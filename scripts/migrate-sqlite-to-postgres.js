const path = require("node:path");
const Database = require("better-sqlite3");
const { Pool } = require("pg");
const env = require("../config/env");

async function migrate() {
  const sqlitePath = path.resolve("./data/localwork.sqlite");

  console.log("Opening original SQLite database...");

  const sqlite = new Database(sqlitePath, {
    readonly: true
  });

  const users = sqlite.prepare(
    "SELECT * FROM users ORDER BY id"
  ).all();

  const bookings = sqlite.prepare(
    "SELECT * FROM bookings ORDER BY id"
  ).all();

  console.log(`Found ${users.length} users.`);
  console.log(`Found ${bookings.length} bookings.`);

  const pool = new Pool({
    connectionString: env.databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userCount = await client.query(
      "SELECT COUNT(*) AS n FROM users"
    );

    const bookingCount = await client.query(
      "SELECT COUNT(*) AS n FROM bookings"
    );

    if (
      Number(userCount.rows[0].n) > 0 ||
      Number(bookingCount.rows[0].n) > 0
    ) {
      throw new Error(
        "Neon database is not empty. Migration stopped to protect existing data."
      );
    }

    for (const user of users) {
      await client.query(
        `INSERT INTO users (
          id, name, email, phone, location, role,
          password_hash, service, experience, description,
          availability, created_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
        )`,
        [
          user.id,
          user.name,
          user.email,
          user.phone,
          user.location,
          user.role,
          user.password_hash,
          user.service,
          user.experience,
          user.description,
          user.availability,
          user.created_at
        ]
      );
    }

    for (const booking of bookings) {
      await client.query(
        `INSERT INTO bookings (
          id, customer_id, workman_id, customer_name,
          phone, address, booking_date, booking_time,
          notes, status, created_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
        )`,
        [
          booking.id,
          booking.customer_id,
          booking.workman_id,
          booking.customer_name,
          booking.phone,
          booking.address,
          booking.booking_date,
          booking.booking_time,
          booking.notes,
          booking.status,
          booking.created_at
        ]
      );
    }

    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('users', 'id'),
        GREATEST(COALESCE((SELECT MAX(id) FROM users), 1), 1),
        EXISTS (SELECT 1 FROM users)
      )
    `);

    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('bookings', 'id'),
        GREATEST(COALESCE((SELECT MAX(id) FROM bookings), 1), 1),
        EXISTS (SELECT 1 FROM bookings)
      )
    `);

    await client.query("COMMIT");

    console.log("Migration completed successfully!");
    console.log(`Users transferred: ${users.length}`);
    console.log(`Bookings transferred: ${bookings.length}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error.message);
  } finally {
    sqlite.close();
    client.release();
    await pool.end();
  }
}

migrate().catch(error => {
  console.error("Migration error:", error.message);
  process.exitCode = 1;
});