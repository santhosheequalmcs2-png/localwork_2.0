const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const { db, publicUser } = require("../database");
const { validate, registerSchema, loginSchema } = require("../middleware/validation");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();

router.get("/csrf", (req, res) => {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  res.json({ csrfToken: req.session.csrfToken });
});

router.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, phone, location, password, role, service, experience, description } = req.body;
    if (db.prepare("SELECT id FROM users WHERE email=?").get(email)) return res.status(409).json({ error: "An account with this email already exists." });
    const passwordHash = await bcrypt.hash(password, 12);
    const result = db.prepare(`INSERT INTO users (name,email,phone,location,role,password_hash,service,experience,description)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(name, email, phone, location, role, passwordHash,
      role === "workman" ? service : null, role === "workman" ? experience : null, role === "workman" ? description : null);
    const user = publicUser(db.prepare("SELECT * FROM users WHERE id=?").get(result.lastInsertRowid));
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.user = { id: user.id, role: user.role };
      req.session.csrfToken = crypto.randomBytes(32).toString("hex");
      res.status(201).json({ user, csrfToken: req.session.csrfToken });
    });
  } catch (err) { next(err); }
});

router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const row = db.prepare("SELECT * FROM users WHERE email=?").get(req.body.email);
    if (!row || !(await bcrypt.compare(req.body.password, row.password_hash))) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    const user = publicUser(row);
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.user = { id: user.id, role: user.role };
      req.session.csrfToken = crypto.randomBytes(32).toString("hex");
      res.json({ user, csrfToken: req.session.csrfToken });
    });
  } catch (err) { next(err); }
});

router.get("/me", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM users WHERE id=?").get(req.session.user.id);
  if (!row) return req.session.destroy(() => res.status(401).json({ error: "Session expired." }));
  res.json({ user: publicUser(row) });
});

router.post("/logout", requireAuth, (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: "Could not log out." });
    res.clearCookie("localwork.sid", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/" });
    res.json({ message: "You have logged out." });
  });
});

module.exports = router;
