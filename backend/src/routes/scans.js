const router = require("express").Router();
const ctrl   = require("../controllers/scanController");
const { protect } = require("../middleware/auth");
const upload = require("../middleware/upload");

router.post("/classify",  protect, upload.single("image"), ctrl.classify);
router.get("/",           protect, ctrl.getScans);
router.get("/recent",     protect, ctrl.getRecentScans);
router.get("/limits",     protect, ctrl.getLimits);
router.get("/:id",        protect, ctrl.getScan);
router.delete("/:id",     protect, ctrl.deleteScan);

module.exports = router;
