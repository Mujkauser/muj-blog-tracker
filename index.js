require('dotenv').config();
const express = require("express");
const session = require("express-session");
const axios = require("axios");
const qs = require("querystring");
const morgan = require("morgan");


const app = express();
// Use environment variables instead of hardcoding
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
app.use(morgan("combined")); // logs all requests to console

app.use(session({ secret: "muj-secret", resave: false, saveUninitialized: true }));

// Step 2a: Redirect user to Reddit for authorization
app.get("/reddit/login", (req, res) => {
  const state = Math.random().toString(36).substring(2);
  req.session.state = state;

  const authURL = `https://www.reddit.com/api/v1/authorize?client_id=${CLIENT_ID}&response_type=code&state=${state}&redirect_uri=${REDIRECT_URI}&duration=permanent&scope=read identity`;
  res.redirect(authURL);
});

// Step 2b: Callback to exchange code for access token
app.get("/reddit/callback", async (req, res) => {
  if (req.query.state !== req.session.state) return res.send("Invalid state");

  const tokenResponse = await axios.post(
    "https://www.reddit.com/api/v1/access_token",
    qs.stringify({
      grant_type: "authorization_code",
      code: req.query.code,
      redirect_uri: REDIRECT_URI
    }),
    {
      auth: { username: CLIENT_ID, password: CLIENT_SECRET },
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    }
  );

  req.session.access_token = tokenResponse.data.access_token;
  res.redirect("/reddit/posts");
});

// Step 2c: Fetch and display your Reddit posts
app.get("/reddit/posts", async (req, res) => {
  if (!req.session.access_token) return res.redirect("/reddit/login");

  const postsResponse = await axios.get("https://oauth.reddit.com/user/FrontFaith74/submitted", {
    headers: { Authorization: `bearer ${req.session.access_token}`, "User-Agent": "HersparklingqalbBlog/0.1" }
  });

  res.send(postsResponse.data.data.children.map(p => `<li><a href="${p.data.url}">${p.data.title}</a></li>`).join(""));
});


// --- Admin Dashboard routes start here ---
app.get("/admin", (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.send("Unauthorized");

  res.send(`
    <h1>Admin Dashboard</h1>
    <ul>
      <li><a href="/reddit/posts">View Reddit Posts</a></li>
      <li><a href="/admin/analytics">View Visitor Analytics</a></li>
    </ul>
  `);
});

app.get("/admin/analytics", (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.send("Unauthorized");

  res.send(`
    <h1>Visitor Analytics</h1>
    <canvas id="analyticsChart"></canvas>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
      const ctx = document.getElementById('analyticsChart').getContext('2d');
      const chart = new Chart(ctx, {
          type: 'line',
          data: { labels: ['Jan', 'Feb'], datasets: [{ label: 'Pageviews', data: [10, 20] }] },
      });
    </script>
  `);
});

// Optional: Content moderation
app.get("/admin/delete-post/:id", (req, res) => {
  // delete post from DB or memory
  res.send(`Post ${req.params.id} deleted!`);
});
// --- Admin Dashboard routes end here ---

// Start server
app.listen(3000, () => console.log("Server running on port 3000"));
