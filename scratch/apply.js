import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appPath = path.join(__dirname, '..', 'src', 'App.tsx');
let content = fs.readFileSync(appPath, 'utf8');

// Normalize all newlines to LF
content = content.replace(/\r\n/g, '\n');

// Block 1: Replace resolvedArticles, filteredArticles, and useEffect for selectedArticle
const targetStart1 = '  // Combine Firestore subscription list with initial state list beautifully\n  const resolvedArticles = isDbLoaded && dbArticles.length > 0 ? dbArticles : state.articles;';
const targetEnd1 = '  }, [selectedArticle]);';

const replacement1 = `  // Combine Firestore subscription list with initial state list beautifully
  const resolvedArticles = isDbLoaded && dbArticles.length > 0 ? dbArticles : state.articles;

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
    document.title = \`\${activeArticle.title} | あまぞん GO!!\`;

    // 1. Update meta description
    let metaDescriptionEl = document.querySelector('meta[name="description"]');
    if (!metaDescriptionEl) {
      metaDescriptionEl = document.createElement("meta");
      metaDescriptionEl.setAttribute("name", "description");
      document.head.appendChild(metaDescriptionEl);
    }
    const cleanIntro = activeArticle.introText || "";
    metaDescriptionEl.setAttribute("content", \`\${activeArticle.title} - \${cleanIntro.substring(0, 150)}\`);

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
  }, [activeArticle]);`;

const startIndex1 = content.indexOf(targetStart1);
const endIndex1 = content.indexOf(targetEnd1, startIndex1);

if (startIndex1 === -1 || endIndex1 === -1) {
  console.error("Error: Could not locate Block 1 target area!");
  process.exit(1);
}

const finalEndIndex1 = endIndex1 + targetEnd1.length;
content = content.substring(0, startIndex1) + replacement1 + content.substring(finalEndIndex1);
console.log("Successfully replaced Block 1.");

// Block 2: Replace case 1 frontend (Discovery grids / Review details)
const targetStart2 = '        {/* ==================================================================== */}\n        {/* ======================= CASE 1: PUBLIC DISCOVERY FRONTEND =========== */}\n        {/* ==================================================================== */}\n        {!isAdminRoute && (';
const targetEnd2 = '        {/* ==================================================================== */}\n        {/* ======================= CASE 2: HOST ADMIN PANEL =================== */}';

const replacement2 = `        {/* ==================================================================== */}
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
                      <img src={reviewArticle.imageUrl} alt={reviewArticle.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
                      {cleanMarkdownHeaders(reviewArticle.reviewBody)}
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
                              onClick={() => navigateTo(\`/review/\${art.id}\`)}
                              className="bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 hover:bg-[#0e0e11] p-4 rounded-xl text-left cursor-pointer transition-all flex flex-col gap-3 group relative overflow-hidden"
                            >
                              <div className="aspect-video w-full bg-zinc-900 rounded-lg overflow-hidden border border-zinc-855 relative">
                                <img src={art.imageUrl} alt={art.title} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" referrerPolicy="no-referrer" />
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
                    className={\`w-full flex items-center justify-between px-3 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer text-left
                      \\\${state.activeCategorySlug === 'all'
                        ? 'bg-orange-500/10 text-orange-400 border-l-[3px] border-orange-500'
                        : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200'
                      }\`}
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
                        className={\`w-full flex items-center justify-between px-3 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer text-left
                          \\\${state.activeCategorySlug === cat.slug
                            ? 'bg-orange-500/10 text-orange-400 border-l-[3px] border-orange-500'
                            : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200'
                          }\`}
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
                        onClick={() => navigateTo(\`/review/\${art.id}\`)}
                        className="bg-[#0a0a0c] border border-[#131317] hover:border-zinc-800 hover:bg-[#0e0e11] p-4 rounded-xl text-left cursor-pointer transition-all flex flex-col gap-3 group relative overflow-hidden"
                      >
                        <div className="aspect-video w-full bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800/80 relative">
                          <img src={art.imageUrl} alt={art.title} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" referrerPolicy="no-referrer" />
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
        )}`;

const startIndex2 = content.indexOf(targetStart2);
const endIndex2 = content.indexOf(targetEnd2, startIndex2);

if (startIndex2 === -1 || endIndex2 === -1) {
  console.error("Error: Could not locate Block 2 target area!");
  process.exit(1);
}

content = content.substring(0, startIndex2) + replacement2 + content.substring(endIndex2);
console.log("Successfully replaced Block 2.");

// Revert to CRLF for Windows compatibility
fs.writeFileSync(appPath, content.replace(/\n/g, '\r\n'), 'utf8');
console.log("Successfully wrote App.tsx changes.");
