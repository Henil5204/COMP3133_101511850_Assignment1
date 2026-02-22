// graphql/typeDefs.js
// v3.0.0
//
// Full GraphQL schema for the Employee Management System.
// Covers all 8 operations from the assignment spec + a bonus "me" query.

const { gql } = require("graphql-tag");

const typeDefs = gql`

  # ── Enums ─────────────────────────────────────────────────────────────────

  enum Gender {
    Male
    Female
    Other
  }

  # ── Core Types ─────────────────────────────────────────────────────────────

  type User {
    _id:        ID!
    username:   String!
    email:      String!
    is_active:  Boolean!
    created_at: String!
    updated_at: String!
  }

  # what login returns — includes a JWT so the client can auth future requests
  type AuthPayload {
    token:      String!
    token_type: String!  # always "Bearer"
    expires_in: String!
    user:       User!
  }

  type Employee {
    _id:             ID!
    first_name:      String!
    last_name:       String!
    full_name:       String!   # virtual: first + last
    email:           String!
    gender:          Gender!
    designation:     String!
    salary:          Float!
    date_of_joining: String!
    department:      String!
    employee_photo:  String    # Cloudinary URL — null if no photo uploaded
    created_at:      String!
    updated_at:      String!
  }

  # paginated employee list — all list queries return this
  type EmployeeList {
    total:     Int!
    employees: [Employee!]!
  }

  type DeleteResponse {
    success:    Boolean!
    message:    String!
    deleted_id: ID!
  }

  # ── Queries ────────────────────────────────────────────────────────────────

  type Query {

    """
    PUBLIC — login with your username or email + password.
    Copy the token from the response and send it as:
      Authorization: Bearer <token>
    on all protected requests.
    """
    login(usernameOrEmail: String!, password: String!): AuthPayload!

    """
    PROTECTED — get all employees, newest first.
    Supports basic pagination with page and limit.
    """
    getAllEmployees(page: Int, limit: Int): EmployeeList!

    """
    PROTECTED — look up one employee by their MongoDB _id.
    """
    searchEmployeeById(eid: ID!): Employee!

    """
    PROTECTED — search by designation and/or department (case-insensitive).
    Pass at least one of the two arguments.
    """
    searchEmployeeByDesignationOrDepartment(
      designation: String
      department:  String
    ): EmployeeList!

    """
    PROTECTED — returns the profile of whoever is currently logged in.
    Handy for confirming your token is working.
    """
    me: User!
  }

  # ── Mutations ──────────────────────────────────────────────────────────────

  type Mutation {

    """
    PUBLIC — create a new account.
    Password rules: 8+ chars, 1 uppercase, 1 lowercase, 1 digit.
    """
    signup(username: String!, email: String!, password: String!): User!

    """
    PROTECTED — add a new employee.
    Upload the photo first via POST /api/upload and paste the returned URL
    into employee_photo.
    """
    addEmployee(
      first_name:      String!
      last_name:       String!
      email:           String!
      gender:          Gender!
      designation:     String!
      salary:          Float!
      date_of_joining: String!
      department:      String!
      employee_photo:  String
    ): Employee!

    """
    PROTECTED — update any fields on an existing employee.
    Only the fields you include will change.
    """
    updateEmployee(
      eid:             ID!
      first_name:      String
      last_name:       String
      email:           String
      gender:          Gender
      designation:     String
      salary:          Float
      date_of_joining: String
      department:      String
      employee_photo:  String
    ): Employee!

    """
    PROTECTED — permanently remove an employee by ID.
    """
    deleteEmployee(eid: ID!): DeleteResponse!
  }
`;

module.exports = typeDefs;