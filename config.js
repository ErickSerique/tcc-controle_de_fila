require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 3001,
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || "dev_secret_change_in_production",
  RATE_LIMIT: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 min
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 20,
  },
};
