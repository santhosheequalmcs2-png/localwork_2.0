const path = require("node:path");
const express = require("express");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const env = require("../config/env");
const { pool, initializeDatabase, bootstrapAdmin } = require("./database");
const { requireCsrf } = require("./middleware/auth");

const app = express();

if (env.isProduction || process.env.RENDER) app.set("trust proxy", 1);

app.disable("x-powered-by");

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com"],
      imgSrc: ["'self'", "data:", "https://*.googleusercontent.com", "https://accounts.google.com"],
      connectSrc: ["'self'", "https://accounts.google.com", "https://oauth2.googleapis.com"],
      frameSrc: ["'self'", "https://accounts.google.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: env.isProduction ? [] : null
    }
  },
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));

if (env.corsOrigins.length) {
  app.use(cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin not allowed by CORS."));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
  }));
}

app.use(express.json({ limit: "20kb", strict: true }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

app.use(session({
  name: "localwork.sid",
  store: new PgSession({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: true
  }),
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "strict",
    maxAge: 1000 * 60 * 60 * 8,
    path: "/"
  }
}));

app.use("/api", requireCsrf);

// Stricter rate limit for password reset requests
app.use(
  "/api/auth/forgot-password",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: "Too many password reset requests. Please wait a few minutes before trying again."
    }
  })
);

app.use("/api/auth", require("./routes/auth"));
app.use("/api/workmen", require("./routes/workmen"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/profile", require("./routes/profile"));
app.use("/api/ai", require("./routes/ai"));
app.use("/api/reviews", require("./routes/reviews"));
const publicDir = path.join(__dirname, "..", "public");

app.use(
  "/vendor/three",
  express.static(
    path.join(__dirname, "..", "node_modules", "three", "build"),
    {
      fallthrough: false,
      immutable: true,
      maxAge: "7d"
    }
  )
);

app.use(
  express.static(publicDir, {
    dotfiles: "deny",
    index: "index.html",
    maxAge: env.isProduction ? "1h" : 0
  })
);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use((req, res) => {
  res.status(404).json({
    error: "The requested page or API route was not found."
  });
});

app.use((err, req, res, next) => {
  console.error("Request error:", err.message);

  if (res.headersSent) return next(err);

  const status = err.status || (err.message.includes("CORS") ? 403 : 500);

  res.status(status).json({
    error:
      env.isProduction && status === 500
        ? "Something went wrong. Please try again."
        : err.message
  });
});

let server;

async function startServer() {
  try {
    console.log("Connecting to PostgreSQL...");

    await initializeDatabase();

    console.log("PostgreSQL database connected.");

    await bootstrapAdmin();

    server = app.listen(env.port, () => {
      console.log(`LocalWork running at http://localhost:${env.port}`);
    });
  } catch (err) {
    console.error("Server startup failed:", err.message);
    await pool.end();
    process.exit(1);
  }
}

async function shutdown() {
  console.log("Shutting down LocalWork...");

  if (server) {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  } else {
    await pool.end();
    process.exit(0);
  }
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

startServer();