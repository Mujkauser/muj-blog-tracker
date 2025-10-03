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

// --- Visitor analytics & pageviews ---
const logFile = "./logs.json";
let visitorLogs = [];
let pageviews = {};

if (fs.existsSync(logFile)) {
  visitorLogs = JSON.parse(fs.readFileSync(logFile, "utf-8"));
}

// Visitor logging middleware
app.use(async (req, res, next) => {
  let ipList = (req.headers["x-forwarded-for"] || req.socket.remoteAddress).split(",").map(i => i.trim());

  // Regex to detect private/internal IPs
  const privateIP = /^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|^192\.168\.|^127\./;

  // Pick first public IP if available
  let publicIP = ipList.find(ip => !privateIP.test(ip)) || ipList[0] || "Unknown";

  // Increment pageviews
  pageviews[req.path] = (pageviews[req.path] || 0) + 1;

  // Geo lookup
  let location = "Unknown", lat = null, lon = null;
  if (publicIP !== "Unknown") {
    try {
      const geoResp = await fetch(`https://ipapi.co/${publicIP}/json/`);
      if (geoResp.ok) {
        const geo = await geoResp.json();
        if (geo && geo.city && geo.country_name) {
          location = `${geo.city}, ${geo.country_name}`;
        }
        lat = geo.latitude || null;
        lon = geo.longitude || null;
      }
    } catch (err) {
      console.error("Geo lookup failed:", err);
    }
  }

  const visitor = {
    path: req.path,
    ip: ipList.join(", "),  // keep full chain for logs
    publicIP,
    location,
    lat,
    lon,
    utcTime: new Date().toISOString(),
    istTime: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    estTime: new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
  };

  visitorLogs.push(visitor);
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
      <li><a href="/admin/analytics?key=${ADMIN_KEY}">View Visitor Analytics</a></li>
      <li><a href="/admin/logs?key=${ADMIN_KEY}">View Visitor Logs</a></li>
      <li><a href="/admin/moderation?key=${ADMIN_KEY}">Moderate Posts</a></li>
    </ul>
  `);
});

/*
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
*/

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
    <p><a href="/admin?key=${ADMIN_KEY}">Back to Admin Dashboard</a></p>
  `);
});

// --- Visitor logs page with search, sort, map ---
app.get("/admin/logs", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.send("Unauthorized");

  const rows = visitorLogs.map((v, idx) => `<tr onclick="showMap(${idx})" style="cursor:pointer">
    <td>${v.path}</td>
    <td>${v.ip}</td>
    <td>${v.location}</td>
    <td>${v.utcTime}</td>
    <td>${v.istTime}</td>
    <td>${v.estTime}</td>
  </tr>`).join("");

  res.send(`
    <h1>Visitor Logs</h1>
    <input type="text" id="searchInput" placeholder="Filter by IP, path, or location" style="margin-bottom:10px;padding:5px;width:300px;" />
    <table id="logsTable" border="1" cellpadding="5" cellspacing="0">
      <thead>
        <tr>
          <th onclick="sortTable(0)">Path ⬍</th>
          <th onclick="sortTable(1)">IP Address ⬍</th>
          <th onclick="sortTable(2)">Location ⬍</th>
          <th onclick="sortTable(3)">UTC Time ⬍</th>
          <th onclick="sortTable(4)">IST Time ⬍</th>
          <th onclick="sortTable(5)">EST Time ⬍</th>
        </tr>
      </thead>
      <tbody>
        ${rows || "<tr><td colspan='6'>No logs yet</td></tr>"}
      </tbody>
    </table>
    <div id="map" style="height:400px;margin-top:20px;"></div>
    <p><a href="/admin?key=${ADMIN_KEY}">Back to Admin Dashboard</a></p>

    <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
    <script>
      const visitorLogs = ${JSON.stringify(visitorLogs)};

      // Search filter
      const input = document.getElementById("searchInput");
      input.addEventListener("keyup", () => {
        const filter = input.value.toLowerCase();
        const rows = document.querySelectorAll("#logsTable tbody tr");
        rows.forEach(row => {
          const text = row.textContent.toLowerCase();
          row.style.display = text.includes(filter) ? "" : "none";
        });
      });

      // Table sorting
      function sortTable(n) {
        const table = document.getElementById("logsTable");
        let switching = true, dir = "asc";
        while (switching) {
          switching = false;
          const rows = table.rows;
          for (let i = 1; i < rows.length - 1; i++) {
            let shouldSwitch = false;
            const x = rows[i].getElementsByTagName("TD")[n];
            const y = rows[i+1].getElementsByTagName("TD")[n];
            if (dir === "asc" ? x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase() : x.innerHTML.toLowerCase() < y.innerHTML.toLowerCase()) {
              shouldSwitch = true;
              break;
            }
          }
          if (shouldSwitch) {
            rows[i].parentNode.insertBefore(rows[i+1], rows[i]);
            switching = true;
          } else if (dir === "asc") {
            dir = "desc";
            switching = true;
          }
        }
      }

      // Leaflet map setup
      const map = L.map('map').setView([20,0],2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      function showMap(idx) {
        const visitor = visitorLogs[idx];
        if (!visitor.lat || !visitor.lon) {
          alert("No coordinates available for this visitor.");
          return;
        }
        map.setView([visitor.lat, visitor.lon], 5);
        L.marker([visitor.lat, visitor.lon]).addTo(map)
          .bindPopup(\`<b>IP:</b> \${visitor.ip}<br><b>Location:</b> \${visitor.location}\`)
          .openPopup();
      }
    </script>
  `);
});

// --- Moderation page ---
app.get("/admin/moderation", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.send("Unauthorized");

  res.send(`
    <h1>Moderate Reddit Posts</h1>
    <ul>
      ${redditPosts.map((p,i) => `<li>${p.data.title} - <a href="/admin/delete-post/${i}?key=${ADMIN_KEY}">Delete</a></li>`).join("")}
    </ul>
  `);
});

app.get("/admin/delete-post/:id", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.send("Unauthorized");
  const index = parseInt(req.params.id);
  if (!redditPosts[index]) return res.send("Post not found");
  const removed = redditPosts.splice(index,1);
  res.send(`Deleted post: ${removed[0].data.title} <a href="/admin/moderation?key=${ADMIN_KEY}">Back</a>`);
});

// --- Start server ---
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
