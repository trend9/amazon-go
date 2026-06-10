import express from "express";
import path from "path";
import dotenv from "dotenv";
import https from "https";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Safe HTTP POST helper using Node's native https module to guarantee compatibility across all Node versions on Vercel
function safeHttpPost(urlStr: string, body: any): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const postData = JSON.stringify(body);
      
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`Status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.write(postData);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Direct Firestore REST API logger to bypass Firebase client SDK compatibility crashes on Vercel Node runtime
function pushLog(message: string, type: 'info' | 'success' | 'warn' | 'ai' = 'info') {
  try {
    const projectId = "go-app-4dcb9";
    const id = "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const timestamp = new Date().toLocaleTimeString();
    const createdAt = new Date().toISOString();

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/system_logs?documentId=${id}`;

    const body = {
      fields: {
        id: { stringValue: id },
        timestamp: { stringValue: timestamp },
        message: { stringValue: message },
        type: { stringValue: type },
        createdAt: { stringValue: createdAt }
      }
    };

    safeHttpPost(url, body).catch((err) => {
      console.error("REST log write error:", err);
    });
  } catch (err) {
    console.error("Failed inside pushLog:", err);
  }

  console.log(`[${type.toUpperCase()}] ${message}`);
}

const isAiEnabled = !!process.env.GEMINI_API_KEY;
if (isAiEnabled) {
  console.log("Amazon GO AI: Gemini API key is configured. Ready for REST requests.");
} else {
  console.warn("Warning: GEMINI_API_KEY not found in environment variables. Running in mock mode.");
}

// Standalone REST-based Gemini client to completely bypass @google/genai SDK compatibility crashes on Vercel Node runtime
async function generateGeminiReviewREST(prompt: string, apiKey: string): Promise<any> {
  const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];
  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`Attempting content generation via REST with model: ${model}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const resText = await safeHttpPost(url, {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: {
          parts: [{
            text: `You are the world's most talented Amazon Affiliate copywriter and conversion rates optimization (CRO) engineer.
