# LocalWork security notes

## Secrets
- Never commit `.env`, database files, session databases, access tokens, or passwords.
- Keep production secrets in your hosting provider's secret manager.
- Rotate any credential that was accidentally committed or shared.

## Authentication and authorization
- Passwords are hashed with bcrypt on the server.
- Session identifiers are regenerated after successful login and registration.
- The server checks the session and role on every protected route.
- Admin privileges are not selectable during registration.

## Input and output
- Request bodies are size-limited and validated with Zod.
- Database access uses prepared statements.
- Frontend templates HTML-escape dynamic values before insertion.

## Browser and transport protections
- Helmet adds security headers and Content Security Policy.
- Session cookies use HttpOnly and SameSite=Strict; Secure is enabled in production.
- State-changing API requests require a CSRF token.
- Serve the production site over HTTPS only.

## Operational checklist
- [ ] Set `NODE_ENV=production`.
- [ ] Set a unique 32+ character `SESSION_SECRET`.
- [ ] Set private admin credentials.
- [ ] Enable HTTPS at the host / reverse proxy.
- [ ] Keep `.env` and `data/` out of version control.
- [ ] Run `npm audit` and review advisories.
- [ ] Back up the database securely.
- [ ] Add privacy, retention, verification, and account-recovery workflows before launch.
