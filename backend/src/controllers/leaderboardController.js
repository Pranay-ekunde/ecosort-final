const User = require("../models/User");
const Scan = require("../models/Scan");

// GET /api/leaderboard
exports.getLeaderboard = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const [top, userRank] = await Promise.all([
      User.find({ isActive: true })
        .select("name avatar points tier totalScans")
        .sort({ points: -1 })
        .limit(limit),
      User.countDocuments({ points: { $gt: req.user.points }, isActive: true }),
    ]);
    res.json({ success: true, leaderboard: top, userRank: userRank + 1 });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/leaderboard/weekly
exports.getWeeklyLeaderboard = async (req, res) => {
  try {
    const since = new Date(); since.setDate(since.getDate() - 7);
    const weekly = await Scan.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$user", weeklyScans: { $sum: 1 }, weeklyPoints: { $sum: "$pointsEarned" } } },
      { $sort: { weeklyPoints: -1 } },
      { $limit: 10 },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "u" } },
      { $unwind: "$u" },
      { $match: { "u.isActive": true } },
      { $project: { name:"$u.name", avatar:"$u.avatar", tier:"$u.tier", weeklyScans:1, weeklyPoints:1 } },
    ]);
    res.json({ success: true, leaderboard: weekly });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
