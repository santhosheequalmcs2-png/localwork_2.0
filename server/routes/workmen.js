const express = require("express");
const { db, publicUser } = require("../database");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validate, profileSchema } = require("../middleware/validation");
const router = express.Router();

router.get("/", (req, res) => {
  const service = String(req.query.service || "").slice(0, 40);
  const location = String(req.query.location || "").slice(0, 120);
  const rows = db.prepare(`SELECT * FROM users WHERE role='workman'
    AND (?='' OR service LIKE '%' || ? || '%')
    AND (?='' OR location LIKE '%' || ? || '%')
    ORDER BY availability='Available' DESC, created_at DESC LIMIT 100`)
    .all(service, service, location, location);
  res.json({ workmen: rows.map(publicUser) });
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM users WHERE id=? AND role='workman'").get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Workman profile not found." });
  res.json({ workman: publicUser(row) });
});

router.put("/me/profile", requireAuth, requireRole("workman"), validate(profileSchema), (req, res) => {
  const p = req.body;
  db.prepare(`UPDATE users SET name=?,phone=?,location=?,service=?,experience=?,description=?,availability=? WHERE id=? AND role='workman'`)
    .run(p.name,p.phone,p.location,p.service,p.experience,p.description,p.availability,req.session.user.id);
  res.json({ user: publicUser(db.prepare("SELECT * FROM users WHERE id=?").get(req.session.user.id)) });
});

module.exports = router;
