// ═══════════════════════════════════════════
// models/User.js
// ═══════════════════════════════════════════
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true, maxlength: 50 },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  avatar:   { type: String, default: "" },
  role:     { type: String, enum: ["user","admin"], default: "user" },

  points:     { type: Number, default: 0 },
  totalScans: { type: Number, default: 0 },
  tier: {
    type: String,
    enum: ["bronze","silver","gold","platinum"],
    default: "bronze",
  },
  scanStats: {
    recyclable:     { type: Number, default: 0 },
    non_recyclable: { type: Number, default: 0 },
    hazardous:      { type: Number, default: 0 },
  },
  isActive:  { type: Boolean, default: true },
  lastLogin: { type: Date },
}, { timestamps: true });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

userSchema.methods.updateTier = function () {
  if      (this.points >= 5000) this.tier = "platinum";
  else if (this.points >= 2000) this.tier = "gold";
  else if (this.points >= 500)  this.tier = "silver";
  else                          this.tier = "bronze";
};

const User = mongoose.model("User", userSchema);

// ═══════════════════════════════════════════
// models/Scan.js  — with pHash + CNN fields
// ═══════════════════════════════════════════
const scanSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  imageUrl:  { type: String, required: true },
  imageName: { type: String },

  prediction: {
    type: String,
    enum: ["recyclable","non_recyclable","hazardous"],
    required: true,
  },
  confidence: { type: Number, required: true, min: 0, max: 1 },
  allScores: {
    recyclable:     { type: Number },
    non_recyclable: { type: Number },
    hazardous:      { type: Number },
  },

  // Anti-duplicate pHash
  imageHash:   { type: String },
  isDuplicate: { type: Boolean, default: false },
  duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: "Scan" },

  // CNN feature vector for robust duplicate detection
  cnnFeatures: { type: [Number] },

  pointsEarned: { type: Number, default: 0 },
  note:         { type: String, maxlength: 200 },
  location:     { type: String, maxlength: 100 },
}, { timestamps: true });

scanSchema.index({ user: 1, createdAt: -1 });
scanSchema.index({ user: 1, imageHash: 1 });
scanSchema.index({ imageHash: 1, createdAt: -1 });
scanSchema.index({ prediction: 1, createdAt: -1 });

const Scan = mongoose.model("Scan", scanSchema);

// ═══════════════════════════════════════════
// models/Reward.js
// ═══════════════════════════════════════════
const rewardSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type:        { type: String, enum: ["earn","redeem"], required: true },
  points:      { type: Number, required: true },
  description: { type: String, required: true },
  scan:        { type: mongoose.Schema.Types.ObjectId, ref: "Scan" },
  coupon:      { type: mongoose.Schema.Types.ObjectId, ref: "Coupon" },
  balanceAfter:{ type: Number, required: true },
}, { timestamps: true });

rewardSchema.index({ user: 1, createdAt: -1 });

const Reward = mongoose.model("Reward", rewardSchema);

// ═══════════════════════════════════════════
// models/Coupon.js
// ═══════════════════════════════════════════
const { customAlphabet } = require("nanoid");
const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 10);

const couponSchema = new mongoose.Schema({
  code:        { type: String, unique: true },
  user:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  pointsCost:  { type: Number, required: true },
  discount:    { type: String, required: true },
  brand:       { type: String, required: true },
  description: { type: String },
  expiresAt:   { type: Date, required: true },
  isRedeemed:  { type: Boolean, default: false },
  redeemedAt:  { type: Date },
  category: {
    type: String,
    enum: ["grocery","electronics","clothing","food","transport","other"],
    default: "other",
  },
}, { timestamps: true });

couponSchema.pre("save", function (next) {
  if (!this.code) this.code = "ECO-" + nanoid();
  next();
});

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = { User, Scan, Reward, Coupon };
