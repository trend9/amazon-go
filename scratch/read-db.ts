import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query, orderBy } from 'firebase/firestore';
import { firebaseConfig } from '../firebase-config-static';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkDb() {
  console.log("Checking Firestore database...");
  
  const stockSnap = await getDocs(collection(db, 'stock_products'));
  console.log(`stock_products count: ${stockSnap.size}`);
  stockSnap.forEach(doc => {
    console.log(`- [Stock] ${doc.id}: ${doc.data().name}`);
  });

  const articlesSnap = await getDocs(collection(db, 'articles'));
  console.log(`articles count: ${articlesSnap.size}`);
  articlesSnap.forEach(doc => {
    console.log(`- [Article] ${doc.id}: ${doc.data().title} (${doc.data().asin || 'No ASIN'})`);
  });

  console.log("Fetching latest 10 logs...");
  const logsQuery = query(collection(db, 'system_logs'), orderBy('createdAt', 'desc'), limit(10));
  const logsSnap = await getDocs(logsQuery);
  logsSnap.forEach(doc => {
    const d = doc.data();
    console.log(`[${d.timestamp || ''}] [${d.type || ''}] ${d.message}`);
  });
}

checkDb().catch(console.error);
