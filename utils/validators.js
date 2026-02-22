// utils/validators.js
// v3.1.0
//
// Input validation using express-validator (as required by the assignment spec).
// Each helper throws a clear, human-readable error if something's wrong.
//
// express-validator is typically used as Express route middleware, but for
// GraphQL resolvers we use its underlying validators directly — same library,
// same validation rules, just called as functions instead of middleware.

const { body, validationResult } = require("express-validator");
const { isEmail, isISO8601 }     = require("validator"); // express-validator re-exports validator.js
const { badInput } = require("./errors");

// ─── Direct validators for GraphQL resolvers ──────────────────────────────────

// make sure a value actually exists and isn't just whitespace
const requireField = (value, fieldName) => {
  if (!value || String(value).trim() === "") {
    throw badInput(`"${fieldName}" is required — you can't leave it empty.`);
  }
};

// email check via express-validator's underlying isEmail
const validateEmail = (email) => {
  if (!isEmail(String(email))) {
    throw badInput(`"${email}" doesn't look like a valid email address.`);
  }
};

// password rules: 8+ chars, 1 uppercase, 1 lowercase, 1 digit
const validatePassword = (password) => {
  if (!password || password.length < 8)
    throw badInput("Password needs to be at least 8 characters.");
  if (!/[A-Z]/.test(password))
    throw badInput("Password needs at least one uppercase letter.");
  if (!/[a-z]/.test(password))
    throw badInput("Password needs at least one lowercase letter.");
  if (!/[0-9]/.test(password))
    throw badInput("Password needs at least one number.");
};

// salary >= 1000 per assignment spec
const validateSalary = (salary) => {
  const num = parseFloat(salary);
  if (isNaN(num)) throw badInput("Salary has to be a valid number.");
  if (num < 1000)  throw badInput("Salary must be at least $1,000.");
};

// make sure a date string parses to a real date — uses validator.isISO8601
const validateDate = (dateStr, fieldName = "Date") => {
  if (!isISO8601(String(dateStr), { strict: false })) {
    throw badInput(`"${fieldName}" needs to be a real date (e.g. 2024-01-15).`);
  }
  return new Date(dateStr);
};

// MongoDB ObjectIDs are exactly 24 hex characters
const validateObjectId = (id, fieldName = "ID") => {
  if (!id || !/^[a-f\d]{24}$/i.test(String(id)))
    throw badInput(`"${fieldName}" is not a valid ID.`);
};

// ─── express-validator middleware chains for REST endpoints ───────────────────
// These are the classic express-validator pattern used on the /api/upload route
// and can be reused if any REST endpoints are added later.

const signupValidationRules = () => [
  body("username")
    .trim()
    .notEmpty().withMessage("Username is required.")
    .isLength({ min: 3 }).withMessage("Username must be at least 3 characters.")
    .matches(/^[a-zA-Z0-9_]+$/).withMessage("Username can only contain letters, numbers, and underscores."),
  body("email")
    .trim().notEmpty().withMessage("Email is required.")
    .isEmail().withMessage("Please enter a valid email address.")
    .normalizeEmail(),
  body("password")
    .notEmpty().withMessage("Password is required.")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters.")
    .matches(/[A-Z]/).withMessage("Password needs at least one uppercase letter.")
    .matches(/[a-z]/).withMessage("Password needs at least one lowercase letter.")
    .matches(/[0-9]/).withMessage("Password needs at least one number."),
];

const employeeValidationRules = () => [
  body("first_name").trim().notEmpty().withMessage("First name is required."),
  body("last_name").trim().notEmpty().withMessage("Last name is required."),
  body("email").trim().isEmail().withMessage("Please enter a valid email.").normalizeEmail(),
  body("gender").isIn(["Male", "Female", "Other"]).withMessage("Gender must be Male, Female, or Other."),
  body("designation").trim().notEmpty().withMessage("Designation is required."),
  body("salary").isFloat({ min: 1000 }).withMessage("Salary must be at least $1,000."),
  body("date_of_joining").isISO8601().withMessage("Date of joining must be a valid date (e.g. 2024-01-15)."),
  body("department").trim().notEmpty().withMessage("Department is required."),
];

// call after running validation rules — collects errors and throws as one message
const handleValidationErrors = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg).join(" | ");
    throw badInput(messages);
  }
};

const VALID_GENDERS = ["Male", "Female", "Other"];

module.exports = {
  requireField,
  validateEmail,
  validatePassword,
  validateSalary,
  validateDate,
  validateObjectId,
  VALID_GENDERS,
  signupValidationRules,
  employeeValidationRules,
  handleValidationErrors,
};