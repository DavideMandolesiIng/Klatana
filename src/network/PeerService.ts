import Peer, { type DataConnection } from 'peerjs';
import { registerRoomCode, getRoomInfo, setRoomStatus, removeRoom, cancelRoomAutoRemove, cleanupAllExpiredRooms, updateHostPeerId } from './firebase';
import { debugLogger } from './DebugLogger';

export type NetworkRole = 'host' | 'client' | 'none';

type MessageHandler = (data: any, peerId: string) => void;
type ConnectionHandler = (conn: DataConnection) => void;

export class PeerService {
  private peer: Peer | null = null;
  public peerId: string = '';
  public role: NetworkRole = 'none';
  public roomCode: string = '';
  public gameStatus: 'LOBBY' | 'IN_PROGRESS' = 'LOBBY';
  public isMainGameStarted: boolean = false;
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
      this.isMainGameStarted = false;
      // Snapshot all currently connected peers as valid players
      this.connections.forEach((_v, k) => this.knownPlayers.add(k));
      await setRoomStatus(this.roomCode, 'IN_PROGRESS');
    }
  }

  public async setMainGameStarted() {
    if (this.role === 'host') {
      this.isMainGameStarted = true;
      await cancelRoomAutoRemove(this.roomCode);
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
        
        // Fire and forget global cleanup
        cleanupAllExpiredRooms();
        
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

        // Fallback cleanup: if the tab/window is closed, try to remove the room.
        // This fires synchronously — removeRoom returns a Promise we can't await,
        // but the Firebase SDK will attempt delivery before the page is torn down.
        this._beforeUnloadHandler = () => {
          if (this.role === 'host' && this.gameStatus === 'LOBBY' && this.roomCode) {
            removeRoom(this.roomCode);
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
   * Reconnects to an existing active room as Host.
   */
  public async reconnectAsHost(code: string, savedPeerId?: string): Promise<string> {
    const codeUpper = code.toUpperCase();
    debugLogger.log('HOST', `reconnectAsHost initiated for room ${codeUpper}`, { savedPeerId });
    const roomInfo = await getRoomInfo(codeUpper);
    if (!roomInfo) {
      debugLogger.log('ERROR', `reconnectAsHost failed: room ${codeUpper} not in DB`);
      throw new Error("Room not found in database");
    }
    if (roomInfo.status !== 'IN_PROGRESS') {
      debugLogger.log('ERROR', `reconnectAsHost failed: room status is ${roomInfo.status}`);
      throw new Error("Room is not in progress");
    }

    return new Promise((resolve, reject) => {
      this.peer = savedPeerId ? new Peer(savedPeerId) : new Peer();

      this.peer.on('open', async (id) => {
        this.role = 'host';
        this.peerId = id;
        this.roomCode = codeUpper;
        this.gameStatus = 'IN_PROGRESS';
        localStorage.setItem('klatana_peer_id', id);
        localStorage.setItem('klatana_room_code', codeUpper);

        debugLogger.log('HOST', `Host peer opened successfully with ID ${id}, updating Firebase...`);
        await updateHostPeerId(codeUpper, id);
        resolve(codeUpper);
      });

      this.peer.on('connection', (conn) => {
        debugLogger.log('HOST', `Incoming connection received on reconnected Host from ${conn.peer}`, conn.metadata);
        this.handleNewConnection(conn);
        conn.on('open', () => {
          debugLogger.log('HOST', `Connection opened with client ${conn.peer}`);
          if (this.onPlayerReconnectedCallback) {
            this.onPlayerReconnectedCallback(conn.peer, conn.metadata);
          }
        });
      });

      this.peer.on('error', (err) => {
        debugLogger.log('ERROR', `Host peer error during reconnect`, err);
        reject(err);
      });
    });
  }

  /**
   * Reconnects an existing client to a host's peer ID.
   */
  public async reconnectClientToHost(hostPeerId: string): Promise<boolean> {
    if (!hostPeerId) return false;
    debugLogger.log('CLIENT', `reconnectClientToHost initiated targeting host ${hostPeerId}`);

    const existingConn = this.connections.get(hostPeerId);
    if (existingConn && existingConn.open) {
      debugLogger.log('CLIENT', `Already connected to host ${hostPeerId}`);
      return true;
    }

    return new Promise((resolve, reject) => {
      let isSettled = false;
      const timeoutTimer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          debugLogger.log('CLIENT', `Connection attempt to host ${hostPeerId} timed out after 2.5s`);
          reject(new Error("Connection attempt timed out"));
        }
      }, 2500);

      const doConnect = () => {
        if (!this.peer || this.peer.destroyed) {
          const savedPeerId = localStorage.getItem('klatana_peer_id') || undefined;
          debugLogger.log('CLIENT', `Creating new Peer instance for client reconnect`, { savedPeerId });
          this.peer = savedPeerId ? new Peer(savedPeerId) : new Peer();
          this.peer.on('open', (id) => {
            this.peerId = id;
            this.role = 'client';
            localStorage.setItem('klatana_peer_id', id);
            debugLogger.log('CLIENT', `Client peer open with ID ${id}, connecting to host ${hostPeerId}`);
            const conn = this.peer!.connect(hostPeerId, {
              reliable: true,
              metadata: { playerId: this.playerId, username: this.username }
            });
            conn.on('open', () => {
              if (!isSettled) {
                isSettled = true;
                clearTimeout(timeoutTimer);
                debugLogger.log('CLIENT', `DataConnection to host ${hostPeerId} OPEN!`);
                this.handleNewConnection(conn);
                resolve(true);
              }
            });
            conn.on('error', (err) => {
              if (!isSettled) {
                isSettled = true;
                clearTimeout(timeoutTimer);
                debugLogger.log('ERROR', `Connection error to host ${hostPeerId}`, err);
                reject(err);
              }
            });
          });
          this.peer.on('error', (err) => {
            if (!isSettled) {
              isSettled = true;
              clearTimeout(timeoutTimer);
              debugLogger.log('ERROR', `Client Peer error`, err);
              reject(err);
            }
          });
        } else {
          debugLogger.log('CLIENT', `Using existing client Peer ${this.peerId} to connect to host ${hostPeerId}`);
          const conn = this.peer.connect(hostPeerId, {
            reliable: true,
            metadata: { playerId: this.playerId, username: this.username }
          });
          conn.on('open', () => {
            if (!isSettled) {
              isSettled = true;
              clearTimeout(timeoutTimer);
              debugLogger.log('CLIENT', `DataConnection to host ${hostPeerId} OPEN!`);
              this.handleNewConnection(conn);
              resolve(true);
            }
          });
          conn.on('error', (err) => {
            if (!isSettled) {
              isSettled = true;
              clearTimeout(timeoutTimer);
              debugLogger.log('ERROR', `Connection error to host ${hostPeerId}`, err);
              reject(err);
            }
          });
        }
      };

      doConnect();
    });
  }

  /**
   * Initializes as Client and connects to a Room via code.
   */
  public async joinRoom(code: string, peerIdOverride?: string): Promise<boolean> {
    // Fire and forget global cleanup
    cleanupAllExpiredRooms();

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
    debugLogger.log('PEER', `handleNewConnection added for peer ${conn.peer}`);
    this.connections.set(conn.peer, conn);

    conn.on('data', (data: any) => {
      if (data && data.type === 'CONNECTION_REJECTED') {
        debugLogger.log('ERROR', `Connection rejected by remote peer: ${data.reason}`);
        if (this.onConnectionRejectedCallback) {
          this.onConnectionRejectedCallback(data.reason);
        }
        this.destroy();
        return;
      }
      debugLogger.log('MESSAGE', `Data received from ${conn.peer} [type: ${data?.type}]`);
      if (this.onMessageCallback) {
        this.onMessageCallback(data, conn.peer);
      }
    });

    conn.on('close', () => {
      debugLogger.log('PEER', `Connection CLOSED for peer ${conn.peer}`);
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

  public destroy(_isIntentional: boolean = false) {
    // 1. Remove the beforeunload listener (we're doing explicit cleanup)
    if (this._beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this._beforeUnloadHandler);
      this._beforeUnloadHandler = null;
    }
    // 2. If we're the host, remove the room from Firebase ONLY if in LOBBY or before MAIN_GAME starts.
    //    If MAIN_GAME is running, room persists so host can reconnect.
    if (this.role === 'host' && this.roomCode && (!this.isMainGameStarted || this.gameStatus === 'LOBBY')) {
      removeRoom(this.roomCode).catch(console.error);
    }
    // 3. Tear down PeerJS
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.connections.clear();
    this.role = 'none';
    this.roomCode = '';
    this.isMainGameStarted = false;
  }
}

export const peerService = new PeerService();
