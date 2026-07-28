import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, remove, onDisconnect, onValue, off, query, orderByChild, endAt } from 'firebase/database';

const ROOM_TTL_MS = 30 * 60 * 1000; // 30 minutes

// TODO: Replace with your actual Firebase config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

/**
 * Registers a Room Code with a specific Peer ID in Firebase Realtime Database.
 */
export const registerRoomCode = async (roomCode: string, peerId: string): Promise<boolean> => {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);
  if (snapshot.exists()) {
    return false; // Room already exists
  }
  const now = Date.now();
  await set(roomRef, { hostPeerId: peerId, status: 'LOBBY', createdAt: now });

  // Best-effort cleanup if the Firebase WebSocket detects a disconnect.
  // This covers most graceful tab-close scenarios.
  onDisconnect(roomRef).remove();
  return true;
};

export const setRoomStatus = async (roomCode: string, status: string): Promise<void> => {
  const statusRef = ref(db, `rooms/${roomCode}/status`);
  await set(statusRef, status);
};

export const getRoomInfo = async (roomCode: string): Promise<{ hostPeerId: string, status: string, createdAt: number } | null> => {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return null;

  const data = snapshot.val();

  // Auto-cleanup: remove expired rooms (TTL exceeded).
  // This catches rooms that survived all other cleanup mechanisms.
  if (data.createdAt && Date.now() - data.createdAt > ROOM_TTL_MS) {
    await remove(roomRef);
    return null;
  }

  return data;
};

/**
 * Explicitly removes the room from Firebase.
 * Now works because the security rules allow deletion (!newData.exists()).
 */
export const removeRoom = async (roomCode: string): Promise<void> => {
  if (!roomCode) return;
  const roomRef = ref(db, `rooms/${roomCode}`);
  // Cancel any pending onDisconnect so it doesn't fire after we've manually cleaned up
  onDisconnect(roomRef).cancel();
  await remove(roomRef);
};

/**
 * Cancels the onDisconnect auto-removal for a room.
 * Call this when the game starts — we no longer want the room removed on disconnect
 * because players may need to reconnect.
 */
export const cancelRoomAutoRemove = async (roomCode: string): Promise<void> => {
  if (!roomCode) return;
  const roomRef = ref(db, `rooms/${roomCode}`);
  await onDisconnect(roomRef).cancel();
};

/**
 * Sweeps the entire database for expired rooms and deletes them.
 * Uses an indexed query to only fetch old rooms efficiently.
 */
export const cleanupAllExpiredRooms = async (): Promise<void> => {
  try {
    const expiredCutoff = Date.now() - ROOM_TTL_MS;
    const oldRoomsQuery = query(ref(db, 'rooms'), orderByChild('createdAt'), endAt(expiredCutoff));
    const snapshot = await get(oldRoomsQuery);
    
    if (snapshot.exists()) {
      const updates: Promise<void>[] = [];
      snapshot.forEach((childNode) => {
        updates.push(remove(childNode.ref));
      });
      await Promise.all(updates);
      console.log(`[Firebase] Cleaned up ${updates.length} expired zombie rooms.`);
    }
  } catch (err) {
    console.error("[Firebase] Error during global room cleanup:", err);
  }
};

export { onValue, off, ref };
