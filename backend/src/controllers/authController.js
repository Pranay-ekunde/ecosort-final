const jwt    = require("jsonwebtoken");
const User   = require("../models/User");
const Reward = require("../models/Reward");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });

const userPublic = (u) => ({
  _id:       u._id,
  name:      u.name,
  email:     u.email,
  avatar:    u.avatar,
  role:      u.role,
  points:    u.points,
  tier:      u.tier,
  totalScans:u.totalScans,
  scanStats: u.scanStats,
  createdAt: u.createdAt,
});

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: "All fields are required" });
    if (await User.findOne({ email }))
      return res.status(400).json({ success: false, message: "Email already registered" });

    const user = await User.create({ name, email, password });

    // Welcome bonus
    user.points = 50;
    await user.save();
    await Reward.create({
      user:        user._id,
      type:        "earn",
      points:      50,
      description: "Welcome bonus — thanks for joining EcoSort!",
      balanceAfter:50,
    });

    res.status(201).json({
      success: true,
      token:   signToken(user._id),
      user:    userPublic(user),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: "Email and password required" });

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    if (!user.isActive)
      return res.status(403).json({ success: false, message: "Account is banned" });

    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      token:   signToken(user._id),
      user:    userPublic(user),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json({ success: true, user: userPublic(req.user) });
};

// PUT /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: "Both passwords required" });
    if (newPassword.length < 6)
      return res.status(400).json({ success: false, message: "New password must be 6+ chars" });

    const user = await User.findById(req.user._id).select("+password");
    if (!(await user.comparePassword(currentPassword)))
      return res.status(401).json({ success: false, message: "Current password incorrect" });

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
