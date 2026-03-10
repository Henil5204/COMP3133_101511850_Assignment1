// routes/upload.js
// v4.0.0
//
// Three endpoints:
//
//   POST /api/upload
//     — just uploads a photo to Cloudinary and returns the URL
//     — use this URL in the addEmployee / updateEmployee GraphQL mutations
//
//   POST /api/employees/photo
//     — uploads photo + creates employee in ONE request
//     — send everything as multipart/form-data
//
//   PUT /api/employees/:eid/photo
//     — uploads photo + updates employee in ONE request
//     — send everything as multipart/form-data

const express    = require("express");
const multer     = require("multer");
const jwt        = require("jsonwebtoken");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");
const Employee   = require("../models/Employee");
const User       = require("../models/User");
const logger     = require("../utils/logger");

const router = express.Router();

// ─── Cloudinary storage config ────────────────────────────────────────────────
const storage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder:          "emp_mgmt/photos",
    public_id:       `emp_${Date.now()}`,
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation:  [
      { width: 400, height: 400, crop: "fill", gravity: "face" },
      { quality: "auto", fetch_format: "auto" },
    ],
  }),
});

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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// ─── Auth middleware for REST routes ─────────────────────────────────────────
const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided. Please login first." });
  }

  const token = authHeader.slice(7).trim();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.userId);
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: "Invalid or expired token." });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
};

// ─── POST /api/upload ─────────────────────────────────────────────────────────
// Just uploads a photo and returns the URL.
// Use the URL in your addEmployee / updateEmployee GraphQL mutation.
//
// Body: multipart/form-data
// Field: photo (image file)
router.post("/", protect, upload.single("photo"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No photo attached. Send the image in a field called 'photo'.",
    });
  }

  logger.info(`Photo uploaded → ${req.file.path}`);

  return res.status(200).json({
    success:   true,
    message:   "Photo uploaded! Copy the URL and use it in your addEmployee mutation.",
    url:       req.file.path,
    public_id: req.file.filename,
  });
});

// ─── POST /api/employees/photo ────────────────────────────────────────────────
// Upload photo AND create employee in ONE request.
//
// Body: multipart/form-data with these fields:
//   photo          (file)
//   first_name     (text)
//   last_name      (text)
//   email          (text)
//   gender         (text) — Male / Female / Other
//   designation    (text)
//   salary         (text) — number >= 1000
//   date_of_joining (text) — e.g. 2024-01-15
//   department     (text)
router.post("/employees/photo", protect, upload.single("photo"), async (req, res) => {
  try {
    const {
      first_name, last_name, email,
      gender, designation, salary,
      date_of_joining, department,
    } = req.body;

    // basic validation
    const required = { first_name, last_name, email, gender, designation, salary, date_of_joining, department };
    const missing  = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    if (!["Male", "Female", "Other"].includes(gender)) {
      return res.status(400).json({ success: false, message: "Gender must be Male, Female, or Other." });
    }

    if (parseFloat(salary) < 1000) {
      return res.status(400).json({ success: false, message: "Salary must be at least $1,000." });
    }

    // check duplicate email
    const duplicate = await Employee.findOne({ email: email.toLowerCase().trim() });
    if (duplicate) {
      return res.status(409).json({ success: false, message: `An employee with email "${email}" already exists.` });
    }

    // photo URL from Cloudinary (null if no photo was attached)
    const employee_photo = req.file ? req.file.path : null;

    const employee = await Employee.create({
      first_name:      first_name.trim(),
      last_name:       last_name.trim(),
      email:           email.trim(),
      gender,
      designation:     designation.trim(),
      salary:          parseFloat(salary),
      date_of_joining: new Date(date_of_joining),
      department:      department.trim(),
      employee_photo,
    });

    logger.info(`Employee created with photo: ${employee.first_name} ${employee.last_name}`);

    return res.status(201).json({
      success:  true,
      message:  `Employee "${employee.first_name} ${employee.last_name}" created successfully.`,
      employee: {
        _id:             employee._id,
        first_name:      employee.first_name,
        last_name:       employee.last_name,
        full_name:       `${employee.first_name} ${employee.last_name}`,
        email:           employee.email,
        gender:          employee.gender,
        designation:     employee.designation,
        salary:          employee.salary,
        date_of_joining: employee.date_of_joining,
        department:      employee.department,
        employee_photo:  employee.employee_photo,
        created_at:      employee.created_at,
      },
    });
  } catch (err) {
    logger.error("Error creating employee with photo:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/employees/:eid/photo ────────────────────────────────────────────
// Upload photo AND update employee in ONE request.
//
// Body: multipart/form-data — only send the fields you want to change
//   photo          (file)    — optional
//   first_name     (text)    — optional
//   last_name      (text)    — optional
//   email          (text)    — optional
//   gender         (text)    — optional
//   designation    (text)    — optional
//   salary         (text)    — optional
//   date_of_joining (text)   — optional
//   department     (text)    — optional
router.put("/employees/:eid/photo", protect, upload.single("photo"), async (req, res) => {
  try {
    const { eid } = req.params;

    // validate ObjectId
    if (!/^[a-f\d]{24}$/i.test(eid)) {
      return res.status(400).json({ success: false, message: "Invalid employee ID." });
    }

    const employee = await Employee.findById(eid);
    if (!employee) {
      return res.status(404).json({ success: false, message: `Employee with ID "${eid}" not found.` });
    }

    // build update object from whatever was sent
    const updates = {};
    const fields  = ["first_name", "last_name", "email", "gender", "designation", "department"];
    fields.forEach((f) => { if (req.body[f]) updates[f] = req.body[f].trim(); });

    if (req.body.salary) {
      if (parseFloat(req.body.salary) < 1000) {
        return res.status(400).json({ success: false, message: "Salary must be at least $1,000." });
      }
      updates.salary = parseFloat(req.body.salary);
    }

    if (req.body.date_of_joining) {
      updates.date_of_joining = new Date(req.body.date_of_joining);
    }

    if (req.body.gender && !["Male", "Female", "Other"].includes(req.body.gender)) {
      return res.status(400).json({ success: false, message: "Gender must be Male, Female, or Other." });
    }

    // if a new photo was uploaded, use it — otherwise keep the old one
    if (req.file) {
      updates.employee_photo = req.file.path;
      logger.info(`New photo uploaded for employee ${eid}: ${req.file.path}`);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "Nothing to update — send at least one field." });
    }

    const updated = await Employee.findByIdAndUpdate(
      eid,
      { $set: updates },
      { new: true, runValidators: true }
    );

    logger.info(`Employee updated with photo: ${eid}`);

    return res.status(200).json({
      success:  true,
      message:  `Employee "${updated.first_name} ${updated.last_name}" updated successfully.`,
      employee: {
        _id:             updated._id,
        first_name:      updated.first_name,
        last_name:       updated.last_name,
        full_name:       `${updated.first_name} ${updated.last_name}`,
        email:           updated.email,
        gender:          updated.gender,
        designation:     updated.designation,
        salary:          updated.salary,
        date_of_joining: updated.date_of_joining,
        department:      updated.department,
        employee_photo:  updated.employee_photo,
        updated_at:      updated.updated_at,
      },
    });
  } catch (err) {
    logger.error("Error updating employee with photo:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Multer error handler ─────────────────────────────────────────────────────
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ success: false, message: "File too large — max 5MB." });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
});

module.exports = router;