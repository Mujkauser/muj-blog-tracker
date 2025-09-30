const express = require("express");
const { getRedditPosts } = require("./redditFetcher");

const app = express();
const PORT = process.env.PORT || 10000;

app.set("view engine", "ejs");
app.set("views", __dirname + "/views");

// Home route
app.get("/", async (req, res) => {
  const redditPosts = await getRedditPosts("FrontFaith74");

  res.render("redditPosts", { redditPosts });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
