// middleware/auth.js
// v3.0.0
//
// Three things live here:
//   1. buildContext  — reads the JWT from the Authorization header and attaches the user
//                      to every GraphQL request. Doesn't throw if no token — that's intentional.
//   2. requireAuth   — call this at the top of any protected resolver to gate it behind login.
//   3. signToken     — creates a signed JWT for a user.

const jwt    = require("jsonwebtoken");
const User   = require("../models/User");
const logger = require("../utils/logger");
const { unauth } = require("../utils/errors");

// reads the token, finds the user, returns both in context
const buildContext = async (req) => {
  const authHeader = req.headers.authorization || "";

  // nothing in the header? that's fine — public routes don't need it
  if (!authHeader.startsWith("Bearer ")) {
    return { user: null, req };
  }

  const token = authHeader.slice(7).trim();
  if (!token) return { user: null, req };

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.userId);

    // user deleted or deactivated since the token was issued
    if (!user || !user.is_active) return { user: null, req };

    return { user, req };
  } catch (err) {
    // expired, tampered, whatever — just treat as unauthenticated
    logger.debug(`JWT check failed: ${err.message}`);
    return { user: null, req };
  }
};

// drop this at the start of any resolver that needs a logged-in user
const requireAuth = (context) => {
  if (!context.user) throw unauth();
  return context.user;
};

// sign a 7-day token (or whatever JWT_EXPIRES_IN is set to)
const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

module.exports = { buildContext, requireAuth, signToken };