import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { firebaseConfig } from '../firebase-config-static';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Copy of MASTER_PRODUCT_POOL mapping ASIN to clean name
const MASTER_PRODUCT_POOL: Record<string, { asin: string; name: string }[]> = {
  gadgets: [
    { asin: "B09Y2MYLMC", name: "Sony WH-1000XM5 ノイズキャンセリングヘッドホン" },
    { asin: "B0CH191KNC", name: "Bose QuietComfort Ultra ワイヤレスヘッドホン" },
    { asin: "B0BVB5LBDD", name: "JBL TOUR PRO 2 完全ワイヤレスイヤホン" },
    { asin: "B09Y5C27F7", name: "Sony LinkBuds S ノイキャンイヤホン" },
    { asin: "B0B5G82F58", name: "Anker Soundcore Space Q45" },
    { asin: "B0CG1TNYR3", name: "DJI Osmo Pocket 3 ハンドヘルドカメラ" },
    { asin: "B0D3J5VNDG", name: "Apple iPad Air 11インチ M2" },
    { asin: "B0BG5B5Q95", name: "Anker Soundcore Liberty 4 イヤホン" },
    { asin: "B09M2P5978", name: "Shokz OpenRun Pro 骨伝導イヤホン" }
  ],
  pc: [
    { asin: "B082TTR5C1", name: "HHKB Professional HYBRID Type-S キーボード" },
    { asin: "B0B1D4Y7S3", name: "Logicool MX Master 3S 高機能マウス" },
    { asin: "B0BMQ24C1B", name: "Samsung 990 PRO 2TB M.2 SSD" },
    { asin: "B0C5HVYCDT", name: "Anker Prime Wall Charger 100W 充電器" },
    { asin: "B0BYMJWCSK", name: "LG UltraGear 27インチ ゲーミングモニター" },
    { asin: "B09TDFM7J8", name: "Dell U2723QE 27インチ 4K モニター" },
    { asin: "B0CGDCL14L", name: "Logicool G PRO X SUPERLIGHT 2 マウス" },
    { asin: "B0BD5Q5L62", name: "SteelSeries Apex Pro TKL キーボード" },
    { asin: "B09738CV2G", name: "Elgato Stream Deck MK.2 ショートカットコントローラー" }
  ],
  kitchen: [
    { asin: "B09C15CR9P", name: "シャープ ヘルシオ ホットクック KN-HW24G" },
    { asin: "B08FPCSBFR", name: "バルミューダ The Toaster スチームトースター" },
    { asin: "B008ZZFCAI", name: "デロンギ マグニフィカS 全自動コーヒーマシン" },
    { asin: "B07JH8XQJ2", name: "シロカ コーン式全自動コーヒーメーカー" },
    { asin: "B085VNDM5H", name: "アイリスオーヤマ 電気圧力鍋 4.0L" },
    { asin: "B09NSN7B8H", name: "ソーダストリーム Terra 炭酸水メーカー" },
    { asin: "B0761HM28B", name: "ティファール クックフォーミー エキスパート" },
    { asin: "B07HQCHZ3B", name: "アラジン グラファイト トースター 4枚焼き" }
  ],
  beauty: [
    { asin: "B0B7H8MC5M", name: "パナソニック ヘアドライヤー ナノケア" },
    { asin: "B0B824BKB7", name: "リファ ビューテック ドライヤープロ" },
    { asin: "B08KH6C7F1", name: "ヤーマン フォトシャイン スチーマー" },
    { asin: "B09M8FLRPQ", name: "ブラウン シルクエキスパート Pro5 光美容器" },
    { asin: "B0182C317U", name: "ReFa CARAT RAY プラチナローラー" },
    { asin: "B08K7G5T5N", name: "SALONIA サロニア スピーディーイオンドライヤー" },
    { asin: "B09H2S5N6G", name: "Dyson Supersonic Ionic ヘアドライヤー" },
    { asin: "B0B4DBP2S9", name: "パナソニック バイタリフト かっさ 美顔器" }
  ],
  fashion: [
    { asin: "B0B5F4KV4B", name: "アークテリクス マンティス 26 バックパック" },
    { asin: "B07PBFYL36", name: "パタゴニア ブラックホール パック 32L" },
    { asin: "B07MGB563Q", name: "ザ・ノース・フェイス シングルショット リュック" },
    { asin: "B000GLNQRE", name: "ビルケンシュトック アリゾナ サンダル" },
    { asin: "B07MLYV64R", name: "ニューバランス 996 スニーカー" },
    { asin: "B083M12D8J", name: "パタゴニア トレントシェル 3L ジャケット" },
    { asin: "B07MGB26V1", name: "ザ・ノース・フェイス マウンテンライトジャケット" },
    { asin: "B00M0N4K5I", name: "グレゴリー デイパック リュック" }
  ],
  "books-games": [
    { asin: "B0DGWYDRM4", name: "モンスターハンターワイルズ - PS5" },
    { asin: "B0BVMNV15D", name: "ゼルダの伝説 ティアーズ オブ ザ キングダム - Switch" },
    { asin: "B0B68WNDR9", name: "ペルソナ5 ザ・ロイヤル - Switch/PS5" },
    { asin: "B09H2S5N6G", name: "エルデンリング ELDEN RING - PS5" },
    { asin: "B08752KBG4", name: "世界のアソビ大全51 - Switch" },
    { asin: "B0C9J6MWRY", name: "スーパーマリオブラザーズ ワンダー - Switch" },
    { asin: "B0C9J9K4CR", name: "桃太郎電鉄ワールド 昭和 平成 令和も定番！ - Switch" },
    { asin: "B06XZ1178K", name: "マリオカート8 デラックス - Switch" }
  ]
};

