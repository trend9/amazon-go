async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/generate-amazon-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputUrl: "B0CL7Y437Z",
        category: "gadgets",
        associateId: "mattan0290c-22",
        userCustomTitle: "Fire TV Stick Test",
        customAffiliateLink: "https://example.com"
      })
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Body:", text);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}
test();
