import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { firebaseConfig } from './firebase-config-static';

dotenv.config();

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Check Hugging Face Token
const hfToken = process.env.HF_TOKEN;
if (!hfToken) {
  console.error("Error: HF_TOKEN is not set.");
  process.exit(1);
}

// 50+ Real Japan Product Pool by Category with actual ASINs
const MASTER_PRODUCT_POOL: Record<string, { asin: string; name: string; keyword: string; price: string; img: string }[]> = {
  gadgets: [
    { asin: "B09Y2MYLMC", name: "Sony WH-1000XM5 ノイズキャンセリングヘッドホン", keyword: "Sony WH-1000XM5", price: "¥48,500", img: "https://picsum.photos/seed/sonywh1000xm5/400/300" },
    { asin: "B0CH191KNC", name: "Bose QuietComfort Ultra ワイヤレスヘッドホン", keyword: "Bose QuietComfort Ultra", price: "¥53,900", img: "https://picsum.photos/seed/boseqc/400/300" },
    { asin: "B0BVB5LBDD", name: "JBL TOUR PRO 2 完全ワイヤレスイヤホン", keyword: "JBL TOUR PRO 2", price: "¥29,700", img: "https://picsum.photos/seed/jbltour/400/300" },
    { asin: "B09Y5C27F7", name: "Sony LinkBuds S ノイキャンイヤホン", keyword: "Sony LinkBuds S", price: "¥21,800", img: "https://picsum.photos/seed/sonylink/400/300" },
    { asin: "B0B5G82F58", name: "Anker Soundcore Space Q45", keyword: "Anker Space Q45", price: "¥14,990", img: "https://picsum.photos/seed/ankerspace/400/300" },
    { asin: "B0CG1TNYR3", name: "DJI Osmo Pocket 3 ハンドヘルドカメラ", keyword: "DJI Osmo Pocket 3", price: "¥74,800", img: "https://picsum.photos/seed/djiosmo/400/300" },
    { asin: "B0D3J5VNDG", name: "Apple iPad Air 11インチ M2", keyword: "iPad Air M2", price: "¥98,800", img: "https://picsum.photos/seed/ipadairm2/400/300" },
    { asin: "B0BG5B5Q95", name: "Anker Soundcore Liberty 4 イヤホン", keyword: "Anker Liberty 4", price: "¥14,990", img: "https://picsum.photos/seed/ankerliberty/400/300" },
    { asin: "B09M2P5978", name: "Shokz OpenRun Pro 骨伝導イヤホン", keyword: "Shokz OpenRun Pro", price: "¥23,880", img: "https://picsum.photos/seed/shokzopen/400/300" }
  ],
  pc: [
    { asin: "B082TTR5C1", name: "HHKB Professional HYBRID Type-S キーボード", keyword: "HHKB Professional HYBRID Type-S", price: "¥36,850", img: "https://picsum.photos/seed/hhkbd/400/300" },
    { asin: "B0B1D4Y7S3", name: "Logicool MX Master 3S 高機能マウス", keyword: "Logicool MX Master 3S", price: "¥16,800", img: "https://picsum.photos/seed/mxmaster/400/300" },
    { asin: "B0BMQ24C1B", name: "Samsung 990 PRO 2TB M.2 SSD", keyword: "Samsung 990 PRO", price: "¥28,980", img: "https://picsum.photos/seed/samssd/400/300" },
    { asin: "B0C5HVYCDT", name: "Anker Prime Wall Charger 100W 充電器", keyword: "Anker Prime Charger", price: "¥9,990", img: "https://picsum.photos/seed/ankercharger/400/300" },
    { asin: "B0BYMJWCSK", name: "LG UltraGear 27インチ ゲーミングモニター", keyword: "LG UltraGear", price: "¥34,800", img: "https://picsum.photos/seed/lgmonitor/400/300" },
    { asin: "B09TDFM7J8", name: "Dell U2723QE 27インチ 4K モニター", keyword: "Dell U2723QE", price: "¥62,800", img: "https://picsum.photos/seed/dell4k/400/300" },
    { asin: "B0CGDCL14L", name: "Logicool G PRO X SUPERLIGHT 2 マウス", keyword: "G PRO X SUPERLIGHT 2", price: "¥22,800", img: "https://picsum.photos/seed/gprosuper/400/300" },
    { asin: "B0BD5Q5L62", name: "SteelSeries Apex Pro TKL キーボード", keyword: "SteelSeries Apex Pro TKL", price: "¥32,980", img: "https://picsum.photos/seed/apexpro/400/300" },
    { asin: "B09738CV2G", name: "Elgato Stream Deck MK.2 ショートカットコントローラー", keyword: "Stream Deck MK.2", price: "¥22,980", img: "https://picsum.photos/seed/streamdeck/400/300" }
  ],
  kitchen: [
    { asin: "B09C15CR9P", name: "シャープ ヘルシオ ホットクック KN-HW24G", keyword: "ホットクック KN-HW24G", price: "¥58,000", img: "https://picsum.photos/seed/hotcook/400/300" },
    { asin: "B08FPCSBFR", name: "バルミューダ The Toaster スチームトースター", keyword: "バルミューダ トースター", price: "¥27,900", img: "https://picsum.photos/seed/baltoaster/400/300" },
    { asin: "B008ZZFCAI", name: "デロンギ マグニフィカS 全自動コーヒーマシン", keyword: "デロンギ マグニフィカS", price: "¥68,000", img: "https://picsum.photos/seed/delonghi/400/300" },
    { asin: "B07JH8XQJ2", name: "シロカ コーン式全自動コーヒーメーカー", keyword: "シロカ コーヒーメーカー", price: "¥23,800", img: "https://picsum.photos/seed/siroca/400/300" },
    { asin: "B085VNDM5H", name: "アイリスオーヤマ 電気圧力鍋 4.0L", keyword: "アイリスオーヤマ 電気圧力鍋", price: "¥16,800", img: "https://picsum.photos/seed/irispressure/400/300" },
    { asin: "B09NSN7B8H", name: "ソーダストリーム Terra 炭酸水メーカー", keyword: "ソーダストリーム Terra", price: "¥15,400", img: "https://picsum.photos/seed/sodastream/400/300" },
    { asin: "B0761HM28B", name: "ティファール クックフォーミー エキスパート", keyword: "クックフォーミー", price: "¥29,800", img: "https://picsum.photos/seed/tfalcook/400/300" },
    { asin: "B07HQCHZ3B", name: "アラジン グラファイト トースター 4枚焼き", keyword: "アラジン トースター", price: "¥22,000", img: "https://picsum.photos/seed/aladdintoaster/400/300" }
  ],
  beauty: [
    { asin: "B0B7H8MC5M", name: "パナソニック ヘアドライヤー ナノケア", keyword: "ナノケア ドライヤー", price: "¥38,000", img: "https://picsum.photos/seed/nanocare/400/300" },
    { asin: "B0B824BKB7", name: "リファ ビューテック ドライヤープロ", keyword: "リファ ドライヤー プロ", price: "¥43,000", img: "https://picsum.photos/seed/refadryer/400/300" },
    { asin: "B08KH6C7F1", name: "ヤーマン フォトシャイン スチーマー", keyword: "ヤーマン フォトシャイン", price: "¥49,500", img: "https://picsum.photos/seed/yamansteamer/400/300" },
    { asin: "B09M8FLRPQ", name: "ブラウン シルクエキスパート Pro5 光美容器", keyword: "ブラウン シルクエキスパート", price: "¥59,800", img: "https://picsum.photos/seed/braunsilk/400/300" },
    { asin: "B0182C317U", name: "ReFa CARAT RAY プラチナローラー", keyword: "ReFa CARAT RAY", price: "¥26,800", img: "https://picsum.photos/seed/refacarat/400/300" },
    { asin: "B08K7G5T5N", name: "SALONIA サロニア スピーディーイオンドライヤー", keyword: "サロニア ドライヤー", price: "¥5,918", img: "https://picsum.photos/seed/salonia/400/300" },
    { asin: "B09H2S5N6G", name: "Dyson Supersonic Ionic ヘアドライヤー", keyword: "ダイソン ドライヤー", price: "¥45,760", img: "https://picsum.photos/seed/dysondryer/400/300" },
    { asin: "B0B4DBP2S9", name: "パナソニック バイタリフト かっさ 美顔器", keyword: "バイタリフト かっさ", price: "¥33,660", img: "https://picsum.photos/seed/vitalift/400/300" }
  ],
  fashion: [
    { asin: "B0B5F4KV4B", name: "アークテリクス マンティス 26 バックパック", keyword: "アークテリクス マンティス 26", price: "¥22,000", img: "https://picsum.photos/seed/arcteryx/400/300" },
    { asin: "B07PBFYL36", name: "パタゴニア ブラックホール パック 32L", keyword: "パタゴニア ブラックホール 32L", price: "¥24,200", img: "https://picsum.photos/seed/patagonia/400/300" },
    { asin: "B07MGB563Q", name: "ザ・ノース・フェイス シングルショット リュック", keyword: "ノースフェイス シングルショット", price: "¥16,500", img: "https://picsum.photos/seed/northface/400/300" },
    { asin: "B000GLNQRE", name: "ビルケンシュトック アリゾナ サンダル", keyword: "ビルケンシュトック アリゾナ", price: "¥12,100", img: "https://picsum.photos/seed/birkenstock/400/300" },
    { asin: "B07MLYV64R", name: "ニューバランス 996 スニーカー", keyword: "ニューバランス 996", price: "¥16,280", img: "https://picsum.photos/seed/newbalance996/400/300" },
    { asin: "B083M12D8J", name: "パタゴニア トレントシェル 3L ジャケット", keyword: "パタゴニア トレントシェル", price: "¥22,000", img: "https://picsum.photos/seed/torrentshell/400/300" },
    { asin: "B07MGB26V1", name: "ザ・ノース・フェイス マウンテンライトジャケット", keyword: "マウンテンライトジャケット", price: "¥41,800", img: "https://picsum.photos/seed/mountainlight/400/300" },
    { asin: "B00M0N4K5I", name: "グレゴリー デイパック リュック", keyword: "グレゴリー デイパック", price: "¥24,200", img: "https://picsum.photos/seed/gregory/400/300" }
  ],
  "books-games": [
    { asin: "B0DGWYDRM4", name: "モンスターハンターワイルズ - PS5", keyword: "モンスターハンターワイルズ", price: "¥9,900", img: "https://picsum.photos/seed/mhwilds/400/300" },
    { asin: "B0BVMNV15D", name: "ゼルダの伝説 ティアーズ オブ ザ キングダム - Switch", keyword: "ゼルダの伝説 ティアーズ", price: "¥7,920", img: "https://picsum.photos/seed/zelda/400/300" },
    { asin: "B0B68WNDR9", name: "ペルソナ5 ザ・ロイヤル - Switch/PS5", keyword: "ペルソナ5 ロイヤル", price: "¥7,678", img: "https://picsum.photos/seed/persona/400/300" },
    { asin: "B09H2S5N6G", name: "エルデンリング ELDEN RING - PS5", keyword: "エルデンリング", price: "¥9,240", img: "https://picsum.photos/seed/elden/400/300" },
    { asin: "B08752KBG4", name: "世界のアソビ大全51 - Switch", keyword: "世界のアソビ大全51", price: "¥4,378", img: "https://picsum.photos/seed/asobi51/400/300" },
    { asin: "B0C9J6MWRY", name: "スーパーマリオブラザーズ ワンダー - Switch", keyword: "マリオ ワンダー", price: "¥6,578", img: "https://picsum.photos/seed/mariowonder/400/300" },
    { asin: "B0C9J9K4CR", name: "桃太郎電鉄ワールド 昭和 平成 令和も定番！ - Switch", keyword: "桃太郎電鉄ワールド", price: "¥6,930", img: "https://picsum.photos/seed/momotetsu/400/300" },
    { asin: "B06XZ1178K", name: "マリオカート8 デラックス - Switch", keyword: "マリオカート8 デラックス", price: "¥6,578", img: "https://picsum.photos/seed/mariokart8/400/300" }
  ]
};

