import { useState, useEffect, FormEvent } from 'react';
import {
  Tv,
  Laptop,
  ChefHat,
  Sparkles,
  Shirt,
  Gamepad2,
  RefreshCw,
  ArrowUpRight,
  BookOpen,
  Copy,
  Check,
  Search,
  ChevronRight,
  Settings,
  Clock,
  Star,
  Github,
  Store,
  DollarSign,
  AlertCircle,
  LogIn,
  LogOut,
  Shield,
  User as UserIcon,
  CheckCircle2,
  Trash2,
  FileText
} from 'lucide-react';
import { AMAZON_CATEGORIES, INITIAL_ARTICLES } from './data';
import { AmazonGoState, AmazonProductArticle, CategorySpec, SystemLog } from './types';
import {
  auth,
  loginWithGoogle,
  logoutUser,
  seedArticlesIfEmpty,
  seedSettingsIfEmptyOrDummy,
  subscribeToArticles,
  saveArticleToFirestore,
  deleteArticleFromFirestore,
  subscribeToSettings,
  saveSettingsToFirestore,
  clearStockProductsInFirestore,
  saveLogToFirestore,
  subscribeToLogs,
  addProductToStockInFirestore
} from './firebase';
import { User, onAuthStateChanged } from 'firebase/auth';

// Helper to match category icons from lucide-react safely
function CategoryIcon({ icon, className = "w-4 h-4" }: { icon: string; className?: string }) {
  switch (icon) {
    case 'Tv': return <Tv className={className} />;
    case 'Laptop': return <Laptop className={className} />;
    case 'ChefHat': return <ChefHat className={className} />;
    case 'Shirt': return <Shirt className={className} />;
    case 'Gamepad2': return <Gamepad2 className={className} />;
    default: return <Sparkles className={className} />;
  }
}

