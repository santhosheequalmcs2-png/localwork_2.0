const express = require("express");
const { pool, publicUser } = require("../database");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth, requireRole("admin"));

// Admin dashboard overview
router.get("/overview", async (req, res, next) => {
  try {
    const [
      usersCount,
      customersCount,
      workmenCount,
      bookingsCount,
      pendingCount,
      pendingApplicationsCount,
      usersResult,
      bookingsResult
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) AS n FROM users"),

      pool.query(
        "SELECT COUNT(*) AS n FROM users WHERE role = 'customer'"
      ),

      pool.query(
        "SELECT COUNT(*) AS n FROM workman_profiles WHERE application_status = 'Approved'"
      ),

      pool.query("SELECT COUNT(*) AS n FROM bookings"),

      pool.query(
        "SELECT COUNT(*) AS n FROM bookings WHERE status = 'Pending'"
      ),

      pool.query(
        "SELECT COUNT(*) AS n FROM workman_profiles WHERE application_status = 'Pending'"
      ),

      pool.query(`
        SELECT
          u.*,
          wp.service AS profile_service,
          wp.experience AS profile_experience,
          wp.description AS profile_description,
          wp.availability AS profile_availability,
          wp.application_status,
          wp.rejection_reason
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
      pending: Number(pendingCount.rows[0].n),
      pendingApplications: Number(pendingApplicationsCount.rows[0].n)
    };

    const users = usersResult.rows.map(publicUser);
    const bookings = bookingsResult.rows;

    res.json({ counts, users, bookings });

  } catch (err) {
    next(err);
  }
});

// View workman applications
router.get("/applications", async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        u.*,
        wp.service AS profile_service,
        wp.experience AS profile_experience,
        wp.description AS profile_description,
        wp.availability AS profile_availability,
        wp.application_status,
        wp.rejection_reason,
        wp.reviewed_at
      FROM workman_profiles wp
      JOIN users u ON u.id = wp.user_id
      ORDER BY
        CASE wp.application_status
          WHEN 'Pending' THEN 1
          WHEN 'Rejected' THEN 2
          WHEN 'Approved' THEN 3
          ELSE 4
        END,
        wp.created_at DESC
    `);

    res.json({
      applications: result.rows.map(publicUser)
    });

  } catch (err) {
    next(err);
  }
});

// Approve a workman application
router.patch("/applications/:id/approve", async (req, res, next) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(400).json({
        error: "Invalid application ID."
      });
    }

    const result = await pool.query(`
      UPDATE workman_profiles
      SET
        application_status = 'Approved',
        rejection_reason = NULL,
        reviewed_at = CURRENT_TIMESTAMP,
        reviewed_by = $2
      WHERE user_id = $1
      AND application_status = 'Pending'
      RETURNING user_id
    `, [userId, req.session.user.id]);

    if (!result.rowCount) {
      return res.status(404).json({
        error: "Pending application not found."
      });
    }

    res.json({
      message: "Workman application approved."
    });

  } catch (err) {
    next(err);
  }
});

// Reject a workman application
router.patch("/applications/:id/reject", async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const reason = typeof req.body?.reason === "string"
      ? req.body.reason.trim()
      : "";

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(400).json({
        error: "Invalid application ID."
      });
    }

    if (!reason || reason.length < 3 || reason.length > 500) {
      return res.status(400).json({
        error: "Please provide a rejection reason between 3 and 500 characters."
      });
    }

    const result = await pool.query(`
      UPDATE workman_profiles
      SET
        application_status = 'Rejected',
        rejection_reason = $2,
        reviewed_at = CURRENT_TIMESTAMP,
        reviewed_by = $3
      WHERE user_id = $1
      AND application_status = 'Pending'
      RETURNING user_id
    `, [userId, reason, req.session.user.id]);

    if (!result.rowCount) {
      return res.status(404).json({
        error: "Pending application not found."
      });
    }

    res.json({
      message: "Workman application rejected."
    });

  } catch (err) {
    next(err);
  }
});

// Delete a user account
router.delete("/users/:id", async (req, res, next) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(400).json({
        error: "Invalid user ID."
      });
    }

    const result = await pool.query(
      `DELETE FROM users
       WHERE id = $1
       AND role != 'admin'
       AND id != $2`,
      [userId, req.session.user.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        error: "User not found or cannot be deleted."
      });
    }

    res.json({
      message: "User account deleted."
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;