import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Reddit app credentials
const CLIENT_ID = process.env.REDDIT_CLIENT_ID || "LTdnPPNOYruUBOcWeDfoGQ";
const SECRET = process.env.REDDIT_SECRET || "t10Y_u4vkY2D3oHo9KcJuJ8dbCzAqg";
const USER_AGENT = "hersparklingqalb-blog/0.1 by FrontFaith74";
const REDDIT_USERNAME = "FrontFaith74";

let accessToken = "";
let tokenExpiry = 0;

// Serve static frontend
app.use(express.static(path.join(__dirname, "public")));

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

app.get("/reddit-posts", async (req, res) => {
  try {
    const token = await getToken();
    const response = await fetch(`https://oauth.reddit.com/user/${REDDIT_USERNAME}/submitted`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "User-Agent": USER_AGENT
      }
    });
    const posts = await response.json();
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch Reddit posts" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
