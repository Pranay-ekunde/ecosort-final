require("dotenv").config();
const app       = require("./app");
const connectDB = require("./utils/db");
const fetch     = require("node-fetch");

const PORT = process.env.PORT || 5000;

// ── Keep-alive pinger ─────────────────────────────────────────────────
// Render free tier sleeps after 15 min inactivity.
// Ping AI service every 9 min so it never goes cold.
function startKeepAlive() {
  const aiUrl = process.env.AI_SERVICE_URL;
  if (!aiUrl || process.env.NODE_ENV !== "production") return;

  const ping = () => {
    fetch(`${aiUrl}/health`, { signal: AbortSignal.timeout(10_000) })
      .then(() => console.log("[keep-alive] AI service pinged ✓"))
      .catch((e) => console.warn("[keep-alive] AI ping failed:", e.message));
  };

  // First ping after 30s (let everything settle), then every 9 min
  setTimeout(() => {
    ping();
    setInterval(ping, 9 * 60 * 1000);
  }, 30_000);
}

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`EcoSort backend running on port ${PORT} [${process.env.NODE_ENV}]`);
    startKeepAlive();
  });
}).catch((err) => {
  console.error("Failed to connect to database:", err.message);
  process.exit(1);
});

