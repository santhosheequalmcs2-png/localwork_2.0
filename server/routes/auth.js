const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const { pool, publicUser } = require("../database");
const { validate, registerSchema, loginSchema } = require("../middleware/validation");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/csrf", (req, res) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }

  res.json({ csrfToken: req.session.csrfToken });
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

// Login: Same Gmail and password for both dashboards
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

// Get logged-in user
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.*,
              wp.service AS profile_service,
              wp.experience AS profile_experience,
              wp.description AS profile_description,
              wp.availability AS profile_availability
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

    res.json({ user: publicUser(row) });
  } catch (err) {
    next(err);
  }
});

// Logout
router.post("/logout", requireAuth, (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({
        error: "Could not log out."
      });
    }

    res.clearCookie("localwork.sid", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });

    res.json({ message: "You have logged out." });
  });
});

module.exports = router;