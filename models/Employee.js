// models/Employee.js
// v3.0.0
//
// Employee model — stores everything the assignment spec asks for.
// Added a text index so searching by designation / department is fast,
// and a virtual "full_name" field so we don't have to concatenate in every resolver.

const mongoose  = require("mongoose");
const validator = require("validator");

const employeeSchema = new mongoose.Schema(
  {
    first_name: {
      type:      String,
      required:  [true, "First name is required."],
      trim:      true,
      minlength: [2,   "First name needs at least 2 characters."],
      maxlength: [50,  "First name can't exceed 50 characters."],
    },

    last_name: {
      type:      String,
      required:  [true, "Last name is required."],
      trim:      true,
      minlength: [2,   "Last name needs at least 2 characters."],
      maxlength: [50,  "Last name can't exceed 50 characters."],
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

    gender: {
      type:     String,
      required: [true, "Gender is required."],
      enum: {
        values:  ["Male", "Female", "Other"],
        message: "Gender must be Male, Female, or Other.",
      },
    },

    designation: {
      type:      String,
      required:  [true, "Designation is required."],
      trim:      true,
      maxlength: [100, "Designation can't exceed 100 characters."],
    },

    salary: {
      type:     Number,
      required: [true, "Salary is required."],
      min:      [1000, "Salary has to be at least $1,000."],
    },

    date_of_joining: {
      type:     Date,
      required: [true, "Date of joining is required."],
    },

    department: {
      type:      String,
      required:  [true, "Department is required."],
      trim:      true,
      maxlength: [100, "Department name can't exceed 100 characters."],
    },

    // URL returned by Cloudinary after uploading via POST /api/upload
    employee_photo: {
      type:    String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// indexes so search queries aren't slow when the collection grows
employeeSchema.index({ department: 1 });
employeeSchema.index({ designation: 1 });
employeeSchema.index({ email: 1 });

// text index lets us do case-insensitive substring searches easily
employeeSchema.index(
  { first_name: "text", last_name: "text", designation: "text", department: "text" },
  { name: "employee_text_index" }
);

// virtual — just saves us writing `first_name + " " + last_name` every time
employeeSchema.virtual("full_name").get(function () {
  return `${this.first_name} ${this.last_name}`;
});

module.exports = mongoose.model("Employee", employeeSchema);