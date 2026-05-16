const express    = require("express");
const cors       = require("cors");
const helmet     = require("helmet");
const morgan     = require("morgan");
const rateLimit  = require("express-rate-limit");

const authRoutes        = require("./routes/auth");
const scanRoutes        = require("./routes/scans");
const analyticsRoutes   = require("./routes/analytics");
const rewardRoutes      = require("./routes/rewards");
const couponRoutes      = require("./routes/coupons");
const userRoutes        = require("./routes/users");
const leaderboardRoutes = require("./routes/leaderboard");
const adminRoutes       = require("./routes/admin");

const app = express();

// ── Security ──────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin:      process.env.FRONTEND_URL || "*",
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max:      200,
  message:  { success: false, message: "Too many requests, slow down." },
});
const classifyLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 min
  max:      20,
  message:  { success: false, message: "Too many classify requests per minute." },
});

app.use("/api/", globalLimiter);
app.use("/api/scans/classify", classifyLimiter);

// ── Body parsing ──────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Logging ───────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ── Routes ───────────────────────────────────────────────────────────
app.use("/api/auth",         authRoutes);
app.use("/api/scans",        scanRoutes);
app.use("/api/analytics",    analyticsRoutes);
app.use("/api/rewards",      rewardRoutes);
app.use("/api/coupons",      couponRoutes);
app.use("/api/users",        userRoutes);
app.use("/api/leaderboard",  leaderboardRoutes);
app.use("/api/admin",        adminRoutes);

// ── Health check ──────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({
  success: true,
  service: "ecosort-backend",
  timestamp: new Date(),
}));

// ── 404 ───────────────────────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ success: false, message: "Route not found" })
);

// ── Global error handler ──────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[Error]", err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

module.exports = app;
