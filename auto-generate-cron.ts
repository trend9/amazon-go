import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Read firebase config
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Gemini
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
} else {
  console.error("Error: GEMINI_API_KEY is not set.");
  process.exit(1);
}

// 50+ Real Japan Product Pool by Category
const MASTER_PRODUCT_POOL: Record<string, { name: string; keyword: string; price: string; img: string }[]> = {
  gadgets: [
    { name: "Sony WH-1000XM5 ノイズキャンセリングヘッドホン", keyword: "Sony WH-1000XM5", price: "¥48,500", img: "https://picsum.photos/seed/sonywh1000xm5/400/300" },
    { name: "Bose QuietComfort Ultra ワイヤレスヘッドホン", keyword: "Bose QuietComfort Ultra", price: "¥53,900", img: "https://picsum.photos/seed/boseqc/400/300" },
    { name: "JBL TOUR PRO 2 完全ワイヤレスイヤホン", keyword: "JBL TOUR PRO 2", price: "¥29,700", img: "https://picsum.photos/seed/jbltour/400/300" },
    { name: "Sony LinkBuds S ノイキャンイヤホン", keyword: "Sony LinkBuds S", price: "¥21,800", img: "https://picsum.photos/seed/sonylink/400/300" },
    { name: "Anker Soundcore Space Q45", keyword: "Anker Space Q45", price: "¥14,990", img: "https://picsum.photos/seed/ankerspace/400/300" },
    { name: "DJI Osmo Pocket 3 ハンドヘルドカメラ", keyword: "DJI Osmo Pocket 3", price: "¥74,800", img: "https://picsum.photos/seed/djiosmo/400/300" },
    { name: "Apple iPad Air 11インチ M2", keyword: "iPad Air M2", price: "¥98,800", img: "https://picsum.photos/seed/ipadairm2/400/300" },
    { name: "Anker Soundcore Liberty 4 イヤホン", keyword: "Anker Liberty 4", price: "¥14,990", img: "https://picsum.photos/seed/ankerliberty/400/300" },
    { name: "Shokz OpenRun Pro 骨伝導イヤホン", keyword: "Shokz OpenRun Pro", price: "¥23,880", img: "https://picsum.photos/seed/shokzopen/400/300" }
  ],
  pc: [
    { name: "HHKB Professional HYBRID Type-S キーボード", keyword: "HHKB Professional HYBRID Type-S", price: "¥36,850", img: "https://picsum.photos/seed/hhkbd/400/300" },
    { name: "Logicool MX Master 3S 高機能マウス", keyword: "Logicool MX Master 3S", price: "¥16,800", img: "https://picsum.photos/seed/mxmaster/400/300" },
    { name: "Samsung 990 PRO 2TB M.2 SSD", keyword: "Samsung 990 PRO", price: "¥28,980", img: "https://picsum.photos/seed/samssd/400/300" },
    { name: "Anker Prime Wall Charger 100W 充電器", keyword: "Anker Prime Charger", price: "¥9,990", img: "https://picsum.photos/seed/ankercharger/400/300" },
    { name: "LG UltraGear 27インチ ゲーミングモニター", keyword: "LG UltraGear", price: "¥34,800", img: "https://picsum.photos/seed/lgmonitor/400/300" },
    { name: "Dell U2723QE 27インチ 4K モニター", keyword: "Dell U2723QE", price: "¥62,800", img: "https://picsum.photos/seed/dell4k/400/300" },
    { name: "Logicool G PRO X SUPERLIGHT 2 マウス", keyword: "G PRO X SUPERLIGHT 2", price: "¥22,800", img: "https://picsum.photos/seed/gprosuper/400/300" },
    { name: "SteelSeries Apex Pro TKL キーボード", keyword: "SteelSeries Apex Pro TKL", price: "¥32,980", img: "https://picsum.photos/seed/apexpro/400/300" },
    { name: "Elgato Stream Deck MK.2 ショートカットコントローラー", keyword: "Stream Deck MK.2", price: "¥22,980", img: "https://picsum.photos/seed/streamdeck/400/300" }
  ],
  kitchen: [
    { name: "シャープ ヘルシオ ホットクック KN-HW24G", keyword: "ホットクック KN-HW24G", price: "¥58,000", img: "https://picsum.photos/seed/hotcook/400/300" },
    { name: "バルミューダ The Toaster スチームトースター", keyword: "バルミューダ トースター", price: "¥27,900", img: "https://picsum.photos/seed/baltoaster/400/300" },
    { name: "デロンギ マグニフィカS 全自動コーヒーマシン", keyword: "デロンギ マグニフィカS", price: "¥68,000", img: "https://picsum.photos/seed/delonghi/400/300" },
    { name: "シロカ コーン式全自動コーヒーメーカー", keyword: "シロカ コーヒーメーカー", price: "¥23,800", img: "https://picsum.photos/seed/siroca/400/300" },
    { name: "アイリスオーヤマ 電気圧力鍋 4.0L", keyword: "アイリスオーヤマ 電気圧力鍋", price: "¥16,800", img: "https://picsum.photos/seed/irispressure/400/300" },
    { name: "ソーダストリーム Terra 炭酸水メーカー", keyword: "ソーダストリーム Terra", price: "¥15,400", img: "https://picsum.photos/seed/sodastream/400/300" },
    { name: "ティファール クックフォーミー エキスパート", keyword: "クックフォーミー", price: "¥29,800", img: "https://picsum.photos/seed/tfalcook/400/300" },
    { name: "アラジン グラファイト トースター 4枚焼き", keyword: "アラジン トースター", price: "¥22,000", img: "https://picsum.photos/seed/aladdintoaster/400/300" }
  ],
  beauty: [
    { name: "パナソニック ヘアドライヤー ナノケア", keyword: "ナノケア ドライヤー", price: "¥38,000", img: "https://picsum.photos/seed/nanocare/400/300" },
    { name: "リファ ビューテック ドライヤープロ", keyword: "リファ ドライヤー プロ", price: "¥43,000", img: "https://picsum.photos/seed/refadryer/400/300" },
    { name: "ヤーマン フォトシャイン スチーマー", keyword: "ヤーマン フォトシャイン", price: "¥49,500", img: "https://picsum.photos/seed/yamansteamer/400/300" },
    { name: "ブラウン シルクエキスパート Pro5 光美容器", keyword: "ブラウン シルクエキスパート", price: "¥59,800", img: "https://picsum.photos/seed/braunsilk/400/300" },
    { name: "ReFa CARAT RAY プラチナローラー", keyword: "ReFa CARAT RAY", price: "¥26,800", img: "https://picsum.photos/seed/refacarat/400/300" },
    { name: "SALONIA サロニア スピーディーイオンドライヤー", keyword: "サロニア ドライヤー", price: "¥5,918", img: "https://picsum.photos/seed/salonia/400/300" },
    { name: "Dyson Supersonic Ionic ヘアドライヤー", keyword: "ダイソン ドライヤー", price: "¥45,760", img: "https://picsum.photos/seed/dysondryer/400/300" },
    { name: "パナソニック バイタリフト かっさ 美顔器", keyword: "バイタリフト かっさ", price: "¥33,660", img: "https://picsum.photos/seed/vitalift/400/300" }
  ],
  fashion: [
    { name: "アークテリクス マンティス 26 バックパック", keyword: "アークテリクス マンティス 26", price: "¥22,000", img: "https://picsum.photos/seed/arcteryx/400/300" },
    { name: "パタゴニア ブラックホール パック 32L", keyword: "パタゴニア ブラックホール 32L", price: "¥24,200", img: "https://picsum.photos/seed/patagonia/400/300" },
    { name: "ザ・ノース・フェイス シングルショット リュック", keyword: "ノースフェイス シングルショット", price: "¥16,500", img: "https://picsum.photos/seed/northface/400/300" },
    { name: "ビルケンシュトック アリゾナ サンダル", keyword: "ビルケンシュトック アリゾナ", price: "¥12,100", img: "https://picsum.photos/seed/birkenstock/400/300" },
    { name: "ニューバランス 996 スニーカー", keyword: "ニューバランス 996", price: "¥16,280", img: "https://picsum.photos/seed/newbalance996/400/300" },
    { name: "パタゴニア トレントシェル 3L ジャケット", keyword: "パタゴニア トレントシェル", price: "¥22,000", img: "https://picsum.photos/seed/torrentshell/400/300" },
    { name: "ザ・ノース・フェイス マウンテンライトジャケット", keyword: "マウンテンライトジャケット", price: "¥41,800", img: "https://picsum.photos/seed/mountainlight/400/300" },
    { name: "グレゴリー デイパック リュック", keyword: "グレゴリー デイパック", price: "¥24,200", img: "https://picsum.photos/seed/gregory/400/300" }
  ],
  "books-games": [
    { name: "モンスターハンターワイルズ - PS5", keyword: "モンスターハンターワイルズ", price: "¥9,900", img: "https://picsum.photos/seed/mhwilds/400/300" },
    { name: "ゼルダの伝説 ティアーズ オブ ザ キングダム - Switch", keyword: "ゼルダの伝説 ティアーズ", price: "¥7,920", img: "https://picsum.photos/seed/zelda/400/300" },
    { name: "ペルソナ5 ザ・ロイヤル - Switch/PS5", keyword: "ペルソナ5 ロイヤル", price: "¥7,678", img: "https://picsum.photos/seed/persona/400/300" },
    { name: "エルデンリング ELDEN RING - PS5", keyword: "エルデンリング", price: "¥9,240", img: "https://picsum.photos/seed/elden/400/300" },
    { name: "世界のアソビ大全51 - Switch", keyword: "世界のアソビ大全51", price: "¥4,378", img: "https://picsum.photos/seed/asobi51/400/300" },
    { name: "スーパーマリオブラザーズ ワンダー - Switch", keyword: "マリオ ワンダー", price: "¥6,578", img: "https://picsum.photos/seed/mariowonder/400/300" },
    { name: "桃太郎電鉄ワールド 昭和 平成 令和も定番！ - Switch", keyword: "桃太郎電鉄ワールド", price: "¥6,930", img: "https://picsum.photos/seed/momotetsu/400/300" },
    { name: "マリオカート8 デラックス - Switch", keyword: "マリオカート8 デラックス", price: "¥6,578", img: "https://picsum.photos/seed/mariokart8/400/300" }
  ]
};

