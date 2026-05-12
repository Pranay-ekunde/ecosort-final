const router = require("express").Router();
const User   = require("../models/User");
const { protect } = require("../middleware/auth");
router.get("/profile", protect, (req, res) => res.json({ success:true, user:req.user }));
router.put("/profile", protect, async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const u = await User.findByIdAndUpdate(req.user._id, { name, avatar }, { new:true, runValidators:true });
    res.json({ success:true, user:u });
  } catch (e) { res.status(500).json({ success:false, message:e.message }); }
});
module.exports = router;
