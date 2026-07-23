import Peer, { type DataConnection } from 'peerjs';
import { registerRoomCode, getRoomInfo, setRoomStatus, removeRoom } from './firebase';

export type NetworkRole = 'host' | 'client' | 'none';

type MessageHandler = (data: any, peerId: string) => void;
type ConnectionHandler = (conn: DataConnection) => void;

export class PeerService {
  private peer: Peer | null = null;
  public peerId: string = '';
  public role: NetworkRole = 'none';
  public roomCode: string = '';
  public gameStatus: 'LOBBY' | 'IN_PROGRESS' = 'LOBBY';
  public knownPlayers: Set<string> = new Set();
  public playerId: string = '';
  public username: string = '';
  private _beforeUnloadHandler: (() => void) | null = null;
  
  // Connections (for Host: multiple clients. For Client: only the host)
  private connections: Map<string, DataConnection> = new Map();

  private onMessageCallback: MessageHandler | null = null;
  private onConnectionCallback: ConnectionHandler | null = null;
  private onDisconnectCallback: ((peerId: string) => void) | null = null;
  private onConnectionRejectedCallback: ((reason: string) => void) | null = null;
  private onPlayerReconnectedCallback: ((peerId: string, metadata: any) => void) | null = null;

  constructor() {}

  public onMessage(callback: MessageHandler) {
    this.onMessageCallback = callback;
  }

  public onConnection(callback: ConnectionHandler) {
    this.onConnectionCallback = callback;
  }

  public onPeerDisconnect(callback: (peerId: string) => void) {
    this.onDisconnectCallback = callback;
  }

  public onConnectionRejected(callback: (reason: string) => void) {
    this.onConnectionRejectedCallback = callback;
  }

  public onPlayerReconnected(callback: (peerId: string, metadata: any) => void) {
    this.onPlayerReconnectedCallback = callback;
  }

  public async setGameStarted() {
    if (this.role === 'host') {
      this.gameStatus = 'IN_PROGRESS';
      // Snapshot all currently connected peers as valid players
      this.connections.forEach((_v, k) => this.knownPlayers.add(k));
      await setRoomStatus(this.roomCode, 'IN_PROGRESS');
      // Game is running: stop watching for lobby-cleanup on unload
      if (this._beforeUnloadHandler) {
        window.removeEventListener('beforeunload', this._beforeUnloadHandler);
        this._beforeUnloadHandler = null;
      }
    }
  }

  /**
   * Initializes as Host, generates a 4-letter room code, and registers it.
   */
  public async createRoom(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.peer = new Peer();

      this.peer.on('open', async (id) => {
        this.role = 'host';
        this.peerId = id;
        
        // Generate random 4-letter code
        let code = '';
        let registered = false;
        while (!registered) {
          code = Math.random().toString(36).substring(2, 6).toUpperCase();
          registered = await registerRoomCode(code, id);
        }

        this.roomCode = code;
        localStorage.setItem('klatana_peer_id', id);
        localStorage.setItem('klatana_room_code', code);

        // Best-effort: remove room from Firebase when host closes the tab/window.
        // fetch with keepalive:true survives beforeunload in all modern browsers.
        // This is a fallback for when onDisconnect() doesn't fire (browser killed).
        this._beforeUnloadHandler = () => {
          if (this.role === 'host' && this.gameStatus === 'LOBBY' && this.roomCode) {
            const dbUrl = import.meta.env.VITE_FIREBASE_DATABASE_URL.replace(/\/$/, '');
            fetch(`${dbUrl}/rooms/${this.roomCode}.json`, {
              method: 'DELETE',
              keepalive: true,
            });
          }
        };
        window.addEventListener('beforeunload', this._beforeUnloadHandler);

        resolve(code);
      });

      this.peer.on('connection', (conn) => {
        if (this.gameStatus === 'IN_PROGRESS') {
          // Reconnecting player (GameScreen will validate against disconnectedPlayers)
          this.handleNewConnection(conn);
          conn.on('open', () => {
             if (this.onPlayerReconnectedCallback) {
                this.onPlayerReconnectedCallback(conn.peer, conn.metadata);
             }
          });
          return;
        }
        
        // Normal lobby join
        this.handleNewConnection(conn);
      });

      this.peer.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Initializes as Client and connects to a Room via code.
   */
  public async joinRoom(code: string, peerIdOverride?: string): Promise<boolean> {
    const codeUpper = code.toUpperCase();
    const roomInfo = await getRoomInfo(codeUpper);
    if (!roomInfo) {
      throw new Error("Room not found");
    }

    return new Promise((resolve, reject) => {
      this.peer = peerIdOverride ? new Peer(peerIdOverride) : new Peer();

      this.peer.on('open', (id) => {
        this.role = 'client';
        this.peerId = id;
        this.roomCode = codeUpper;
        localStorage.setItem('klatana_peer_id', id);
        localStorage.setItem('klatana_room_code', codeUpper);
        
        const conn = this.peer!.connect(roomInfo.hostPeerId, { 
           reliable: true,
           metadata: { playerId: this.playerId, username: this.username }
        });
        
        conn.on('open', () => {
          this.handleNewConnection(conn);
          resolve(true);
        });

        conn.on('error', (err) => {
          reject(err);
        });
      });

      this.peer.on('error', (err) => {
        reject(err);
      });
    });
  }

  private handleNewConnection(conn: DataConnection) {
    this.connections.set(conn.peer, conn);

    conn.on('data', (data: any) => {
      if (data && data.type === 'CONNECTION_REJECTED') {
        if (this.onConnectionRejectedCallback) {
          this.onConnectionRejectedCallback(data.reason);
        }
        this.destroy();
        return;
      }
      if (this.onMessageCallback) {
        this.onMessageCallback(data, conn.peer);
      }
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      if (this.onDisconnectCallback) {
        this.onDisconnectCallback(conn.peer);
      }
    });

    if (this.onConnectionCallback) {
      this.onConnectionCallback(conn);
    }
  }

  public broadcast(data: any) {
    this.connections.forEach(conn => {
      conn.send(data);
    });
  }

  public sendTo(peerId: string, data: any) {
    const conn = this.connections.get(peerId);
    if (conn) {
      conn.send(data);
    }
  }

  public getConnectedPeers(): string[] {
    return Array.from(this.connections.keys());
  }

  public rejectConnection(peerId: string, reason: string) {
    const conn = this.connections.get(peerId);
    if (conn) {
       conn.send({ type: 'CONNECTION_REJECTED', reason });
       setTimeout(() => conn.close(), 500);
       this.connections.delete(peerId);
    }
  }

  public destroy() {
    if (this._beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this._beforeUnloadHandler);
      this._beforeUnloadHandler = null;
    }
    // Explicitly remove the Firebase room if host leaves the lobby cleanly
    if (this.role === 'host' && this.gameStatus === 'LOBBY' && this.roomCode) {
      removeRoom(this.roomCode);
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.connections.clear();
    this.role = 'none';
    this.roomCode = '';
  }
}

export const peerService = new PeerService();
