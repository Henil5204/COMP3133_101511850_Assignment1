// graphql/resolvers.js
// v3.0.0
//
// All 8 required operations + the bonus "me" query.
// Each resolver validates its input, does the DB work, and returns clean data.
// Errors are thrown using the helpers in utils/errors.js so Apollo formats them nicely.

const User     = require("../models/User");
const Employee = require("../models/Employee");
const { requireAuth, signToken } = require("../middleware/auth");
const { notFound, badInput, conflict }  = require("../utils/errors");
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

// ─────────────────────────────────────────────────────────────────────────────

const resolvers = {

  // ── Custom field resolvers ───────────────────────────────────────────────
  // These handle fields that need a little massaging before sending to the client

  Employee: {
    full_name:       (e)  => `${e.first_name} ${e.last_name}`,
    date_of_joining: (e)  => new Date(e.date_of_joining).toISOString().split("T")[0],
    created_at:      (e)  => e.created_at?.toISOString(),
    updated_at:      (e)  => e.updated_at?.toISOString(),
  },

  User: {
    created_at: (u) => u.created_at?.toISOString(),
    updated_at: (u) => u.updated_at?.toISOString(),
  },


  // ── Queries ───────────────────────────────────────────────────────────────

  Query: {

    // ─ 2. Login ──────────────────────────────────────────────────────────────
    // Accepts username OR email + password. Returns a JWT + the user object.
    login: async (_, { usernameOrEmail, password }) => {
      requireField(usernameOrEmail, "usernameOrEmail");
      requireField(password, "password");

      const user = await User.findByCredential(usernameOrEmail);

      // same error message for both "user doesn't exist" and "wrong password"
      // so we don't leak info about what accounts exist
      if (!user || !(await user.comparePassword(password))) {
        throw badInput("Those credentials don't match anything in our system. Double-check and try again.");
      }

      if (!user.is_active) {
        throw badInput("This account has been deactivated. Reach out to support if that's unexpected.");
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
    // Protected. Supports page/limit pagination so it doesn't blow up on large datasets.
    getAllEmployees: async (_, { page = 1, limit = 20 }, context) => {
      requireAuth(context);

      // clamp values so nobody passes page=0 or limit=99999
      const safePage  = Math.max(1, page);
      const safeLimit = Math.min(100, Math.max(1, limit));
      const skip      = (safePage - 1) * safeLimit;

      // run both queries at the same time instead of one after the other
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
    // Case-insensitive partial match on either (or both) fields.
    searchEmployeeByDesignationOrDepartment: async (_, { designation, department }, context) => {
      requireAuth(context);

      if (!designation && !department) {
        throw badInput("You need to pass at least one of: designation, department.");
      }

      const filters = [];
      if (designation) filters.push({ designation: { $regex: designation.trim(), $options: "i" } });
      if (department)  filters.push({ department:  { $regex: department.trim(),  $options: "i" } });

      const employees = await Employee.find({ $or: filters }).sort({ created_at: -1 });
      return { total: employees.length, employees };
    },


    // ─ Bonus: me ─────────────────────────────────────────────────────────────
    // Quick way to confirm your token works and see your own profile.
    me: async (_, __, context) => {
      return requireAuth(context);
    },
  },


  // ── Mutations ─────────────────────────────────────────────────────────────

  Mutation: {

    // ─ 1. Signup ──────────────────────────────────────────────────────────────
    signup: async (_, { username, email, password }) => {
      requireField(username, "username");
      requireField(email,    "email");
      requireField(password, "password");

      validateEmail(email);
      validatePassword(password);

      if (username.length < 3) throw badInput("Username must be at least 3 characters.");
      if (!/^[a-zA-Z0-9_]+$/.test(username))
        throw badInput("Username can only have letters, numbers, and underscores — no spaces.");

      // check both fields in one query
      const taken = await User.findOne({
        $or: [{ username: username.trim() }, { email: email.toLowerCase().trim() }],
      });

      if (taken) {
        if (taken.username === username.trim())
          throw conflict("That username is already taken — try a different one.");
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
    // employee_photo should be the URL you got back from POST /api/upload
    addEmployee: async (_, args, context) => {
      requireAuth(context);

      const {
        first_name, last_name, email,
        gender, designation, salary,
        date_of_joining, department, employee_photo,
      } = args;

      // make sure all required fields are present
      requireField(first_name,  "first_name");
      requireField(last_name,   "last_name");
      requireField(email,       "email");
      requireField(designation, "designation");
      requireField(department,  "department");

      validateEmail(email);
      validateSalary(salary);
      const joinDate = validateDate(date_of_joining, "date_of_joining");

      // check duplicate email before trying to insert
      const duplicate = await Employee.findOne({ email: email.toLowerCase().trim() });
      if (duplicate) throw conflict(`There's already an employee with the email "${email}".`);

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
    // Only the fields you actually pass in get changed — everything else stays the same.
    updateEmployee: async (_, { eid, ...updates }, context) => {
      requireAuth(context);
      validateObjectId(eid, "eid");

      const existing = await Employee.findById(eid);
      if (!existing) throw notFound(`Employee with ID "${eid}"`);

      // validate whatever was provided
      if (updates.email) {
        validateEmail(updates.email);
        const emailTaken = await Employee.findOne({
          email: updates.email.toLowerCase().trim(),
          _id:   { $ne: eid },
        });
        if (emailTaken) throw conflict(`The email "${updates.email}" is already in use.`);
        updates.email = updates.email.trim();
      }

      if (updates.salary          !== undefined) validateSalary(updates.salary);
      if (updates.date_of_joining !== undefined) {
        updates.date_of_joining = validateDate(updates.date_of_joining, "date_of_joining");
      }

      // trim strings if present
      ["first_name", "last_name", "designation", "department"].forEach((f) => {
        if (updates[f]) updates[f] = updates[f].trim();
      });

      if (updates.salary) updates.salary = parseFloat(updates.salary);

      const clean = pickDefined(updates);
      if (Object.keys(clean).length === 0) {
        throw badInput("Nothing to update — you need to pass at least one field.");
      }

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