// Helper to strip raw markdown headers (###) and bold formatting tags elegantly
function cleanMarkdownHeaders(text: string): string {
  if (!text) return "";
  return text
    .replace(/^#+\s+/gm, "") // Strips heading tags "### "
    .replace(/##+/g, "")     // Excess security
    .replace(/\*{2,}/g, "")  // Stylistic bold tags e.g. **bold**
    .replace(/`{1,}/g, "");  // Backticks
}

// Helper to return fallback images if image URL is invalid, empty, or points to deprecated Amazon adsystem domain
function getValidImageUrl(imageUrl: string, category: string, title: string): string {
  if (!imageUrl || imageUrl.includes('amazon-adsystem.com')) {
    const fallbackImages: Record<string, string[]> = {
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
    const categoryKey = category || 'gadgets';
    const list = fallbackImages[categoryKey] || fallbackImages['gadgets'];
    const hash = (title || imageUrl || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return list[Math.abs(hash) % list.length];
  }
  return imageUrl;
}

// Automated Semantic Internal Linker
function renderReviewBodyWithLinks(
  bodyText: string,
  articles: AmazonProductArticle[],
  currentArticleId: string,
  onNavigate: (path: string) => void
) {
  if (!bodyText) return null;
  const cleanText = cleanMarkdownHeaders(bodyText);

  // Define keyword-to-ASIN mapping
  const keywordMappings: { keyword: string; asin: string }[] = [
    { keyword: "WH-1000XM5", asin: "B09Y2MYLMC" },
    { keyword: "WH-1000XM5", asin: "B0D2XBV7FZ" }, // Include seed article ASIN
    { keyword: "QuietComfort", asin: "B0CH191KNC" },
    { keyword: "TOUR PRO 2", asin: "B0BVB5LBDD" },
    { keyword: "LinkBuds S", asin: "B09Y5C27F7" },
    { keyword: "Space Q45", asin: "B0B5G82F58" },
    { keyword: "Osmo Pocket 3", asin: "B0CG1TNYR3" },
    { keyword: "iPad Air", asin: "B0D3J5VNDG" },
    { keyword: "Liberty 4", asin: "B0BG5B5Q95" },
    { keyword: "OpenRun Pro", asin: "B09M2P5978" },
    { keyword: "HHKB", asin: "B082TTR5C1" },
    { keyword: "MX Master 3S", asin: "B0B1D4Y7S3" },
    { keyword: "990 PRO", asin: "B0BMQ24C1B" },
    { keyword: "Prime Wall Charger", asin: "B0C5HVYCDT" },
    { keyword: "UltraGear", asin: "B0BYMJWCSK" },
    { keyword: "Dell U2723QE", asin: "B09TDFM7J8" },
    { keyword: "SUPERLIGHT 2", asin: "B0CGDCL14L" },
    { keyword: "Apex Pro TKL", asin: "B0BD5Q5L62" },
    { keyword: "Stream Deck", asin: "B09738CV2G" },
    { keyword: "ホットクック", asin: "B09C15CR9P" },
    { keyword: "バルミューダ", asin: "B08FPCSBFR" },
    { keyword: "デロンギ", asin: "B008ZZFCAI" },
    { keyword: "シロカ", asin: "B07JH8XQJ2" },
    { keyword: "電気圧力鍋", asin: "B085VNDM5H" },
    { keyword: "ソーダストリーム", asin: "B09NSN7B8H" },
    { keyword: "クックフォーミー", asin: "B0761HM28B" },
    { keyword: "アラジン", asin: "B07HQCHZ3B" },
    { keyword: "ナノケア", asin: "B0B7H8MC5M" },
    { keyword: "リファ ビューテック", asin: "B0B824BKB7" },
    { keyword: "フォトシャイン", asin: "B08KH6C7F1" },
    { keyword: "シルクエキスパート", asin: "B09M8FLRPQ" },
    { keyword: "プラチナローラー", asin: "B0182C317U" },
    { keyword: "サロニア", asin: "B08K7G5T5N" },
    { keyword: "ダイソン", asin: "B09H2S5N6G" },
    { keyword: "バイタリフト", asin: "B0B4DBP2S9" },
    { keyword: "アークテリクス", asin: "B0B5F4KV4B" },
    { keyword: "ブラックホール", asin: "B07PBFYL36" },
    { keyword: "シングルショット", asin: "B07MGB563Q" },
    { keyword: "ビルケンシュトック", asin: "B000GLNQRE" },
    { keyword: "ニューバランス", asin: "B07MLYV64R" },
    { keyword: "トレントシェル", asin: "B083M12D8J" },
    { keyword: "マウンテンライトジャケット", asin: "B07MGB26V1" },
    { keyword: "グレゴリー", asin: "B00M0N4K5I" },
    { keyword: "モンスターハンター", asin: "B0DGWYDRM4" },
    { keyword: "ゼルダの伝説", asin: "B0BVMNV15D" },
    { keyword: "ペルソナ5", asin: "B0B68WNDR9" },
    { keyword: "マリオカート", asin: "B06XZ1178K" },
    { keyword: "マリオブラザーズ", asin: "B0C9J6MWRY" },
    { keyword: "桃太郎電鉄", asin: "B0C9J9K4CR" },
  ];

  // Resolve matching articles in db. We only keep those that exist in `articles` and are not the current one.
  const activeMatches: { keyword: string; articleId: string }[] = [];
  for (const mapping of keywordMappings) {
    const matchedArt = articles.find(
      (a) => a.id !== currentArticleId && a.asin.toLowerCase() === mapping.asin.toLowerCase()
    );
    if (matchedArt) {
      activeMatches.push({ keyword: mapping.keyword, articleId: matchedArt.id });
    }
  }

  if (activeMatches.length === 0) {
    return <>{cleanText}</>;
  }

  // Sort keywords by length desc to avoid substring collisions
  activeMatches.sort((a, b) => b.keyword.length - a.keyword.length);

  // Build a regex of all keywords
  const escapedKeywords = activeMatches.map((m) => m.keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"));
  const regex = new RegExp(`(${escapedKeywords.join("|")})`, "g");

  const parts = cleanText.split(regex);
  return (
    <>
      {parts.map((part, index) => {
        const match = activeMatches.find((m) => m.keyword === part);
        if (match) {
          return (
            <a
              key={index}
              href={`/review/${match.articleId}`}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(`/review/${match.articleId}`);
              }}
              className="text-orange-400 hover:text-orange-300 underline font-semibold transition-colors"
            >
              {part}
            </a>
          );
        }
        return part;
      })}
    </>
  );
}

export default function App() {
  // Navigation / Route state
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  // Authentication states
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Core App states
  const [state, setState] = useState<AmazonGoState>(() => {
    try {
      const saved = localStorage.getItem('amazongo_app_state_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        const activeTag = (!parsed.associateId || parsed.associateId === 'amazongo-22' || parsed.associateId === 'dummy') ? 'mattan0290c-22' : parsed.associateId;
        return {
          associateId: activeTag,
          fallbackAdUrl: parsed.fallbackAdUrl || 'https://www.amazon.co.jp',
          activeCategorySlug: parsed.activeCategorySlug || 'all',
          articles: Array.isArray(parsed.articles) ? parsed.articles : INITIAL_ARTICLES,
          systemLogs: Array.isArray(parsed.systemLogs) ? parsed.systemLogs : [],
          showAdminPanel: false, // Override to use URL state instead
          simulatedCronActive: !!parsed.simulatedCronActive
        };
      }
    } catch (e) {
      console.error('Failed to parse saved state:', e);
    }

    return {
      associateId: 'mattan0290c-22',
      fallbackAdUrl: 'https://www.amazon.co.jp',
      activeCategorySlug: 'all',
      articles: INITIAL_ARTICLES,
      systemLogs: [],
      showAdminPanel: false,
      simulatedCronActive: false
    };
  });

  // DB States
  const [dbArticles, setDbArticles] = useState<AmazonProductArticle[]>([]);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  // Combine Firestore subscription list with initial state list beautifully
  const resolvedArticles = isDbLoaded && dbArticles.length > 0 ? dbArticles : state.articles;

  // UI States
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // CMS Editor states
  const [selectedEditArticleId, setSelectedEditArticleId] = useState<string>('');
  const [editTitle, setEditTitle] = useState<string>('');
  const [editImageUrl, setEditImageUrl] = useState<string>('');
  const [editStarRating, setEditStarRating] = useState<number>(4.5);
  const [editIntroText, setEditIntroText] = useState<string>('');
  const [editReviewBody, setEditReviewBody] = useState<string>('');
  const [editCtaTitle, setEditCtaTitle] = useState<string>('');
  const [editAffiliateLink, setEditAffiliateLink] = useState<string>('');
  const [cmsSaveLoading, setCmsSaveLoading] = useState(false);

  // Queue Form State (Vercel-safe review reservations)
  const [queueAsin, setQueueAsin] = useState('');
  const [queueName, setQueueName] = useState('');
  const [queuePrice, setQueuePrice] = useState('');
  const [queueImg, setQueueImg] = useState('');
  const [queueAffiliateLink, setQueueAffiliateLink] = useState('');
  const [queueCategory, setQueueCategory] = useState('gadgets');
  const [queueLoading, setQueueLoading] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [yamlCopied, setYamlCopied] = useState(false);

  // Navigation pushState utility
  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    // Smooth scroll to top on nav
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Listen to popstate event for back/forward browser support
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [bannerProducts, setBannerProducts] = useState<any[]>([
    {
      asin: "B0CL7Y437Z",
      name: "Fire TV Stick 4K Max - 極上の映像美とドルビーアトモス音響体験",
      price: "¥9,980",
      img: "https://picsum.photos/seed/firetv/300/200",
      label: "ベストセラー1位",
      affiliateLink: `https://www.amazon.co.jp/s?k=Fire+TV+Stick+4K&tag=${state.associateId}`
    },
    {
      asin: "B0CGDGN41Y",
      name: "Anker PowerBank (30W, 10000mAh) - 急速充電対応コンパクトモバイルバッテリー",
      price: "¥5,990",
      img: "https://picsum.photos/seed/anker/300/200",
      label: "セール中",
      affiliateLink: `https://www.amazon.co.jp/s?k=Anker+PowerBank+10000mAh&tag=${state.associateId}`
    },
    {
      asin: "B0CHX58W9G",
      name: "Apple AirPods Pro (第2世代) USB-C - 魔法のようなノイズキャンセリング",
      price: "¥39,800",
      img: "https://picsum.photos/seed/airpods/300/200",
      label: "人気急上昇",
      affiliateLink: `https://www.amazon.co.jp/s?k=AirPods+Pro&tag=${state.associateId}`
    },
    {
      asin: "B0BTMG5N5G",
      name: "SwitchBot スマートリモコン ハブ2 - 温度・湿度計付きスマートホーム中継器",
      price: "¥8,980",
      img: "https://picsum.photos/seed/switchbot/300/200",
      label: "QOL向上定番",
      affiliateLink: `https://www.amazon.co.jp/s?k=SwitchBot+%E3%83%8F%E3%83%962&tag=${state.associateId}`
    }
  ]);

  useEffect(() => {
    const fetchBannerProducts = async () => {
      try {
        const asins = "B0CL7Y437Z,B0CGDGN41Y,B0CHX58W9G,B0BTMG5N5G";
        const response = await fetch(`/api/amazon-products?asins=${asins}&tag=${state.associateId}`);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            setBannerProducts(data);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch banner products details from API, using defaults:", err);
      }
    };
    fetchBannerProducts();
  }, [state.associateId]);

  // Is Admin Route check
  const isAdminRoute = currentPath === '/host' || window.location.hash === '#/host' || window.location.search.includes('host');

  // Authorized Admin check
  const isAuthorizedAdmin = authUser?.email === 'mattan029@gmail.com';

  // Push log function (only rendered on admin console panel)
  const pushLog = (message: string, type: 'info' | 'success' | 'warn' | 'ai' = 'info') => {
    saveLogToFirestore(message, type);
  };

  // Initial Seed & Auth Subscription & Firestore Subscription
  useEffect(() => {
    // 1. Auth observer setup
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
      if (user) {
        if (user.email === 'mattan029@gmail.com') {
          pushLog(`管理者 [${user.email}] が認証に成功しました。`, 'success');
        } else {
          pushLog(`認証完了アカウント: ${user.email} (アクセス権限なし)`, 'warn');
        }

        // Auto-restore redirect target page (e.g. /host) after successful auth redirect
        const redirectTarget = localStorage.getItem('auth_redirect_target');
        if (redirectTarget) {
          localStorage.removeItem('auth_redirect_target');
          navigateTo(redirectTarget);
        }
      }
    });

    // 2. Seed initial articles if FireStore is completely empty
    seedArticlesIfEmpty(INITIAL_ARTICLES);
    seedSettingsIfEmptyOrDummy();

    // 3. Real-time Firestore subscription
    const unsubscribeArticles = subscribeToArticles(
      (items) => {
        setDbArticles(items);
        setIsDbLoaded(true);
      },
      (err) => {
        console.warn('Real-time database fetch error, staying on offline mode:', err);
        setIsDbLoaded(false);
      }
    );

    // 4. Real-time Settings subscription
    const unsubscribeSettings = subscribeToSettings((conf) => {
      setState(prev => ({
        ...prev,
        associateId: conf.associateId,
        fallbackAdUrl: conf.fallbackAdUrl
      }));
    });

    // 5. Real-time System Logs subscription
    const unsubscribeLogs = subscribeToLogs((logs) => {
      setState(prev => ({
        ...prev,
        systemLogs: logs
      }));
    });

    return () => {
      unsubscribeAuth();
      unsubscribeArticles();
      unsubscribeSettings();
      unsubscribeLogs();
    };
  }, []);

  // Persist local state for logs + category slug
  useEffect(() => {
    try {
      localStorage.setItem('amazongo_app_state_v3', JSON.stringify(state));
    } catch (e) {
      console.error('Failed to sync to local storage:', e);
    }
  }, [state]);

  // Synchronize CMS form values when selected article changes
  useEffect(() => {
    const art = resolvedArticles.find(a => a.id === selectedEditArticleId);
    if (art) {
      setEditTitle(art.title || '');
      setEditImageUrl(art.imageUrl || '');
      setEditStarRating(art.starRating || 4.5);
      setEditIntroText(art.introText || '');
      setEditReviewBody(art.reviewBody || '');
      setEditCtaTitle(art.ctaTitle || '');
      setEditAffiliateLink(art.affiliateLink || '');
    } else {
      setEditTitle('');
      setEditImageUrl('');
      setEditStarRating(4.5);
      setEditIntroText('');
      setEditReviewBody('');
      setEditCtaTitle('');
      setEditAffiliateLink('');
    }
  }, [selectedEditArticleId, resolvedArticles]);



  // Google Login handling
  const handleGoogleLogin = async () => {
    try {
      localStorage.setItem('auth_redirect_target', '/host');
      await loginWithGoogle();
    } catch (err: any) {
      console.error("Auth redirect failed:", err);
      alert(`Googleログイン認証の開始中にエラーが発生しました。\nエラーコード: ${err.code}\nエラーメッセージ: ${err.message}`);
    }
  };

  // Log out handling
  const handleSignOut = async () => {
    try {
      await logoutUser();
      pushLog("ホストログアウトしました。", "info");
    } catch (err) {
      console.error(err);
    }
  };

  // CMS edit handler to save article changes to database and local state
  const handleUpdateArticle = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEditArticleId) {
      alert("編集・修正する記事を選択してください。");
      return;
    }
    setCmsSaveLoading(true);
    try {
      const art = resolvedArticles.find(a => a.id === selectedEditArticleId);
      if (!art) {
        throw new Error("対象の記事が見つかりません。");
      }

      const updatedArticle: AmazonProductArticle = {
        ...art,
        title: editTitle,
        imageUrl: editImageUrl,
        starRating: Number(editStarRating),
        introText: editIntroText,
        reviewBody: editReviewBody,
        ctaTitle: editCtaTitle,
        affiliateLink: editAffiliateLink,
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
      };

      // Save to Firebase if authenticated admin
      if (isAuthorizedAdmin) {
        await saveArticleToFirestore(updatedArticle);
      }

      // Sync local state as well
      setState(prev => ({
        ...prev,
        articles: prev.articles.map(a => a.id === selectedEditArticleId ? updatedArticle : a)
      }));

      pushLog(`記事「${updatedArticle.title}」の文字修正を保存しました。`, "success");
      alert("修正内容が保存されました！");
    } catch (err: any) {
      console.error("CMS Edit failed:", err);
      alert(`記事の修正保存中にエラーが発生しました。\nエラー詳細: ${err.message || err}`);
    } finally {
      setCmsSaveLoading(false);
    }
  };

  // Queue custom product for review (adds to stock_products)
  const handleQueueProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!queueAsin || !queueName) {
      alert("ASINと商品名は必須です。");
      return;
    }
    setQueueLoading(true);
    try {
      const resolvedAsin = queueAsin.trim().toUpperCase();
      const isSony = resolvedAsin === "B0D2XBV7FZ" || resolvedAsin === "B09Y2MYLMC";
      const resolvedLink = queueAffiliateLink.trim() || (isSony
        ? "https://amzn.to/4fZYn2T"
        : `https://www.amazon.co.jp/s?k=${encodeURIComponent(queueName.trim())}&tag=${state.associateId}`);
      const resolvedPrice = queuePrice.trim() || "オープン価格";
      const resolvedImg = queueImg.trim() || `https://picsum.photos/seed/${resolvedAsin}/400/300`;

      await addProductToStockInFirestore({
        asin: resolvedAsin,
        name: queueName.trim(),
        price: resolvedPrice,
        img: resolvedImg,
        affiliateLink: resolvedLink,
        category: queueCategory
      });

      pushLog(`商品「${queueName}」（ASIN: ${resolvedAsin}）を自動レビュー生成待ちキューに追加しました。`, "success");
      alert("レビュー執筆予約を登録しました！GitHub Actionsの次の実行時に執筆されます。");
      
      // Clear form
      setQueueAsin('');
      setQueueName('');
      setQueuePrice('');
      setQueueImg('');
      setQueueAffiliateLink('');
    } catch (err: any) {
      console.error("Failed to queue product:", err);
      alert(`キューへの追加中にエラーが発生しました。\nエラー詳細: ${err.message || err}`);
    } finally {
      setQueueLoading(false);
    }
  };

  // Article deletion
  const handleDeleteArticle = async (id: string, titleStr: string) => {
    if (!confirm(`「${titleStr}」のレビューをデータベースから削除しますか？`)) return;

    try {
      // Authorized check
      if (isAuthorizedAdmin) {
        await deleteArticleFromFirestore(id);
      }

      setState(prev => ({
        ...prev,
        articles: prev.articles.filter(a => a.id !== id)
      }));

      if (selectedArticleId === id) setSelectedArticleId(null);
      pushLog(`記事「${titleStr}」を削除しました。`, "warn");
    } catch (err) {
      console.error(err);
      alert("記事の削除に失敗しました。認証トークンの期限等を確認してください。");
    }
  };

  // Total reset catalog to defaults
  const handleResetCatalog = async () => {
    if (!confirm("全ての記事の成果データを0にリセットし、最新の正しいリンク（Sonyは短縮リンク、他は検索リンク）で初期記事を再配置しますか？")) return;

    try {
      const cleanArticles = INITIAL_ARTICLES.map(art => ({
        ...art,
        clicks: 0,
        earnings: 0,
        estimatedPV: 0
      }));

      // Update in Firebase if authenticated admin
      if (isAuthorizedAdmin && isDbLoaded) {
        // Delete all currently loaded dbArticles from Firestore first to clear the slate
        for (const art of dbArticles) {
          await deleteArticleFromFirestore(art.id);
        }
        // Save the correct seed articles
        for (const art of cleanArticles) {
          await saveArticleToFirestore(art);
        }
        // Clear stock products
        await clearStockProductsInFirestore();
      }

      setState(prev => ({
        ...prev,
        articles: cleanArticles,
        systemLogs: [
          { id: Math.random().toString(), timestamp: new Date().toLocaleTimeString(), message: "成果カウンターをリセットし、最新の正しい個別商品リンクで初期記事を再同期しました。", type: "info" }
        ],
        simulatedCronActive: false
      }));
      setSelectedArticleId(null);
      pushLog("成果カウンターと初期レビュー記事が正常に再配置されました。", "success");
    } catch (err) {
      console.error(err);
      alert("カウンターのリセット中にエラーが発生しました。");
    }
  };

  // Copy Clean Structured Text to Clipboard (No raw markdown hashes)
  const handleCopyMarkdown = (art: AmazonProductArticle) => {
    const textToCopy = `title: "${art.title}"
asin: "${art.asin}"
category: "${art.category}"
tag: "${state.associateId}"
link: "${art.affiliateLink}"

【タイトル】
${art.title}

🌟 総合評価: ⭐ ${art.starRating} / 5.0

【紹介文】
${art.introText}

💡 際立つ特徴・アピールポイント
${art.features.map(f => `・ ${f}`).join('\n')}

⭕ 圧倒的なメリット
${art.pros.map(p => `・ ${p}`).join('\n')}

❌ 検討すべき注意点
${art.cons.map(c => `・ ${c}`).join('\n')}

--------------------------------------------------

【レビュー本文】
${cleanMarkdownHeaders(art.reviewBody)}

--------------------------------------------------

👉 限定特典特設ページへのリンク
[${art.ctaTitle}]
${art.affiliateLink}
`;

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedId(art.id);
      setTimeout(() => setCopiedId(null), 2000);
      pushLog(`「${art.title}」のMarkdownコードをエクスポートしました。`, "success");
    });
  };

  // Copy YAML workflows
  const handleCopyYaml = () => {
    const yamlTemplate = `name: "あまぞん GO!! 定刻自動巡回レビュー自動配信"

on:
  schedule:
    - cron: '0 * * * *' # 毎時間自動起動
  workflow_dispatch: # 手動実行

jobs:
  build-and-generate:
    runs-on: ubuntu-latest
    steps:
      - name: リポジトリチェックアウト
        uses: actions/checkout@v4

      - name: Node.jsのインストール
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: パッケージインストール
        run: npm ci

      - name: 自動レビュー生成システム
        env:
          GEMINI_API_KEY: \${{ secrets.GEMINI_API_KEY }}
          AMAZON_ASSOCIATE_ID: "${state.associateId}"
        run: |
          npm run auto-generate-cron -- --category=all
`;
    navigator.clipboard.writeText(yamlTemplate).then(() => {
      setYamlCopied(true);
      setTimeout(() => setYamlCopied(false), 2500);
      pushLog("GitHub Actions YAML構成をコピーしました。", "success");
    });
  };



  // Is Review Route check
  const isReviewRoute = currentPath.startsWith('/review/');
  const reviewArticleId = isReviewRoute ? currentPath.split('/review/')[1] : null;
  const reviewArticle = resolvedArticles.find(a => a.id === reviewArticleId);

  // Filter articles by active category slug and search queries
  const filteredArticles = resolvedArticles.filter(art => {
    const categoryMatches = state.activeCategorySlug === 'all' || art.category === state.activeCategorySlug;
    const queryMatches = !searchQuery.trim() ||
      art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.reviewBody.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.asin.toLowerCase().includes(searchQuery.toLowerCase());
    return categoryMatches && queryMatches;
  });

  const selectedArticle = resolvedArticles.find(a => a.id === selectedArticleId) || filteredArticles[0];
  const activeArticle = isReviewRoute ? (reviewArticle || null) : (selectedArticle || null);

  // Dynamically set noindex, nofollow for secret page to keep crawlers away
  useEffect(() => {
    let robotsMeta = document.querySelector('meta[name="robots"]');
    if (isAdminRoute) {
      if (!robotsMeta) {
        robotsMeta = document.createElement("meta");
        robotsMeta.setAttribute("name", "robots");
        document.head.appendChild(robotsMeta);
      }
      robotsMeta.setAttribute("content", "noindex, nofollow");
    } else {
      if (robotsMeta) {
        robotsMeta.setAttribute("content", "index, follow");
      }
    }
  }, [isAdminRoute]);

  // Dynamically set meta description and JSON-LD schema markup for the active article (Automated SEO)
  useEffect(() => {
    if (!activeArticle) {
      document.title = "あまぞん GO!! - QOL向上商品レビューメディア";
      return;
    }

    // 0. Update document title
    document.title = `${activeArticle.title} | あまぞん GO!!`;

    // 1. Update meta description
    let metaDescriptionEl = document.querySelector('meta[name="description"]');
    if (!metaDescriptionEl) {
      metaDescriptionEl = document.createElement("meta");
      metaDescriptionEl.setAttribute("name", "description");
      document.head.appendChild(metaDescriptionEl);
    }
    const cleanIntro = activeArticle.introText || "";
    metaDescriptionEl.setAttribute("content", `${activeArticle.title} - ${cleanIntro.substring(0, 150)}`);

    // 2. Inject JSON-LD Schema Markup for standard crawler bots
    let jsonLdScript = document.getElementById("schema-jsonld") as HTMLScriptElement;
    if (!jsonLdScript) {
      jsonLdScript = document.createElement("script");
      jsonLdScript.id = "schema-jsonld";
      jsonLdScript.setAttribute("type", "application/ld+json");
      document.head.appendChild(jsonLdScript);
    }

    const schemaObj = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": activeArticle.title,
      "image": activeArticle.imageUrl,
      "description": activeArticle.introText,
      "mpn": activeArticle.asin,
      "sku": activeArticle.asin,
      "brand": {
        "@type": "Brand",
        "name": "Amazon"
      },
      "review": {
        "@type": "Review",
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": activeArticle.starRating,
          "bestRating": "5"
        },
        "author": {
          "@type": "Organization",
          "name": "あまぞん GO!!"
        },
        "reviewBody": cleanMarkdownHeaders(activeArticle.reviewBody)
      },
      "offers": {
        "@type": "Offer",
        "url": activeArticle.affiliateLink,
        "priceCurrency": "JPY",
        "price": "OpenPrice",
        "availability": "https://schema.org/InStock"
      }
    };

    jsonLdScript.textContent = JSON.stringify(schemaObj, null, 2);
  }, [activeArticle]);

  return (
    <div className="min-h-screen bg-[#070708] text-zinc-100 flex items-center justify-center p-2 sm:p-6 md:p-8 font-sans overflow-x-hidden relative selection:bg-orange-500 selection:text-white">
      {/* Glow ambient meshes */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-amber-500/5 blur-[140px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-0 w-[400px] h-[400px] bg-orange-500/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-[1380px] bg-[#0c0c0e] border border-zinc-900 rounded-2xl p-4 sm:p-6 md:p-8 lg:p-10 flex flex-col gap-6 relative shadow-[0_24px_80px_rgba(0,0,0,0.85)] max-h-none">

        {/* ==================================================================== */}
        {/* ================ HEADER COMPONENT: PATHWAY ROUTER ================= */}
        {/* ==================================================================== */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-900 pb-5 gap-4">

          {/* Logo & Category Slogan */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
              <span className="text-[10px] sm:text-xs tracking-[0.25em] text-orange-400 font-bold uppercase font-mono">
                {isAdminRoute ? "AMAZON GO HOST MANAGER SECURITY CORE" : "CURATED SHOPPING EXPERT REVIEWS"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div
                onClick={() => {
                  setSearchQuery('');
                  setState(prev => ({ ...prev, activeCategorySlug: 'all' }));
                  setSelectedArticleId(null);
                  navigateTo('/');
                }}
                className="bg-zinc-900 text-amber-500 border border-zinc-800/80 font-black text-xl sm:text-2xl md:text-3xl px-3.5 py-1 rounded-lg tracking-tighter flex items-center gap-1.5 hover:border-amber-500/40 cursor-pointer shadow-inner transition-all"
              >
                あまぞん GO!!
              </div>
              <span className="text-zinc-700 text-base font-normal hidden sm:inline">|</span>
              <p className="text-xs sm:text-sm text-zinc-400 font-medium">
                {isAdminRoute ? "管理者コンソール・アフィリエイト設定" : "バイヤーが徹底検証。本当に買ってよかったモノだけを紹介する本音ブログ"}
              </p>
            </div>
          </div>

          {/* Symmetrical Action Hub Toggle buttons */}
          <div className="flex items-center gap-3.5 self-stretch sm:self-auto justify-end ml-auto">
            {isAdminRoute && (
              <button
                onClick={() => navigateTo('/')}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-md hover:brightness-110 transition-all cursor-pointer"
              >
                <Store className="w-3.5 h-3.5" />
                公開サイトへ戻る
              </button>
            )}
          </div>
        </div>

        {/* ==================================================================== */}
        {/* ======================= CASE 1: PUBLIC DISCOVERY FRONTEND =========== */}
        {/* ==================================================================== */}
        {!isAdminRoute && (
          isReviewRoute ? (
            // REVIEW DETAIL PAGE VIEW
            <div className="w-full text-left space-y-6">
              {/* Back breadcrumb */}
              <button
                onClick={() => navigateTo('/')}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-orange-400 transition-all font-bold group cursor-pointer mb-6 self-start bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg"
              >
                <ChevronRight className="w-4 h-4 rotate-180 group-hover:-translate-x-0.5 transition-transform" />
                レビュー一覧に戻る
              </button>

              {reviewArticle ? (
                <div className="max-w-4xl mx-auto bg-zinc-900/20 border border-zinc-900 p-6 sm:p-8 rounded-2xl flex flex-col gap-6 shadow-2xl">
                  {/* Category badge and ASIN */}
                  <div className="flex flex-wrap items-center gap-3 border-b border-zinc-900 pb-4">
                    <span className="text-xs bg-orange-500/10 text-orange-400 font-mono font-bold px-2 py-0.5 rounded border border-orange-500/20">
                      {AMAZON_CATEGORIES.find(c => c.slug === reviewArticle.category)?.name}
                    </span>
                    <span className="text-xs text-zinc-500 font-mono">
                      ASIN: {reviewArticle.asin}
                    </span>
                  </div>

                  {/* Title & Star Rating */}
                  <div className="flex flex-wrap justify-between items-start gap-4">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-snug flex-1">
                      {reviewArticle.title}
                    </h1>
                    <div className="flex items-center gap-1.5 bg-zinc-900 px-3 py-1.5 rounded border border-zinc-800 text-amber-400 font-extrabold text-sm sm:text-base flex-shrink-0">
                      <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-amber-400 text-amber-400" />
                      <span>{reviewArticle.starRating}</span>
                    </div>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono">
                    投稿日: {reviewArticle.createdAt}
                  </span>

                  {/* Main Product Info Block */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2">
                    <div className="md:col-span-4 aspect-square bg-zinc-950 rounded-xl overflow-hidden border border-zinc-900 shadow-md">
                      <img src={getValidImageUrl(reviewArticle.imageUrl, reviewArticle.category, reviewArticle.title)} alt={reviewArticle.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="md:col-span-8 flex flex-col justify-between gap-4">
                      <div className="bg-gradient-to-r from-zinc-950 to-zinc-900/40 p-4 sm:p-5 rounded-xl border border-zinc-900/60 font-sans italic text-zinc-300 leading-relaxed text-sm sm:text-base">
                        「 {reviewArticle.introText} 」
                      </div>
                      <div className="space-y-2">
                        <span className="text-xs font-black text-orange-400 uppercase tracking-widest block">🔑 注目すべき特徴</span>
                        <ul className="text-xs sm:text-sm space-y-1.5 text-zinc-400 font-sans">
                          {reviewArticle.features.map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-orange-500 font-bold">✓</span>
                              <span>{cleanMarkdownHeaders(feat)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Pros & Cons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                    <div className="bg-[#0b100e] border border-emerald-950/60 p-4 rounded-xl text-xs sm:text-sm space-y-3">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-black border-b border-emerald-950/80 pb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        メリット（良かった点）
                      </div>
                      <ul className="space-y-1.5 text-zinc-300 font-sans leading-relaxed">
                        {reviewArticle.pros.map((p, idx) => (
                          <li key={idx} className="flex gap-1.5">
                            <span className="text-emerald-500 font-bold">＋</span>
                            {cleanMarkdownHeaders(p)}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-[#120a0a] border border-red-950/60 p-4 rounded-xl text-xs sm:text-sm space-y-3">
                      <div className="flex items-center gap-1.5 text-red-400 font-black border-b border-red-950/80 pb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                        デメリット・懸念点
                      </div>
                      <ul className="space-y-1.5 text-zinc-300 font-sans leading-relaxed">
                        {reviewArticle.cons.map((c, idx) => (
                          <li key={idx} className="flex gap-1.5">
                            <span className="text-red-400 font-bold">－</span>
                            {cleanMarkdownHeaders(c)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Review body */}
                  <div className="border-t border-zinc-900 pt-6 mt-4 space-y-3">
                    <span className="text-xs text-zinc-500 font-mono font-bold uppercase tracking-widest block">実機レビュー検証記録</span>
                    <div className="text-sm sm:text-base text-zinc-200 leading-relaxed space-y-4 pr-1 border-l border-zinc-800 pl-4 whitespace-pre-line font-sans">
                      {renderReviewBodyWithLinks(reviewArticle.reviewBody, resolvedArticles, reviewArticle.id, navigateTo)}
                    </div>
                  </div>

                  {/* CTA link bar */}
                  <div className="mt-8 pt-6 border-t border-zinc-900">
                    <div className="bg-gradient-to-r from-orange-600/10 via-amber-500/10 to-orange-500/10 border border-orange-500/20 p-6 rounded-xl text-center shadow-md relative overflow-hidden group">
                      <span className="text-sm sm:text-base text-amber-500 font-sans font-black tracking-widest block mb-3 px-1">
                        {reviewArticle.ctaTitle}
                      </span>
                      <a
                        href={reviewArticle.affiliateLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-black font-extrabold text-sm sm:text-base tracking-wider px-8 sm:px-12 py-4 rounded-lg transition-all shadow-[0_4px_18px_rgba(249,115,22,0.15)] cursor-pointer animate-pulse"
                      >
                        Amazon 公式サイトで最安値をチェックする
                        <ArrowUpRight className="w-5 h-5 text-black font-extrabold" />
                      </a>
                      <span className="text-[10px] sm:text-xs text-zinc-500 font-mono mt-3 block">
                        ※上記リンクからAmazon.co.jpに遷移してご購入いただくと、割引価格や限定アソシエイト保証が適用されます。
                      </span>
                    </div>
                  </div>

                  {/* Related Articles (Internal Links) */}
                  {(() => {
                    const related = resolvedArticles.filter(a => a.id !== reviewArticle.id && a.category === reviewArticle.category).slice(0, 3);
                    const fallbacks = resolvedArticles.filter(a => a.id !== reviewArticle.id && a.category !== reviewArticle.category);
                    const finalRelated = [...related, ...fallbacks].slice(0, 3);
                    if (finalRelated.length === 0) return null;
                    return (
                      <div className="border-t border-zinc-900 pt-8 mt-10 text-left">
                        <h3 className="text-xs sm:text-sm font-black text-orange-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                          こちらのレビュー記事もおすすめ（関連記事）
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                          {finalRelated.map((art) => (
                            <div
                              key={art.id}
                              onClick={() => navigateTo(`/review/${art.id}`)}
                              className="bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 hover:bg-[#0e0e11] p-4 rounded-xl text-left cursor-pointer transition-all flex flex-col gap-3 group relative overflow-hidden"
                            >
                              <div className="aspect-video w-full bg-zinc-900 rounded-lg overflow-hidden border border-zinc-855 relative">
                                <img src={getValidImageUrl(art.imageUrl, art.category, art.title)} alt={art.title} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" referrerPolicy="no-referrer" />
                              </div>
                              <div className="flex-1 flex flex-col justify-between">
                                <h4 className="text-xs sm:text-sm font-bold text-zinc-300 group-hover:text-white line-clamp-2 leading-snug">
                                  {art.title}
                                </h4>
                                <span className="text-[10px] text-zinc-500 font-mono block mt-2">
                                  公開日: {art.createdAt.substring(0, 10)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="bg-zinc-900/10 border border-dashed border-zinc-900 rounded-xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                  <BookOpen className="w-12 h-12 text-zinc-700 mb-2 animate-bounce" />
                  <p className="text-sm text-zinc-500">お探しのレビュー記事が見つかりません。</p>
                </div>
              )}
            </div>
          ) : (
            // ORIGINAL DISCOVERY GRID LAYOUT
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1">
              {/* LEFT CONTAINER: LIST FILTERS & SEARCH (3 columns) */}
              <div className="col-span-1 lg:col-span-3 flex flex-col gap-4">
                {/* Refinement Search input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5 sm:top-3.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="カテゴリーを検索する..."
                    className="w-full bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 focus:border-orange-500 focus:outline-none rounded-lg pl-9 pr-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white placeholder-zinc-500 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-2 sm:top-3 text-zinc-400 hover:text-white text-xs sm:text-sm font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Sidebar Category Selection */}
                <div className="bg-zinc-900/30 border border-zinc-900 rounded-xl p-3 sm:p-4 flex flex-col gap-1.5 text-left">
                  <span className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-widest px-2.5 pb-2 border-b border-zinc-900/60 mb-2 block">
                    カテゴリー
                  </span>

                  <button
                    onClick={() => setState(prev => ({ ...prev, activeCategorySlug: 'all' }))}
                    className={`w-full flex items-center justify-between px-3 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer text-left
                      \${state.activeCategorySlug === 'all'
                        ? 'bg-orange-500/10 text-orange-400 border-l-[3px] border-orange-500'
                        : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span>すべてのカテゴリー ({resolvedArticles.length})</span>
                    </div>
                    <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-700" />
                  </button>

                  {AMAZON_CATEGORIES.map((cat) => {
                    const countInCat = resolvedArticles.filter(a => a.category === cat.slug).length;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setState(prev => ({ ...prev, activeCategorySlug: cat.slug }))}
                        className={`w-full flex items-center justify-between px-3 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer text-left
                          \${state.activeCategorySlug === cat.slug
                            ? 'bg-orange-500/10 text-orange-400 border-l-[3px] border-orange-500'
                            : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200'
                          }`}
                        title={cat.description}
                      >
                        <div className="flex items-center gap-2 truncate pr-1">
                          <CategoryIcon icon={cat.icon} className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span className="truncate">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-[10px] sm:text-xs bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-550 font-mono">
                            {countInCat}
                          </span>
                          <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-750" />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Secure Editorial Quality Statement */}
                <div className="bg-zinc-950/40 border border-zinc-900 p-4 sm:p-5 rounded-xl text-left space-y-2">
                  <h4 className="text-xs sm:text-sm font-bold text-zinc-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
                    本音と透明性を最優先
                  </h4>
                  <p className="text-[11px] sm:text-xs text-zinc-500 leading-normal">
                    紹介しているアイテムはすべて専門バイヤーによる詳細調査に基づいています。メリットだけでなくデメリットも正直に隠さず記述。
                  </p>
                </div>
              </div>

              {/* RIGHT MAIN VIEWPORT: FEED SPILTTER (9 columns - Grid layout of 3 columns!) */}
              <div className="col-span-1 lg:col-span-9 flex flex-col gap-4 overflow-y-auto max-h-[820px] pr-1 custom-scrollbar">
                <div className="flex justify-between items-center bg-zinc-950/30 p-2.5 rounded-lg border border-zinc-900/50 text-left">
                  <h3 className="text-xs sm:text-sm font-black text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span>レビュー一覧</span>
                    <span className="text-[10px] sm:text-xs bg-zinc-900 px-2 py-0.5 rounded text-zinc-500 font-mono">
                      {filteredArticles.length}
                    </span>
                  </h3>
                  {state.activeCategorySlug !== 'all' && (
                    <span className="text-[9px] sm:text-xs text-orange-400 font-bold bg-orange-500/5 px-2 py-0.5 rounded border border-orange-500/10">
                      {AMAZON_CATEGORIES.find(c => c.slug === state.activeCategorySlug)?.name}
                    </span>
                  )}
                </div>

                {filteredArticles.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredArticles.map((art) => (
                      <div
                        key={art.id}
                        onClick={() => navigateTo(`/review/${art.id}`)}
                        className="bg-[#0a0a0c] border border-[#131317] hover:border-zinc-800 hover:bg-[#0e0e11] p-4 rounded-xl text-left cursor-pointer transition-all flex flex-col gap-3 group relative overflow-hidden"
                      >
                        <div className="aspect-video w-full bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800/80 relative">
                          <img src={getValidImageUrl(art.imageUrl, art.category, art.title)} alt={art.title} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" referrerPolicy="no-referrer" />
                          <span className="absolute bottom-2 right-2 text-[10px] bg-black/80 px-2 py-0.5 rounded text-orange-400 font-mono font-bold flex items-center gap-0.5">
                            <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
                            {art.starRating}
                          </span>
                        </div>
                        <div className="flex-1 flex flex-col justify-between gap-3">
                          <div>
                            <span className="text-[9px] text-[#FF9900] font-mono px-1.5 py-0.5 bg-orange-500/5 border border-orange-500/10 rounded uppercase tracking-wider mb-2 inline-block">
                              {AMAZON_CATEGORIES.find(c => c.slug === art.category)?.name}
                            </span>
                            <h4 className="text-sm font-bold text-zinc-300 group-hover:text-white line-clamp-2 leading-snug">
                              {art.title}
                            </h4>
                          </div>
                          <span className="text-[10px] text-zinc-550 font-mono block mt-auto">
                            公開日: {art.createdAt.substring(0, 10)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-zinc-900 rounded-xl p-10 text-center opacity-60">
                    <BookOpen className="w-8 h-8 mx-auto text-zinc-500 mb-2" />
                    <p className="text-xs sm:text-sm text-zinc-400">
                      該当カテゴリーのレビュー記事は現在スタンバイ中です。
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        )}        {/* ==================================================================== */}
        {/* ======================= CASE 2: HOST ADMIN PANEL =================== */}
        {/* ==================================================================== */}
        {isAdminRoute && (
          <div className="w-full">

            {/* SUB-FLOW: GOOGLE AUTH REQUIREMENT SCREEN */}
            {authLoading ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-4">
                <RefreshCw className="w-10 h-10 text-orange-500 animate-spin" />
                <p className="text-xs text-zinc-400 font-mono">管理者セッションを検証中...</p>
              </div>
            ) : !authUser ? (
              <div className="max-w-md mx-auto my-12 bg-zinc-950 border border-zinc-900 p-6 sm:p-8 rounded-2xl text-center space-y-6 shadow-2xl">
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mx-auto border border-orange-500/20">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-white">ホスト管理者アクセス制限</h2>
                  <p className="text-xs text-zinc-400">
                    「あまぞん GO!!」管理コンソールへ入るには、Googleログイン認証を通過する必要があります。
                  </p>
                </div>

                <div className="border border-dashed border-zinc-850 p-4 rounded-xl text-left bg-zinc-900/20">
                  <span className="text-[9px] font-bold text-orange-400 block mb-1 uppercase tracking-wider">
                    ※ 許可されたアクセス用アカウント
                  </span>
                  <p className="text-xs text-zinc-200 font-bold flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-zinc-450" />
                    ご指定の特権管理者アカウントのみ
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-1.5 leading-normal">
                    ご指定の管理者アカウント以外のメールアドレスでログインされた場合、記事の書き込みやダッシュボード編集操作などはブロックされます。
                  </p>
                </div>

                <button
                  onClick={handleGoogleLogin}
                  className="w-full bg-white hover:bg-gray-100 text-black font-extrabold text-xs tracking-wider py-3 px-4 rounded-lg flex items-center justify-center gap-2.5 transition-all shadow-md cursor-pointer"
                >
                  <LogIn className="w-4 h-4 text-black" />
                  Google 認証でサインイン
                </button>

                {/* Debug Session Info Helper */}
                <div className="mt-4 text-[10px] text-zinc-600 space-y-1 font-mono text-left bg-[#0c0c0e]/80 p-3 rounded-xl border border-zinc-900">
                  <p className="text-orange-400 font-bold uppercase tracking-wider text-[9px] mb-1">🔧 接続デバッグ情報</p>
                  <p>状態: {authLoading ? "読み込み中..." : "接続済み"}</p>
                  <p>アカウント: {authUser ? authUser.email : "未ログイン"}</p>
                  <p>管理権限判定: {isAuthorizedAdmin ? "許可 (Admin)" : "拒否 (Unauthorized)"}</p>
                </div>
              </div>
            ) : !isAuthorizedAdmin ? (
              <div className="max-w-md mx-auto my-12 bg-zinc-950 border border-zinc-900 p-8 rounded-2xl text-center space-y-6">
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-white">アクセスが拒否されました</h2>
                  <p className="text-xs text-zinc-400">
                    申し訳ありませんが、入力されたアカウントには管理権限がありません。
                  </p>
                </div>

                <div className="border border-[#1f0f0f] p-4 rounded-xl text-left bg-[#150a0a]">
                  <p className="text-xs text-zinc-400">
                    現在ログイン中のアドレス:
                  </p>
                  <p className="text-xs text-red-400 font-mono font-bold mt-1">
                    {authUser.email}
                  </p>
                </div>

                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={handleSignOut}
                    className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-bold text-xs py-2.5 rounded-lg transition-all cursor-pointer"
                  >
                    アカウントを変更する
                  </button>
                  <button
                    onClick={() => navigateTo('/')}
                    className="w-full bg-orange-500 text-black font-black text-xs py-2.5 rounded-lg transition-all cursor-pointer"
                  >
                    一般公開サイトに戻る
                  </button>
                </div>
              </div>
            ) : (

              /* SUB-FLOW: LOGGED EXECUTOR PANEL (AUTHORIZED mattan029@gmail.com) */
              <div className="space-y-6">

                {/* Host User status block */}
                <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-4 flex flex-wrap justify-between items-center gap-4 text-xs font-sans">
                  <div className="flex items-center gap-3">
                    {authUser.photoURL ? (
                      <img src={authUser.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-orange-500/30" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold">
                        A
                      </div>
                    )}
                    <div>
                      <p className="text-zinc-400 font-mono">
                        ログイン管理者: <strong className="text-white font-mono">{authUser.email}</strong>
                      </p>
                      <span className="text-[10px] text-emerald-400 font-mono font-bold uppercase flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                        FireStore Database & Auth Sync Status: Verified
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleSignOut}
                    className="ml-auto bg-zinc-950 border border-zinc-900 hover:border-zinc-800 text-zinc-400 hover:text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 cursor-pointer shadow-inner"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    ログアウト
                  </button>
                </div>

                {/* Dashboard Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">

                  <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl flex items-center gap-3.5">
                    <div className="p-2.5 bg-orange-500/10 text-orange-400 rounded-lg">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider block font-bold">推定成果（シミュレーション）</span>
                      <span className="text-lg font-mono font-black text-white">
                        ¥{resolvedArticles.reduce((sum, item) => sum + item.earnings, 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl flex items-center gap-3.5">
                    <div className="p-2.5 bg-[#0080ff]/10 text-blue-400 rounded-lg">
                      <ChevronRight className="w-5 h-5 rotate-45" />
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider block font-bold">総アフィクリック（シミュレーション）</span>
                      <span className="text-lg font-mono font-black text-zinc-200">
                        {resolvedArticles.reduce((sum, item) => sum + item.clicks, 0).toLocaleString()} <em className="text-xs text-zinc-400 not-italic">回</em>
                      </span>
                    </div>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl flex items-center gap-3.5">
                    <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider block font-bold">データベース蓄積記事</span>
                      <span className="text-lg font-mono font-black text-white">
                        {resolvedArticles.length} <em className="text-xs text-zinc-400 not-italic">記事</em>
                      </span>
                    </div>
                  </div>

                </div>

                {/* Main Double Grid: CMS and Queue reservation form on Left, terminal / actions on Right */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

                  {/* LEFT PANELS: CMS EDITOR & QUEUE ENGINES (6 columns) */}
                  <div className="lg:col-span-6 flex flex-col gap-6">

                    {/* Review CMS Editor Form */}
                    <div className="bg-zinc-950 border border-zinc-900 p-5 sm:p-6 rounded-xl text-left space-y-4">
                      <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
                        <FileText className="text-orange-500 w-5 h-5 flex-shrink-0" />
                        <div>
                          <h3 className="font-black text-white text-xs sm:text-sm">あまぞん GO!! 個別記事の文字修正CMS</h3>
                          <p className="text-[10px] text-zinc-500">公開済みの個別記事の文章やリンクをご自身で自由に編集・修正できます</p>
                        </div>
                      </div>

                      <form onSubmit={handleUpdateArticle} className="space-y-4 text-xs">

                        <div className="space-y-1.5">
                          <label className="text-[9px] text-zinc-400 uppercase tracking-widest font-black block">
                            修正する記事を選択（必須）
                          </label>
                          <select
                            value={selectedEditArticleId}
                            onChange={(e) => setSelectedEditArticleId(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2.5 rounded-lg text-white focus:outline-none focus:border-orange-500 cursor-pointer"
                          >
                            <option value="">-- 記事を選択してください --</option>
                            {resolvedArticles.map(art => (
                              <option key={art.id} value={art.id}>
                                [{art.category}] {art.title}
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedEditArticleId && (
                          <>
                            <div className="space-y-1.5">
                              <label className="text-[9px] text-zinc-401 uppercase tracking-widest font-black block">
                                記事タイトル
                              </label>
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2.5 rounded-lg text-white placeholder-zinc-700 focus:outline-none focus:border-orange-500"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[9px] text-zinc-400 uppercase tracking-widest font-black block">
                                  評価スコア (4.0〜5.0)
                                </label>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="4.0"
                                  max="5.0"
                                  value={editStarRating}
                                  onChange={(e) => setEditStarRating(parseFloat(e.target.value))}
                                  className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2.5 rounded-lg text-white focus:outline-none focus:border-orange-500"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[9px] text-zinc-400 uppercase tracking-widest font-black block">
                                  CTAボタン文言
                                </label>
                                <input
                                  type="text"
                                  value={editCtaTitle}
                                  onChange={(e) => setEditCtaTitle(e.target.value)}
                                  className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2.5 rounded-lg text-white placeholder-zinc-700 focus:outline-none focus:border-orange-500"
                                />
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[9px] text-zinc-400 uppercase tracking-widest font-black block">
                                紹介導入文
                              </label>
                              <textarea
                                rows={2}
                                value={editIntroText}
                                onChange={(e) => setEditIntroText(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2.5 rounded-lg text-white placeholder-zinc-700 focus:outline-none focus:border-orange-500"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[9px] text-zinc-400 uppercase tracking-widest font-black block">
                                画像 URL
                              </label>
                              <input
                                type="text"
                                value={editImageUrl}
                                onChange={(e) => setEditImageUrl(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 rounded-lg text-white placeholder-zinc-700 focus:outline-none focus:border-orange-500"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[9px] text-zinc-400 uppercase tracking-widest font-black block">
                                アフィリエイトリンク URL
                              </label>
                              <input
                                type="text"
                                value={editAffiliateLink}
                                onChange={(e) => setEditAffiliateLink(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 rounded-lg text-white font-mono placeholder-zinc-700 focus:outline-none focus:border-orange-500"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[9px] text-zinc-400 uppercase tracking-widest font-black block">
                                詳細レビュー本文
                              </label>
                              <textarea
                                rows={5}
                                value={editReviewBody}
                                onChange={(e) => setEditReviewBody(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2.5 rounded-lg text-white font-sans placeholder-zinc-700 focus:outline-none focus:border-orange-500"
                              />
                            </div>

                            <button
                              type="submit"
                              disabled={cmsSaveLoading}
                              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-black font-black py-3 rounded-lg uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                              {cmsSaveLoading ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  CMSデータベース保存中...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4 text-black" />
                                  修正内容をデータベースに保存
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </form>
                    </div>

                    {/* Review Queue Reservation Form */}
                    <div className="bg-zinc-950 border border-zinc-900 p-5 sm:p-6 rounded-xl text-left space-y-4">
                      <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
                        <Clock className="text-orange-500 w-5 h-5 flex-shrink-0" />
                        <div>
                          <h3 className="font-black text-white text-xs sm:text-sm">自動レビュー執筆の予約（キュー追加）</h3>
                          <p className="text-[10px] text-zinc-500">任意の商品のASINや名称を登録すると、GitHub Actionsが自動巡回時に執筆します</p>
                        </div>
                      </div>

                      <form onSubmit={handleQueueProduct} className="space-y-4 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[9px] text-zinc-400 uppercase tracking-widest font-black block">
                              ASINコード（必須）
                            </label>
                            <input
                              type="text"
                              required
                              value={queueAsin}
                              onChange={(e) => setQueueAsin(e.target.value)}
                              placeholder="例: B0CL7Y437Z"
                              className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2.5 rounded-lg text-white focus:outline-none focus:border-orange-500 font-mono"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[9px] text-zinc-400 uppercase tracking-widest font-black block">
                              カテゴリー
                            </label>
                            <select
                              value={queueCategory}
                              onChange={(e) => setQueueCategory(e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2.5 rounded-lg text-white focus:outline-none focus:border-orange-500 cursor-pointer"
                            >
                              {AMAZON_CATEGORIES.map(cat => (
                                <option key={cat.id} value={cat.slug}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] text-zinc-400 uppercase tracking-widest font-black block">
                            商品名・製品キーワード（必須）
                          </label>
                          <input
                            type="text"
                            required
                            value={queueName}
                            onChange={(e) => setQueueName(e.target.value)}
                            placeholder="例: Apple AirPods Pro"
                            className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2.5 rounded-lg text-white focus:outline-none focus:border-orange-500"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[9px] text-zinc-400 uppercase tracking-widest font-black block">
                              参考価格（任意）
                            </label>
                            <input
                              type="text"
                              value={queuePrice}
                              onChange={(e) => setQueuePrice(e.target.value)}
                              placeholder="例: ¥39,800"
                              className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2.5 rounded-lg text-white focus:outline-none focus:border-orange-500"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[9px] text-zinc-400 uppercase tracking-widest font-black block">
                              画像URL（任意）
                            </label>
                            <input
                              type="text"
                              value={queueImg}
                              onChange={(e) => setQueueImg(e.target.value)}
                              placeholder="https://images..."
                              className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2.5 rounded-lg text-white focus:outline-none focus:border-orange-500"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] text-zinc-400 uppercase tracking-widest font-black block">
                            アフィリエイトリンク URL（任意、省略時は自動署名DPリンク）
                          </label>
                          <input
                            type="text"
                            value={queueAffiliateLink}
                            onChange={(e) => setQueueAffiliateLink(e.target.value)}
                            placeholder="例: https://www.amazon.co.jp/dp/..."
                            className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2.5 rounded-lg text-white focus:outline-none focus:border-orange-500 font-mono"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={queueLoading}
                          className="w-full bg-[#1b1b24] hover:bg-[#272733] text-orange-400 font-black py-3 rounded-lg border border-orange-500/20 hover:border-orange-500/40 uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {queueLoading ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              キュー登録中...
                            </>
                          ) : (
                            <>
                              <Clock className="w-4 h-4 text-orange-400" />
                              この商品を執筆キューに登録する
                            </>
                          )}
                        </button>
                      </form>
                    </div>



                    {/* ID Control Settings & Reset Panel */}
                    <div className="bg-zinc-950 border border-zinc-900 p-5 sm:p-6 rounded-xl text-left space-y-4">

                      <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
                        <Settings className="text-orange-500 w-5 h-5 flex-shrink-0" />
                        <div>
                          <h3 className="font-black text-white text-xs sm:text-sm">トラッキングID（アソシエイト）設定</h3>
                          <p className="text-[10px] text-zinc-500">全ての成果獲得誘導URLをご自身のアフィロゴタグに自動署名</p>
                        </div>
                      </div>

                      <div className="space-y-4 text-xs">
                        <div className="space-y-1.5">
                          <label className="text-[9px] text-zinc-400 uppercase tracking-widest font-black block">
                            管理者 Amazon associate-id
                          </label>
                          <input
                            type="text"
                            value={state.associateId}
                            onChange={(e) => {
                              const v = e.target.value.trim() || 'mattan0290c-22';
                              // Update local config
                              setState(p => {
                                const updated = p.articles.map(art => {
                                  if (art.affiliateLink.includes('amzn.to')) {
                                    return art;
                                  }
                                  if (art.affiliateLink.includes('/s?k=')) {
                                    const baseUrl = art.affiliateLink.split('?')[0];
                                    const params = new URLSearchParams(art.affiliateLink.split('?')[1] || '');
                                    params.set('tag', v);
                                    return {
                                      ...art,
                                      affiliateLink: `${baseUrl}?${params.toString()}`
                                    };
                                  }
                                  return {
                                    ...art,
                                    affiliateLink: `https://www.amazon.co.jp/dp/${art.asin}/ref=nosim?tag=${v}`
                                  };
                                });
                                return { ...p, associateId: v, articles: updated };
                              });
                              // Save to database
                              saveSettingsToFirestore(v, state.fallbackAdUrl).catch(console.error);
                              pushLog(`アソシエイトIDを [${v}] に書き換え、データベース連動を同期しました。`, "info");
                            }}
                            className="w-full bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 rounded-lg text-white font-mono focus:outline-none focus:border-orange-500"
                            placeholder="mattan0290c-22"
                          />
                          <p className="text-[9px] text-zinc-500 leading-relaxed">
                            ※ここを本物のAmazonアソシエイトIDに変更すると、生成された全記事内のアフィリエイト購入ボタンの追跡コードが即座に同期されます。
                          </p>
                        </div>

                        <div className="pt-2 border-t border-zinc-900/60 pb-1">
                          <button
                            onClick={handleResetCatalog}
                            className="w-full border border-red-500/10 hover:border-red-500/40 hover:bg-red-550/5 text-red-400 py-2.5 rounded-lg text-[10px] uppercase font-black tracking-widest transition-all cursor-pointer text-center"
                          >
                            全レビュー記事と報酬シミュレータの初期リセット
                          </button>
                        </div>
                      </div>

                    </div>

                  </div>

                  {/* RIGHT PANELS: GITHUB MANUALS AND SYSTEM CONSOLE LOGS (6 columns) */}
                  <div className="lg:col-span-6 flex flex-col gap-6">

                    {/* Real-time Simulator Console logs panel */}
                    <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 flex flex-col flex-1 min-h-[220px]">
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block border-b border-zinc-900 pb-2 mb-3 flex justify-between items-center">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                          システム統合コンソール
                        </span>
                        <span className="text-orange-500 tracking-wider text-[8px] uppercase">
                          SECURE DYNAMIC LINK
                        </span>
                      </div>

                      <div className="flex-1 overflow-y-auto max-h-[190px] text-[10px] font-mono space-y-2 text-zinc-400 custom-scrollbar pr-1">
                        {state.systemLogs.map(log => (
                          <p key={log.id} className="leading-relaxed">
                            <span className="text-zinc-650">[{log.timestamp}]</span>{' '}
                            <span className={`px-1 py-0.1 rounded text-[8px] font-black uppercase
                              ${log.type === 'success' ? 'bg-[#0f1d16] text-emerald-400' : ''}
                              ${log.type === 'warn' ? 'bg-[#220f0f] text-red-400' : ''}
                              ${log.type === 'ai' ? 'bg-[#181126] text-purple-400' : ''}
                              ${log.type === 'info' ? 'bg-zinc-900 text-zinc-500' : ''}
                            `}>
                              {log.type.toUpperCase()}
                            </span>{' '}
                            {log.message}
                          </p>
                        ))}
                      </div>
                    </div>

                    {/* GitHub Actions YAML Deployment Manual exporter */}
                    <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-xl space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                        <div className="flex items-center gap-2 font-black text-white text-xs sm:text-sm">
                          <Github className="text-zinc-400 w-4 h-4" />
                          <span>サーバー代0円：完全自律化マニュアル</span>
                        </div>

                        <button
                          onClick={handleCopyYaml}
                          className="text-orange-400 hover:text-orange-300 font-bold text-[10px] flex items-center gap-1.5 cursor-pointer"
                        >
                          {yamlCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" /> コピー完了!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> Actions YAMLをコピー
                            </>
                          )}
                        </button>
                      </div>

                      <p className="text-[11px] text-zinc-450 leading-normal text-left font-sans">
                        ローカルまたはGitHubリポジトリに
                        <code className="text-orange-400 font-mono text-[10px] bg-zinc-900 px-1.5 py-0.5 rounded ml-1">.github/workflows/amazongo-loop.yml</code>
                        を配置すると、Gemini 3.5 Flashが24時間自動学習＆巡回して1時間に1回勝手に新着レビューを作成する全自動収益型エンジンが実現できます。
                      </p>
                    </div>

                  </div>
                </div>

                {/* Article Catalogue list management (Table format for the admin) */}
                <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 text-left">
                  <h3 className="font-black text-white text-xs sm:text-sm border-b border-zinc-900 pb-3 mb-4 flex items-center justify-between">
                    <span>格納アフィリエイト記事一覧と削除管理 ({resolvedArticles.length}件)</span>
                    <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">
                      Firestore Documents database
                    </span>
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="border-b border-zinc-900 text-zinc-500 pb-2 text-[10px] uppercase font-bold text-left">
                          <th className="py-2.5 pr-4 pl-1">商品名・タイトル</th>
                          <th className="py-2.5 px-3">ASIN</th>
                          <th className="py-2.5 px-3">アクセス数 (PV)</th>
                          <th className="py-2.5 px-3">成果金額</th>
                          <th className="py-2.5 px-3 text-right">コントロール</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900">
                        {resolvedArticles.map((art) => (
                          <tr key={art.id} className="hover:bg-zinc-900/30 text-zinc-300">
                            <td className="py-3 px-1 max-w-sm truncate font-medium">
                              <span className="text-orange-500 font-sans mr-2 text-[9px] bg-orange-500/5 px-1.5 py-0.5 rounded border border-orange-500/10">
                                {AMAZON_CATEGORIES.find(c => c.slug === art.category)?.name}
                              </span>
                              <span className="font-sans font-bold text-zinc-200">{art.title}</span>
                            </td>
                            <td className="py-3 px-3 text-zinc-400 truncate max-w-[80px]">{art.asin}</td>
                            <td className="py-3 px-3 text-blue-400 font-bold">{art.estimatedPV.toLocaleString()} PV</td>
                            <td className="py-3 px-3 text-green-400 font-bold">¥{art.earnings.toLocaleString()}</td>
                            <td className="py-3 px-3 text-right space-x-2 flex items-center justify-end">
                              <button
                                onClick={() => handleCopyMarkdown(art)}
                                className="bg-zinc-900 hover:text-white px-2.5 py-1 rounded text-[10px] transition-all cursor-pointer text-zinc-400 hover:border-zinc-700 border border-zinc-800"
                              >
                                markdown
                              </button>
                              <button
                                onClick={() => handleDeleteArticle(art.id, art.title)}
                                className="bg-[#1a1111] hover:bg-[#291414] hover:text-red-400 border border-[#2b1717] px-2 py-1 rounded transition-all text-red-500 cursor-pointer flex items-center"
                                title="検証データをデータベースから削除する"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {resolvedArticles.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-zinc-500 italic">
                              データベース内のレビュー記事は空です。
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

        {/* ==================================================================== */}
        {/* ======================= AMAZON BEST SELLERS SHOWCASE BANNER ======== */}
        {/* ==================================================================== */}
        {!isAdminRoute && (
          <div className="mt-8 border-t border-zinc-900 pt-6">
            <h4 className="text-xs sm:text-sm font-black text-amber-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></span>
              本日のAmazon売れ筋タイムセール商品
            </h4>

            {/* Desktop View: 1 Row, 4 Columns Grid */}
            <div className="hidden md:grid grid-cols-4 gap-4">
              {bannerProducts.map((prod, idx) => (
                <a
                  key={idx}
                  href={prod.affiliateLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-zinc-950 border border-zinc-900 rounded-xl p-3.5 flex flex-col justify-between hover:border-orange-500/40 hover:scale-[1.02] transition-all group cursor-pointer text-left"
                >
                  <div className="space-y-2.5">
                    <div className="w-full aspect-video rounded-lg overflow-hidden bg-zinc-900 relative">
                      <img src={getValidImageUrl(prod.img, "", prod.name)} alt={prod.name} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" referrerPolicy="no-referrer" />
                      <span className="absolute top-1.5 left-1.5 text-[8px] bg-amber-500 text-black font-black px-1.5 py-0.5 rounded tracking-wide uppercase">
                        {prod.label}
                      </span>
                    </div>
                    <h5 className="text-[11px] font-bold text-zinc-300 line-clamp-2 leading-snug group-hover:text-white transition-colors">
                      {prod.name}
                    </h5>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-zinc-900/60 flex items-center justify-between">
                    <span className="text-sm font-black text-orange-400 font-mono">{prod.price}</span>
                    <span className="text-[9px] bg-orange-500/10 text-orange-400 font-bold px-2 py-1 rounded group-hover:bg-orange-500 group-hover:text-black transition-all">
                      詳細を見る
                    </span>
                  </div>
                </a>
              ))}
            </div>

            {/* Mobile View: Slim Horizontal 1 Row, 1 Column Banner at the bottom */}
            <div className="md:hidden block">
              {bannerProducts.length > 0 && (
                <a
                  href={bannerProducts[0].affiliateLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-zinc-950 border border-zinc-900 hover:border-orange-500/40 rounded-xl p-3 flex items-center justify-between gap-3 cursor-pointer text-left transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-900 flex-shrink-0 relative">
                      <img src={getValidImageUrl(bannerProducts[0].img, "", bannerProducts[0].name)} className="w-full h-full object-cover" alt={bannerProducts[0].name} referrerPolicy="no-referrer" />
                      <span className="absolute top-0.5 left-0.5 text-[6px] bg-amber-500 text-black font-extrabold px-1 rounded">HOT</span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[8px] text-orange-400 font-black uppercase tracking-wider block">{bannerProducts[0].label || "タイムセール"}</span>
                      <h5 className="text-[10px] font-bold text-zinc-300 truncate leading-normal">
                        {bannerProducts[0].name}
                      </h5>
                    </div>
                  </div>
                  <span className="text-[9px] bg-orange-500 text-black font-black px-2.5 py-1.5 rounded-lg flex-shrink-0 flex items-center gap-0.5 whitespace-nowrap">
                    セールを見る
                    <ArrowUpRight className="w-2.5 h-2.5" />
                  </span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* ======================= COMPREHENSIVE FOOTER COMPONENT ============ */}
        {/* ==================================================================== */}
        <div className="border-t border-zinc-900 pt-5 mt-4 flex items-center justify-center px-1 text-[11px] sm:text-xs text-zinc-550">
          <span>© 2026 あまぞん GO!! PORTFOLIO CO., LTD.</span>
        </div>

      </div>
    </div>
  );
}
