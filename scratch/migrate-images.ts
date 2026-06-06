import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { firebaseConfig } from '../firebase-config-static';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const FALLBACK_IMAGE_BANK: Record<string, string[]> = {
  gadgets: [
    "https://images.unsplash.com/photo-1546054471-190c10847711?auto=format&fit=crop&q=80&w=600",
    "https://images.unsplash.com/photo-1572561357382-95d271950998?auto=format&fit=crop&q=80&w=600",
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=600"
  ],
  pc: [
    "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=600",
    "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=600",
    "https://images.unsplash.com/photo-1563206767-5b18f218e8de?auto=format&fit=crop&q=80&w=600"
  ],
  kitchen: [
    "https://images.unsplash.com/photo-1584269603463-35149fa7e826?auto=format&fit=crop&q=80&w=600",
    "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&q=80&w=600",
    "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=600"
  ],
  beauty: [
    "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=600",
    "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&q=80&w=600",
    "https://images.unsplash.com/photo-1608248597481-496100c80836?auto=format&fit=crop&q=80&w=600"
  ],
  fashion: [
    "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=600",
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600",
    "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=600"
  ],
  'books-games': [
    "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600",
    "https://images.unsplash.com/photo-1486572788966-cfd3df1f5b42?auto=format&fit=crop&q=80&w=600",
    "https://images.unsplash.com/photo-1612287230202-1bf1d85d1bdf?auto=format&fit=crop&q=80&w=600"
  ]
};

function selectProductMockImage(cat: string, namePrompt: string): string {
  const images = FALLBACK_IMAGE_BANK[cat] || FALLBACK_IMAGE_BANK["gadgets"];
  const index = Math.abs(namePrompt.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % images.length;
  return images[index];
}

async function migrateImages() {
  console.log("Starting image migration script...");
  
  const articlesSnap = await getDocs(collection(db, 'articles'));
  console.log(`Found ${articlesSnap.size} articles to process.`);
  
  let migratedCount = 0;
  for (const articleDoc of articlesSnap.docs) {
    const data = articleDoc.data();
    const asin = data.asin;
    const cat = data.category || 'gadgets';
    const title = data.title || 'product';
    const imageUrl = data.imageUrl || '';
    
    if (imageUrl.includes('amazon-adsystem.com') || !imageUrl) {
      const fallbackUrl = selectProductMockImage(cat, asin || title);
      console.log(`Migrating article ${articleDoc.id} (${title}): ${imageUrl} -> ${fallbackUrl}`);
      await updateDoc(doc(db, 'articles', articleDoc.id), {
        imageUrl: fallbackUrl
      });
      migratedCount++;
    } else {
      console.log(`Article ${articleDoc.id} (${title}) has a valid image URL: ${imageUrl}`);
    }
  }
  
  console.log(`Migration complete. Migrated ${migratedCount} articles.`);
}

migrateImages().catch(console.error);
