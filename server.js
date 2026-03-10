// server.js
// v4.0.0
//
// Entry point — wires together Express, Apollo Server, all middleware, and starts listening.
//
// Endpoints:
//   POST   /graphql                      — GraphQL API (all 8 operations)
//   POST   /api/upload                   — upload photo only → returns Cloudinary URL
//   POST   /api/employees/photo          — create employee WITH photo in one request
//   PUT    /api/employees/:eid/photo     — update employee WITH photo in one request
//   GET    /health                       — health check
//   GET    /                             — info

require("dotenv").config();

const http        = require("http");
const express     = require("express");
const cors        = require("cors");
const helmet      = require("helmet");
const compression = require("compression");
const morgan      = require("morgan");
const rateLimit   = require("express-rate-limit");

const { ApolloServer }                    = require("@apollo/server");
const { expressMiddleware }               = require("@apollo/server/express4");
const { ApolloServerPluginDrainHttpServer } = require("@apollo/server/plugin/drainHttpServer");
const { ApolloServerPluginLandingPageLocalDefault } = require("@apollo/server/plugin/landingPage/default");

const connectDB        = require("./config/db");
const typeDefs         = require("./graphql/typeDefs");
const resolvers        = require("./graphql/resolvers");
const { buildContext } = require("./middleware/auth");
const uploadRouter     = require("./routes/upload");
const logger           = require("./utils/logger");

require("./config/cloudinary"); // init Cloudinary on startup

const PORT    = parseInt(process.env.PORT || "4000", 10);
const IS_PROD = process.env.NODE_ENV === "production";

// ─── Apollo error formatter ───────────────────────────────────────────────────
const formatError = (formattedError, originalError) => {
  const code = formattedError.extensions?.code || "INTERNAL_SERVER_ERROR";
  if (IS_PROD && code === "INTERNAL_SERVER_ERROR") {
    logger.error("Unhandled GraphQL error:", originalError);
    return { message: "Something went wrong. Try again in a moment.", code };
  }
  return {
    message: formattedError.message,
    code,
    ...(formattedError.path && { path: formattedError.path }),
  };
};

async function startServer() {

  // 1. Database
  await connectDB();

  // 2. Express + HTTP server
  const app        = express();
  const httpServer = http.createServer(app);

  // 3. Security / utility middleware
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy:     IS_PROD ? undefined : false,
  }));
  app.use(compression());
  app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "OPTIONS"] }));
  app.use(morgan(IS_PROD ? "combined" : "dev"));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // rate limiting — 100 requests per 15 minutes
  app.use(rateLimit({
    windowMs:        15 * 60 * 1000,
    max:             100,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { success: false, message: "Too many requests. Try again in 15 minutes." },
  }));

  // 4. Apollo Server
  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
    formatError,
    introspection: true,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      ApolloServerPluginLandingPageLocalDefault({ embed: true }),
    ],
  });

  await apollo.start();

  // 5. Mount routes

  // GraphQL
  app.use("/graphql", expressMiddleware(apollo, {
    context: async ({ req }) => buildContext(req),
  }));

  // Photo upload + employee create/update with photo
  // POST   /api/upload                  — photo only
  // POST   /api/employees/photo         — create employee with photo
  // PUT    /api/employees/:eid/photo    — update employee with photo
  app.use("/api", uploadRouter);

  // Health check
  app.get("/health", (req, res) =>
    res.json({
      status:      "healthy",
      uptime:      `${Math.floor(process.uptime())}s`,
      timestamp:   new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    })
  );

  // Root info
  app.get("/", (req, res) =>
    res.json({
      project: "COMP3133 Assignment 1 — Employee Management System",
      version: "4.0.0",
      endpoints: {
        graphql:               `http://localhost:${PORT}/graphql`,
        upload_photo_only:     `POST http://localhost:${PORT}/api/upload`,
        create_with_photo:     `POST http://localhost:${PORT}/api/employees/photo`,
        update_with_photo:     `PUT  http://localhost:${PORT}/api/employees/:eid/photo`,
        health:                `http://localhost:${PORT}/health`,
      },
    })
  );

  // 404 handler
  app.use((req, res) =>
    res.status(404).json({ success: false, message: `Route "${req.originalUrl}" not found.` })
  );

  // Global error handler
  app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(err.status || 500).json({
      success: false,
      message: IS_PROD ? "Internal server error." : err.message,
    });
  });

  // 6. Start listening
  await new Promise((resolve) => httpServer.listen({ port: PORT }, resolve));

  logger.info(`🚀  GraphQL            →  http://localhost:${PORT}/graphql`);
  logger.info(`📸  Upload photo only  →  POST http://localhost:${PORT}/api/upload`);
  logger.info(`👤  Create with photo  →  POST http://localhost:${PORT}/api/employees/photo`);
  logger.info(`✏️   Update with photo  →  PUT  http://localhost:${PORT}/api/employees/:eid/photo`);
  logger.info(`💚  Health check       →  http://localhost:${PORT}/health`);
}

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received — shutting down");
  process.exit(0);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection:", reason);
});

startServer().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});