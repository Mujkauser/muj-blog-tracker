// index.js
const express = require('express');
const fetch = require('node-fetch'); // Make sure node-fetch is installed
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Function to fetch Reddit posts
async function getRedditPosts(username) {
  const url = `https://www.reddit.com/user/${username}/submitted.json`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'muj-blog-tracker/1.0' }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

    const json = await res.json();

    if (!json.data?.children) {
      console.error('⚠️ Unexpected Reddit response:', JSON.stringify(json, null, 2));
      throw new Error('Reddit response missing data.children');
    }

    return json.data.children.map(post => ({
      title: post.data.title,
      url: post.data.url,
      date: new Date(post.data.created_utc * 1000).toISOString()
    }));

  } catch (err) {
    console.error('❌ Error fetching reddit posts:', err.message);
    return [];
  }
}

// Route to render Reddit posts
app.get('/', async (req, res) => {
  const username = 'FrontFaith74'; // Your Reddit username
  const posts = await getRedditPosts(username);
  res.render('redditPosts', { posts });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
