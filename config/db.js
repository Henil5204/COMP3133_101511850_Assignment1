// config/db.js
// v3.0.0
//
// Connects to MongoDB and retries a few times if it fails on startup.
// Handles reconnect events so we get notified if the DB drops mid-run.

const mongoose = require("mongoose");
const logger   = require("../utils/logger");

const MAX_RETRIES    = 5;
const RETRY_DELAY_MS = 5000; // wait 5 seconds before each retry

const connectDB = async (retriesLeft = MAX_RETRIES) => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    logger.info(`✅  MongoDB connected → ${conn.connection.host}/${conn.connection.name}`);

    // let us know if the connection drops while the server is running
    mongoose.connection.on("disconnected", () =>
      logger.warn("⚠️  MongoDB disconnected — trying to reconnect...")
    );
    mongoose.connection.on("reconnected", () =>
      logger.info("✅  MongoDB reconnected!")
    );

  } catch (err) {
    logger.error(`❌  MongoDB connection failed: ${err.message}`);

    if (retriesLeft > 0) {
      logger.info(`Retrying in ${RETRY_DELAY_MS / 1000}s... (${retriesLeft} tries left)`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return connectDB(retriesLeft - 1);
    }

    logger.error("All retries exhausted. Check your MONGO_URI and try again.");
    process.exit(1);
  }
};

module.exports = connectDB;