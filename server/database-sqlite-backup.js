const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const env = require("../config/env");

fs.mkdirSync(path.dirname(env.databaseFile), { recursive: true });
const db = new Database(env.databaseFile);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT NOT NULL,
  location TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('customer','workman','admin')),
  password_hash TEXT NOT NULL,
  service TEXT,
  experience INTEGER,
  description TEXT,
  availability TEXT NOT NULL DEFAULT 'Available' CHECK(availability IN ('Available','Busy')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workman_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  booking_date TEXT NOT NULL,
  booking_time TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Accepted','Declined','Completed','Cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_role_service ON users(role, service);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_workman ON bookings(workman_id);
`);

const publicUser = row => row && ({
  id: row.id, name: row.name, email: row.email, phone: row.phone,
  location: row.location, role: row.role, service: row.service,
  experience: row.experience, description: row.description,
  availability: row.availability, createdAt: row.created_at
});

function bootstrapAdmin() {
  if (!env.adminEmail || !env.adminPassword) {
    console.warn("Admin bootstrap skipped: set ADMIN_EMAIL and ADMIN_PASSWORD in .env.");
    return;
  }
  if (env.adminPassword.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(env.adminEmail);
  const hash = bcrypt.hashSync(env.adminPassword, 12);
  if (existing) {
    db.prepare("UPDATE users SET role='admin', password_hash=? WHERE id=?").run(hash, existing.id);
  } else {
    db.prepare(`INSERT INTO users (name,email,phone,location,role,password_hash)
      VALUES (?,?,?,?, 'admin', ?)`).run("LocalWork Administrator", env.adminEmail, "Not public", "Admin", hash);
  }
  console.log(`Admin account ready for ${env.adminEmail}`);
}

module.exports = { db, publicUser, bootstrapAdmin };
