const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 5000;

const LOGFILE = "clicks.log";
const ADMIN_KEY = process.env.ADMIN_KEY || "changeme";

// Serve static files (your blog)
app.use(express.static(path.join(__dirname, "public")));

// Log function
function logClick(entry) {
  fs.appendFileSync(LOGFILE, JSON.stringify(entry) + "\n", { encoding: "utf8" });
}

// GeoIP lookup
async function geoip(ip) {
  try {
    const res = await axios.get(`http://ip-api.com/json/${ip}?fields=status,country,countryCode`);
    if (res.data.status === "success") return { country: res.data.country, iso: res.data.countryCode };
  } catch (err) {}
  return { country: "Unknown", iso: "" };
}

// Tracker route (logs all visits)
app.get("*", async (req, res, next) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const ua = req.headers["user-agent"] || "";
  const geo = await geoip(ip);
  const entry = {
    ts: new Date().toISOString(),
    ip,
    country: geo.country,
    iso: geo.iso,
    ua,
    path: req.path
  };
  logClick(entry);
  next();
});

// Admin logs (protected)
app.get("/admin/logs", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(403).send("Forbidden");
  let lines = [];
  try {
    lines = fs.readFileSync(LOGFILE, "utf8")
      .split("\n")
      .filter(l => l.trim() !== "")
      .slice(-200)
      .map(l => JSON.parse(l));
  } catch (err) {}
  res.json(lines);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
