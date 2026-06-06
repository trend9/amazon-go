import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { firebaseConfig } from '../firebase-config-static';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateImages() {
  console.log("Starting image migration script...");
  
  const articlesSnap = await getDocs(collection(db, 'articles'));
  console.log(`Found ${articlesSnap.size} articles to process.`);
  
  let migratedCount = 0;
  for (const articleDoc of articlesSnap.docs) {
    const data = articleDoc.data();
    const asin = data.asin;
    
    if (!asin || asin === 'Search') {
      console.log(`Skipping article ${articleDoc.id} due to missing or invalid ASIN.`);
      continue;
    }
    
    const amazonImgUrl = `https://ws-fe.amazon-adsystem.com/widgets/q?_encoding=UTF8&Format=_SL600_&ASIN=${asin}&MarketPlace=JP&ID=AsinImage&WS=1&ServiceVersion=20070822`;
    
    if (data.imageUrl !== amazonImgUrl) {
      console.log(`Migrating article ${articleDoc.id} (${data.title}): ${data.imageUrl} -> ${amazonImgUrl}`);
      await updateDoc(doc(db, 'articles', articleDoc.id), {
        imageUrl: amazonImgUrl
      });
      migratedCount++;
    } else {
      console.log(`Article ${articleDoc.id} is already migrated.`);
    }
  }
  
  console.log(`Migration complete. Migrated ${migratedCount} articles.`);
}

migrateImages().catch(console.error);
