// index.js
const express = require("express");
const path = require("path");

// ✅ Node-fetch dynamic import for compatibility
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 10000;

// Set EJS as the view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Serve static files (if any)
app.use(express.static(path.join(__dirname, "public")));

// --- Fetch Reddit Posts ---
async function getRedditPosts(username) {
  const url = `https://www.reddit.com/user/${username}/submitted.json`;

  try {
    const res = await fetch(url, { headers: { "User-Agent": "muj-blog-tracker/1.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const json = await res.json();

    // Safety check
    if (!json.data || !json.data.children) {
      console.error("⚠️ Unexpected Reddit response:", JSON.stringify(json, null, 2));
      throw new Error("Reddit response missing data.children");
    }

    return json.data.children.map(post => ({
      title: post.data.title,
      url: post.data.url,
      score: post.data.score,
      created: new Date(post.data.created_utc * 1000).toISOString()
    }));
  } catch (err) {
    console.error("❌ Error fetching reddit posts:", err.message);
    return [];
  }
}

// --- Routes ---
app.get("/", async (req, res) => {
  const redditPosts = await getRedditPosts("FrontFaith74");
  res.render("redditPosts", { redditPosts });
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
