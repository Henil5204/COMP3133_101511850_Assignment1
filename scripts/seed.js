// scripts/seed.js
// v3.0.0
//
// Drops existing users and employees, then inserts some sample data.
// Run with: npm run seed
//
// After seeding you can login with:
//   username: admin     password: Admin1234
//   username: testuser  password: Test1234

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const mongoose = require("mongoose");
const User     = require("../models/User");
const Employee = require("../models/Employee");

const SAMPLE_USERS = [
  { username: "admin",    email: "admin@comp3133.ca",    password: "Admin1234" },
  { username: "testuser", email: "testuser@comp3133.ca", password: "Test1234" },
];

const SAMPLE_EMPLOYEES = [
  {
    first_name: "Alice", last_name: "Johnson",
    email: "alice.j@company.com", gender: "Female",
    designation: "Software Engineer", salary: 85000,
    date_of_joining: "2022-03-15", department: "Engineering",
  },
  {
    first_name: "Bob", last_name: "Smith",
    email: "bob.smith@company.com", gender: "Male",
    designation: "Senior Software Engineer", salary: 110000,
    date_of_joining: "2020-07-01", department: "Engineering",
  },
  {
    first_name: "Carol", last_name: "Davis",
    email: "carol.d@company.com", gender: "Female",
    designation: "Product Manager", salary: 95000,
    date_of_joining: "2021-11-20", department: "Product",
  },
  {
    first_name: "David", last_name: "Lee",
    email: "david.lee@company.com", gender: "Male",
    designation: "UX Designer", salary: 78000,
    date_of_joining: "2023-01-10", department: "Design",
  },
  {
    first_name: "Eva", last_name: "Martinez",
    email: "eva.m@company.com", gender: "Female",
    designation: "DevOps Engineer", salary: 92000,
    date_of_joining: "2022-08-05", department: "Engineering",
  },
  {
    first_name: "Frank", last_name: "Wilson",
    email: "frank.w@company.com", gender: "Male",
    designation: "Data Analyst", salary: 72000,
    date_of_joining: "2023-04-17", department: "Analytics",
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅  Connected to MongoDB\n");

    // wipe existing records
    await User.deleteMany({});
    await Employee.deleteMany({});
    console.log("🗑   Cleared existing users and employees");

    // insert users
    await User.insertMany(SAMPLE_USERS);
    console.log(`👤  Created ${SAMPLE_USERS.length} users`);

    // insert employees — convert date strings to Date objects
    const empDocs = SAMPLE_EMPLOYEES.map((e) => ({
      ...e,
      date_of_joining: new Date(e.date_of_joining),
    }));
    await Employee.insertMany(empDocs);
    console.log(`👷  Created ${empDocs.length} employees\n`);

    console.log("──────────────────────────────────────────");
    console.log("  Test credentials:");
    console.log("  admin    / Admin1234");
    console.log("  testuser / Test1234");
    console.log("──────────────────────────────────────────\n");
    console.log("✅  Seed done!");

  } catch (err) {
    console.error("❌  Seed failed:", err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();