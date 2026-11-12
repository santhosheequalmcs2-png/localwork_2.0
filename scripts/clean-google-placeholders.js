const { pool } = require("../server/database");

async function run() {
  try {
    console.log("Cleaning up placeholder strings for Google OAuth users...");

    // Update phone numbers that were hardcoded as 'Google Account'
    const phoneRes = await pool.query(
      "UPDATE users SET phone = '' WHERE phone = 'Google Account' OR phone ILIKE '%google%'"
    );
    console.log(`Cleared 'Google Account' phone from ${phoneRes.rowCount} users.`);

    // Update locations that were hardcoded as 'Local Area'
    const locRes = await pool.query(
      "UPDATE users SET location = '' WHERE location = 'Local Area'"
    );
    console.log(`Cleared 'Local Area' location from ${locRes.rowCount} users.`);

    // Verify current user state for Google logins
    const users = await pool.query(
      "SELECT id, name, email, phone, location, role FROM users WHERE role = 'customer' ORDER BY id DESC LIMIT 5"
    );
    console.log("Recent customer users in DB:");
    console.table(users.rows);

  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await pool.end();
  }
}

run();
