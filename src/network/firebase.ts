import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, remove, onDisconnect } from 'firebase/database';

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
  await set(roomRef, { hostPeerId: peerId, status: 'LOBBY', createdAt: now, expiresAt: now + ROOM_TTL_MS });

  // Best-effort cleanup if the Firebase WebSocket detects a disconnect
  onDisconnect(roomRef).remove();
  return true;
};

export const setRoomStatus = async (roomCode: string, status: string): Promise<void> => {
  const statusRef = ref(db, `rooms/${roomCode}/status`);
  await set(statusRef, status);
};

export const getRoomInfo = async (roomCode: string): Promise<{ hostPeerId: string, status: string } | null> => {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return null;

  const data = snapshot.val();

  // Auto-cleanup: remove expired rooms (TTL exceeded)
  if (data.expiresAt && Date.now() > data.expiresAt) {
    await remove(roomRef);
    return null;
  }

  return data;
};

/**
 * Explicitly removes the room from Firebase.
 * Call this when the host intentionally leaves the lobby.
 */
export const removeRoom = async (roomCode: string): Promise<void> => {
  if (!roomCode) return;
  await remove(ref(db, `rooms/${roomCode}`));
};
