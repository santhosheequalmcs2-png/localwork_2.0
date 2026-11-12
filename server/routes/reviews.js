const express = require("express");
const { pool } = require("../database");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// POST /api/reviews - Customer submits rating & review for a completed booking
router.post(
  "/",
  requireAuth,
  requireRole("customer"),
  async (req, res, next) => {
    try {
      const { bookingId, rating, reviewText } = req.body;
      const customerId = req.session.user.id;

      const numRating = Number(rating);
      if (!numRating || numRating < 1 || numRating > 5 || !Number.isInteger(numRating)) {
        return res.status(400).json({
          error: "Please provide a valid star rating between 1 and 5."
        });
      }

      if (!bookingId) {
        return res.status(400).json({
          error: "Booking ID is required."
        });
      }

      // Verify that this booking belongs to the logged-in customer and is Completed
      const bookingCheck = await pool.query(
        `SELECT id, workman_id, status
         FROM bookings
         WHERE id = $1 AND customer_id = $2`,
        [Number(bookingId), customerId]
      );

      if (!bookingCheck.rows.length) {
        return res.status(404).json({
          error: "Booking request not found for your account."
        });
      }

      const booking = bookingCheck.rows[0];

      if (booking.status !== "Completed") {
        return res.status(400).json({
          error: "Reviews can only be submitted once the workman marks the service as Completed."
        });
      }

      // Check if this booking was already reviewed
      const existingReview = await pool.query(
        `SELECT id FROM reviews WHERE booking_id = $1`,
        [booking.id]
      );

      if (existingReview.rows.length > 0) {
        return res.status(400).json({
          error: "You have already submitted a review for this booking."
        });
      }

      const sanitizedText = String(reviewText || "").trim().slice(0, 1000);

      const insertResult = await pool.query(
        `INSERT INTO reviews (booking_id, customer_id, workman_id, rating, review_text)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, rating, review_text, created_at`,
        [booking.id, customerId, booking.workman_id, numRating, sanitizedText]
      );

      res.status(201).json({
        message: "Thank you! Your review and rating have been recorded.",
        review: insertResult.rows[0]
      });

    } catch (err) {
      next(err);
    }
  }
);

// GET /api/reviews/workman/:id - Get reviews for a specific workman profile
router.get("/workman/:id", async (req, res, next) => {
  try {
    const workmanId = Number(req.params.id);
    if (!workmanId) {
      return res.status(400).json({ error: "Invalid workman ID." });
    }

    const result = await pool.query(
      `SELECT
         r.id,
         r.rating,
         r.review_text,
         r.created_at,
         u.name AS customer_name
       FROM reviews r
       JOIN users u ON u.id = r.customer_id
       WHERE r.workman_id = $1
       ORDER BY r.created_at DESC
       LIMIT 25`,
      [workmanId]
    );

    res.json({ reviews: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