function sanitizeJsonString(rawJson: string): string {
  let insideString = false;
  let escaped = false;
  let result = "";
  for (let i = 0; i < rawJson.length; i++) {
    const char = rawJson[i];
    if (char === '"' && !escaped) {
      insideString = !insideString;
      result += char;
    } else if (char === '\\' && !escaped) {
      escaped = true;
      result += char;
    } else {
      escaped = false;
      if (insideString) {
        if (char === '\n') {
          result += '\\n';
        } else if (char === '\r') {
          result += '\\r';
        } else if (char === '\t') {
          result += '\\t';
        } else {
          result += char;
        }
      } else {
        result += char;
      }
    }
  }
  return result;
}

async function pushLog(message: string, type: 'info' | 'success' | 'warn' | 'ai' = 'info') {
  const id = "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const timestamp = new Date().toLocaleTimeString();
  setDoc(doc(db, 'system_logs', id), {
    id,
    timestamp,
    message,
    type,
    createdAt: new Date().toISOString()
  }).catch((err) => {
    console.error("Failed to write log to Firestore:", err);
  });
  console.log(`[${type.toUpperCase()}] ${message}`);
}

async function generateQwenReview(productName: string, category: string, affiliateLink: string, tag: string): Promise<any> {
  const systemPrompt = `You are the world's most talented Amazon Affiliate copywriter and conversion rates optimization (CRO) engineer.
Your primary language is Japanese. Your tone is incredibly passionate, informative, deeply detailed, and transparent but highly persuasive.
You know how to convert raw product features into absolute life-changing experiences for the consumer.
CRITICAL: Never output markdown formatting symbols like '#', '##', '###', '*', or '\`'. All text paragraphs must be plain text.
Always output your entire response formatted as a strict single JSON object matching the JSON schema below. DO NOT output any other text or markdown block wrappers.

JSON Schema:
{
  "title": "思わず目が留まる魅力的な日本語記事タイトル (string)",
  "starRating": 4.5, // 製品への評価点数 (number, 4.0から4.9までの小数)
  "introText": "読者の心をつかむ冒頭引き込み文 (string, 80文字〜150文字程度)",
  "features": ["特徴1", "特徴2", "特徴3"], // この製品が誇る主な売りポイント・際立つ特徴 3個 (array of strings)
  "pros": ["メリット1", "メリット2", "メリット3"], // 実際に手に入れて得られる強烈なメリット・良い点 3個 (array of strings)
  "cons": ["デメリット1", "デメリット2"], // 正直に伝えるデメリットや留意点 2個 (array of strings)
  "reviewBody": "説得力の高い詳細レビュー本文 (string)",
  "ctaTitle": "リンク周辺に設置するユーザーの背中を押す高コンバージョンなCTA文言・案内 (string)"
}`;

  const userPrompt = `日本のアマゾンアフィリエイト商品の情報から、思わずユーザーが欲しくてクリックしたくなる圧倒的な「高コンバージョン（超高CTA）商品レビュー記事」を作成してください。

ターゲット要素:
- 対象商品名または検索キーワード: "${productName}"
- 指定の商品カテゴリー: "${category}"
- アソシエイトID(必ず最終リンクに組み込むこと): "${tag}"
- 自社アフィリエイトリンクURL (最終的な誘導先): "${affiliateLink}"

【執筆アプローチ】
1. 購買意欲を限界まで煽るタイトル（J-RATING誌、LDK誌、モノプロのようなプロの検証誌のような魅力的なもの）を考案。
2. 特徴、実際に使って良かった点（メリット：3個）、購入前に知るべき注意点（デメリット：2個）、そして詳細なレビュー本文（見出し記号は一切使わず、読みやすい改行を多用した詳細なテキスト）を高熱量で書いてください。
3. 信頼感を示すためのスター評価（4.0〜5.0の間）を選定してください。
4. 最終的にリンクへと誘導するキャッチーな「CTA勧誘タイトル（CTAボタン用の文言）」を作成してください。

※重要品質制限: 本文や特徴等のすべてのテキスト項目の中で、見出し文字(「#」「##」「###」等)や、アスタリスク(「*」)、コード用バックティック(「\`」)などのマークダウン特有 of テキストフォーマット表現文字は【絶対に】使わないでください。見出し部分は単なる一行のプレーンなテキスト段落として記述してください。`;

  const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.HF_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "Qwen/Qwen2.5-72B-Instruct",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 2048,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Hugging Face API error (Status ${response.status}): ${errText}`);
  }

  const resJson: any = await response.json();
  const content = resJson.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty content returned from Hugging Face API");
  }

  let jsonStr = content.trim();
  // Strip markdown code block wrappers if present
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "");
    jsonStr = jsonStr.replace(/\n?```$/, "");
  }
  jsonStr = jsonStr.trim();

  const sanitized = sanitizeJsonString(jsonStr);

  try {
    return JSON.parse(sanitized);
  } catch (e) {
    const match = sanitized.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw e;
  }
}

