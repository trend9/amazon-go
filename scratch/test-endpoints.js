async function test() {
  try {
    const sitemapRes = await fetch("http://localhost:3000/sitemap.xml");
    console.log("sitemap.xml status:", sitemapRes.status);
    console.log("sitemap.xml content-type:", sitemapRes.headers.get("content-type"));
    
    const rssRes = await fetch("http://localhost:3000/rss.xml");
    console.log("rss.xml status:", rssRes.status);
    console.log("rss.xml content-type:", rssRes.headers.get("content-type"));

    const reviewRes = await fetch("http://localhost:3000/review/art_xabjjcnwy");
    console.log("review page status:", reviewRes.status);
    console.log("review page content-type:", reviewRes.headers.get("content-type"));
    const html = await reviewRes.text();
    console.log("Contains ld+json:", html.includes("application/ld+json"));
    console.log("Contains title tag:", html.includes("<title>"));
  } catch (err) {
    console.error("Test failed:", err);
  }
}
test();
