// utils/errors.js
// v3.0.0
//
// Instead of throwing raw GraphQLError everywhere with the same boilerplate,
// I made a small helper class and some shortcut functions.
// Usage: throw notFound("Employee")  OR  throw badInput("Email is invalid")

const { GraphQLError } = require("graphql");

// Base error class - everything extends from this
class AppError extends GraphQLError {
  constructor(message, code = "BAD_USER_INPUT", httpStatus = 400) {
    super(message, {
      extensions: { code, httpStatus },
    });
    this.name = "AppError";
  }
}

// Shortcuts so resolvers stay readable
const notFound    = (entity)  => new AppError(`${entity} not found.`, "NOT_FOUND", 404);
const badInput    = (message) => new AppError(message, "BAD_USER_INPUT", 400);
const conflict    = (message) => new AppError(message, "CONFLICT", 409);
const unauth      = (message = "You need to be logged in to do that.") =>
  new AppError(message, "UNAUTHENTICATED", 401);

module.exports = { AppError, notFound, badInput, conflict, unauth };