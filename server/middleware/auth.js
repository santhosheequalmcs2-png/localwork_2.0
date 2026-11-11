function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Please log in to continue." });
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: "Please log in to continue." });
    if (!roles.includes(req.session.user.role)) return res.status(403).json({ error: "You do not have permission to do that." });
    next();
  };
}
function requireCsrf(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (
    req.originalUrl === "/api/auth/logout" ||
    req.path === "/auth/logout" ||
    req.path === "/logout" ||
    req.originalUrl.startsWith("/api/ai") ||
    req.path.startsWith("/ai")
  ) {
    return next();
  }
  const token = req.get("x-csrf-token");
  if (!req.session.csrfToken || !token || token !== req.session.csrfToken) {
    return res.status(403).json({ error: "Security token expired. Refresh the page and try again." });
  }
  next();
}
module.exports = { requireAuth, requireRole, requireCsrf };
