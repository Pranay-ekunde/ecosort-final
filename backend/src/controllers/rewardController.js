const Reward = require("../models/Reward");

const TIER_THRESHOLDS = { bronze: 500, silver: 2000, gold: 5000, platinum: Infinity };

// GET /api/rewards/balance
exports.getBalance = async (req, res) => {
  const u    = req.user;
  const next = { bronze:"silver", silver:"gold", gold:"platinum", platinum:null };
  const pts  = TIER_THRESHOLDS[u.tier] === Infinity ? 0 : Math.max(0, TIER_THRESHOLDS[u.tier] - u.points);
  res.json({ success: true, balance: {
    points: u.points, tier: u.tier,
    totalScans: u.totalScans,
    nextTier: next[u.tier],
    pointsToNextTier: pts,
  }});
};

// GET /api/rewards
exports.getRewardHistory = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;

    const [rewards, total] = await Promise.all([
      Reward.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip((page-1)*limit).limit(limit)
        .populate("scan",   "prediction imageUrl")
        .populate("coupon", "code brand discount"),
      Reward.countDocuments({ user: req.user._id }),
    ]);

    res.json({ success: true, rewards,
      pagination: { page, limit, total, pages: Math.ceil(total/limit) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