Your primary language is Japanese. Your tone is incredibly passionate, informative, deeply detailed, and transparent but highly persuasive.
You know how to convert raw product features into absolute life-changing experiences for the consumer.
CRITICAL: Never output markdown formatting symbols like '#', '##', '###', '*', or '\`'. All text paragraphs must be plain text.
Always output your entire response formatted as a strict single JSON object following the JSON schema, block formatting should be pure JSON only.`
          }]
        },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING", description: "思わず目が留まる魅力的な日本語記事タイトル" },
              starRating: { type: "NUMBER", description: "製品への評価点数 (4.0から4.9までの小数)" },
              introText: { type: "STRING", description: "読者の心をつかむ冒頭引き込み文 (80文字〜150文字程度)" },
              features: {
                type: "ARRAY",
                items: { type: "STRING" },
                description: "この製品が誇る主な売りポイント・際立つ特徴 3個"
              },
                pros: {
                  type: "ARRAY",
                  items: { type: "STRING" },
                  description: "実際に手に入れて得られる強烈なメリット・良い点 3個"
                },
                cons: {
                  type: "ARRAY",
                  items: { type: "STRING" },
                  description: "正直に伝えるデメリットや留意点 2個"
                },
                reviewBody: { type: "STRING", description: "Markdownで整理された説得力の高い詳細レビュー本文" },
                ctaTitle: { type: "STRING", description: "リンク周辺に設置するユーザーの背中を押す高コンバージョンなCTA文言・案内" }
              },
              required: ["title", "starRating", "introText", "features", "pros", "cons", "reviewBody", "ctaTitle"]
            }
          }
        }
      );

      const data: any = JSON.parse(resText);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Empty response from Gemini REST");
      }
      const parsed = JSON.parse(text.trim());
      parsed.aiModelUsed = model;
      return parsed;
    } catch (err) {
      console.warn(`REST model ${model} failed:`, err);
      lastError = err;
    }
  }

  throw lastError || new Error("All models failed to generate content via REST");
}

// Robots.txt to hide host administration paths and keep it clean
app.get("/robots.txt", (req, res) => {
  res.type("text/plain");
  res.send("User-agent: *\nDisallow: /host\nDisallow: /api/\n");
});

// 1. Health Status check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", aiEnabled: isAiEnabled });
});

// A robust list of gorgeous, high-resolution royalty-free stock mock product images by category to make everything look pristine and non-empty.
const CATEGORY_IMAGE_BANK: Record<string, string[]> = {
  gadgets: [
    "https://images.unsplash.com/photo-1546054471-190c10847711?auto=format&fit=crop&q=80&w=600", // Phone
    "https://images.unsplash.com/photo-1572561357382-95d271950998?auto=format&fit=crop&q=80&w=600", // smart home
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=600"  // headphone
  ],
  pc: [
    "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=600", // keyboard
    "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=600", // monitor
    "https://images.unsplash.com/photo-1563206767-5b18f218e8de?auto=format&fit=crop&q=80&w=600"  // router
  ],
  kitchen: [
    "https://images.unsplash.com/photo-1584269603463-35149fa7e826?auto=format&fit=crop&q=80&w=600", // toaster
    "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&q=80&w=600", // air fryer
    "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=600"  // pot
  ],
  beauty: [
    "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=600", // dryer
    "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&q=80&w=600", // moisturizer
    "https://images.unsplash.com/photo-1608248597481-496100c80836?auto=format&fit=crop&q=80&w=600"  // serum
  ],
  fashion: [
    "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=600", // backpack
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600", // sneaker
    "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=600"  // shirt
  ],
  "books-games": [
    "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600", // book
    "https://images.unsplash.com/photo-1486572788966-cfd3df1f5b42?auto=format&fit=crop&q=80&w=600", // gaming controller
    "https://images.unsplash.com/photo-1612287230202-1bf1d85d1bdf?auto=format&fit=crop&q=80&w=600"  // Switch/PSP console
  ]
};

function selectProductMockImage(cat: string, namePrompt: string): string {
  const images = CATEGORY_IMAGE_BANK[cat] || CATEGORY_IMAGE_BANK["gadgets"];
  const index = Math.abs(namePrompt.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % images.length;
  return images[index];
}

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
      const errText = await response.text();
      console.warn("Failed to get Amazon LWA token:", errText);
      return null;
    }

    const data: any = await response.json();
    return data.access_token || null;
  } catch (err) {
    console.error("LWA Token request error:", err);
    return null;
  }
}

// 2. Dynamic Product Details Fetcher API for Banners
app.get("/api/amazon-products", async (req, res) => {
  const asinsParam = req.query.asins as string;
  const tag = (req.query.tag as string) || "mattan0290c-22";
  if (!asinsParam) {
    return res.status(400).json({ error: "ASINs parameter is required." });
  }

  const asins = asinsParam.split(",");
  const results = [];

  const defaultDetails: Record<string, { name: string; price: string; img: string }> = {
    "B0CL7Y437Z": {
      name: "Fire TV Stick 4K Max - 極上の映像美とドルビーアトモス音響体験",
      price: "¥9,980",
      img: "https://picsum.photos/seed/firetv/300/200"
    },
    "B0CGDGN41Y": {
      name: "Anker PowerBank (30W, 10000mAh) - 急速充電対応コンパクトモバイルバッテリー",
      price: "¥5,990",
      img: "https://picsum.photos/seed/anker/300/200"
    },
    "B0CHX58W9G": {
      name: "Apple AirPods Pro (第2世代) USB-C - 魔法のようなノイズキャンセリング",
      price: "¥39,800",
      img: "https://picsum.photos/seed/airpods/300/200"
    },
    "B0BTMG5N5G": {
      name: "SwitchBot スマートリモコン ハブ2 - 温度・湿度計付きスマートホーム中継器",
      price: "¥8,980",
      img: "https://picsum.photos/seed/switchbot/300/200"
    }
  };

  try {
    const token = await getLwaAccessToken();
    for (const asin of asins) {
      const searchTerms: Record<string, string> = {
        "B0CL7Y437Z": "Fire TV Stick 4K",
        "B0CGDGN41Y": "Anker PowerBank 10000mAh",
        "B0CHX58W9G": "AirPods Pro",
        "B0BTMG5N5G": "SwitchBot ハブ2"
      };
      const term = searchTerms[asin] || "Amazon売れ筋";
      let productData = {
        asin,
        name: defaultDetails[asin]?.name || "Amazon製品",
        price: defaultDetails[asin]?.price || "オープン価格",
        img: defaultDetails[asin]?.img || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=250",
        affiliateLink: `https://www.amazon.co.jp/s?k=${encodeURIComponent(term)}&tag=${tag}`,
        label: asin === "B0CL7Y437Z" ? "ベストセラー1位" : (asin === "B0CGDGN41Y" ? "セール中" : (asin === "B0CHX58W9G" ? "人気急上昇" : "QOL向上定番"))
      };

      if (token) {
        try {
          const apiRes = await fetch(`https://api.amazon.co.jp/creators/v1/items/${asin}`, {
            headers: {
              "Authorization": `Bearer ${token}`,
              "Accept": "application/json"
            }
          });
          if (apiRes.ok) {
            const data: any = await apiRes.json();
            if (data.title) productData.name = data.title;
            
            if (data.imageUrl) {
              productData.img = data.imageUrl;
            } else if (data.image && data.image.url) {
              productData.img = data.image.url;
            } else if (data.images && data.images[0]) {
              productData.img = typeof data.images[0] === 'string' ? data.images[0] : (data.images[0].url || productData.img);
            }
            
            if (data.price) {
              productData.price = data.price;
            } else if (data.formattedPrice) {
              productData.price = data.formattedPrice;
            }
            
            if (data.buyUrl) {
              productData.affiliateLink = data.buyUrl.includes('?') ? `${data.buyUrl}&tag=${tag}` : `${data.buyUrl}?tag=${tag}`;
            }
          }
        } catch (innerErr) {
          console.warn(`Error fetching details for ASIN ${asin} from Creators API:`, innerErr);
        }
      }
      results.push(productData);
    }
  } catch (err) {
    console.error("Endpoint /api/amazon-products failed:", err);
  }

  res.json(results);
});

