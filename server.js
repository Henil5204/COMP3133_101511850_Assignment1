// server.js
// v3.0.0
//
// Entry point — wires together Express, Apollo Server, all middleware,
// and starts listening on PORT.
//
// Usage:
//   npm run dev    → nodemon (auto-restart on changes)
//   npm start      → plain node

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

const connectDB      = require("./config/db");
const typeDefs       = require("./graphql/typeDefs");
const resolvers      = require("./graphql/resolvers");
const { buildContext } = require("./middleware/auth");
const uploadRouter   = require("./routes/upload");
const logger         = require("./utils/logger");

// initialise Cloudinary early so it warns us if credentials are missing
require("./config/cloudinary");

const PORT   = parseInt(process.env.PORT || "4000", 10);
const IS_PROD = process.env.NODE_ENV === "production";


// ─── Apollo error formatter ───────────────────────────────────────────────────
// Keep stack traces out of production responses but log them on the server side.
const formatError = (formattedError, originalError) => {
  const code = formattedError.extensions?.code || "INTERNAL_SERVER_ERROR";

  if (IS_PROD && code === "INTERNAL_SERVER_ERROR") {
    logger.error("Unhandled GraphQL error:", originalError);
    return { message: "Something went wrong on our end. Try again in a moment.", code };
  }

  return {
    message: formattedError.message,
    code,
    ...(formattedError.path && { path: formattedError.path }),
  };
};


// ─── Bootstrap ───────────────────────────────────────────────────────────────
async function startServer() {

  // 1. Database
  await connectDB();

  // 2. Express + raw HTTP server (Apollo needs the http.Server for drain plugin)
  const app        = express();
  const httpServer = http.createServer(app);

  // 3. Security / utility middleware (order matters here)
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false, // needed for Apollo Sandbox to load in browser
      contentSecurityPolicy:     IS_PROD ? undefined : false,
    })
  );
  app.use(compression());
  app.use(cors({ origin: "*", methods: ["GET", "POST", "OPTIONS"] }));
  app.use(morgan(IS_PROD ? "combined" : "dev"));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // rate limiting — 100 requests per 15 minutes per IP
  app.use(
    rateLimit({
      windowMs:       15 * 60 * 1000,
      max:            100,
      standardHeaders: true,
      legacyHeaders:  false,
      message: { success: false, message: "Slow down! Too many requests. Try again in 15 minutes." },
    })
  );

  // 4. Apollo Server
  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
    formatError,
    introspection: true, // keep on for the assignment so Postman / Sandbox can discover the schema
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      ApolloServerPluginLandingPageLocalDefault({ embed: true }),
    ],
  });

  await apollo.start();

  // 5. Mount routes
  app.use(
    "/graphql",
    expressMiddleware(apollo, {
      context: async ({ req }) => buildContext(req),
    })
  );

  app.use("/api/upload", uploadRouter);

  // health check — useful for Render / Railway / Heroku health probes
  app.get("/health", (req, res) =>
    res.json({
      status:      "healthy",
      uptime:      `${Math.floor(process.uptime())}s`,
      timestamp:   new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    })
  );

  // landing page with quick reference
  app.get("/", (req, res) =>
    res.json({
      project: "COMP3133 Assignment 1 — Employee Management System",
      version: "3.0.0",
      endpoints: {
        graphql: `http://localhost:${PORT}/graphql`,
        upload:  `POST http://localhost:${PORT}/api/upload  (field: photo)`,
        health:  `http://localhost:${PORT}/health`,
      },
      tip: "Open the graphql URL in your browser to get the Apollo Sandbox IDE.",
    })
  );

  // catch-all 404
  app.use((req, res) =>
    res.status(404).json({ success: false, message: `Route "${req.originalUrl}" not found.` })
  );

  // global error handler
  app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(err.status || 500).json({
      success: false,
      message: IS_PROD ? "Internal server error." : err.message,
    });
  });

  // 6. Start listening
  await new Promise((resolve) => httpServer.listen({ port: PORT }, resolve));

  logger.info(`🚀  GraphQL ready   →  http://localhost:${PORT}/graphql`);
  logger.info(`📸  Photo upload    →  POST http://localhost:${PORT}/api/upload`);
  logger.info(`💚  Health check    →  http://localhost:${PORT}/health`);
  logger.info(`🌍  Environment     →  ${process.env.NODE_ENV || "development"}`);
}


// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.on("SIGTERM", () => {
  logger.info("SIGTERM received — shutting down gracefully");
  process.exit(0);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection:", reason);
});


startServer().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});