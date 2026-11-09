const express = require("express");
const { pool, publicUser } = require("../database");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validate, profileSchema } = require("../middleware/validation");

const router = express.Router();

// Get all workman profiles
router.get("/", async (req, res, next) => {
  try {
    const service = String(req.query.service || "").slice(0, 40);
    const location = String(req.query.location || "").slice(0, 120);

    const result = await pool.query(
      `SELECT
         u.*,
         wp.service AS profile_service,
         wp.experience AS profile_experience,
         wp.description AS profile_description,
         wp.availability AS profile_availability
       FROM users u
       INNER JOIN workman_profiles wp ON wp.user_id = u.id
       WHERE ($1 = '' OR wp.service ILIKE '%' || $1 || '%')
       AND ($2 = '' OR u.location ILIKE '%' || $2 || '%')
       ORDER BY
         CASE WHEN wp.availability = 'Available' THEN 0 ELSE 1 END,
         wp.created_at DESC
       LIMIT 100`,
      [service, location]
    );

    res.json({ workmen: result.rows.map(publicUser) });
  } catch (err) {
    next(err);
  }
});

// Get one workman profile
router.get("/:id", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         u.*,
         wp.service AS profile_service,
         wp.experience AS profile_experience,
         wp.description AS profile_description,
         wp.availability AS profile_availability
       FROM users u
       INNER JOIN workman_profiles wp ON wp.user_id = u.id
       WHERE u.id = $1`,
      [Number(req.params.id)]
    );

    const row = result.rows[0];

    if (!row) {
      return res.status(404).json({
        error: "Workman profile not found."
      });
    }

    res.json({ workman: publicUser(row) });
  } catch (err) {
    next(err);
  }
});

// Create or update the logged-in user's workman profile
router.put(
  "/me/profile",
  requireAuth,
  requireRole("customer"),
  validate(profileSchema),
  async (req, res, next) => {
    const client = await pool.connect();

    try {
      const p = req.body;
      const userId = req.session.user.id;

      await client.query("BEGIN");

      // Update common account information
      await client.query(
        `UPDATE users
         SET name = $1, phone = $2, location = $3
         WHERE id = $4`,
        [p.name, p.phone, p.location, userId]
      );

      // Create the workman profile or update the existing one
      await client.query(
        `INSERT INTO workman_profiles
           (user_id, service, experience, description, availability)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id)
         DO UPDATE SET
           service = EXCLUDED.service,
           experience = EXCLUDED.experience,
           description = EXCLUDED.description,
           availability = EXCLUDED.availability`,
        [
          userId,
          p.service,
          p.experience,
          p.description,
          p.availability
        ]
      );

      await client.query("COMMIT");

      // Return the updated account with its workman profile
      const result = await pool.query(
        `SELECT
           u.*,
           wp.service AS profile_service,
           wp.experience AS profile_experience,
           wp.description AS profile_description,
           wp.availability AS profile_availability
         FROM users u
         LEFT JOIN workman_profiles wp ON wp.user_id = u.id
         WHERE u.id = $1`,
        [userId]
      );

      res.json({ user: publicUser(result.rows[0]) });
    } catch (err) {
      await client.query("ROLLBACK");
      next(err);
    } finally {
      client.release();
    }
  }
);

module.exports = router;