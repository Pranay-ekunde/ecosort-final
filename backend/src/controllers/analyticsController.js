const Scan = require("../models/Scan");
const User = require("../models/User");

// GET /api/analytics/summary
exports.getSummary = async (req, res) => {
  try {
    const user      = req.user;
    const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0,0,0,0);

    const [monthlyScans, breakdown] = await Promise.all([
      Scan.countDocuments({ user: user._id, createdAt: { $gte: thisMonth } }),
      Scan.aggregate([
        { $match: { user: user._id } },
        { $group: { _id: "$prediction", count: { $sum: 1 } } },
      ]),
    ]);

    const bd = { recyclable: 0, non_recyclable: 0, hazardous: 0 };
    breakdown.forEach(({ _id, count }) => { bd[_id] = count; });

    res.json({ success: true, summary: {
      totalScans:  user.totalScans,
      monthlyScans,
      points:      user.points,
      tier:        user.tier,
      breakdown:   bd,
      scanStats:   user.scanStats,
    }});
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/analytics/monthly?months=6
exports.getMonthlyAnalytics = async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const since  = new Date(); since.setMonth(since.getMonth() - months);

    const data = await Scan.aggregate([
      { $match: { user: req.user._id, createdAt: { $gte: since }, isDuplicate: false } },
      { $group: {
          _id: {
            year:  { $year:  "$createdAt" },
            month: { $month: "$createdAt" },
            category: "$prediction",
          },
          count:  { $sum: 1 },
          points: { $sum: "$pointsEarned" },
      }},
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const map = {};
    data.forEach(({ _id, count, points }) => {
      const k = `${_id.year}-${String(_id.month).padStart(2,"0")}`;
      if (!map[k]) map[k] = { month:k, recyclable:0, non_recyclable:0, hazardous:0, total:0, points:0 };
      map[k][_id.category] += count;
      map[k].total  += count;
      map[k].points += points;
    });

    res.json({ success: true, data: Object.values(map) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/analytics/global
exports.getGlobalStats = async (req, res) => {
  try {
    const [totalScans, totalUsers, breakdown] = await Promise.all([
      Scan.countDocuments(),
      User.countDocuments({ isActive: true }),
      Scan.aggregate([{ $group: { _id: "$prediction", count: { $sum: 1 } } }]),
    ]);

    const bd = { recyclable: 0, non_recyclable: 0, hazardous: 0 };
    breakdown.forEach(({ _id, count }) => { bd[_id] = count; });

    res.json({ success: true, stats: { totalScans, totalUsers, breakdown: bd } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