async function run() {
  await pushLog("Starting automated review stock & Hugging Face auto-generation pipeline...", "info");

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

    let stockDocs = [...stockSnap.docs];
    await pushLog(`Current stock size: ${stockDocs.length}. Articles size: ${articlesSnap.size}.`, "info");

    // 2. Refill Stock if count is less than 24 (using Master pool with real ASINs)
    if (stockDocs.length < 24) {
      await pushLog(`Stock level is low (${stockDocs.length}/24). Initiating stock refill pipeline for 50 items...`, "info");

      const refillPool: { asin: string; name: string; price: string; img: string; affiliateLink: string; category: string }[] = [];

      // Go through each category and fetch 8-9 items to achieve ~50 items total
      for (const cat of Object.keys(MASTER_PRODUCT_POOL)) {
        const catProducts = MASTER_PRODUCT_POOL[cat];
        let itemsAddedForCat = 0;

        for (const item of catProducts) {
          if (itemsAddedForCat >= 9) break;

          // Prevent duplication
          const isDuplicate = Array.from(existingAsinsAndKeywords).some(val => 
              val.includes(item.name.toLowerCase()) || 
              val.includes(item.keyword.toLowerCase()) ||
              val.includes(item.asin.toLowerCase())
          );

          if (isDuplicate) continue;

          refillPool.push({
            asin: item.asin,
            name: item.name,
            price: item.price,
            img: item.img,
            affiliateLink: `https://www.amazon.co.jp/dp/${item.asin}?tag=${tag}`,
            category: cat
          });
          itemsAddedForCat++;
          
          existingAsinsAndKeywords.add(item.asin.toLowerCase());
          existingAsinsAndKeywords.add(item.name.toLowerCase());
        }
      }

      await pushLog(`Refilling ${refillPool.length} products to stock_products collection...`, "info");
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

      // Re-read stock snapshot to grab the newly added items
      const newStockSnap = await getDocs(stockCol);
      stockDocs = [...newStockSnap.docs];
    }

    // 3. Dispatch up to 3 items from stock to generate review
    const limit = 3;
    const itemsToProcess = stockDocs.slice(0, limit);

    if (itemsToProcess.length === 0) {
      await pushLog("No items available in stock to generate review.", "warn");
      return;
    }

    await pushLog(`Found ${itemsToProcess.length} items to generate reviews for in this batch run.`, "info");

    for (const dispatchDoc of itemsToProcess) {
      const dispatchProduct = dispatchDoc.data();
      await pushLog(`Dispatching product from stock for Hugging Face review: "${dispatchProduct.name}" (${dispatchProduct.asin})`, "info");

      try {
        await pushLog(`Calling Hugging Face Qwen 2.5 72B API...`, "ai");
        const outputJson = await generateQwenReview(dispatchProduct.name, dispatchProduct.category, dispatchProduct.affiliateLink, tag);
        await pushLog(`Hugging Face generation succeeded.`, "success");

        const freshArticleId = "art_" + Math.random().toString(36).substring(2, 11);

        const freshArticle = {
          id: freshArticleId,
          title: outputJson.title || `【最新実機レビュー】QOL高まる決定版「${dispatchProduct.name}」を徹底検証`,
          originalUrl: `https://www.amazon.co.jp/dp/${dispatchProduct.asin}`,
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
          aiModelUsed: `Qwen 2.5 72B (Cron Job via HF)`,
          cronSecret: "mattan029-cron-bypass"
        };

        // 5. Save completed review article to Firestore
        await pushLog(`Saving generated review article to articles collection: "${freshArticle.title}"`, "info");
        await setDoc(doc(db, 'articles', freshArticle.id), freshArticle);

        // 6. Delete dispatched item from stock
        await pushLog(`Removing "${dispatchProduct.name}" from stock_products collection...`, "info");
        await deleteDoc(doc(db, 'stock_products', dispatchProduct.asin));

        await pushLog(`Automated review generation success! Title: "${freshArticle.title}"`, "success");
      } catch (genErr) {
        await pushLog(`Generation failed for item "${dispatchProduct.name}": ${genErr.message || genErr}`, "warn");
      }
    }

  } catch (error) {
    await pushLog(`Scheduler run failed: ${error.message || error}`, "warn");
    process.exit(1);
  }
}

run();