/**
 * Helper to fetch LWA Access Token for Amazon Creators API.
 */
async function getLwaAccessToken(): Promise<string | null> {
  const clientId = process.env.AMAZON_CLIENT_ID;
  const clientSecret = process.env.AMAZON_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  try {
    const response = await fetch("https://api.amazon.com/auth/o2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "amazon:creator:api"
      })
    });

    if (!response.ok) {
      return null;
    }

    const data: any = await response.json();
    return data.access_token || null;
  } catch (err) {
    return null;
  }
}

async function run() {
  console.log("Starting automated review stock & auto-generation pipeline...");

  try {
    const tag = process.env.AMAZON_ASSOCIATE_ID || "mattan0290c-22";

    // 1. Fetch current stock products and already generated articles from Firestore
    const stockCol = collection(db, 'stock_products');
    const articlesCol = collection(db, 'articles');

    const stockSnap = await getDocs(stockCol);
    const articlesSnap = await getDocs(articlesCol);

    const existingAsinsAndKeywords = new Set<string>();
    stockSnap.forEach(d => {
      existingAsinsAndKeywords.add(d.id.toLowerCase());
      existingAsinsAndKeywords.add((d.data().name || "").toLowerCase());
    });
    articlesSnap.forEach(d => {
      existingAsinsAndKeywords.add(d.id.toLowerCase());
      existingAsinsAndKeywords.add((d.data().title || "").toLowerCase());
      if (d.data().asin) existingAsinsAndKeywords.add(d.data().asin.toLowerCase());
    });

    console.log(`Current stock size: ${stockSnap.size}. Articles size: ${articlesSnap.size}.`);

    // 2. Refill Stock if count is less than 24
    if (stockSnap.size < 24) {
      console.log(`Stock level is low (${stockSnap.size}/24). Initiating stock refill pipeline for 50 items...`);

      const refillPool: { asin: string; name: string; price: string; img: string; affiliateLink: string; category: string }[] = [];
      const token = await getLwaAccessToken();

      // Go through each category and fetch 8-9 items to achieve ~50 items total
      for (const cat of Object.keys(MASTER_PRODUCT_POOL)) {
        const catProducts = MASTER_PRODUCT_POOL[cat];
        let itemsAddedForCat = 0;

        for (const item of catProducts) {
          if (itemsAddedForCat >= 9) break;

          // Prevent duplication
          const isDuplicate = Array.from(existingAsinsAndKeywords).some(val => 
            val.includes(item.name.toLowerCase()) || 
            val.includes(item.keyword.toLowerCase())
          );

          if (isDuplicate) continue;

          let resolvedAsin = "ASIN_" + Math.random().toString(36).substring(2, 7).toUpperCase();
          let resolvedName = item.name;
          let resolvedPrice = item.price;
          let resolvedImg = item.img;
          let resolvedLink = `https://www.amazon.co.jp/s?k=${encodeURIComponent(item.keyword)}&tag=${tag}`;

          // If LWA credentials are active, try to fetch real data from Creators API Search
          if (token) {
            try {
              const apiRes = await fetch(`https://api.amazon.co.jp/creators/v1/items?keywords=${encodeURIComponent(item.keyword)}&partnerTag=${tag}&partnerType=Associates`, {
                headers: {
                  "Authorization": `Bearer ${token}`,
                  "Accept": "application/json"
                }
              });
              if (apiRes.ok) {
                const apiData: any = await apiRes.json();
                const firstItem = apiData.items?.[0];
                if (firstItem) {
                  resolvedAsin = firstItem.asin || resolvedAsin;
                  resolvedName = firstItem.title || resolvedName;
                  if (firstItem.price) resolvedPrice = firstItem.price;
                  if (firstItem.imageUrl) resolvedImg = firstItem.imageUrl;
                  if (firstItem.buyUrl) resolvedLink = firstItem.buyUrl;
                  console.log(`API Resolution Success: ${resolvedName} (${resolvedAsin})`);
                }
              }
            } catch (apiErr) {
              // Fail silently and use fallback values
            }
          }

          refillPool.push({
            asin: resolvedAsin,
            name: resolvedName,
            price: resolvedPrice,
            img: resolvedImg,
            affiliateLink: resolvedLink,
            category: cat
          });
          itemsAddedForCat++;
          
          // Add to local set to prevent refilling duplicate items within this run
          existingAsinsAndKeywords.add(resolvedAsin.toLowerCase());
          existingAsinsAndKeywords.add(resolvedName.toLowerCase());
        }
      }

      console.log(`Refilling ${refillPool.length} products to stock_products collection...`);
      for (const prod of refillPool) {
        await setDoc(doc(db, 'stock_products', prod.asin), {
          asin: prod.asin,
          name: prod.name,
          price: prod.price,
          img: prod.img,
          affiliateLink: prod.affiliateLink,
          category: prod.category,
          fetchedAt: new Date().toISOString()
        });
      }

      // Re-read stock snapshot to pick next item
      const newStockSnap = await getDocs(stockCol);
      stockSnap.docs.push(...newStockSnap.docs.filter(d => !stockSnap.docs.some(x => x.id === d.id)));
    }

    // 3. Dispatch one item from stock to generate review
    if (stockSnap.size === 0 && stockSnap.docs.length === 0) {
      console.log("No items available in stock to generate review.");
      return;
    }

    // Pick first item in stock
    const dispatchDoc = stockSnap.docs[0];
    const dispatchProduct = dispatchDoc.data();

    console.log(`Dispatching product from stock for hourly review: "${dispatchProduct.name}" (${dispatchProduct.asin})`);

    // 4. Generate review using Gemini 2.5 Flash
    const prompt = `
【Amazon Affiliate Super-CTA Article Command】
日本のアマゾンアフィリエイト商品の情報から、思わずユーザーが欲しくてクリックしたくなる圧倒的な「高コンバージョン（超高CTA）商品レビュー記事」を作成してください。

ターゲット要素:
- 対象商品名または検索キーワード: "${dispatchProduct.name}"
- 与えられたユーザーの希望タイトル、またはキーワード: "なし"
- 指定の商品カテゴリー: "${dispatchProduct.category}"
- アソシエイトID(必ず最終リンクに組み込むこと): "${tag}"
- 自社アフィリエイトリンクURL (最終的な誘導先): "${dispatchProduct.affiliateLink}"

【執筆アプローチ】
1. 購買意欲を限界まで煽るタイトル（J-RATING誌、LDK誌、モノプロのようなプロの検証誌のような魅力的なもの）を考案。
2. 特徴、実際に使って良かった点（メリット：3個）、購入前に知るべき注意点（デメリット：2個）、そして詳細なレビュー本文（見出し記号は一切使わず、読みやすい改行を多用した詳細なテキスト）を高熱量で書いてください。
3. 信頼感を示すためのスター評価（4.0〜5.0の間）を選定してください。
4. 最終的にリンクへと誘導するキャッチーな「CTA勧誘タイトル（CTAボタン用の文言）」を作成してください。

※重要品質制限: 本文や特徴等のすべてのテキスト項目の中で、見出し文字(「#」「##」「###」等)や、アスタリスク(「*」)、コード用バックティック(「\`」)などのマークダウン特有のテキストフォーマット表現文字は【絶対に】使わないでください。見出し部分は単なる一行のプレーンなテキスト段落として記述してください。

レスポンスは必ず以下のJSONスキーマに合わせてください（markdownブロックで囲わずJSON。日本語で記述してください）。
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: `You are the world's most talented Amazon Affiliate copywriter and conversion rates optimization (CRO) engineer.
Your primary language is Japanese. Your tone is incredibly passionate, informative, deeply detailed, and transparent but highly persuasive.
You know how to convert raw product features into absolute life-changing experiences for the consumer.
CRITICAL: Never output markdown formatting symbols like '#', '##', '###', '*', or '\`'. All text paragraphs must be plain text.
Always output your entire response formatted as a strict single JSON object following the JSON schema, block formatting should be pure JSON only.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "思わず目が留まる魅力的な日本語記事タイトル" },
            starRating: { type: Type.NUMBER, description: "製品への評価点数 (4.0から4.9までの小数)" },
            introText: { type: Type.STRING, description: "読者の心をつかむ冒頭引き込み文 (80文字〜150文字程度)" },
            features: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "この製品が誇る主な売りポイント・際立つ特徴 3個"
            },
            pros: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "実際に手に入れて得られる強烈なメリット・良い点 3個"
            },
            cons: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "正直に伝えるデメリットや留意点 2個"
            },
            reviewBody: { type: Type.STRING, description: "Markdownで整理された説得力の高い詳細レビュー本文" },
            ctaTitle: { type: Type.STRING, description: "リンク周辺に設置するユーザーの背中を押す高コンバージョンなCTA文言・案内" }
          },
          required: ["title", "starRating", "introText", "features", "pros", "cons", "reviewBody", "ctaTitle"]
        }
      }
    });

    const outputJson = JSON.parse(response.text?.trim() || "{}");
    const freshArticleId = "art_" + Math.random().toString(36).substring(2, 11);

    const freshArticle = {
      id: freshArticleId,
      title: outputJson.title || `【最新実機レビュー】QOL高まる決定版「${dispatchProduct.name}」を徹底検証`,
      originalUrl: `https://www.amazon.co.jp/s?k=${encodeURIComponent(dispatchProduct.name)}`,
      asin: dispatchProduct.asin,
      category: dispatchProduct.category,
      imageUrl: dispatchProduct.img,
      starRating: outputJson.starRating || 4.5,
      introText: outputJson.introText || "QOLが向上すると大ヒット中の商品。その実力を本音で評価します。",
      features: outputJson.features || ["高速動作", "長寿命設計", "ギフトにも最適"],
      pros: outputJson.pros || ["毎日の作業から解放される", "頑丈で美しいフォルム", "コスト以上の多機能"],
      cons: outputJson.cons || ["カラーバリエーションが少ないこと", "初期設定に少々時間が必要"],
      reviewBody: outputJson.reviewBody || "確かな機能性。実際に日々使ってみての感想を共有します。",
      ctaTitle: outputJson.ctaTitle || "＼ Amazon最速今日〜明日にお届け。現在の最安値とクチコミを見る ／",
      affiliateLink: dispatchProduct.affiliateLink,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      estimatedPV: 0,
      clicks: 0,
      earnings: 0,
      aiModelUsed: "Gemini 2.5 Flash (Cron Job)"
    };

    // 5. Save completed review article to Firestore
    console.log("Saving generated review article to articles collection...");
    await setDoc(doc(db, 'articles', freshArticle.id), freshArticle);

    // 6. Delete dispatched item from stock
    console.log("Removing dispatched product from stock_products collection...");
    await deleteDoc(doc(db, 'stock_products', dispatchProduct.asin));

    console.log(`Hourly automated review generation success! Title: "${freshArticle.title}"`);

  } catch (error) {
    console.error("Scheduler run failed:", error);
    process.exit(1);
  }
}

run();
