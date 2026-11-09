const express = require("express");
const { pool, publicUser } = require("../database");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth, requireRole("admin"));

router.get("/overview", async (req, res, next) => {
  try {
    const [
      usersCount,
      customersCount,
      workmenCount,
      bookingsCount,
      pendingCount,
      usersResult,
      bookingsResult
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) AS n FROM users"),

      pool.query(
        "SELECT COUNT(*) AS n FROM users WHERE role='customer'"
      ),

      pool.query(
        "SELECT COUNT(*) AS n FROM workman_profiles"
      ),

      pool.query("SELECT COUNT(*) AS n FROM bookings"),

      pool.query(
        "SELECT COUNT(*) AS n FROM bookings WHERE status='Pending'"
      ),

      pool.query(`
        SELECT
          u.*,
          wp.service AS profile_service,
          wp.experience AS profile_experience,
          wp.description AS profile_description,
          wp.availability AS profile_availability
        FROM users u
        LEFT JOIN workman_profiles wp ON wp.user_id = u.id
        ORDER BY u.created_at DESC
        LIMIT 100
      `),

      pool.query(`
        SELECT
          b.*,
          c.name AS customer_account_name,
          w.name AS workman_name
        FROM bookings b
        JOIN users c ON c.id = b.customer_id
        JOIN users w ON w.id = b.workman_id
        ORDER BY b.created_at DESC
        LIMIT 100
      `)
    ]);

    const counts = {
      users: Number(usersCount.rows[0].n),
      customers: Number(customersCount.rows[0].n),
      workmen: Number(workmenCount.rows[0].n),
      bookings: Number(bookingsCount.rows[0].n),
      pending: Number(pendingCount.rows[0].n)
    };

    const users = usersResult.rows.map(publicUser);
    const bookings = bookingsResult.rows;

    res.json({ counts, users, bookings });

  } catch (err) {
    next(err);
  }
});

// Delete a user account
router.delete("/users/:id", async (req, res, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM users
       WHERE id = $1
       AND role != 'admin'
       AND id != $2`,
      [Number(req.params.id), req.session.user.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        error: "User not found or cannot be deleted."
      });
    }

    res.json({ message: "User account deleted." });

  } catch (err) {
    next(err);
  }
});

module.exports = router;