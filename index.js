import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Reddit credentials
const CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const SECRET = process.env.REDDIT_SECRET;
const USER_AGENT = "hersparklingqalb-blog/0.1 by FrontFaith74";
const REDDIT_USERNAME = "FrontFaith74";

// Admin key
const ADMIN_KEY = process.env.ADMIN_KEY;

if (!CLIENT_ID || !SECRET || !ADMIN_KEY) {
  console.error("Missing environment variables. Check your .env file!");
  process.exit(1);
}

// Serve static frontend
app.use(express.static(path.join(__dirname, "public")));

// --- Visitor analytics (persistent logs + pageviews) ---
const logFile = "./logs.json";
let visitorLogs = [];
const pageviews = {};
if (fs.existsSync(logFile)) {
  visitorLogs = JSON.parse(fs.readFileSync(logFile, "utf-8"));
  // rebuild pageviews from logs
  visitorLogs.forEach(v => {
    pageviews[v.path] = (pageviews[v.path] || 0) + 1;
  });
}

// Visitor logging with timezones
app.use(async (req, res, next) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  // Lookup location
  let location = "Unknown";
  try {
    const geoResp = await fetch(`https://ipapi.co/${ip}/json/`);
    if (geoResp.ok) {
      const geo = await geoResp.json();
      if (geo && geo.city && geo.country_name) {
        location = `${geo.city}, ${geo.country_name}`;
      }
    }
  } catch (err) {
    console.error("Geo lookup failed:", err);
  }

  const now = new Date();
  const visitor = {
    path: req.path,
    ip,
    location,
    time_utc: now.toISOString(),
    time_ist: now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    time_est: now.toLocaleString("en-US", { timeZone: "America/New_York" })
  };

  visitorLogs.push(visitor);

  // Save to JSON file
  fs.writeFileSync(logFile, JSON.stringify(visitorLogs, null, 2));

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
    let allPosts = [];
    let after = null;

    do {
      const url = new URL(`https://oauth.reddit.com/user/${REDDIT_USERNAME}/submitted`);
      url.searchParams.set("limit", "100");
      if (after) url.searchParams.set("after", after);

      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "User-Agent": USER_AGENT
        }
      });

      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ error: text });
      }

      const json = await response.json();
      allPosts = allPosts.concat(json.data.children);
      after = json.data.after;
    } while (after);

    const formattedPosts = {
      data: {
        children: allPosts.map(p => ({
          data: {
            title: p.data.title,
            permalink: p.data.permalink,
            selftext: p.data.selftext,
            created_utc: p.data.created_utc
          }
        }))
      }
    };

    redditPosts = formattedPosts.data.children;
    res.json(formattedPosts);
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
      <li><a href="/admin/logs">View Visitor Logs</a></li>
      <li><a href="/admin/moderation">Moderate Posts</a></li>
    </ul>
  `);
});

// --- Admin logs page ---
app.get("/admin/logs", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.send("Unauthorized");

  const rows = visitorLogs
    .map(v => `
      <tr>
        <td>${v.path}</td>
        <td>${v.ip}</td>
        <td>${v.location}</td>
        <td>${v.time_utc || 'N/A'}</td>
        <td>${v.time_ist || 'N/A'}</td>
        <td>${v.time_est || 'N/A'}</td>
      </tr>
    `)
    .join("");

  res.send(`
    <h1>Visitor Logs</h1>
    <table border="1" cellpadding="5" cellspacing="0">
      <thead>
        <tr>
          <th>Path</th>
          <th>IP Address</th>
          <th>Location</th>
          <th>UTC Time</th>
          <th>IST Time</th>
          <th>EST Time</th>
        </tr>
      </thead>
      <tbody>
        ${rows || "<tr><td colspan='6'>No logs yet</td></tr>"}
      </tbody>
    </table>
    <p><a href="/admin?key=${ADMIN_KEY}">Back to Admin Dashboard</a></p>
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
          type: 'bar',
          data: { 
            labels: ${JSON.stringify(labels)}, 
            datasets: [{ 
              label: 'Pageviews', 
              data: ${JSON.stringify(data)}, 
              backgroundColor: 'rgba(75, 192, 192, 0.5)' 
            }] 
          },
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
