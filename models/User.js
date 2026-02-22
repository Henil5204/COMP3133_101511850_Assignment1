// models/User.js
// v3.0.0
//
// User model for authentication.
// Passwords are hashed with bcrypt (12 rounds) before saving.
// The password field is excluded from query results by default
// — you have to explicitly request it with .select("+password").

const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
const validator = require("validator");

const userSchema = new mongoose.Schema(
  {
    username: {
      type:      String,
      required:  [true, "Username is required."],
      unique:    true,
      trim:      true,
      minlength: [3,  "Username must be at least 3 characters."],
      maxlength: [30, "Username can't be longer than 30 characters."],
      match: [
        /^[a-zA-Z0-9_]+$/,
        "Username can only have letters, numbers, and underscores.",
      ],
    },

    email: {
      type:      String,
      required:  [true, "Email is required."],
      unique:    true,
      lowercase: true,
      trim:      true,
      validate: {
        validator: (v) => validator.isEmail(v),
        message:   "That doesn't look like a valid email.",
      },
    },

    // never stored as plain text — hashed in the pre-save hook below
    password: {
      type:      String,
      required:  [true, "Password is required."],
      minlength: [8, "Password must be at least 8 characters."],
      select:    false, // hidden by default
    },

    is_active: {
      type:    Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// indexes for fast lookups
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });

// hash the password every time it changes
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// handy method so we don't repeat bcrypt.compare in resolvers
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// find a user by username OR email in one call
userSchema.statics.findByCredential = function (usernameOrEmail) {
  return this.findOne({
    $or: [
      { username: usernameOrEmail },
      { email: usernameOrEmail.toLowerCase() },
    ],
  }).select("+password"); // include password for comparison
};

module.exports = mongoose.model("User", userSchema);