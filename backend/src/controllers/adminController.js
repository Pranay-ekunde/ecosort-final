const User   = require("../models/User");
const Scan   = require("../models/Scan");
const Reward = require("../models/Reward");
const Coupon = require("../models/Coupon");

// GET /api/admin/stats
exports.getStats = async (req, res) => {
  try {
    const now      = new Date();
    const today    = new Date(now); today.setHours(0,0,0,0);
    const thisWeek = new Date(now); thisWeek.setDate(now.getDate()-7);
    const thisMonth= new Date(now); thisMonth.setDate(1); thisMonth.setHours(0,0,0,0);

    const [
      totalUsers, activeUsers, newToday, newThisWeek,
      totalScans, scansToday, scansThisWeek, scansThisMonth,
      totalCoupons, redeemedCoupons,
      categoryBreakdown, topScanner,
      recentSignups, dailyScans,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive:true }),
      User.countDocuments({ createdAt:{ $gte:today } }),
      User.countDocuments({ createdAt:{ $gte:thisWeek } }),
      Scan.countDocuments(),
      Scan.countDocuments({ createdAt:{ $gte:today } }),
      Scan.countDocuments({ createdAt:{ $gte:thisWeek } }),
      Scan.countDocuments({ createdAt:{ $gte:thisMonth } }),
      Coupon.countDocuments(),
      Coupon.countDocuments({ isRedeemed:true }),
      Scan.aggregate([{ $group:{ _id:"$prediction", count:{ $sum:1 } } }]),
      User.findOne({ isActive:true }).sort({ totalScans:-1 }).select("name email totalScans points tier"),
      User.find().sort({ createdAt:-1 }).limit(5).select("name email createdAt tier points"),
      Scan.aggregate([
        { $match:{ createdAt:{ $gte:new Date(now-14*24*60*60*1000) } } },
        { $group:{ _id:{ $dateToString:{ format:"%Y-%m-%d", date:"$createdAt" } }, count:{ $sum:1 } } },
        { $sort:{ _id:1 } },
      ]),
    ]);

    const breakdown = { recyclable:0, non_recyclable:0, hazardous:0 };
    categoryBreakdown.forEach(({ _id, count }) => { breakdown[_id] = count; });

    res.json({ success:true, stats:{
      users:   { total:totalUsers, active:activeUsers, newToday, newThisWeek },
      scans:   { total:totalScans, today:scansToday, thisWeek:scansThisWeek, thisMonth:scansThisMonth },
      coupons: { total:totalCoupons, redeemed:redeemedCoupons },
      breakdown, topScanner, recentSignups, dailyScans,
    }});
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// GET /api/admin/users
exports.getAllUsers = async (req, res) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 15;
    const search = req.query.search || "";
    const tier   = req.query.tier   || "";
    const sort   = req.query.sort   || "-createdAt";

    const filter = {};
    if (search) filter.$or = [
      { name:  { $regex:search, $options:"i" } },
      { email: { $regex:search, $options:"i" } },
    ];
    if (tier) filter.tier = tier;

    const [users, total] = await Promise.all([
      User.find(filter).sort(sort).skip((page-1)*limit).limit(limit).select("-password"),
      User.countDocuments(filter),
    ]);
    res.json({ success:true, users,
      pagination:{ page, limit, total, pages:Math.ceil(total/limit) } });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// GET /api/admin/users/:id
exports.getUserDetail = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ success:false, message:"User not found" });
    const [scans, rewards, coupons] = await Promise.all([
      Scan.find({ user:user._id }).sort({ createdAt:-1 }).limit(10),
      Reward.find({ user:user._id }).sort({ createdAt:-1 }).limit(10),
      Coupon.find({ user:user._id }).sort({ createdAt:-1 }),
    ]);
    res.json({ success:true, user, scans, rewards, coupons });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// PUT /api/admin/users/:id
exports.updateUser = async (req, res) => {
  try {
    const { role, isActive, points, tier } = req.body;
    const upd = {};
    if (role     !== undefined) upd.role     = role;
    if (isActive !== undefined) upd.isActive = isActive;
    if (points   !== undefined) upd.points   = points;
    if (tier     !== undefined) upd.tier     = tier;
    const user = await User.findByIdAndUpdate(req.params.id, upd, { new:true }).select("-password");
    if (!user) return res.status(404).json({ success:false, message:"User not found" });
    res.json({ success:true, user });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// PUT /api/admin/users/:id/ban
exports.banUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ success:false, message:"Cannot ban yourself" });
    const user = await User.findByIdAndUpdate(req.params.id, { isActive:false }, { new:true }).select("-password");
    if (!user) return res.status(404).json({ success:false, message:"User not found" });
    res.json({ success:true, message:"User banned", user });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// PUT /api/admin/users/:id/unban
