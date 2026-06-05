export interface AmazonProductArticle {
  id: string;
  title: string;
  originalUrl: string;
  asin: string;
  category: string; // e.g. "家電・カメラ", "パソコン・周辺機器", "ホーム＆キッチン", "ビューティー", "ファッション", "本・ゲーム"
  imageUrl: string; // Product photo URL or placeholder
  starRating: number; // e.g. 4.5
  introText: string; // Hook text
  features: string[]; // Key selling points
  pros: string[];
  cons: string[];
  reviewBody: string; // Markdown formatted super high-CTA review body
  ctaTitle: string; // Catchy CTA text like "＼今ならポイント付与＆最安値で購入可能！／"
  affiliateLink: string; // Target link with Associate ID
  createdAt: string;
  estimatedPV: number;
  clicks: number;
  earnings: number;
  aiModelUsed: string;
}

export interface CategorySpec {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warn' | 'ai';
}

export interface AmazonGoState {
  associateId: string; // e.g. "amazongo-22"
  fallbackAdUrl: string; // Default redirection link
  activeCategorySlug: string; // "all" or specific
  articles: AmazonProductArticle[];
  systemLogs: SystemLog[];
  showAdminPanel: boolean; // Toggle between Public Store Front and Management Admin Console
  simulatedCronActive: boolean; // Simulation of GitHub Actions 1-hour hourly runner
}