let viteInstance: any = null;

function mapFirestoreFields(fields: any): any {
  const result: any = {};
  if (!fields) return result;
  for (const key of Object.keys(fields)) {
    const valObj = fields[key];
    if (valObj.stringValue !== undefined) {
      result[key] = valObj.stringValue;
    } else if (valObj.doubleValue !== undefined) {
      result[key] = parseFloat(valObj.doubleValue);
    } else if (valObj.integerValue !== undefined) {
      result[key] = parseInt(valObj.integerValue, 10);
    } else if (valObj.booleanValue !== undefined) {
      result[key] = valObj.booleanValue;
    } else if (valObj.arrayValue && valObj.arrayValue.values) {
      result[key] = valObj.arrayValue.values.map((v: any) => {
        if (v.stringValue !== undefined) return v.stringValue;
        if (v.doubleValue !== undefined) return parseFloat(v.doubleValue);
        if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
        return v;
      });
    } else {
      result[key] = valObj;
    }
  }
  return result;
}

async function fetchArticleFromFirestoreREST(articleId: string): Promise<any | null> {
  try {
    const projectId = "go-app-4dcb9";
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/articles/${articleId}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const docJson: any = await res.json();
    return {
      id: articleId,
      ...mapFirestoreFields(docJson.fields)
    };
  } catch (err) {
    console.error(`Error fetching article ${articleId}:`, err);
    return null;
  }
}

