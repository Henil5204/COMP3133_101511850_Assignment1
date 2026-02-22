// utils/logger.js
// v3.0.0
//
// Simple Winston logger so we get nice colored timestamps instead of
// raw console.log everywhere. Nothing fancy.

const winston = require("winston");

const { combine, timestamp, colorize, printf, errors } = winston.format;

// custom format: timestamp [LEVEL]: message
const prettyFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const logger = winston.createLogger({
  // debug in dev, warn in prod - no one wants noise in production
  level: process.env.NODE_ENV === "production" ? "warn" : "debug",

  format: combine(
    colorize(),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    prettyFormat
  ),

  transports: [new winston.transports.Console()],
});

module.exports = logger;