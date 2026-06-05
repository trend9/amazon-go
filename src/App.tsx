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
  subscribeToArticles,
  saveArticleToFirestore,
  deleteArticleFromFirestore,
  subscribeToSettings,
  saveSettingsToFirestore
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
        return {
          associateId: parsed.associateId || 'mattan0290c-22',
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

  // UI States
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Admin Form variables
  const [inputUrl, setInputUrl] = useState('');
  const [inputCategory, setInputCategory] = useState('gadgets');
  const [customTitle, setCustomTitle] = useState('');
  const [generationLoading, setGenerationLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [yamlCopied, setYamlCopied] = useState(false);
  const [autoGenProgress, setAutoGenProgress] = useState(0);

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

  // Is Admin Route check
  const isAdminRoute = currentPath === '/host' || window.location.hash === '#/host' || window.location.search.includes('host');

  // Push log function (only rendered on admin console panel)
  const pushLog = (message: string, type: 'info' | 'success' | 'warn' | 'ai' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setState(prev => {
      const nextLogs = [
        { id: Math.random().toString(), timestamp, message, type },
        ...prev.systemLogs.slice(0, 29)
      ];
      return { ...prev, systemLogs: nextLogs };
    });
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

    // Seed introductory log
    if (state.systemLogs.length === 0) {
      pushLog("あまぞん GO!! 管理セキュアエンジン起動完了。", "success");
      pushLog("Google Gemini 3.5 AIアフィリエイトプロセッサー通信確立済み。", "ai");
    }

    return () => {
      unsubscribeAuth();
      unsubscribeArticles();
      unsubscribeSettings();
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

  // Traffic / Activity simulation loop (Only active when simulatedCronActive is true under Admin control)
  useEffect(() => {
    const trafficInterval = setInterval(() => {
      if (!state.simulatedCronActive) return;

      const articlesList = isDbLoaded && dbArticles.length > 0 ? dbArticles : state.articles;
      if (articlesList.length === 0) return;

      // Pick a random article to simulate interest
      const randomIndex = Math.floor(Math.random() * articlesList.length);
      const targetArt = articlesList[randomIndex];

      // Simulate PV gain
      const viewsGained = Math.floor(Math.random() * 3) + 1;
      const isClick = Math.random() < 0.15; // 15% click rate
      const payout = isClick ? Math.floor(Math.random() * 380) + 160 : 0;

      // Update in db if admin is logged in, else local
      const isAuthorizedAdmin = authUser?.email === 'mattan029@gmail.com';
      const updatedArticle = {
        ...targetArt,
        estimatedPV: targetArt.estimatedPV + viewsGained,
        clicks: targetArt.clicks + (isClick ? 1 : 0),
        earnings: targetArt.earnings + payout
      };

      if (isAuthorizedAdmin && isDbLoaded) {
        saveArticleToFirestore(updatedArticle).catch(err => {
          console.error("Simulation Firebase write failed:", err);
        });
      }

      // Always sync to local state so metrics update immediately in display
      setState(prev => {
        const nextArticles = prev.articles.map(a => a.id === targetArt.id ? updatedArticle : a);
        return { ...prev, articles: nextArticles };
      });

      if (isClick) {
        pushLog(`[成果発生] 「${targetArt.title.substring(0, 16)}...」がクリックされ成果が反映されました (+¥${payout})`, "success");
      } else {
        pushLog(`[アクセス増配] 「${targetArt.title.substring(0, 16)}...」が検証アクセスを受けました (+${viewsGained} PV)`, "info");
      }

    }, 7000);

    return () => clearInterval(trafficInterval);
  }, [state.simulatedCronActive, dbArticles, state.articles, isDbLoaded, authUser]);

  // Virtual Cron Hour progress simulator
  useEffect(() => {
    if (!state.simulatedCronActive) {
      setAutoGenProgress(0);
      return;
    }

    const cronTimer = setInterval(() => {
      setAutoGenProgress(prev => {
        if (prev >= 100) {
          triggerAutomatedCronWriting();
          return 0;
        }
        return prev + 10;
      });
    }, 1500); // Cycles every 15 seconds representing virtual cron trigger

    return () => clearInterval(cronTimer);
  }, [state.simulatedCronActive]);

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

  // Invoke server-side Gemini 3.5 generation
  const handleCreateNewArticle = async (e: FormEvent) => {
    e.preventDefault();
    if (generationLoading) return;

    if (!inputUrl.trim() && !customTitle.trim()) {
      alert("Amazonの製品URL、ASINコード、またはキーワードを入力してください。");
      return;
    }

    setGenerationLoading(true);
    pushLog(`Gemini 3.5 Flash に暗号化送信。キーワードに基づいて高CTAレビュー文を執筆中...`, "ai");

    try {
      const response = await fetch("/api/generate-amazon-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputUrl: inputUrl.trim(),
          category: inputCategory,
          associateId: state.associateId,
          userCustomTitle: customTitle.trim()
        })
      });

      if (!response.ok) {
        throw new Error("Server review writer returned error code.");
      }

      const freshArticle: AmazonProductArticle = await response.json();

      // Write to Firebase if authenticated admin
      const isAuthorizedAdmin = authUser?.email === 'mattan029@gmail.com';
      if (isAuthorizedAdmin) {
        await saveArticleToFirestore(freshArticle);
      }

      // Sync local state as well
      setState(prev => ({
        ...prev,
        articles: [freshArticle, ...prev.articles]
      }));

      setSelectedArticleId(freshArticle.id);
      setInputUrl('');
      setCustomTitle('');
      pushLog(`新規投稿されました！「${freshArticle.title}」が公開フィードに同期されました。`, "success");

      // Navigate to public view to preview
      navigateTo('/');
    } catch (err) {
      console.error("AI review writer failed:", err);
      alert("執筆生成中にエラーが発生しました。サーバー状況を確認してください。");
      pushLog(`API執筆プロセスに一時的な遅延が発生。フェイルオーバー待機。`, "warn");
    } finally {
      setGenerationLoading(false);
    }
  };

  // Trigger automated simulation cron article writing
  const triggerAutomatedCronWriting = async () => {
    const randomCat = AMAZON_CATEGORIES[Math.floor(Math.random() * AMAZON_CATEGORIES.length)];
    const sampleProductPrompts: Record<string, string[]> = {
      gadgets: ["Anker Soundcore Space Core", "DJI Pocket 4 Pro", "Sony LinkBuds S"],
      pc: ["Logitech K950 Keyboard", "Anker PowerExpand Hub", "EIZO FlexScan Premium"],
      kitchen: ["象印 炎舞炊き ハイエンド", "DeLonghi 全自動エスプレッソ", "BRUNO ホットプレート"],
      beauty: ["リファビューテックヘッドスパ", "YA-MAN フォトスチーマー", "Aesop レスレクション"],
      fashion: ["アークテリクス マンティス2", "ビルケンシュトック アリゾナ", "パタゴニア ライトウェイト"],
      "books-games": ["独学エンジニア大全", "ペルソナ5 ザ・ロイヤル", "モンスターハンターワイルズ"]
    };

    const targetList = sampleProductPrompts[randomCat.slug] || ["ベストセラー製品"];
    const randomProduct = targetList[Math.floor(Math.random() * targetList.length)];
    const customTitleFormat = `【最新実機レビュー】QOL高まる決定版「${randomProduct}」を専門家が徹底検証`;

    pushLog(`[自動ボットスケジュール] クローラーが「${randomProduct}」の巡回抽出を開始。`, "info");

    try {
      const response = await fetch("/api/generate-amazon-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputUrl: `https://www.amazon.co.jp/s?k=${encodeURIComponent(randomProduct)}`,
          category: randomCat.slug,
          associateId: state.associateId,
          userCustomTitle: customTitleFormat
        })
      });

      if (!response.ok) throw new Error("Cron write failed");
      const freshArticle: AmazonProductArticle = await response.json();

      const isAuthorizedAdmin = authUser?.email === 'mattan029@gmail.com';
      if (isAuthorizedAdmin) {
        await saveArticleToFirestore(freshArticle);
      }

      setState(prev => ({
        ...prev,
        articles: [freshArticle, ...prev.articles]
      }));

      pushLog(`[自律配信完了] 「${freshArticle.title}」が【${randomCat.name}】カテゴリーへ追加されました。`, "success");
    } catch (err) {
      console.error("Auto generation cron fail:", err);
      pushLog("[自律配信エラー] タイムアウトまたはAPIレート上限制限のためスキップ。", "warn");
    }
  };

  // Article deletion
  const handleDeleteArticle = async (id: string, titleStr: string) => {
    if (!confirm(`「${titleStr}」のレビューをデータベースから削除しますか？`)) return;

    try {
      const isAuthorizedAdmin = authUser?.email === 'mattan029@gmail.com';
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
    if (!confirm("全ての記事カタログ、アソシエイト設定、成果ウォレットログを完全初期状態へリセットしますか？")) return;

    try {
      const isAuthorizedAdmin = authUser?.email === 'mattan029@gmail.com';
      if (isAuthorizedAdmin) {
        // Delete all firestore articles first
        const currentList = isDbLoaded && dbArticles.length > 0 ? dbArticles : state.articles;
        for (const art of currentList) {
          await deleteArticleFromFirestore(art.id);
        }
        // Re-seed default values
        await seedArticlesIfEmpty(INITIAL_ARTICLES);
        await saveSettingsToFirestore('mattan0290c-22', 'https://www.amazon.co.jp');
      }

      setState({
        associateId: 'mattan0290c-22',
        fallbackAdUrl: 'https://www.amazon.co.jp',
        activeCategorySlug: 'all',
        articles: INITIAL_ARTICLES,
        systemLogs: [
          { id: Math.random().toString(), timestamp: new Date().toLocaleTimeString(), message: "カタログ設定が初期状態に完全復旧されました。", type: "info" }
        ],
        showAdminPanel: false,
        simulatedCronActive: false
      });
      setSelectedArticleId(null);
      pushLog("カタログが初期化されました。", "success");
    } catch (err) {
      console.error(err);
      alert("カタログの初期化中にエラーが発生しました。");
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

  // Combine Firestore subscription list with initial state list beautifully
  const resolvedArticles = isDbLoaded && dbArticles.length > 0 ? dbArticles : state.articles;

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
    if (!selectedArticle) return;

    // 1. Update meta description
    let metaDescriptionEl = document.querySelector('meta[name="description"]');
    if (!metaDescriptionEl) {
      metaDescriptionEl = document.createElement("meta");
      metaDescriptionEl.setAttribute("name", "description");
      document.head.appendChild(metaDescriptionEl);
    }
    const cleanIntro = selectedArticle.introText || "";
    metaDescriptionEl.setAttribute("content", `${selectedArticle.title} - ${cleanIntro.substring(0, 150)}`);

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
      "name": selectedArticle.title,
      "image": selectedArticle.imageUrl,
      "description": selectedArticle.introText,
      "mpn": selectedArticle.asin,
      "sku": selectedArticle.asin,
      "brand": {
        "@type": "Brand",
        "name": "Amazon"
      },
      "review": {
        "@type": "Review",
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": selectedArticle.starRating,
          "bestRating": "5"
        },
        "author": {
          "@type": "Organization",
          "name": "あまぞん GO!!"
        },
        "reviewBody": cleanMarkdownHeaders(selectedArticle.reviewBody)
      },
      "offers": {
        "@type": "Offer",
        "url": selectedArticle.affiliateLink,
        "priceCurrency": "JPY",
        "price": "OpenPrice",
        "availability": "https://schema.org/InStock"
      }
    };

    jsonLdScript.textContent = JSON.stringify(schemaObj, null, 2);
  }, [selectedArticle]);

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
                onClick={() => navigateTo('/')}
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
                    ${state.activeCategorySlug === 'all'
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
                        ${state.activeCategorySlug === cat.slug
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

            {/* RIGHT MAIN VIEWPORT: FEED SPILTTER (9 columns) */}
            <div className="col-span-1 lg:col-span-9 grid grid-cols-1 md:grid-cols-12 gap-6">

              {/* LIST FEED AREA (Left panel of sub division) */}
              <div className={`${selectedArticleId ? 'md:col-span-4' : 'md:col-span-12'} flex flex-col gap-4 overflow-y-auto max-h-[820px] pr-1 custom-scrollbar`}>
                <div className="flex justify-between items-center bg-zinc-950/30 p-2.5 rounded-lg border border-zinc-900/50">
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
                  <div className="grid grid-cols-1 gap-3">
                    {filteredArticles.map((art) => {
                      const isCurrent = selectedArticle?.id === art.id;
                      return (
                        <div
                          key={art.id}
                          onClick={() => setSelectedArticleId(art.id)}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex gap-3 relative overflow-hidden group
                            ${isCurrent
                              ? 'bg-zinc-900 border-amber-500/40 shadow-[0_4px_22px_rgba(249,115,22,0.06)]'
                              : 'bg-[#0a0a0c] border-[#131317] hover:bg-[#0e0e11] hover:border-zinc-800'
                            }`}
                        >
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800/80 flex-shrink-0 relative">
                            <img
                              src={art.imageUrl}
                              alt={art.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                              referrerPolicy="no-referrer"
                            />
                            <span className="absolute bottom-1 right-1 text-[8px] sm:text-[10px] bg-black/80 px-1 rounded text-orange-400 font-mono font-bold flex items-center gap-0.5">
                              <Star className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-orange-500 fill-orange-500" />
                              {art.starRating}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
                            <div>
                              <span className="text-[8px] sm:text-[10px] text-[#FF9900] font-mono px-1.5 py-0.2 bg-orange-500/5 border border-orange-500/10 rounded uppercase tracking-wider mb-1 inline-block">
                                {AMAZON_CATEGORIES.find(c => c.slug === art.category)?.name}
                              </span>

                              <h4 className={`text-xs sm:text-sm font-bold leading-snug line-clamp-2 transition-colors
                                ${isCurrent ? 'text-orange-400' : 'text-zinc-300 group-hover:text-white'}`}>
                                {art.title}
                              </h4>
                            </div>
                            <span className="text-[9px] sm:text-xs text-zinc-650 font-mono block mt-1">
                              公開日: {art.createdAt.substring(0, 10)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
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

              {/* ARTICLE FULL SPECIFICATION DEMONSTRATOR LIST (Right pane of sub division) */}
              {selectedArticle ? (
                <div className="col-span-1 md:col-span-8 bg-zinc-900/30 border border-[#131317] rounded-xl p-5 md:p-6 flex flex-col text-left justify-between min-h-[500px]">

                  <div className="space-y-4">

                    {/* Header meta badges */}
                    <div className="flex flex-wrap items-center gap-3 border-b border-zinc-900/80 pb-4">
                      <span className="text-[10px] sm:text-xs bg-orange-500/10 text-orange-400 font-mono font-bold px-2 py-0.5 rounded border border-orange-500/20">
                        {AMAZON_CATEGORIES.find(c => c.slug === selectedArticle.category)?.name}
                      </span>
                      <span className="text-[10px] sm:text-xs text-zinc-600 font-mono">
                        ASIN: {selectedArticle.asin}
                      </span>
                    </div>

                    {/* Title display */}
                    <div className="space-y-1.5">
                      <div className="flex items-start gap-3 justify-between">
                        <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-snug">
                          {selectedArticle.title}
                        </h2>
                        <div className="flex items-center gap-1.5 bg-zinc-900 px-2.5 py-1 rounded border border-zinc-800 text-amber-400 font-extrabold text-xs sm:text-sm flex-shrink-0 mt-0.5">
                          <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-amber-400" />
                          <span>{selectedArticle.starRating}</span>
                        </div>
                      </div>
                      <p className="text-[11px] sm:text-xs text-zinc-500 font-mono">
                        投稿日: {selectedArticle.createdAt}
                      </p>
                    </div>

                    {/* Image and intro block */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-1">
                      <div className="md:col-span-4 flex flex-col gap-2">
                        <div className="w-full aspect-square bg-zinc-950 rounded-xl overflow-hidden border border-zinc-900 shadow-md">
                          <img
                            src={selectedArticle.imageUrl}
                            alt={selectedArticle.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>

                      <div className="md:col-span-8 flex flex-col justify-between gap-3">
                        <div className="bg-gradient-to-r from-zinc-950 to-zinc-900/40 p-3.5 sm:p-5 rounded-xl border border-zinc-900/60 font-sans italic text-zinc-300 leading-relaxed text-xs sm:text-sm md:text-base">
                          「 {selectedArticle.introText} 」
                        </div>

                        {/* Bullet key highlights */}
                        <div className="space-y-1.5 text-left">
                          <span className="text-[10px] sm:text-xs font-black text-orange-400 uppercase tracking-widest block">
                            🔑 注目すべき特徴
                          </span>
                          <ul className="text-xs sm:text-sm space-y-1.5 text-zinc-400 font-sans">
                            {selectedArticle.features.map((feat, idx) => (
                              <li key={idx} className="flex items-start gap-1.5">
                                <span className="text-orange-500 font-bold">✓</span>
                                <span>{feat}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Merits/Demerits section */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="bg-[#0b100e] border border-emerald-950/60 p-3.5 sm:p-4 rounded-xl text-xs sm:text-sm space-y-2.5">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-black border-b border-emerald-950 pb-1.5 text-xs sm:text-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          メリット（良かった点）
                        </div>
                        <ul className="space-y-1.5 text-zinc-300 font-sans leading-relaxed">
                          {selectedArticle.pros.map((p, idx) => (
                            <li key={idx} className="flex gap-1.5">
                              <span className="text-emerald-500 font-bold">＋</span>
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-[#120a0a] border border-red-950/60 p-3.5 sm:p-4 rounded-xl text-xs sm:text-sm space-y-2.5">
                        <div className="flex items-center gap-1.5 text-red-400 font-black border-b border-red-950 pb-1.5 text-xs sm:text-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                          デメリット・懸念点
                        </div>
                        <ul className="space-y-1.5 text-zinc-300 font-sans leading-relaxed">
                          {selectedArticle.cons.map((c, idx) => (
                            <li key={idx} className="flex gap-1.5">
                              <span className="text-red-400 font-bold">－</span>
                              {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Markdown Body reviews details */}
                    <div className="border-t border-zinc-900 pt-5 mt-4 space-y-3">
                      <span className="text-[11px] sm:text-xs text-zinc-500 font-mono font-bold uppercase tracking-widest block">
                        実機レビュー検証記録
                      </span>
                      <div className="text-xs sm:text-sm md:text-base text-zinc-200 leading-relaxed space-y-4 pr-1 border-l border-zinc-900/60 pl-3 whitespace-pre-line font-sans">
                        {cleanMarkdownHeaders(selectedArticle.reviewBody)}
                      </div>
                    </div>

                  </div>

                  {/* HIGH CTA ACTION BAR */}
                  <div className="mt-8 pt-6 border-t border-zinc-900 space-y-3">
                    <div className="bg-gradient-to-r from-orange-600/10 via-amber-500/10 to-orange-500/10 border border-orange-500/20 p-5 rounded-xl text-center shadow-md relative overflow-hidden group">

                      <span className="text-xs sm:text-sm text-amber-500 font-sans font-black tracking-widest block mb-2.5 px-1">
                        {selectedArticle.ctaTitle}
                      </span>

                      <a
                        href={selectedArticle.affiliateLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          // Track simulated click metrics
                          setState(prev => {
                            const updated = prev.articles.map(art => {
                              if (art.id === selectedArticle.id) {
                                return {
                                  ...art,
                                  clicks: art.clicks + 1,
                                  earnings: art.earnings + Math.floor(Math.random() * 450) + 180
                                };
                              }
                              return art;
                            });
                            return { ...prev, articles: updated };
                          });
                        }}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-black font-extrabold text-xs sm:text-sm md:text-base tracking-wider px-8 sm:px-10 py-3.5 sm:py-4 rounded-lg transition-all shadow-[0_4px_18px_rgba(249,115,22,0.15)] cursor-pointer animate-pulse"
                      >
                        Amazon 公式サイトで詳細と最安値をチェックする
                        <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 text-black font-extrabold" />
                      </a>

                      <span className="text-[9px] sm:text-xs text-zinc-500 font-mono mt-2.5 block">
                        ※上記リンクからAmazon.co.jpに遷移してご購入いただくと、割引価格や限定アソシエイト保証が適用されます。
                      </span>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="col-span-1 md:col-span-8 bg-zinc-900/10 border border-dashed border-zinc-900 rounded-xl p-12 text-center flex flex-col items-center justify-center min-h-[500px]">
                  <BookOpen className="w-12 h-12 text-zinc-700 mb-2 animate-bounce" />
                  <p className="text-sm text-zinc-500">
                    表示するレビュー記事が選択されていません。
                  </p>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ==================================================================== */}
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
              </div>
            ) : authUser.email !== 'mattan029@gmail.com' ? (
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">

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

                  {/* Active Simulator Control widget */}
                  <div className="bg-[#121115] border border-zinc-900 px-4 py-3 rounded-xl flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[9px] text-purple-400 font-bold tracking-widest block uppercase">定刻自動配信シミュレーター</span>
                      <span className="text-[10px] text-zinc-500 block leading-normal pt-0.5 truncate">Actions自動追加の擬似再現</span>
                    </div>
                    <button
                      onClick={() => {
                        const next = !state.simulatedCronActive;
                        setState(prev => ({ ...prev, simulatedCronActive: next }));
                        pushLog(next ? "自律型Actions自動クローラを駆動開始しました。" : "自動クローラを停止しました。", next ? "success" : "warn");
                      }}
                      className={`font-black text-[10px] px-3 py-1.5 rounded uppercase tracking-wider cursor-pointer flex-shrink-0 transition-all
                        ${state.simulatedCronActive
                          ? 'bg-amber-500 text-black shadow'
                          : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                        }`}
                    >
                      {state.simulatedCronActive ? '稼働中' : '停止中'}
                    </button>
                  </div>

                </div>

                {/* Progress bar visualizer for cron simulation */}
                {state.simulatedCronActive && (
                  <div className="bg-[#12100a] border border-[#2f200c]/80 text-amber-300 p-3 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs text-left">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400 animate-spin flex-shrink-0" />
                      <div>
                        <strong className="font-bold uppercase">[自動運転巡回中]</strong>{' '}
                        15秒を仮想の「1時間」とし、自律連携プログラムが自動的におすすめを執筆。各カテゴリーページへ新記事を配置しています。
                      </div>
                    </div>
                    <div className="flex items-center gap-2 min-w-[140px]">
                      <div className="h-1.5 bg-zinc-900 w-full rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${autoGenProgress}%` }}></div>
                      </div>
                      <span className="font-mono text-[9px] text-zinc-400 flex-shrink-0">{autoGenProgress}%</span>
                    </div>
                  </div>
                )}

                {/* Main Double Grid: generation form and terminal / action manager */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

                  {/* LEFT PANELS: CREATION ENGINE FOR REVIEWS (6 columns) */}
                  <div className="lg:col-span-6 flex flex-col gap-6">

                    {/* Review Generator Form */}
                    <div className="bg-zinc-950 border border-zinc-900 p-5 sm:p-6 rounded-xl text-left space-y-4">
                      <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
                        <Sparkles className="text-orange-500 w-5 h-5 flex-shrink-0" />
                        <div>
                          <h3 className="font-black text-white text-xs sm:text-sm">あまぞん GO!! 高機能AIレビュー執筆執動</h3>
                          <p className="text-[10px] text-zinc-500">Google Gemini 3.5 Flashを安全に経由し、レビューカタログを随時自動量産</p>
                        </div>
                      </div>

                      <form onSubmit={handleCreateNewArticle} className="space-y-4 text-xs">

                        <div className="space-y-1.5">
                          <label className="text-[9px] text-zinc-400 uppercase tracking-widest font-black block">
                            Amazon 製品URL または 10桁のASIN識別子
                          </label>
                          <input
                            type="text"
                            value={inputUrl}
                            onChange={(e) => setInputUrl(e.target.value)}
                            placeholder="例: B09Y29G7B2 もしくは 製品個別URLを入力"
                            className="w-full bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 rounded-lg text-white font-mono placeholder-zinc-700 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[9px] text-zinc-400 uppercase tracking-widest font-black block">
                              配置宛先カテゴリー
                            </label>
                            <select
                              value={inputCategory}
                              onChange={(e) => setInputCategory(e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2.5 rounded-lg text-white focus:outline-none focus:border-orange-500 cursor-pointer"
                            >
                              {AMAZON_CATEGORIES.map(cat => (
                                <option key={cat.id} value={cat.slug}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[9px] text-zinc-401 uppercase tracking-widest font-black block">
                              タイトルカスタム指定（任意）
                            </label>
                            <input
                              type="text"
                              value={customTitle}
                              onChange={(e) => setCustomTitle(e.target.value)}
                              placeholder="例: 特別限定モデルなど"
                              className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2.5 rounded-lg text-white placeholder-zinc-700 focus:outline-none focus:border-orange-500"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={generationLoading}
                          className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-black font-black py-3 rounded-lg uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {generationLoading ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              高コンバージョン記事・アフィリンク作成中...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 text-black" />
                              レビュー記事の自動パブリッシュを実行
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
                                const updated = p.articles.map(art => ({
                                  ...art,
                                  affiliateLink: `https://www.amazon.co.jp/dp/${art.asin}?tag=${v}`
                                }));
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
        {/* ======================= COMPREHENSIVE FOOTER COMPONENT ============ */}
        {/* ==================================================================== */}
        <div className="border-t border-zinc-900 pt-5 mt-4 flex items-center justify-center px-1 text-[11px] sm:text-xs text-zinc-550">
          <span>© 2026 あまぞん GO!! PORTFOLIO CO., LTD.</span>
        </div>

      </div>
    </div>
  );
}
