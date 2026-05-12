const fetch    = require("node-fetch");
const fs       = require("fs");
const path     = require("path");
const FormData = require("form-data");
const Scan     = require("../models/Scan");
const User     = require("../models/User");
const Reward   = require("../models/Reward");
const { computeHash, isSimilar } = require("../utils/pHash");

// ── Points per category ───────────────────────────────────────────────
const POINTS_MAP = { recyclable: 10, non_recyclable: 5, hazardous: 15 };

// ── Anti-abuse thresholds ─────────────────────────────────────────────
const LIMITS = {
  MIN_INTERVAL_SEC : 10,   // cooldown between scans (seconds)
  MAX_PER_HOUR     : 30,   // max scans per user per hour
  MAX_PER_DAY      : 100,  // max scans per user per day
  HASH_THRESHOLD   : 10,   // Hamming distance ≤ 10 → duplicate (pHash)
  CNN_SIM_THRESHOLD: 0.85, // cosine similarity > 0.85 → duplicate (CNN)
  RECENT_HASHES_N  : 50,   // recent hashes to compare per user
};

// In-memory cooldown map (userId → timestamp ms)
// For multi-server production, replace with Redis.
const lastScanTime = new Map();

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────
async function checkAbuseRules(userId) {
  const now     = Date.now();
  const userKey = userId.toString();

  // 1. Cooldown
  const last = lastScanTime.get(userKey);
  if (last) {
    const diffSec = (now - last) / 1000;
    if (diffSec < LIMITS.MIN_INTERVAL_SEC) {
      const wait = Math.ceil(LIMITS.MIN_INTERVAL_SEC - diffSec);
      return {
        allowed: false, code: 429,
        reason: `Please wait ${wait}s before scanning again.`,
      };
    }
  }

  // 2. Hourly cap
  const oneHourAgo = new Date(now - 60 * 60 * 1000);
  const perHour = await Scan.countDocuments({
    user: userId, createdAt: { $gte: oneHourAgo },
  });
  if (perHour >= LIMITS.MAX_PER_HOUR) {
    return {
      allowed: false, code: 429,
      reason: `Hourly limit (${LIMITS.MAX_PER_HOUR} scans/hour) reached. Try again later.`,
    };
  }

  // 3. Daily cap
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const perDay = await Scan.countDocuments({
    user: userId, createdAt: { $gte: midnight },
  });
  if (perDay >= LIMITS.MAX_PER_DAY) {
    return {
      allowed: false, code: 429,
      reason: `Daily limit (${LIMITS.MAX_PER_DAY} scans/day) reached. Come back tomorrow!`,
    };
  }

  return { allowed: true };
}

async function checkDuplicate(userId, newHash, newFeatures, newPrediction) {
  if (!newHash && !newFeatures) return { isDuplicate: false, duplicateOf: null, scope: null, method: null };

  // Per-user: last N scans
  const recent = await Scan.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(LIMITS.RECENT_HASHES_N)
    .select("imageHash cnnFeatures prediction _id");

  for (const s of recent) {
    // pHash check — only duplicate if same classification too
    if (newHash && s.imageHash && isSimilar(newHash, s.imageHash, LIMITS.HASH_THRESHOLD)) {
      if (newPrediction && s.prediction && newPrediction === s.prediction) {
        return { isDuplicate: true, duplicateOf: s._id, scope: "user", method: "pHash" };
      }
    }
    // CNN feature check — only duplicate if same classification too
    if (newFeatures && s.cnnFeatures && cosineSimilarity(newFeatures, s.cnnFeatures) > LIMITS.CNN_SIM_THRESHOLD) {
      if (newPrediction && s.prediction && newPrediction === s.prediction) {
        return { isDuplicate: true, duplicateOf: s._id, scope: "user", method: "cnn" };
      }
    }
  }

  // Cross-user: last 24 h
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const global = await Scan.find({
    user: { $ne: userId },
    createdAt: { $gte: dayAgo },
    isDuplicate: false,
  })
    .sort({ createdAt: -1 })
    .limit(200)
    .select("imageHash cnnFeatures prediction _id");

  for (const s of global) {
    if (newHash && s.imageHash && isSimilar(newHash, s.imageHash, LIMITS.HASH_THRESHOLD)) {
      if (newPrediction && s.prediction && newPrediction === s.prediction) {
        return { isDuplicate: true, duplicateOf: s._id, scope: "global", method: "pHash" };
      }
    }
    if (newFeatures && s.cnnFeatures && cosineSimilarity(newFeatures, s.cnnFeatures) > LIMITS.CNN_SIM_THRESHOLD) {
      if (newPrediction && s.prediction && newPrediction === s.prediction) {
        return { isDuplicate: true, duplicateOf: s._id, scope: "global", method: "cnn" };
      }
    }
  }

  return { isDuplicate: false, duplicateOf: null, scope: null, method: null };
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((s, ai) => s + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((s, bi) => s + bi * bi, 0));
  return dot / (normA * normB + 1e-8);
}