// Flatten pool for easy lookup
const asinToNameMap: Record<string, string> = {};
for (const cat of Object.keys(MASTER_PRODUCT_POOL)) {
  for (const item of MASTER_PRODUCT_POOL[cat]) {
    asinToNameMap[item.asin.toUpperCase()] = item.name;
  }
}

async function migrate() {
  console.log("Starting Firestore articles links migration...");
  
  const articlesCol = collection(db, 'articles');
  const snap = await getDocs(articlesCol);
  
  console.log(`Found ${snap.size} articles to inspect.`);
  
  let migratedCount = 0;
  
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const currentLink = data.affiliateLink || "";
    const asin = (data.asin || "").toUpperCase();
    
    if (asin === "B0D2XBV7FZ" || asin === "B09Y2MYLMC" || currentLink.includes("amzn.to")) {
      console.log(`Skipping Sony headphones/shortlink migration for [${docSnap.id}]: "${data.title}"`);
      continue;
    }
    
    // Check if the link is a direct /dp/ ASIN link
    if (currentLink.includes('/dp/') || !currentLink.includes('/s?k=')) {
      console.log(`Migrating article [${docSnap.id}]: "${data.title}"`);
      
      // Look up clean product name
      let searchKeyword = "";
      if (asin && asinToNameMap[asin]) {
        searchKeyword = asinToNameMap[asin];
        console.log(`- Matched ASIN ${asin} to product name: "${searchKeyword}"`);
      } else {
        // Fallback: strip title prefix to get a search query
        searchKeyword = data.title
          .replace(/【徹底レビュー】/g, '')
          .replace(/【最新実機レビュー】/g, '')
          .replace(/を徹底検証/g, '')
          .replace(/の魅力を徹底解剖/g, '')
          .replace(/が選ばれる理由究明！/g, '')
          .trim();
        console.log(`- No ASIN match. Using fallback search keyword: "${searchKeyword}"`);
      }
      
      const associateId = currentLink.match(/tag=([^&]+)/)?.[1] || "mattan0290c-22";
      const newAffiliateLink = `https://www.amazon.co.jp/s?k=${encodeURIComponent(searchKeyword)}&tag=${associateId}`;
      const newOriginalUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(searchKeyword)}`;
      
      await updateDoc(doc(db, 'articles', docSnap.id), {
        affiliateLink: newAffiliateLink,
        originalUrl: newOriginalUrl,
        cronSecret: "mattan029-cron-bypass"
      });
      
      console.log(`- Successfully updated affiliateLink to: ${newAffiliateLink}`);
      migratedCount++;
    }
  }
  
  console.log(`Migration completed. Migrated ${migratedCount} articles.`);
}

migrate().catch(console.error);