exports.unbanUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive:true }, { new:true }).select("-password");
    if (!user) return res.status(404).json({ success:false, message:"User not found" });
    res.json({ success:true, message:"User unbanned", user });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// POST /api/admin/users/:id/award-points
exports.awardPoints = async (req, res) => {
  try {
    const { points, reason } = req.body;
    if (!points || points <= 0)
      return res.status(400).json({ success:false, message:"Points must be positive" });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success:false, message:"User not found" });
    user.points += Number(points);
    user.updateTier();
    await user.save();
    await Reward.create({
      user:user._id, type:"earn", points:Number(points),
      description: reason || `Admin awarded ${points} bonus points`,
      balanceAfter: user.points,
    });
    res.json({ success:true, message:`Awarded ${points} points`, newBalance:user.points });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// GET /api/admin/scans
exports.getAllScans = async (req, res) => {
  try {
    const page     = parseInt(req.query.page)  || 1;
    const limit    = parseInt(req.query.limit) || 20;
    const filter   = {};
    if (req.query.category) filter.prediction = req.query.category;
    if (req.query.userId)   filter.user = req.query.userId;

    const [scans, total] = await Promise.all([
      Scan.find(filter).sort({ createdAt:-1 }).skip((page-1)*limit).limit(limit)
          .populate("user","name email"),
      Scan.countDocuments(filter),
    ]);
    res.json({ success:true, scans,
      pagination:{ page, limit, total, pages:Math.ceil(total/limit) } });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// DELETE /api/admin/scans/:id
exports.deleteScan = async (req, res) => {
  try {
    const scan = await Scan.findByIdAndDelete(req.params.id);
    if (!scan) return res.status(404).json({ success:false, message:"Scan not found" });
    res.json({ success:true, message:"Scan deleted" });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// GET /api/admin/coupons
exports.getAllCoupons = async (req, res) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 20;
    const filter = {};
    if (req.query.redeemed === "true")  filter.isRedeemed = true;
    if (req.query.redeemed === "false") filter.isRedeemed = false;

    const [coupons, total] = await Promise.all([
      Coupon.find(filter).sort({ createdAt:-1 }).skip((page-1)*limit).limit(limit)
            .populate("user","name email"),
      Coupon.countDocuments(filter),
    ]);
    res.json({ success:true, coupons,
      pagination:{ page, limit, total, pages:Math.ceil(total/limit) } });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// GET /api/admin/analytics
exports.getAnalytics = async (req, res) => {
  try {
    const days  = parseInt(req.query.days) || 30;
    const since = new Date(); since.setDate(since.getDate() - days);

    const [dailyScans, dailyUsers, tierDist] = await Promise.all([
      Scan.aggregate([
        { $match:{ createdAt:{ $gte:since } } },
        { $group:{ _id:{ $dateToString:{ format:"%Y-%m-%d", date:"$createdAt" } }, count:{ $sum:1 }, points:{ $sum:"$pointsEarned" } } },
        { $sort:{ _id:1 } },
      ]),
      User.aggregate([
        { $match:{ createdAt:{ $gte:since } } },
        { $group:{ _id:{ $dateToString:{ format:"%Y-%m-%d", date:"$createdAt" } }, count:{ $sum:1 } } },
        { $sort:{ _id:1 } },
      ]),
      User.aggregate([{ $group:{ _id:"$tier", count:{ $sum:1 } } }]),
    ]);

    res.json({ success:true, analytics:{ dailyScans, dailyUsers, tierDist } });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// GET /api/admin/system
exports.getSystemHealth = async (req, res) => {
  try {
    const mongoose = require("mongoose");
    const states   = ["disconnected","connected","connecting","disconnecting"];
    res.json({ success:true, health:{
      database:    states[mongoose.connection.readyState],
      uptime:      process.uptime(),
      memory:      process.memoryUsage(),
      nodeVersion: process.version,
      timestamp:   new Date(),
    }});
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};
