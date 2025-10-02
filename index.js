import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Reddit app credentials
const CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const SECRET = process.env.REDDIT_SECRET;
const USER_AGENT = "hersparklingqalb-blog/0.1 by FrontFaith74";
const REDDIT_USERNAME = "FrontFaith74";

// Admin secret
const ADMIN_KEY = process.env.ADMIN_KEY;

if (!CLIENT_ID || !SECRET || !ADMIN_KEY) {
  console.error("Missing environment variables. Check your .env file!");
  process.exit(1);
}

// Serve static frontend
app.use(express.static(path.join(__dirname, "public")));

// --- Visitor analytics (in-memory) ---
const pageviews = {};

app.use((req, res, next) => {
  pageviews[req.path] = (pageviews[req.path] || 0) + 1;
  next();
});

// --- Reddit token handling ---
let accessToken = "";
let tokenExpiry = 0;

async function getToken() {
  const now = Date.now();
  if (accessToken && now < tokenExpiry) return accessToken;

  const resp = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(`${CLIENT_ID}:${SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials"
  });

  const data = await resp.json();
  accessToken = data.access_token;
  tokenExpiry = now + (data.expires_in - 60) * 1000; // 60s buffer
  return accessToken;
}

// --- Reddit posts route ---
let redditPosts = [];

app.get("/reddit-posts", async (req, res) => {
  try {
    const token = await getToken();
    const response = await fetch(`https://oauth.reddit.com/user/${REDDIT_USERNAME}/submitted`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "User-Agent": USER_AGENT
      }
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const posts = await response.json();
    redditPosts = posts.data.children.map(p => ({
      title: p.data.title,
      url: p.data.url,
      created: p.data.created_utc
    }));

    res.json(redditPosts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch Reddit posts" });
  }
});

// --- Admin Dashboard ---
app.get("/admin", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.send("Unauthorized");

  res.send(`
    <h1>Admin Dashboard</h1>
    <ul>
      <li><a href="/reddit-posts">View Reddit Posts</a></li>
      <li><a href="/admin/analytics">View Visitor Analytics</a></li>
      <li><a href="/admin/moderation">Moderate Posts</a></li>
    </ul>
  `);
});

// --- Analytics page ---
app.get("/admin/analytics", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.send("Unauthorized");

  const labels = Object.keys(pageviews);
  const data = Object.values(pageviews);

  res.send(`
    <h1>Visitor Analytics</h1>
    <canvas id="analyticsChart"></canvas>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
      const ctx = document.getElementById('analyticsChart').getContext('2d');
      const chart = new Chart(ctx, {
          type: 'line',
          data: { labels: ${JSON.stringify(labels)}, datasets: [{ label: 'Pageviews', data: ${JSON.stringify(data)} }] },
      });
    </script>
  `);
});

// --- Moderation page ---
app.get("/admin/moderation", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.send("Unauthorized");

  res.send(`
    <h1>Moderate Reddit Posts</h1>
    <ul>
      ${redditPosts.map((p, i) => `<li>${p.title} - <a href="/admin/delete-post/${i}?key=${ADMIN_KEY}">Delete</a></li>`).join("")}
    </ul>
  `);
});

app.get("/admin/delete-post/:id", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.send("Unauthorized");

  const index = parseInt(req.params.id);
  if (!redditPosts[index]) return res.send("Post not found");
  const removed = redditPosts.splice(index, 1);

  res.send(`Deleted post: ${removed[0].title} <a href="/admin/moderation?key=${ADMIN_KEY}">Back</a>`);
});

// --- Start server ---
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
