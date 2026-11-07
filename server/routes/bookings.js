const express = require("express");
const { db } = require("../database");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validate, bookingSchema, statusSchema } = require("../middleware/validation");
const router = express.Router();

router.post("/", requireAuth, requireRole("customer"), validate(bookingSchema), (req, res) => {
  const p = req.body;
  const workman = db.prepare("SELECT id FROM users WHERE id=? AND role='workman'").get(p.workmanId);
  if (!workman) return res.status(404).json({ error: "Workman profile not found." });
  const result = db.prepare(`INSERT INTO bookings (customer_id,workman_id,customer_name,phone,address,booking_date,booking_time,notes)
    VALUES (?,?,?,?,?,?,?,?)`).run(req.session.user.id,p.workmanId,p.customerName,p.phone,p.address,p.date,p.time,p.notes);
  res.status(201).json({ message: "Booking request sent to the workman.", bookingId: result.lastInsertRowid });
});

router.get("/mine", requireAuth, requireRole("customer"), (req, res) => {
  const rows = db.prepare(`SELECT b.*, u.name AS workman_name, u.service AS workman_service
    FROM bookings b JOIN users u ON u.id=b.workman_id WHERE b.customer_id=? ORDER BY b.created_at DESC`)
    .all(req.session.user.id);
  res.json({ bookings: rows });
});

router.get("/workman", requireAuth, requireRole("workman"), (req, res) => {
  const rows = db.prepare(`SELECT b.*, u.name AS customer_account_name
    FROM bookings b JOIN users u ON u.id=b.customer_id WHERE b.workman_id=? ORDER BY b.created_at DESC`)
    .all(req.session.user.id);
  res.json({ bookings: rows });
});

router.patch("/:id/status", requireAuth, requireRole("workman"), validate(statusSchema), (req, res) => {
  const result = db.prepare("UPDATE bookings SET status=? WHERE id=? AND workman_id=?")
    .run(req.body.status, Number(req.params.id), req.session.user.id);
  if (!result.changes) return res.status(404).json({ error: "Booking request not found." });
  res.json({ message: "Booking status updated." });
});

module.exports = router;
