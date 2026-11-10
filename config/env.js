const path = require("node:path");
const dotenv = require("dotenv");
dotenv.config();

function required(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const nodeEnv = process.env.NODE_ENV || "development";
const sessionSecret = required(
  "SESSION_SECRET",
  nodeEnv === "development"
    ? "localwork-development-only-change-this-secret-123456"
    : null,
);
if (nodeEnv === "production" && sessionSecret.length < 32) {
  throw new Error(
    "SESSION_SECRET must be at least 32 characters in production.",
  );
}

module.exports = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  port: Number(process.env.PORT || 3000),
  sessionSecret,
  databaseUrl: process.env.DATABASE_URL,
  databaseFile: path.resolve(process.env.DATABASE_FILE || "./data/localwork.sqlite"),
  adminEmail: (process.env.ADMIN_EMAIL || "").trim().toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || "",
    corsOrigins: (process.env.CORS_ORIGINS || "").split(",").map(x => x.trim()).filter(Boolean),
  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "LocalWork <onboarding@resend.dev>",
  appBaseUrl: (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/+$/, "")
};