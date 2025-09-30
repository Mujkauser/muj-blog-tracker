const fetch = require("node-fetch");

async function getRedditPosts(username) {
  const url = `https://www.reddit.com/user/${username}/submitted.json`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "muj-blog-tracker/1.0" }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    // ✅ Safety check before accessing children
    if (!json.data || !json.data.children) {
      console.error("⚠️ Unexpected Reddit response:");
      console.error(JSON.stringify(json, null, 2)); // pretty-print full JSON
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

// --- Test run ---
getRedditPosts("FrontFaith74").then(posts =>
  console.log("Fetched posts (first 2):", posts.slice(0, 2))
);
