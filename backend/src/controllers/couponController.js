const Coupon = require("../models/Coupon");
const User   = require("../models/User");
const Reward = require("../models/Reward");

const CATALOGUE = [
  { pointsCost:200,  discount:"10% off",   brand:"EcoMart",   description:"10% off any purchase at EcoMart",           category:"grocery"     },
  { pointsCost:350,  discount:"20% off",   brand:"GreenShop", description:"20% off on eco-friendly products",           category:"grocery"     },
  { pointsCost:500,  discount:"₹100 off",  brand:"BigBasket", description:"₹100 off on orders above ₹500",             category:"grocery"     },
  { pointsCost:400,  discount:"15% off",   brand:"Decathlon", description:"15% off on sports & outdoor items",          category:"clothing"    },
  { pointsCost:600,  discount:"25% off",   brand:"Fab India", description:"25% off on sustainable clothing",            category:"clothing"    },
  { pointsCost:300,  discount:"Free drink",brand:"Starbucks", description:"One free tall beverage",                     category:"food"        },
  { pointsCost:250,  discount:"₹50 off",   brand:"Swiggy",    description:"₹50 off on orders above ₹200",              category:"food"        },
  { pointsCost:700,  discount:"30% off",   brand:"Croma",     description:"30% off on eco-certified electronics",       category:"electronics" },
  { pointsCost:150,  discount:"₹30 off",   brand:"Ola",       description:"₹30 off on your next ride",                 category:"transport"   },
  { pointsCost:1000, discount:"₹500 off",  brand:"Flipkart",  description:"₹500 off on purchase above ₹2000",          category:"other"       },
];

// GET /api/coupons/catalogue
exports.getCatalogue = (req, res) => res.json({ success: true, catalogue: CATALOGUE });

// POST /api/coupons/redeem
exports.redeemCoupon = async (req, res) => {
  try {
    const { catalogueIndex } = req.body;
    const item = CATALOGUE[catalogueIndex];
    if (!item) return res.status(400).json({ success: false, message: "Invalid coupon selection" });

    const user = await User.findById(req.user._id);
    if (user.points < item.pointsCost)
      return res.status(400).json({
        success: false,
        message: `Not enough points. Need ${item.pointsCost}, you have ${user.points}.`,
      });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const coupon = await Coupon.create({
      user: user._id, ...item, expiresAt,
    });

    user.points -= item.pointsCost;
    user.updateTier();
    await user.save();

    await Reward.create({
      user: user._id, type: "redeem", points: -item.pointsCost,
      description: `Redeemed ${item.discount} coupon for ${item.brand}`,
      coupon: coupon._id, balanceAfter: user.points,
    });

    res.json({ success: true, coupon, newBalance: user.points });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/coupons/my
exports.getMyCoupons = async (req, res) => {
  try {
    const filter = { user: req.user._id };
    if (req.query.status === "active")   filter.isRedeemed = false;
    if (req.query.status === "redeemed") filter.isRedeemed = true;
    const coupons = await Coupon.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, coupons });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// POST /api/coupons/use/:code
exports.useCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findOne({ code: req.params.code, user: req.user._id });
    if (!coupon)           return res.status(404).json({ success: false, message: "Coupon not found" });
    if (coupon.isRedeemed) return res.status(400).json({ success: false, message: "Already redeemed" });
    if (coupon.expiresAt < new Date()) return res.status(400).json({ success: false, message: "Coupon expired" });

    coupon.isRedeemed = true;
    coupon.redeemedAt = new Date();
    await coupon.save();
    res.json({ success: true, message: "Coupon marked as used", coupon });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/coupons/validate/:code
exports.validateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findOne({ code: req.params.code });
    if (!coupon)           return res.status(404).json({ success: false, valid: false, message: "Invalid code" });
    if (coupon.isRedeemed) return res.json({ success: true, valid: false, message: "Already used" });
    if (coupon.expiresAt < new Date()) return res.json({ success: true, valid: false, message: "Expired" });
    res.json({ success: true, valid: true,
      coupon: { brand: coupon.brand, discount: coupon.discount, expiresAt: coupon.expiresAt } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
