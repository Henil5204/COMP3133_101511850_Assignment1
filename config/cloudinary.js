// config/cloudinary.js
// v3.0.0
//
// Sets up Cloudinary with credentials from .env
// and warns you early if something's missing so you don't
// scratch your head wondering why uploads break later.

const cloudinary = require("cloudinary").v2; // .v2 works in both v1 and v2
const logger     = require("../utils/logger");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true, // always use HTTPS URLs
});

// quick sanity check on startup
if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY    ||
  !process.env.CLOUDINARY_API_SECRET
) {
  logger.warn("⚠️  Cloudinary credentials missing — photo uploads won't work until you add them to .env");
} else {
  logger.info("✅  Cloudinary ready");
}

module.exports = cloudinary;