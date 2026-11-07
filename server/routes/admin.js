const express = require("express");
const { db, publicUser } = require("../database");
const { requireAuth, requireRole } = require("../middleware/auth");
const router = express.Router();
router.use(requireAuth, requireRole("admin"));

router.get("/overview", (req, res) => {
  const counts = {
    users: db.prepare("SELECT COUNT(*) AS n FROM users").get().n,
    customers: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='customer'").get().n,
    workmen: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='workman'").get().n,
    bookings: db.prepare("SELECT COUNT(*) AS n FROM bookings").get().n,
    pending: db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE status='Pending'").get().n
  };
  const users = db.prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT 100").all().map(publicUser);
  const bookings = db.prepare(`SELECT b.*, c.name AS customer_account_name, w.name AS workman_name
    FROM bookings b JOIN users c ON c.id=b.customer_id JOIN users w ON w.id=b.workman_id
    ORDER BY b.created_at DESC LIMIT 100`).all();
  res.json({ counts, users, bookings });
});

router.patch("/users/:id/role", (req, res) => {
  const role = req.body?.role;
  if (!["customer", "workman"].includes(role)) return res.status(400).json({ error: "Invalid role." });
  const result = db.prepare("UPDATE users SET role=? WHERE id=? AND role!='admin'").run(role, Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "User not found or cannot be changed." });
  res.json({ message: "User role updated." });
});

router.delete("/users/:id", (req, res) => {
  const result = db.prepare("DELETE FROM users WHERE id=? AND role!='admin' AND id!=?").run(Number(req.params.id), req.session.user.id);
  if (!result.changes) return res.status(404).json({ error: "User not found or cannot be deleted." });
  res.json({ message: "User account deleted." });
});

module.exports = router;
