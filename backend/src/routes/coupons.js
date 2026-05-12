const router = require("express").Router();
const ctrl   = require("../controllers/couponController");
const { protect } = require("../middleware/auth");
router.get("/catalogue",               ctrl.getCatalogue);
router.post("/redeem",      protect,   ctrl.redeemCoupon);
router.get("/my",           protect,   ctrl.getMyCoupons);
router.post("/use/:code",   protect,   ctrl.useCoupon);
router.get("/validate/:code",          ctrl.validateCoupon);
module.exports = router;
