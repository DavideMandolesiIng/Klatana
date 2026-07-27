/**
 * Script temporaneo per controllare le room attive nel DB Firebase.
 * Esegui con: node scripts/check-db.mjs
 * Richiede le variabili d'ambiente nel .env (o .env.local)
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, remove } from 'firebase/database';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Leggi le env dal file .env.local manualmente
function loadEnv() {
  // Try .env.local first, then fall back to .env
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
      console.log(`✅ ${filename} caricato\n`);
      return;
    } catch {
      // try next file
    }
  }
  console.warn('⚠️  Nessun file .env trovato, uso variabili d\'ambiente di sistema\n');
}

loadEnv();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function listRooms() {
  console.log('Recupero tutte le room da Firebase...\n');
  const roomsRef = ref(db, 'rooms');
  const snapshot = await get(roomsRef);

  if (!snapshot.exists()) {
    console.log('Nessuna room presente nel DB. Tutto pulito!');
    process.exit(0);
  }

  const rooms = snapshot.val();
  const entries = Object.entries(rooms);

  console.log(`Trovate ${entries.length} room(s):\n`);
  const now = Date.now();

  for (const [code, data] of entries) {
    const age = data.createdAt ? Math.round((now - data.createdAt) / 1000 / 60) : '?';
    console.log(`  Room: ${code}`);
    console.log(`    Status:    ${data.status ?? 'N/A'}`);
    console.log(`    Host ID:   ${data.hostPeerId ?? 'N/A'}`);
    console.log(`    Età:       ~${age} minuti fa`);
    console.log();
  }

  // Chiedi se eliminare le room vecchie (> 60 minuti)
  const stale = entries.filter(([, data]) => {
    if (!data.createdAt) return false;
    return (now - data.createdAt) > 60 * 60 * 1000;
  });

  if (stale.length > 0) {
    console.log(` ${stale.length} room(s) sono più vecchie di 60 minuti:`);
    for (const [code] of stale) console.log(`   - ${code}`);
    console.log('\nPer eliminarle, imposta la variabile DELETE_STALE=1 e riesegui lo script.');
    console.log('Esempio: $env:DELETE_STALE=1; node scripts/check-db.mjs\n');

    if (process.env.DELETE_STALE === '1') {
      console.log('🗑️  Eliminazione in corso...');
      for (const [code] of stale) {
        await remove(ref(db, `rooms/${code}`));
        console.log(`   Eliminata: ${code}`);
      }
    }
  } else {
    console.log('Nessuna room "appesa" trovata (tutte < 60 min).');
  }

  process.exit(0);
}

listRooms().catch(err => {
  console.error('Errore:', err.message);
  process.exit(1);
});
