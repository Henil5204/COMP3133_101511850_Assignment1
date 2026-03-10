// graphql/resolvers.js
// v4.0.0
//
// All 8 required operations + bonus "me" query.
//
// Photo handling:
//   - addEmployee and updateEmployee both accept an employee_photo argument
//   - Pass the Cloudinary URL you got from POST /api/upload
//   - OR use the combined REST endpoints:
//       POST /api/employees/photo   — create employee with photo in one shot
//       PUT  /api/employees/:id/photo — update employee with photo in one shot

const User     = require("../models/User");
const Employee = require("../models/Employee");
const { requireAuth, signToken } = require("../middleware/auth");
const { notFound, badInput, conflict } = require("../utils/errors");
const {
  requireField,
  validateEmail,
  validatePassword,
  validateSalary,
  validateDate,
  validateObjectId,
} = require("../utils/validators");
const logger = require("../utils/logger");

// strips out undefined/null so we only $set fields that were actually passed
const pickDefined = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null)
  );

const resolvers = {

  // ── Field resolvers ──────────────────────────────────────────────────────
  Employee: {
    full_name:       (e) => `${e.first_name} ${e.last_name}`,
    date_of_joining: (e) => new Date(e.date_of_joining).toISOString().split("T")[0],
    created_at:      (e) => e.created_at?.toISOString(),
    updated_at:      (e) => e.updated_at?.toISOString(),
  },

  User: {
    created_at: (u) => u.created_at?.toISOString(),
    updated_at: (u) => u.updated_at?.toISOString(),
  },

  // ── Queries ──────────────────────────────────────────────────────────────
  Query: {

    // ─ 2. Login ──────────────────────────────────────────────────────────────
    login: async (_, { usernameOrEmail, password }) => {
      requireField(usernameOrEmail, "usernameOrEmail");
      requireField(password, "password");

      const user = await User.findByCredential(usernameOrEmail);

      if (!user || !(await user.comparePassword(password))) {
        throw badInput("Those credentials don't match. Double-check and try again.");
      }

      if (!user.is_active) {
        throw badInput("This account has been deactivated. Reach out to support.");
      }

      logger.info(`User "${user.username}" logged in`);

      return {
        token:      signToken(user._id),
        token_type: "Bearer",
        expires_in: process.env.JWT_EXPIRES_IN || "7d",
        user,
      };
    },

    // ─ 3. Get all employees ──────────────────────────────────────────────────
    getAllEmployees: async (_, { page = 1, limit = 20 }, context) => {
      requireAuth(context);

      const safePage  = Math.max(1, page);
      const safeLimit = Math.min(100, Math.max(1, limit));
      const skip      = (safePage - 1) * safeLimit;

      const [employees, total] = await Promise.all([
        Employee.find().sort({ created_at: -1 }).skip(skip).limit(safeLimit),
        Employee.countDocuments(),
      ]);

      return { total, employees };
    },

    // ─ 5. Search employee by ID ───────────────────────────────────────────────
    searchEmployeeById: async (_, { eid }, context) => {
      requireAuth(context);
      validateObjectId(eid, "eid");

      const employee = await Employee.findById(eid);
      if (!employee) throw notFound(`Employee with ID "${eid}"`);

      return employee;
    },

    // ─ 8. Search by designation OR department ────────────────────────────────
    searchEmployeeByDesignationOrDepartment: async (_, { designation, department }, context) => {
      requireAuth(context);

      if (!designation && !department) {
        throw badInput("Provide at least one of: designation, department.");
      }

      const filters = [];
      if (designation) filters.push({ designation: { $regex: designation.trim(), $options: "i" } });
      if (department)  filters.push({ department:  { $regex: department.trim(),  $options: "i" } });

      const employees = await Employee.find({ $or: filters }).sort({ created_at: -1 });
      return { total: employees.length, employees };
    },

    // ─ Bonus: me ─────────────────────────────────────────────────────────────
    me: async (_, __, context) => {
      return requireAuth(context);
    },
  },

  // ── Mutations ────────────────────────────────────────────────────────────
  Mutation: {

    // ─ 1. Signup ──────────────────────────────────────────────────────────────
    signup: async (_, { username, email, password }) => {
      requireField(username, "username");
      requireField(email,    "email");
      requireField(password, "password");

      validateEmail(email);
      validatePassword(password);

      if (username.length < 3)
        throw badInput("Username must be at least 3 characters.");
      if (!/^[a-zA-Z0-9_]+$/.test(username))
        throw badInput("Username can only have letters, numbers, and underscores.");

      const taken = await User.findOne({
        $or: [{ username: username.trim() }, { email: email.toLowerCase().trim() }],
      });

      if (taken) {
        if (taken.username === username.trim())
          throw conflict("That username is already taken.");
        throw conflict("That email is already registered.");
      }

      const user = await User.create({
        username: username.trim(),
        email:    email.trim(),
        password,
      });

      logger.info(`New user registered: ${user.username}`);
      return user;
    },

    // ─ 4. Add employee ────────────────────────────────────────────────────────
    //
    // employee_photo is optional — two ways to provide it:
    //
    //   Option A (GraphQL only):
    //     1. Call POST /api/upload with the image file → get back a URL
    //     2. Pass that URL as employee_photo here
    //
    //   Option B (one-shot REST):
    //     Skip this mutation entirely and use:
    //     POST /api/employees/photo  (multipart/form-data with photo + all fields)
    //
    addEmployee: async (_, args, context) => {
      requireAuth(context);

      const {
        first_name, last_name, email,
        gender, designation, salary,
        date_of_joining, department,
        employee_photo,  // Cloudinary URL — optional
      } = args;

      requireField(first_name,  "first_name");
      requireField(last_name,   "last_name");
      requireField(email,       "email");
      requireField(designation, "designation");
      requireField(department,  "department");

      validateEmail(email);
      validateSalary(salary);
      const joinDate = validateDate(date_of_joining, "date_of_joining");

      const duplicate = await Employee.findOne({ email: email.toLowerCase().trim() });
      if (duplicate)
        throw conflict(`An employee with email "${email}" already exists.`);

      const employee = await Employee.create({
        first_name:      first_name.trim(),
        last_name:       last_name.trim(),
        email:           email.trim(),
        gender,
        designation:     designation.trim(),
        salary:          parseFloat(salary),
        date_of_joining: joinDate,
        department:      department.trim(),
        employee_photo:  employee_photo || null,
      });

      logger.info(`Employee added: ${employee.first_name} ${employee.last_name} (${employee._id})`);
      return employee;
    },

    // ─ 6. Update employee ────────────────────────────────────────────────────
    //
    // employee_photo is optional — two ways to update it:
    //
    //   Option A (GraphQL only):
    //     1. Call POST /api/upload with the new image → get back a URL
    //     2. Pass that URL as employee_photo here
    //
    //   Option B (one-shot REST):
    //     PUT /api/employees/:eid/photo  (multipart/form-data with photo + fields to update)
    //
    updateEmployee: async (_, { eid, ...updates }, context) => {
      requireAuth(context);
      validateObjectId(eid, "eid");

      const existing = await Employee.findById(eid);
      if (!existing) throw notFound(`Employee with ID "${eid}"`);

      if (updates.email) {
        validateEmail(updates.email);
        const emailTaken = await Employee.findOne({
          email: updates.email.toLowerCase().trim(),
          _id:   { $ne: eid },
        });
        if (emailTaken)
          throw conflict(`The email "${updates.email}" is already in use by another employee.`);
        updates.email = updates.email.trim();
      }

      if (updates.salary          !== undefined) validateSalary(updates.salary);
      if (updates.date_of_joining !== undefined) {
        updates.date_of_joining = validateDate(updates.date_of_joining, "date_of_joining");
      }

      ["first_name", "last_name", "designation", "department"].forEach((f) => {
        if (updates[f]) updates[f] = updates[f].trim();
      });

      if (updates.salary) updates.salary = parseFloat(updates.salary);

      // employee_photo — if a new URL was passed, update it; otherwise leave it alone
      // (null means "keep existing photo", undefined also keeps existing)

      const clean = pickDefined(updates);
      if (Object.keys(clean).length === 0)
        throw badInput("Nothing to update — pass at least one field.");

      const updated = await Employee.findByIdAndUpdate(
        eid,
        { $set: clean },
        { new: true, runValidators: true }
      );

      logger.info(`Employee updated: ${eid}`);
      return updated;
    },

    // ─ 7. Delete employee ────────────────────────────────────────────────────
    deleteEmployee: async (_, { eid }, context) => {
      requireAuth(context);
      validateObjectId(eid, "eid");

      const employee = await Employee.findById(eid);
      if (!employee) throw notFound(`Employee with ID "${eid}"`);

      await Employee.findByIdAndDelete(eid);

      logger.info(`Employee deleted: ${eid}`);
      return {
        success:    true,
        message:    `"${employee.first_name} ${employee.last_name}" has been removed.`,
        deleted_id: eid,
      };
    },
  },
};

module.exports = resolvers;