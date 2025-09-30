const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// Set EJS as the view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Homepage → show Reddit posts
app.get("/", async (req, res) => {
  try {
    const response = await axios.get(
      "https://www.reddit.com/user/FrontFaith74/submitted.json"
    );

    const posts = response.data.data.children.map((p) => ({
      title: p.data.title,
      url: p.data.url,
      date: new Date(p.data.created_utc * 1000).toLocaleDateString(),
    }));

    res.render("redditPosts", { posts });
  } catch (err) {
    console.error("❌ Error fetching reddit posts:", err.message);
    res.status(500).send("Error fetching reddit posts");
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
