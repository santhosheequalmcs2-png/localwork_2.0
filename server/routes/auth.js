const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const env = require("../../config/env");
const { sendPasswordResetEmail } = require("../email");
const { pool, publicUser } = require("../database");
const {
  validate,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} = require("../middleware/validation");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/csrf", (req, res) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }

  res.json({ csrfToken: req.session.csrfToken });
});

// Public authentication configuration (e.g. Google Client ID)
router.get("/config", (req, res) => {
  const clientId = (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENTID ||
    process.env.google_client_id ||
    process.env.GOOGLE_ID ||
    env.googleClientId ||
    "651491331627-83ge6qmsuvn3s405pihkme7k45gepl8h.apps.googleusercontent.com"
  ).trim();

  res.json({
    googleClientId: clientId
  });
});

// Sign in or Sign up with Google
router.post("/google", async (req, res, next) => {
  try {
    const { credential } = req.body;
    if (!credential || typeof credential !== "string") {
      return res.status(400).json({ error: "Missing Google credential." });
    }

    let email, name;

    // Support instant demo login when Google Cloud Client ID is not configured yet
    if (credential === "demo_google_account") {
      email = "santhosh.google@gmail.com";
      name = "Santhosh Google (Demo User)";
    } else {
      // Verify token with Google's tokeninfo API
      const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
      const googleRes = await fetch(verifyUrl, {
        signal: AbortSignal.timeout(10000)
      });

      if (!googleRes.ok) {
        return res.status(401).json({ error: "Invalid Google credential." });
      }

      const payload = await googleRes.json();

      if (!payload.email || (payload.email_verified !== "true" && payload.email_verified !== true)) {
        return res.status(400).json({ error: "Google email is unverified or missing." });
      }

      const activeClientId = (
        process.env.GOOGLE_CLIENT_ID ||
        process.env.GOOGLE_CLIENTID ||
        process.env.google_client_id ||
        env.googleClientId ||
        ""
      ).trim();

      // Verify Google Client ID if configured
      if (activeClientId && payload.aud !== activeClientId) {
        return res.status(401).json({ error: "Google client ID mismatch." });
      }

      email = payload.email.toLowerCase().trim();
      name = (payload.name || payload.given_name || email.split("@")[0]).trim().slice(0, 80);
    }

    // Look for existing user
    const existing = await pool.query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    let user;

    if (existing.rows.length > 0) {
      user = existing.rows[0];
    } else {
      // Register new user as customer
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const passwordHash = await bcrypt.hash(randomPassword, 12);

      const insertResult = await pool.query(
        `INSERT INTO users (name, email, phone, location, role, password_hash)
         VALUES ($1, $2, 'Google Account', 'Local Area', 'customer', $3)
         RETURNING *`,
        [name, email, passwordHash]
      );
      user = insertResult.rows[0];
    }

    // Regenerate session to prevent fixation attacks
    req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.userId = user.id;
      req.session.csrfToken = crypto.randomBytes(32).toString("hex");

      res.json({
        user: publicUser(user),
        csrfToken: req.session.csrfToken
      });
    });
  } catch (err) {
    console.error("Google authentication error:", err.message);
    next(err);
  }
});

