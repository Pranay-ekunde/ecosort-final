const router = require("express").Router();
const ctrl   = require("../controllers/rewardController");
const { protect } = require("../middleware/auth");
router.get("/balance", protect, ctrl.getBalance);
router.get("/",        protect, ctrl.getRewardHistory);
module.exports = router;
