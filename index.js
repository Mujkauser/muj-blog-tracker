// index.js
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Replace this with your Reddit username
const REDDIT_USERNAME = 'FrontFaith74';

// Function to fetch Reddit posts
async function fetchRedditPosts(username) {
    try {
        const url = `https://www.reddit.com/user/${username}/submitted.json?limit=50`;
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'MujBlogTracker/1.0' }
        });

        const posts = response.data.data.children.map(post => ({
            title: post.data.title,
            content: post.data.selftext,
            url: `https://reddit.com${post.data.permalink}`,
            date: new Date(post.data.created_utc * 1000),
            subreddit: post.data.subreddit
        }));

        console.log("Reddit posts fetched:", posts.length);
        return posts;
    } catch (err) {
        console.error("Error fetching Reddit posts:", err.message);
        return [];
    }
}

// Route to show all posts
app.get('/reddit-posts', async (req, res) => {
    const posts = await fetchRedditPosts(REDDIT_USERNAME);
    res.render('redditPosts', { posts, query: '' });
});

// Route to search posts
app.get('/reddit-posts/search', async (req, res) => {
    const query = req.query.q?.toLowerCase() || '';
    const posts = await fetchRedditPosts(REDDIT_USERNAME);
    const filtered = posts.filter(post =>
        post.title.toLowerCase().includes(query) ||
        post.content.toLowerCase().includes(query)
    );
    res.render('redditPosts', { posts: filtered, query });
});

// Root redirect
app.get('/', (req, res) => {
    res.redirect('/reddit-posts');
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

