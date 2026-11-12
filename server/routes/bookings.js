const express = require("express");
const { pool } = require("../database");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  validate,
  bookingSchema,
  statusSchema
} = require("../middleware/validation");

const router = express.Router();

// Create a booking request
router.post(
  "/",
  requireAuth,
  requireRole("customer"),
  validate(bookingSchema),
  async (req, res, next) => {
    try {
      const p = req.body;

      const workman = await pool.query(
        "SELECT user_id FROM workman_profiles WHERE user_id=$1",
        [p.workmanId]
      );

      if (!workman.rows.length) {
        return res.status(404).json({
          error: "Workman profile not found."
        });
      }

      const result = await pool.query(
        `INSERT INTO bookings
         (customer_id, workman_id, customer_name, phone,
          address, booking_date, booking_time, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [
          req.session.user.id,
          p.workmanId,
          p.customerName,
          p.phone,
          p.address,
          p.date,
          p.time,
          p.notes
        ]
      );

      res.status(201).json({
        message: "Booking request sent to the workman.",
        bookingId: result.rows[0].id
      });

    } catch (err) {
      next(err);
    }
  }
);

// Get bookings sent by the logged-in customer
router.get(
  "/mine",
  requireAuth,
  requireRole("customer"),
  async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT
           b.*,
           u.name AS workman_name,
           wp.service AS workman_service,
           r.rating AS customer_rating,
           r.review_text AS customer_review
         FROM bookings b
         JOIN users u ON u.id = b.workman_id
         JOIN workman_profiles wp ON wp.user_id = u.id
         LEFT JOIN reviews r ON r.booking_id = b.id
         WHERE b.customer_id = $1
         ORDER BY b.created_at DESC`,
        [req.session.user.id]
      );

      res.json({ bookings: result.rows });

    } catch (err) {
      next(err);
    }
  }
);

// Get booking requests received by the logged-in workman
router.get(
  "/workman",
  requireAuth,
  requireRole("customer"),
  async (req, res, next) => {
    try {
      const profile = await pool.query(
        "SELECT user_id FROM workman_profiles WHERE user_id=$1",
        [req.session.user.id]
      );

      if (!profile.rows.length) {
        return res.json({ bookings: [] });
      }

      const result = await pool.query(
        `SELECT
           b.*,
           u.name AS customer_account_name,
           r.rating AS review_rating,
           r.review_text AS review_comment
         FROM bookings b
         JOIN users u ON u.id = b.customer_id
         LEFT JOIN reviews r ON r.booking_id = b.id
         WHERE b.workman_id = $1
         ORDER BY b.created_at DESC`,
        [req.session.user.id]
      );

      res.json({ bookings: result.rows });

    } catch (err) {
      next(err);
    }
  }
);

// Accept, decline, complete, or cancel a booking
router.patch(
  "/:id/status",
  requireAuth,
  requireRole("customer"),
  validate(statusSchema),
  async (req, res, next) => {
    try {
      const bookingId = Number(req.params.id);
      const newStatus = req.body.status;
      const userId = req.session.user.id;

      const bookingCheck = await pool.query(
        "SELECT id, customer_id, workman_id, status FROM bookings WHERE id = $1",
        [bookingId]
      );

      if (!bookingCheck.rows.length) {
        return res.status(404).json({ error: "Booking request not found." });
      }

      const booking = bookingCheck.rows[0];

      // Workman actions: Accepted, Declined, Completed
      if (booking.workman_id === userId) {
        if (!["Accepted", "Declined", "Completed"].includes(newStatus)) {
          return res.status(400).json({ error: "Invalid status update for workman." });
        }

        await pool.query(
          "UPDATE bookings SET status = $1 WHERE id = $2",
          [newStatus, bookingId]
        );

        return res.json({ message: `Booking marked as ${newStatus}.` });
      }

      // Customer action: Cancelled (allowed if currently Pending or Accepted)
      if (booking.customer_id === userId) {
        if (newStatus !== "Cancelled") {
          return res.status(403).json({ error: "Customers can only cancel their booking requests." });
        }

        if (booking.status === "Completed") {
          return res.status(400).json({ error: "Completed bookings cannot be cancelled." });
        }

        await pool.query(
          "UPDATE bookings SET status = 'Cancelled' WHERE id = $1",
          [bookingId]
        );

        return res.json({ message: "Booking cancelled successfully." });
      }

      return res.status(403).json({ error: "You are not authorized to update this booking." });

    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;