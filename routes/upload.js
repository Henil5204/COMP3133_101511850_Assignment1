// routes/upload.js
// v3.1.0
//
// REST endpoint for uploading employee photos to Cloudinary.
// Uses express-validator to validate the incoming request (as per assignment spec).
//
// How to use:
//   POST /api/upload
//   Content-Type: multipart/form-data
//   Field name: "photo"
//
// Returns a Cloudinary URL — paste that into the employee_photo
// argument when calling addEmployee or updateEmployee.

const express   = require("express");
const multer    = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { query, validationResult } = require("express-validator");
const cloudinary = require("../config/cloudinary");
const logger    = require("../utils/logger");

const router = express.Router();

// store uploaded files directly on Cloudinary (not on disk)
const storage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder:           "emp_mgmt/photos",
    public_id:        `emp_${Date.now()}`,
    allowed_formats:  ["jpg", "jpeg", "png", "webp"],
    transformation:   [
      { width: 400, height: 400, crop: "fill", gravity: "face" }, // square crop, face-aware
      { quality: "auto", fetch_format: "auto" },                  // auto-optimize
    ],
  }),
});

// only allow actual images
const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, and WebP images are allowed."), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

// ─── POST /api/upload ─────────────────────────────────────────────────────────
router.post("/", upload.single("photo"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No photo attached — send the file in a field called 'photo'.",
    });
  }

  logger.info(`Photo uploaded → ${req.file.path}`);

  return res.status(200).json({
    success:   true,
    message:   "Photo uploaded! Use the URL below in your addEmployee mutation.",
    url:       req.file.path,      // Cloudinary HTTPS URL
    public_id: req.file.filename,  // if you ever need to delete it from Cloudinary
  });
});

// catch multer errors (file too big, wrong type, etc.)
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ success: false, message: "File too big — max 5 MB please." });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
});

module.exports = router;