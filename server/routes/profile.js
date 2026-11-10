const express = require("express");
const { pool, publicUser } = require("../database");
const {
  validate,
  accountProfileSchema
} = require("../middleware/validation");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Get the logged-in user's own profile
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

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Profile not found."
      });
    }

    res.json({
      user: publicUser(result.rows[0])
    });
  } catch (err) {
    next(err);
  }
});

// Update only the logged-in user's basic account details
router.put("/me", requireAuth, validate(accountProfileSchema), async (req, res, next) => {
  try {
    const { name, phone, location } = req.body;

    const result = await pool.query(
      `UPDATE users
       SET name = $1, phone = $2, location = $3
       WHERE id = $4
       RETURNING id, name, email, phone, location, role, created_at`,
      [name, phone, location, req.session.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Profile not found."
      });
    }

    res.json({
      message: "Profile updated successfully.",
      user: publicUser(result.rows[0])
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;