const multer = require("multer");

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only JPG, PNG, WEBP images are allowed"), false);
};

// Use memory storage — no files ever written to disk.
// req.file.buffer holds the raw bytes in RAM.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

module.exports = upload;
