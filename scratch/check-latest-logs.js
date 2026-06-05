import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkLogs() {
  try {
    const logsCol = collection(db, 'system_logs');
    const q = query(logsCol, orderBy('createdAt', 'desc'), limit(15));
    const snap = await getDocs(q);
    
    console.log('--- Firestore Latest System Logs ---');
    snap.forEach(d => {
      const data = d.data();
      console.log(`[${data.timestamp}] [${data.type.toUpperCase()}] ${data.message}`);
    });
    console.log('------------------------------------');
  } catch (err) {
    console.error('Error fetching logs:', err.message || err);
  }
}

checkLogs();
