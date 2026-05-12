const router = require("express").Router();
const ctrl   = require("../controllers/analyticsController");
const { protect } = require("../middleware/auth");
router.get("/summary",  protect, ctrl.getSummary);
router.get("/monthly",  protect, ctrl.getMonthlyAnalytics);
router.get("/global",            ctrl.getGlobalStats);
module.exports = router;
