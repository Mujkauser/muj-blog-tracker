// redditFetcher.js
// Use dynamic import so node-fetch works in all Node versions on Render
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

async function getRedditPosts(username) {
  const url = `https://www.reddit.com/user/${username}/submitted.json`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "muj-blog-tracker/1.0" }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

    const json = await res.json();

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

module.exports = { getRedditPosts };
