// index.js
const express = require("express");
const { getRedditPosts } = require("./redditFetcher");
const app = express();
const PORT = process.env.PORT || 10000;

app.set("view engine", "ejs");
app.set("views", __dirname + "/views");

app.get("/", async (req, res) => {
  const redditPosts = await getRedditPosts("FrontFaith74"); // full posts
  res.render("index", { redditPosts }); // pass to main template
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

