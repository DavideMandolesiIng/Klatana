import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, remove, onDisconnect } from 'firebase/database';

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
  await set(roomRef, { hostPeerId: peerId, createdAt: Date.now() });
  
  // Cleanup if host disconnects from Firebase
  onDisconnect(roomRef).remove();
  return true;
};

/**
 * Retrieves the Host Peer ID for a given Room Code.
 */
export const getHostPeerId = async (roomCode: string): Promise<string | null> => {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);
  if (snapshot.exists()) {
    return snapshot.val().hostPeerId;
  }
  return null;
};