// ─────────────────────────────────────────────────────────────────────
// POST /api/scans/classify
// ─────────────────────────────────────────────────────────────────────
exports.classify = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Image file required" });
    }

    const imageUrl  = `/uploads/${req.file.filename}`;
    const imagePath = req.file.path;
    const userId    = req.user._id;

    // ── Abuse check first ────────────────────────────────────────────
    const abuse = await checkAbuseRules(userId);
    if (!abuse.allowed) {
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      return res.status(abuse.code).json({
        success: false, message: abuse.reason, limitExceeded: true,
      });
    }

    // ── Update cooldown first to prevent race condition ───────────────
    lastScanTime.set(userId.toString(), Date.now());

    // ── AI inference ───────────────────────────────────────────────────
    let aiResult;
    try {
      const form = new FormData();
      form.append("file", fs.createReadStream(imagePath), req.file.originalname);
      const aiRes = await fetch(
        `${process.env.AI_SERVICE_URL || "http://localhost:8000"}/predict`,
        { method: "POST", body: form, headers: form.getHeaders() }
      );
      if (!aiRes.ok) throw new Error(`AI service HTTP ${aiRes.status}`);
      aiResult = await aiRes.json();
    } catch (aiErr) {
      console.warn("[AI Service fallback]", aiErr.message);
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      return res.status(503).json({
        success: false,
        message: "AI service unavailable. Please try again later.",
        aiDown: true,
      });
    }

    const { prediction, confidence, scores } = aiResult;

    // ── Perceptual hash ───────────────────────────────────────────────
    let imageHash = null;
    try { imageHash = computeHash(imagePath); }
    catch (e) { console.warn("[pHash]", e.message); }

    // ── CNN features for robust duplicate detection ──────────────────
    let cnnFeatures = null;
    try {
      const form = new FormData();
      form.append("file", fs.createReadStream(imagePath), req.file.originalname);
      const featRes = await fetch(
        `${process.env.AI_SERVICE_URL || "http://localhost:8000"}/features/extract`,
        { method: "POST", body: form, headers: form.getHeaders() }
      );
      if (featRes.ok) {
        const featData = await featRes.json();
        cnnFeatures = featData.features;
      }
    } catch (e) { console.warn("[CNN Features]", e.message); }

    // ── Duplicate check (pHash + CNN + same classification) ─────────────
    const dupResult = await checkDuplicate(userId, imageHash, cnnFeatures, prediction);
    const { isDuplicate, duplicateOf, scope, method } = dupResult;

    const pointsEarned = isDuplicate ? 0 : (prediction && POINTS_MAP[prediction] ? POINTS_MAP[prediction] : 5);

    // ── Save scan ────────────────────────────────────────────────────
    const scan = await Scan.create({
      user: userId, imageUrl,
      imageName:   req.file.originalname,
      prediction, confidence,
      allScores:   scores,
      imageHash, isDuplicate,
      duplicateOf: isDuplicate ? duplicateOf : undefined,
      cnnFeatures,
      pointsEarned,
      note:        req.body.note     || "",
      location:    req.body.location || "",
    });

    // ── Update user stats ────────────────────────────────────────────
    const user = req.user;
    user.totalScans += 1;
    if (prediction) {
      user.scanStats[prediction] = (user.scanStats[prediction] || 0) + 1;
    }

    const milestones = [];
    if (!isDuplicate) {
      user.points += pointsEarned;
      user.updateTier();

      const msMap = { 10: 50, 50: 100, 100: 200 };
      if (msMap[user.totalScans]) {
        const bonus = msMap[user.totalScans];
        const msg   = `${user.totalScans} scan milestone! +${bonus} bonus points`;
        user.points += bonus;
        milestones.push(msg);
        await Reward.create({
          user: userId, type: "earn", points: bonus,
          description: msg, balanceAfter: user.points,
        });
      }

      await Reward.create({
        user: userId, type: "earn", points: pointsEarned,
        description: `Classified ${(prediction || "unknown").replace("_", " ")} waste`,
        scan: scan._id, balanceAfter: user.points,
      });
    }
    await user.save();

    // ── Response ─────────────────────────────────────────────────────
    const response = {
      success: true,
      scan: {
        _id: scan._id, imageUrl, prediction, confidence,
        allScores: scores, pointsEarned, isDuplicate,
        createdAt: scan.createdAt,
      },
      user: { points: user.points, tier: user.tier, totalScans: user.totalScans },
      milestones,
    };

    if (isDuplicate) {
      const methodNote = scope === "user"
        ? ` (${method || "image"} similarity)`
        : ` (global ${method || "image"} match)`;
      response.warning = scope === "user"
        ? "This image has already been classified. No points awarded."
        : "A very similar image was recently submitted. No points awarded.";
      response.warning += methodNote;
      response.duplicateScope = scope;
      response.duplicateMethod = method || "pHash";
    }

    return res.json(response);
  } catch (err) {
    console.error("[classify]", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/scans
exports.getScans = async (req, res) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 10;
    const filter = { user: req.user._id };
    if (req.query.category) filter.prediction = req.query.category;

    const [scans, total] = await Promise.all([
      Scan.find(filter).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit),
      Scan.countDocuments(filter),
    ]);
    res.json({ success: true, scans,
      pagination: { page, limit, total, pages: Math.ceil(total/limit) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/scans/recent
exports.getRecentScans = async (req, res) => {
  try {
    const scans = await Scan.find({ user: req.user._id })
      .sort({ createdAt: -1 }).limit(10);
    res.json({ success: true, scans });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/scans/limits
exports.getLimits = async (req, res) => {
  try {
    const userId     = req.user._id;
    const now        = Date.now();
    const oneHourAgo = new Date(now - 60*60*1000);
    const midnight   = new Date(); midnight.setHours(0,0,0,0);

    const [perHour, perDay] = await Promise.all([
      Scan.countDocuments({ user: userId, createdAt: { $gte: oneHourAgo } }),
      Scan.countDocuments({ user: userId, createdAt: { $gte: midnight } }),
    ]);

    const last     = lastScanTime.get(userId.toString());
    const cooldown = last
      ? Math.max(0, Math.ceil(LIMITS.MIN_INTERVAL_SEC - (now - last) / 1000))
      : 0;

    res.json({ success: true, limits: {
      cooldownSeconds:    cooldown,
      scansLastHour:      perHour,
      maxPerHour:         LIMITS.MAX_PER_HOUR,
      remainingThisHour:  Math.max(0, LIMITS.MAX_PER_HOUR - perHour),
      scansToday:         perDay,
      maxPerDay:          LIMITS.MAX_PER_DAY,
      remainingToday:     Math.max(0, LIMITS.MAX_PER_DAY - perDay),
    }});
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/scans/:id
exports.getScan = async (req, res) => {
  try {
    const scan = await Scan.findOne({ _id: req.params.id, user: req.user._id });
    if (!scan) return res.status(404).json({ success: false, message: "Scan not found" });
    res.json({ success: true, scan });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// DELETE /api/scans/:id
exports.deleteScan = async (req, res) => {
  try {
    const scan = await Scan.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!scan) return res.status(404).json({ success: false, message: "Scan not found" });
    const fp = path.join(__dirname, "../../", scan.imageUrl);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    res.json({ success: true, message: "Scan deleted" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
