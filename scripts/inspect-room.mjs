/**
 * Script per ispezionare i dettagli di una specifica room in Firebase DB.
 * Esegui con: node scripts/inspect-room.mjs <ROOM_CODE>
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  for (const filename of ['.env.local', '.env']) {
    try {
      const envPath = resolve(process.cwd(), filename);
      const content = readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [key, ...rest] = trimmed.split('=');
        process.env[key.trim()] = rest.join('=').trim();
      }
      console.log(`[Env] Loaded ${filename}`);
      return;
    } catch {
      // try next
    }
  }
}

loadEnv();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const roomCode = process.argv[2] ? process.argv[2].toUpperCase() : null;

if (!roomCode) {
  console.error("Usage: node scripts/inspect-room.mjs <ROOM_CODE>");
  process.exit(1);
}

async function inspectRoom() {
  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);
  const roomRef = ref(db, `rooms/${roomCode}`);

  console.log(`Fetching info for room ${roomCode}...`);
  const snapshot = await get(roomRef);

  if (!snapshot.exists()) {
    console.log(`X Room ${roomCode} DOES NOT EXIST in database.`);
  } else {
    console.log(`V Room ${roomCode} details:`);
    console.log(JSON.stringify(snapshot.val(), null, 2));
  }
  process.exit(0);
}

inspectRoom().catch(console.error);