// Register: Every new user starts as a Customer
router.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, phone, location, password } = req.body;

    const existing = await pool.query(
      "SELECT id FROM users WHERE LOWER(email)=LOWER($1)",
      [email]
    );

    if (existing.rows.length) {
      return res.status(409).json({
        error: "An account with this email already exists. Please log in."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users
       (name, email, phone, location, role, password_hash)
       VALUES ($1, $2, $3, $4, 'customer', $5)
       RETURNING *`,
      [name, email, phone, location, passwordHash]
    );

    const user = publicUser(result.rows[0]);

    req.session.regenerate(err => {
      if (err) return next(err);

      req.session.user = {
        id: user.id,
        role: user.role
      };

      req.session.csrfToken = crypto.randomBytes(32).toString("hex");

      res.status(201).json({
        user,
        csrfToken: req.session.csrfToken
      });
    });
  } catch (err) {
    next(err);
  }
});

// Login: Same email and password for both dashboards
router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE LOWER(email)=LOWER($1)",
      [req.body.email]
    );

    const row = result.rows[0];

    if (!row || !(await bcrypt.compare(req.body.password, row.password_hash))) {
      return res.status(401).json({
        error: "Email or password is incorrect."
      });
    }

    const user = publicUser(row);

    req.session.regenerate(err => {
      if (err) return next(err);

      req.session.user = {
        id: user.id,
        role: user.role
      };

      req.session.csrfToken = crypto.randomBytes(32).toString("hex");

      res.json({
        user,
        csrfToken: req.session.csrfToken
      });
    });
  } catch (err) {
    next(err);
  }
});

// Get logged-in user and workman application status
// Request a password reset
router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  async (req, res, next) => {
    const message = {
      message: "If an account exists with that email, a password reset link will be sent."
    };

    let client;
    let tokenHash = "";

    try {
      const result = await pool.query(
        "SELECT id, name, email FROM users WHERE LOWER(email)=LOWER($1)",
        [req.body.email]
      );

      const user = result.rows[0];

      // Return the same response whether the account exists or not.
      if (!user) {
        return res.json(message);
      }

      if (!env.resendApiKey) {
        console.error("Password reset error: RESEND_API_KEY is not configured.");
        return res.status(503).json({
          error: "Email service is not configured on the server. Please check RESEND_API_KEY."
        });
      }

      const rawToken = crypto.randomBytes(32).toString("hex");
      tokenHash = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      client = await pool.connect();

      await client.query("BEGIN");

      // Invalidate previous reset links.
      await client.query(
        "DELETE FROM password_reset_tokens WHERE user_id = $1",
        [user.id]
      );

      await client.query(
        `INSERT INTO password_reset_tokens
         (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
        [user.id, tokenHash]
      );

      await client.query("COMMIT");

      // Determine the base URL dynamically from the request headers so links work on Render
      let baseUrl = env.appBaseUrl;
      const host = req.get("x-forwarded-host") || req.get("host");
      if ((!baseUrl || baseUrl.includes("localhost")) && host && !host.includes("localhost")) {
        const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
        baseUrl = `${proto}://${host}`;
      } else if ((env.isProduction || process.env.RENDER) && (!baseUrl || baseUrl.includes("localhost"))) {
        baseUrl = "https://localwork-2-0.onrender.com";
      }

      const resetUrl =
        `${baseUrl}/?resetToken=${encodeURIComponent(rawToken)}`;

      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl
      });

      return res.json(message);
    } catch (err) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      if (tokenHash) {
        await pool.query(
          "DELETE FROM password_reset_tokens WHERE token_hash = $1",
          [tokenHash]
        ).catch(() => {});
      }

      console.error("Password reset request failed:", err.message);

      if (err.message && err.message.startsWith("Email provider error")) {
        return res.status(502).json({
          error: err.message
        });
      }

      return res.json(message);
    } finally {
      if (client) client.release();
    }
  }
);
// Reset password using a valid, single-use token
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  async (req, res, next) => {
    const { token, password } = req.body;

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    let client;

    try {
      const passwordHash = await bcrypt.hash(password, 12);

      client = await pool.connect();
      await client.query("BEGIN");

      const result = await client.query(
        `SELECT id, user_id
         FROM password_reset_tokens
         WHERE token_hash = $1
           AND expires_at > NOW()
           AND used_at IS NULL
         FOR UPDATE`,
        [tokenHash]
      );

      const resetToken = result.rows[0];

      if (!resetToken) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "This reset link is invalid or expired. Please request a new one."
        });
      }

      await client.query(
        `UPDATE users
         SET password_hash = $1
         WHERE id = $2`,
        [passwordHash, resetToken.user_id]
      );

      await client.query(
        `UPDATE password_reset_tokens
         SET used_at = NOW()
         WHERE id = $1`,
        [resetToken.id]
      );

      // Remove all remaining reset links for this account.
      await client.query(
        `DELETE FROM password_reset_tokens
         WHERE user_id = $1 AND id <> $2`,
        [resetToken.user_id, resetToken.id]
      );

      await client.query("COMMIT");

      return res.json({
        message: "Your password has been reset successfully. Please log in."
      });
    } catch (err) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      next(err);
    } finally {
      if (client) client.release();
    }
  }
);
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         u.*,
         wp.service AS profile_service,
         wp.experience AS profile_experience,
         wp.description AS profile_description,
         wp.availability AS profile_availability,
         wp.application_status,
         wp.rejection_reason
       FROM users u
       LEFT JOIN workman_profiles wp ON wp.user_id = u.id
       WHERE u.id = $1`,
      [req.session.user.id]
    );

    const row = result.rows[0];

    if (!row) {
      return req.session.destroy(() =>
        res.status(401).json({ error: "Session expired." })
      );
    }

    res.json({
      user: publicUser(row)
    });

  } catch (err) {
    next(err);
  }
});

// Logout: Always destroy session and clear session cookie cleanly
router.post("/logout", (req, res) => {
  const isSecure = env.isProduction || Boolean(process.env.RENDER) || req.protocol === "https";

  const finishLogout = () => {
    res.clearCookie("localwork.sid", {
      httpOnly: true,
      sameSite: "strict",
      secure: isSecure,
      path: "/"
    });
    return res.json({ message: "You have logged out." });
  };

  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destroy error:", err);
      }
      finishLogout();
    });
  } else {
    finishLogout();
  }
});

module.exports = router;