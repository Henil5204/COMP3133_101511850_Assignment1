# COMP3133 Assignment 1 — Employee Management System

**Course:** COMP3133 Full Stack Development II
**Student:** Henil Shah
**Due:** Sunday, February 22, 2026

---

## What is this?

This is a backend API I built for managing employees as part of my COMP3133 assignment at George Brown College. The idea was to pretend I'm a Jr. Software Engineer who just got hired and my manager wants me to build an Employee Management System from scratch.

The whole thing runs on GraphQL, which was honestly pretty interesting to work with — instead of having a bunch of different REST endpoints, everything goes through one `/graphql` endpoint and you just ask for exactly what you need.

---

## Tech I used

- **Node.js + Express** — server
- **Apollo Server 4** — GraphQL
- **MongoDB + Mongoose** — database
- **JWT** — authentication (login tokens)
- **bcryptjs** — password hashing so passwords aren't stored as plain text
- **Cloudinary** — storing employee profile photos
- **express-validator** — input validation
- **Winston** — logging

---

## Project structure

```
assignment1/
├── config/
│   ├── db.js               connects to MongoDB
│   └── cloudinary.js       sets up Cloudinary for photo uploads
├── graphql/
│   ├── typeDefs.js         all the GraphQL types and operations
│   └── resolvers.js        the actual logic behind each operation
├── middleware/
│   └── auth.js             handles JWT — reading tokens, protecting routes
├── models/
│   ├── User.js             user schema (username, email, hashed password)
│   └── Employee.js         employee schema (all the fields from the spec)
├── routes/
│   └── upload.js           REST endpoint for uploading photos to Cloudinary
├── scripts/
│   └── seed.js             loads test data into the database
├── utils/
│   ├── errors.js           reusable error helpers
│   ├── validators.js       input validation using express-validator
│   └── logger.js           Winston logger setup
├── .env.example            template for environment variables
├── .gitignore
├── package.json
└── server.js               entry point — starts everything up
```

---

## How to run it locally

**1. Clone the repo**
```bash
git clone https://github.com/Henil5204/COMP3133_StudentID_Assignment1.git
cd COMP3133_StudentID_Assignment1
```

**2. Install packages**
```bash
npm install --legacy-peer-deps
```

**3. Set up your environment variables**
```bash
cp .env.example .env
```

Open `.env` and fill in your values:
```env
PORT=4000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/comp3133_StudentID_Assigment1
JWT_SECRET=makethissomethinglong
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**4. Load test data**
```bash
npm run seed
```

**5. Start the server**
```bash
npm run dev
```

Server starts at **http://localhost:4000/graphql** — Apollo Sandbox opens in the browser so you can test everything right away.

---

## GraphQL API — all 8 operations

### Public (no login needed)

**Signup — create a new account**
```graphql
mutation {
  signup(
    username: "henil"
    email: "henil3764@gmail.com"
    password: "Henil@2004"
  ) {
    _id
    username
    email
    created_at
  }
}
```

**Login — get your token**
```graphql
query {
  login(usernameOrEmail: "henil", password: "Henil@2004") {
    token
    user {
      _id
      username
      email
    }
  }
}

```

After login, add this to your request headers for all protected routes:
```
Authorization: Bearer your_token_here
```

---

### Protected (need the token above)

**Get all employees**
```graphql
query {
  getAllEmployees(page: 1, limit: 20) {
    total
    employees {
      _id
      full_name
      email
      gender
      designation
      department
      salary
      date_of_joining
      employee_photo
      created_at
    }
  }
}
```

**Add a new employee**
```graphql
mutation {
  addEmployee(
    first_name: "Steve"
    last_name: "Smith"
    email: "steve.smith@company.com"
    gender: Male
    designation: "Software Engineer"
    salary: 75000
    date_of_joining: "2024-01-15"
    department: "Engineering"
  ) {
    _id
    full_name
    email
    gender
    designation
    department
    salary
    date_of_joining
    created_at
  }
}
```

**Search employee by ID**
```graphql
query {
  searchEmployeeById(eid: "699b7623dbd770aedf065ab2") {
    _id
    full_name
    email
    gender
    designation
    department
    salary
    date_of_joining
    employee_photo
    created_at
    updated_at
  }
}
```

**Update employee**
```graphql
mutation {
  updateEmployee(
    eid: "699b7623dbd770aedf065ab2"
    designation: "Senior Software Engineer"
    salary: 85000
    department: "Platform Engineering"
  ) {
    _id
    full_name
    email
    designation
    department
    salary
    updated_at
  }
}
```

**Delete employee**
```graphql
mutation {
  deleteEmployee( eid: "699b7623dbd770aedf065ab2") {
    success
    message
    deleted_id
  }
}
```

**Search by designation or department**
```graphql
query {
  searchEmployeeByDesignationOrDepartment(department: "Engineering") {
    total
    employees {
      _id
      full_name
      designation
      department
      salary
    }
  }
}
```

## Uploading an employee photo

Before adding an employee with a photo, upload it first:

```
POST http://localhost:4000/api/upload
Content-Type: multipart/form-data
Field: photo
```

You'll get back a URL — paste that into the `employee_photo` field when adding the employee.

---

## Test credentials

After running `npm run seed` you can log in with:

| Username | Password |
|---|---|
| `admin` | `Admin1234` |
| `testuser` | `Test1234` |

---

## Live demo

Hosted on Render: **https://comp3133-101511850-assignment1.onrender.com/graphqll**

---

## A few things I want to mention

- Passwords are hashed with bcrypt (12 rounds) before being stored — plain text passwords are never saved
- All protected routes require a valid JWT token in the `Authorization` header
- Input validation is done with `express-validator` on all fields
- Salary has a minimum of $1,000 as per the assignment spec
- The search by designation/department is case-insensitive so "engineer" and "Engineer" both work
- Rate limiting is set to 100 requests per 15 minutes to prevent abuse
- The server automatically retries the MongoDB connection up to 5 times if it fails on startup

---

## Contact

**Student:** Henil Patel
**Course:** COMP3133 — Full Stack Development II
**Instructor:** Pritesh Patel — pritesh.patel2@georgebrown.ca
**College:** George Brown College