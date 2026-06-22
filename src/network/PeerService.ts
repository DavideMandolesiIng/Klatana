import Peer, { type DataConnection } from 'peerjs';
import { registerRoomCode, getHostPeerId } from './firebase';

export type NetworkRole = 'host' | 'client' | 'none';

type MessageHandler = (data: any, peerId: string) => void;
type ConnectionHandler = (conn: DataConnection) => void;

export class PeerService {
  private peer: Peer | null = null;
  public role: NetworkRole = 'none';
  public roomCode: string = '';
  
  // Connections (for Host: multiple clients. For Client: only the host)
  private connections: Map<string, DataConnection> = new Map();

  private onMessageCallback: MessageHandler | null = null;
  private onConnectionCallback: ConnectionHandler | null = null;
  private onDisconnectCallback: ((peerId: string) => void) | null = null;

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

  /**
   * Initializes as Host, generates a 4-letter room code, and registers it.
   */
  public async createRoom(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.peer = new Peer();

      this.peer.on('open', async (id) => {
        this.role = 'host';
        
        // Generate random 4-letter code
        let code = '';
        let registered = false;
        while (!registered) {
          code = Math.random().toString(36).substring(2, 6).toUpperCase();
          registered = await registerRoomCode(code, id);
        }

        this.roomCode = code;
        resolve(code);
      });

      this.peer.on('connection', (conn) => {
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
  public async joinRoom(code: string): Promise<boolean> {
    const codeUpper = code.toUpperCase();
    const hostPeerId = await getHostPeerId(codeUpper);
    if (!hostPeerId) {
      throw new Error("Room not found");
    }

    return new Promise((resolve, reject) => {
      this.peer = new Peer();

      this.peer.on('open', () => {
        this.role = 'client';
        this.roomCode = codeUpper;
        
        const conn = this.peer!.connect(hostPeerId, { reliable: true });
        
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

    conn.on('data', (data) => {
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

  public destroy() {
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