async function fetchAllArticlesFromFirestoreREST(): Promise<any[]> {
  try {
    const projectId = "go-app-4dcb9";
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/articles?pageSize=100`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const resJson: any = await res.json();
    if (!resJson.documents) return [];
    return resJson.documents.map((docJson: any) => {
      const parts = docJson.name.split('/');
      const id = parts[parts.length - 1];
      return {
        id,
        ...mapFirestoreFields(docJson.fields)
      };
    });
  } catch (err) {
    console.error("Error fetching all articles:", err);
    return [];
  }
}

// dynamic sitemap.xml
app.get("/sitemap.xml", async (req, res) => {
  const articles = await fetchAllArticlesFromFirestoreREST();
  const host = req.headers.host || "localhost:3000";
  const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // Home page
  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/</loc>\n`;
  xml += `    <changefreq>daily</changefreq>\n`;
  xml += `    <priority>1.0</priority>\n`;
  xml += `  </url>\n`;

  // Admin page
  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/host</loc>\n`;
  xml += `    <changefreq>weekly</changefreq>\n`;
  xml += `    <priority>0.3</priority>\n`;
  xml += `  </url>\n`;

  // Articles pages
  for (const art of articles) {
    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}/review/${art.id}</loc>\n`;
    xml += `    <lastmod>${(art.createdAt || new Date().toISOString()).substring(0, 10)}</lastmod>\n`;
    xml += `    <changefreq>monthly</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>`;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

// dynamic rss.xml
app.get("/rss.xml", async (req, res) => {
  const articles = await fetchAllArticlesFromFirestoreREST();
  const host = req.headers.host || "localhost:3000";
  const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;

  // Sort by date desc
  articles.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  let xml = `<?xml version="1.0" encoding="UTF-8" ?>\n`;
  xml += `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n`;
  xml += `<channel>\n`;
  xml += `  <title>モノレポ - QOL向上商品レビューメディア</title>\n`;
  xml += `  <link>${baseUrl}</link>\n`;
  xml += `  <description>専門バイヤーによる本音の商品レビュー自動配信フィード</description>\n`;
  xml += `  <language>ja</language>\n`;
  xml += `  <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml" />\n`;

  for (const art of articles) {
    const pubDate = art.createdAt 
      ? new Date(art.createdAt.replace(' ', 'T') + 'Z').toUTCString()
      : new Date().toUTCString();
      
    xml += `  <item>\n`;
    xml += `    <title><![CDATA[${art.title}]]></title>\n`;
    xml += `    <link>${baseUrl}/review/${art.id}</link>\n`;
    xml += `    <guid>${baseUrl}/review/${art.id}</guid>\n`;
    xml += `    <pubDate>${pubDate}</pubDate>\n`;
    xml += `    <description><![CDATA[${art.introText || ""}]]></description>\n`;
    xml += `  </item>\n`;
  }

  xml += `</channel>\n`;
  xml += `</rss>`;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

// dynamic review pages with SEO injection (Title, Meta, JSON-LD Schema)
app.get("/review/:id", async (req, res, next) => {
  try {
    const articleId = req.params.id;
    const article = await fetchArticleFromFirestoreREST(articleId);

    let htmlPath = "";
    if (process.env.NODE_ENV !== "production") {
      htmlPath = path.join(process.cwd(), "index.html");
    } else {
      htmlPath = path.join(process.cwd(), "dist", "index.html");
    }

    if (!fs.existsSync(htmlPath)) {
      return next();
    }

    let html = fs.readFileSync(htmlPath, "utf-8");

    if (article) {
      // Clean quotes and newlines for JSON-LD safety
      const cleanTitle = article.title.replace(/"/g, '\\"');
      const cleanIntro = (article.introText || "").replace(/"/g, '\\"');
      const cleanBody = (article.reviewBody || "").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '');

      // Inject SEO tags and schema markup before </head>
      const seoTags = `
  <title>${article.title} | モノレポ</title>
  <meta name="description" content="${article.introText || ''}" />
  <meta property="og:title" content="${article.title}" />
  <meta property="og:description" content="${article.introText || ''}" />
  <meta property="og:image" content="${article.imageUrl || ''}" />
  <meta property="og:url" content="https://${req.headers.host || 'monorepo-go.vercel.app'}/review/${article.id}" />
  <meta property="og:type" content="article" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${article.title}" />
  <meta name="twitter:description" content="${article.introText || ''}" />
  <meta name="twitter:image" content="${article.imageUrl || ''}" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "${cleanTitle}",
    "image": "${article.imageUrl || ''}",
    "description": "${cleanIntro}",
    "offers": {
      "@type": "Offer",
      "url": "${article.affiliateLink || ''}",
      "priceCurrency": "JPY",
      "price": "${(article.price || '').replace(/[^0-9]/g, '') || '1000'}",
      "availability": "https://schema.org/InStock"
    },
    "review": {
      "@type": "Review",
      "author": {
        "@type": "Person",
        "name": "モノレポ 専門バイヤー"
      },
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "${article.starRating || 4.5}",
        "bestRating": "5"
      },
      "reviewBody": "${cleanBody}"
    }
  }
  </script>
`;
      // Replace existing title if present, otherwise prepend
      if (html.includes("<title>")) {
        html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${article.title} | モノレポ</title>`);
      }
      html = html.replace("</head>", `${seoTags}\n</head>`);
    }

    if (process.env.NODE_ENV !== "production" && viteInstance) {
      html = await viteInstance.transformIndexHtml(req.originalUrl, html);
    }

    res.send(html);
  } catch (err) {
    console.error("Failed to render SEO article page:", err);
    next();
  }
});

// 3. High-Performance Review Generator API
app.post("/api/generate-amazon-review", async (req, res) => {
  const { inputUrl, category, associateId, userCustomTitle, customAffiliateLink } = req.body;

  const targetCategory = category || "gadgets";
  const userTag = associateId || "mattan0290c-22";

  // Helper patterns for extraction
  let detectedAsin = "";
  let searchKeyword = "";

  const asinMatch = (inputUrl || "").match(/\/(dp|gp\/product)\/([A-Z0-9]{10})/i);
  const searchMatch = (inputUrl || "").match(/[?&]k=([^&]+)/i);

  if (asinMatch && asinMatch[2]) {
    detectedAsin = asinMatch[2].toUpperCase();
  } else if ((inputUrl || "").trim().length === 10 && /^[A-Z0-9]+$/i.test((inputUrl || "").trim())) {
    detectedAsin = (inputUrl || "").trim().toUpperCase();
  } else if (searchMatch && searchMatch[1]) {
    searchKeyword = decodeURIComponent(searchMatch[1]);
  } else {
    const isUrl = (inputUrl || "").startsWith("http");
    if (!isUrl && (inputUrl || "").trim().length > 0) {
      searchKeyword = (inputUrl || "").trim();
    }
  }

  if (!detectedAsin && !searchKeyword) {
    detectedAsin = "B0CL7Y437Z";
  }



  // Attempt to fetch product details from Amazon Creators API using LWA credentials
  let apiProductDetails: any = null;
  try {
    const token = await getLwaAccessToken();
    if (token && detectedAsin) {
      console.log(`Querying Amazon Creators API for ASIN: ${detectedAsin}...`);
      const response = await fetch(`https://api.amazon.co.jp/creators/v1/items/${detectedAsin}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        }
      });
      if (response.ok) {
        apiProductDetails = await response.json();
        console.log("Amazon Creators API product fetch successful:", apiProductDetails.title || detectedAsin);
      } else {
        const errText = await response.text();
        console.warn(`Amazon Creators API returned code ${response.status}:`, errText);
      }
    }
  } catch (apiErr) {
    console.warn("Amazon API fetch failed or was skipped:", apiErr);
  }

  let finalImg = "";
  if (apiProductDetails) {
    if (apiProductDetails.imageUrl) {
      finalImg = apiProductDetails.imageUrl;
    } else if (apiProductDetails.image && apiProductDetails.image.url) {
      finalImg = apiProductDetails.image.url;
    } else if (apiProductDetails.images && apiProductDetails.images[0]) {
      finalImg = typeof apiProductDetails.images[0] === 'string' ? apiProductDetails.images[0] : (apiProductDetails.images[0].url || "");
    }
  }

  if (!finalImg) {
    finalImg = selectProductMockImage(targetCategory, detectedAsin || userCustomTitle || searchKeyword || inputUrl || "product");
  }

  const resolvedSearchKeyword = apiProductDetails?.title || searchKeyword || userCustomTitle || inputUrl || "Amazon売れ筋";
  const isSony = detectedAsin === "B0D2XBV7FZ" || detectedAsin === "B09Y2MYLMC";
  const finalAffLink = customAffiliateLink && customAffiliateLink.trim()
    ? customAffiliateLink.trim()
    : (isSony
        ? `https://amzn.to/4fZYn2T`
        : `https://www.amazon.co.jp/s?k=${encodeURIComponent(resolvedSearchKeyword)}&tag=${userTag}`);

  if (!isAiEnabled) {
    const defaultTitles: Record<string, string> = {
      gadgets: "【超高音質】JBL Tour Pro 2はスマートタッチ画面付きで驚愕の便利さ！徹底時短レビュー",
      pc: "【爆速化】Samsung 990 PRO NVMe M.2 SSDでゲームロード時間が実質0秒になった件",
      kitchen: "【極上の朝】バルミューダ The Toasterで焼く「奇跡のチーズトースト」を実体験レビュー",
      beauty: "【自宅サロン級】リファ ビューテックドライヤープロで髪のツヤが劇的復活した秘密",
      fashion: "【傑作】Coleman 大容量シールド35 バックパックを徹底レビュー！超防水かつ疲れない最高の相棒",
      "books-games": "【神ゲー確定】エルデンリング(ELDEN RING)を100時間遊び尽くした完全攻略レビュー"
    };

    const targetTitle = userCustomTitle || defaultTitles[targetCategory] || "【超人気アイテム】話題 of Amazon売れ筋商品をプロ目線で徹底レビュー";

    return res.json({
      id: "art_" + Math.random().toString(36).substring(2, 11),
      title: targetTitle,
      originalUrl: inputUrl || (isSony ? `https://www.amazon.co.jp/dp/${detectedAsin}` : `https://www.amazon.co.jp/s?k=${encodeURIComponent(resolvedSearchKeyword)}`),
      asin: detectedAsin || "Search",
      category: targetCategory,
      imageUrl: finalImg,
      starRating: parseFloat((4.3 + Math.random() * 0.6).toFixed(1)),
      introText: `今回ご紹介するのは、Amazonのセールランキングでも圧倒的上位を獲得している大注目製品です。実際に日々のQOL（生活の質）が爆発的に高まるかどうかを徹底的に使って検証しました。結論、迷っているなら今すぐ手に入れるべき価値があります！`,
      features: [
        "圧倒的な業界最高レベルのコストパフォーマンスと抜群の耐久設計",
        "直感的で誰にでも分かりやすいスマートな操作感と極めて快適な装着・使用感",
        "Amazonタイムセール祭りによる驚異的な最安値ポイント還元プログラム"
      ],
      pros: [
        "使ったその日から違いを実感できる即効性、毎日のストレスが激減します",
        "ミニマルでスタイリッシュな外観、お部屋や手元に美しく溶け込みます",
        "カスタマーサポートも超丁寧で初期不良や保証ポリシーも完璧で安心"
      ],
      cons: [
        "便利すぎて手放せなくなり、旅行中や外出先でも常に持ち歩きたくなる点",
        "人気すぎて入荷待ちや在庫切れのスロットが度々発生すること"
      ],
      reviewBody: `${targetTitle}を実際に買ってよかったこと

多くのインフルエンサーや辛口評論家が口を揃えて「これがベストバイ」と推奨するこの製品。私自身も「本当にそんなに凄いの？」と半信半疑でしたが、導入した瞬間にすべての悩みから解放されました。

圧倒的な時短効果と圧倒的な機能美
日々の生活リズムにおいて、1分1回の小さな億劫な手間が消えるのは想像以上の体験です。
これまでは時間がかかっていたあの作業が、ボタンひとつ・スイッチを入れるだけで完了するストレスフリー。

Amazonで買うからこそ最高の保証と即納スピード
この製品を購入する際は、信頼性の観点からAmazonの公式ストア経由を第一に推奨します。お急ぎ便なら早ければ当日に到着し、もしもの初期不良でもワンタップで返品・新品交換が可能です。安心の保険だと思って下記のリンクをチェックしてみてください。`,
      ctaTitle: "＼ 限定の特別ポイント還元中！Amazon最安値価格をチェック ／",
      affiliateLink: finalAffLink,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      estimatedPV: Math.floor(Math.random() * 20) + 12,
      clicks: 0,
      earnings: 0,
      aiModelUsed: "Gemini 3.5 Flash (Demo Mode)"
    });
  }

  try {
    const prompt = `
【Amazon Affiliate Super-CTA Article Command】
日本のアマゾンアフィリエイト商品の情報から、思わずユーザーが欲しくてクリックしたくなる圧倒的な「高コンバージョン（超高CTA）商品レビュー記事」を作成してください。

ターゲット要素:
- 対象商品名または検索キーワード: "${inputUrl || "最新のベストセラー電子製品"}"
- 与えられたユーザーの希望タイトル、またはキーワード: "${userCustomTitle || "なし"}"
- 指定の商品カテゴリー: "${targetCategory}" (家電/パソコン/キッチン/ビューティー/ファッション/本・ゲームい等)
- アソシエイトID(必ず最終リンクに組み込むこと): "${userTag}"
- 自社アフィリエイトリンクURL (最終的な誘導先): "${finalAffLink}"

【執筆アプローチ】
1. 購買意欲を限界まで煽るタイトル（J-RATING誌、LDK誌、モノプロのようなプロの検証誌のような魅力的なもの）を考案。
2. 特徴、実際に使って良かった点（メリット：3個）、購入前に知るべき注意点（デメリット：2個）、そして詳細なレビュー本文（見出し記号は一切使わず、読みやすい改行を多用した詳細なテキスト）を高熱量で書いてください。
3. 信頼感を示すためのスター評価（4.0〜5.0の間）を選定してください。
4. 最終的にリンクへと誘導するキャッチーな「CTA勧誘タイトル（CTAボタン用の文言）」を作成してください。

※重要品質制限: 本文や特徴等のすべてのテキスト項目の中で、見出し文字(「#」「##」「###」等)や、アスタリスク(「*」)、コード用バックティック(「\`」)などのマークダウン特有のテキストフォーマット表現文字は【絶対に】使わないでください。見出し部分は単なる一行のプレーンなテキスト段落として記述してください。

レスポンスは必ず以下のJSONスキーマに合わせてください（markdownブロックで囲わずJSON。日本語で記述してください）。
`;

    const outputJson = await generateGeminiReviewREST(prompt, process.env.GEMINI_API_KEY!);
    const successModel = outputJson.aiModelUsed || "gemini-1.5-flash";

    res.json({
      id: "art_" + Math.random().toString(36).substring(2, 11),
      title: outputJson.title || "【今こそ買い】話題のAmazonベストセラー徹底個別レビュー",
      originalUrl: inputUrl || (isSony ? `https://www.amazon.co.jp/dp/${detectedAsin}` : `https://www.amazon.co.jp/s?k=${encodeURIComponent(resolvedSearchKeyword)}`),
      asin: detectedAsin || "Search",
      category: targetCategory,
      imageUrl: finalImg,
      starRating: outputJson.starRating || 4.5,
      introText: outputJson.introText || "QOLが向上するとネット上でバズっている大ヒット商品。その実力を本音で評価します。",
      features: outputJson.features || ["高速動作", "長寿命設計", "ギフトにも最適"],
      pros: outputJson.pros || ["毎日の作業から解放される", "頑丈で美しいフォルム", "コスト以上の多機能"],
      cons: outputJson.cons || ["カラーバリエーションが少ないこと", "初期設定に少々時間が必要"],
      reviewBody: outputJson.reviewBody || "### 確かな機能性。実際に日々使ってみての感想を共有します。",
      ctaTitle: outputJson.ctaTitle || "＼ Amazonプライム対応。最速明日にお届け。現在の価格を見る ／",
      affiliateLink: finalAffLink,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      estimatedPV: Math.floor(Math.random() * 5) + 5,
      clicks: 0,
      earnings: 0,
      aiModelUsed: `Gemini ${successModel === 'gemini-1.5-flash' ? '1.5' : successModel === 'gemini-2.0-flash' ? '2.0' : '2.5'} Flash`
    });

    pushLog(`AI review writer success: "${outputJson.title || 'Untitled'}" using ${successModel}`, "success");

  } catch (error: any) {
    console.error("AI Generation failed:", error);
    const errorMsg = error.message || String(error);
    pushLog(`AI Generation failed (falling back to mock mode). Details: ${errorMsg}`, "warn");

    const defaultTitles: Record<string, string> = {
      gadgets: `【超高音質】話題の「${userCustomTitle || inputUrl}」を徹底時短レビュー`,
      pc: `【爆速化】「${userCustomTitle || inputUrl}」で作業環境を劇的改善した結果`,
      kitchen: `【極上の体験】「${userCustomTitle || inputUrl}」を実際に使ってみたリアルな評価`,
      beauty: `【自宅ケア決定版】「${userCustomTitle || inputUrl}」のツヤと使い心地を本音レビュー`,
      fashion: `【最高の相棒】「${userCustomTitle || inputUrl}」の耐久性とフィット感を徹底検証`,
      "books-games": `【神作確定】「${userCustomTitle || inputUrl}」を遊び尽くした完全攻略レビュー`
    };

    const targetTitle = userCustomTitle || defaultTitles[targetCategory] || `【今こそ買い】話題のAmazonベストセラー「${userCustomTitle || inputUrl}」徹底個別レビュー`;

    res.json({
      id: "art_" + Math.random().toString(36).substring(2, 11),
      title: targetTitle,
      originalUrl: inputUrl || (isSony ? `https://www.amazon.co.jp/dp/${detectedAsin}` : `https://www.amazon.co.jp/s?k=${encodeURIComponent(resolvedSearchKeyword)}`),
      asin: detectedAsin || "Search",
      category: targetCategory,
      imageUrl: finalImg,
      starRating: parseFloat((4.3 + Math.random() * 0.6).toFixed(1)),
      introText: `今回ご紹介するのは、Amazonのセールやランキングでも圧倒的上位を獲得している大注目製品です。実際に日々のQOL（生活の質）が爆発的に高まるかどうかを徹底的に使って検証しました。結論、迷っているなら今すぐ手に入れるべき価値があります！`,
      features: [
        "圧倒的な業界最高レベル of コストパフォーマンスと抜群の耐久設計",
        "直感的で誰にでも分かりやすいスマートな操作感と極めて快適な装着・使用感",
        "Amazonポイント還元プログラムや迅速なお急ぎ便配送対応"
      ],
      pros: [
        "使ったその日から違いを実感できる即効性、毎日のストレスが激減します",
        "ミニマルでスタイリッシュな外観、お部屋や手元に美しく溶け込みます",
        "カスタマーサポートも非常に丁寧で、初期不良や保証ポリシーも完璧で安心"
      ],
      cons: [
        "便利すぎて手放せなくなり、旅行中や外出先でも常に持ち歩きたくなる点",
        "人気すぎて入荷待ちや一時的な在庫切れが発生しやすいこと"
      ],
      reviewBody: `${targetTitle}を実際に買ってよかったこと

多くのインフルエンサーや辛口評論家が口を揃えて「これがベストバイ」と推奨するこの製品。私自身も「本当にそんなに凄いの？」と半信半疑でしたが、導入した瞬間にすべての悩みから解放されました。

圧倒的な時短効果と圧倒的な機能美
日々の生活リズムにおいて、小さな手間やストレスが消えるのは想像以上の快適な体験です。これまでは面倒だったあの作業が、ボタンひとつ・スイッチを入れるだけで完了するストレスフリー。

Amazonで買うからこそ最高の保証と即納スピード
この製品を購入する際は、信頼性の観点からAmazonの公式ストア経由を第一に推奨します。お急ぎ便なら早ければ当日に到着し、もしもの初期不良でもワンタップで返品・新品交換が可能です。安心の保険だと思って下記のリンクをチェックしてみてください。`,
      ctaTitle: "＼ 限定の特別ポイント還元中！Amazon最安値価格をチェック ／",
      affiliateLink: finalAffLink,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      estimatedPV: Math.floor(Math.random() * 20) + 12,
      clicks: 0,
      earnings: 0,
      aiModelUsed: "Gemini 3.5 Flash (Mock Fallback)"
    });
  }
});

// Start Express background listener
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    viteInstance = vite;
    app.use(vite.middlewares);
    console.log("Vite interactive asset stream initialized.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Amazon Go static production router configured.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening at port ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
