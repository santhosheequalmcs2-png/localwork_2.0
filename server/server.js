const path = require("node:path");
const fs = require("node:fs");
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const env = require("../config/env");
const { db, bootstrapAdmin } = require("./database");
const { requireCsrf } = require("./middleware/auth");

const app = express();
if (env.isProduction) app.set("trust proxy", 1);
app.disable("x-powered-by");
fs.mkdirSync(path.resolve("./data"), { recursive: true });
bootstrapAdmin();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: env.isProduction ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "no-referrer" }
}));

if (env.corsOrigins.length) {
  app.use(cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
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
  store: new SQLiteStore({ db: "sessions.sqlite", dir: path.resolve("./data"), table: "sessions", concurrentDB: true }),
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
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false }));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/workmen", require("./routes/workmen"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/admin", require("./routes/admin"));

const publicDir = path.join(__dirname, "..", "public");
app.use("/vendor/three", express.static(path.join(__dirname, "..", "node_modules", "three", "build"), {
  fallthrough: false, immutable: true, maxAge: "7d"
}));
app.use(express.static(publicDir, { dotfiles: "deny", index: "index.html", maxAge: env.isProduction ? "1h" : 0 }));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use((req, res) => res.status(404).json({ error: "The requested page or API route was not found." }));
app.use((err, req, res, next) => {
  console.error("Request error:", err.message);
  if (res.headersSent) return next(err);
  const status = err.status || (err.message.includes("CORS") ? 403 : 500);
  res.status(status).json({ error: env.isProduction && status === 500 ? "Something went wrong. Please try again." : err.message });
});

const server = app.listen(env.port, () => console.log(`LocalWork running at http://localhost:${env.port}`));
function shutdown() {
  server.close(() => { db.close(); process.exit(0); });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
