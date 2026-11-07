# LocalWork — Full-stack website

LocalWork connects customers with local workmen. This version replaces the original browser-only demo authentication and localStorage data with a Node.js/Express backend, SQLite database, server-side sessions, bcrypt password hashing, role-based access control, and a Three.js hero animation.

## Requirements

- Node.js 20 or newer
- npm

## Setup (Windows / VS Code)

1. Extract the `LocalWork` folder.
2. Open the folder in VS Code.
3. Open Terminal → New Terminal.
4. Install dependencies:

   ```bash
   npm install
   ```

5. Copy `.env.example` to `.env`.
6. Edit `.env` and set a unique session secret and admin credentials. The admin password must be at least 12 characters.

   To create a strong session secret, run:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   Paste the output into `SESSION_SECRET`.

7. Start the server:

   ```bash
   npm start
   ```

8. Open `http://localhost:3000` in your browser. Do not open `public/index.html` directly; the backend must be running.

For automatic restart during development, use `npm run dev`.

## Account roles

- **Customer:** register, search workmen, view public profiles, create booking requests, and view booking history.
- **Workman:** register with service details, edit profile and availability, view booking requests, and accept or decline pending requests.
- **Admin:** there is no public admin registration. The first admin is created from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`. Log in using that email and password to access the protected admin panel.

## Project structure

```text
LocalWork/
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── server/
│   ├── server.js
│   ├── database.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── validation.js
│   └── routes/
│       ├── auth.js
│       ├── workmen.js
│       ├── bookings.js
│       └── admin.js
├── config/env.js
├── data/                 # created automatically; never commit this folder
├── .env.example
├── .gitignore
├── .gitguardian.yaml
├── package.json
├── SECURITY.md
└── README.md
```

## Security controls implemented

- Passwords are hashed server-side with bcrypt (12 rounds); plain-text passwords are never stored.
- Authentication uses server-side sessions stored in SQLite, not localStorage.
- Session cookies are HttpOnly, SameSite=Strict, and Secure in production.
- Session ID is regenerated after login and registration to reduce session fixation risk.
- Customer, workman, and admin routes enforce server-side role checks.
- Admin accounts are bootstrapped only from private environment variables; public signup cannot select the admin role.
- CSRF token is required for state-changing API requests.
- Helmet supplies security headers and a restrictive Content Security Policy.
- Authentication endpoints are rate-limited.
- JSON request size is capped; Zod validates and bounds user input.
- SQL queries use prepared statements.
- API errors avoid exposing stack traces in production.
- Dotfiles are not served as static files; `.env`, database, and dependencies are excluded from Git.
- Three.js is served from the installed local dependency rather than an external script CDN.

## Important production notes

This is a strong educational full-stack baseline, not a completed production security certification. Before a public launch:

1. Deploy behind HTTPS and set `NODE_ENV=production`.
2. Set a unique, high-entropy `SESSION_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in your hosting provider's secret manager. Never commit `.env`.
3. Use a managed database with backups, monitoring, least-privilege access, and a migration plan if moving beyond a small SQLite deployment.
4. Configure CORS only if the frontend is hosted on a separate trusted origin. Same-origin hosting is preferred.
5. Add email verification, password reset, account lockout / abuse monitoring, audit logs, privacy policy, consent, data retention and deletion workflows before accepting real personal data.
6. Add CAPTCHA or stronger bot controls if abuse is observed.
7. Review dependency advisories regularly (`npm audit`) and update packages carefully.
8. Do not treat contact details or workman profiles as verified unless a real verification process exists.

## Useful commands

```bash
npm run check
npm audit
npm audit fix
```

`npm audit fix` may introduce breaking changes; review the changes and test the site before deploying.

## Three.js animation

The landing page includes a lightweight animated 3D neighbourhood house, orbit ring, and floating objects. The scene resizes with its container and uses the locally installed Three.js package.

## Original files

The original `index.html`, `styles.css`, `app.js`, and `README.md` were used as the starting point for the LocalWork idea and interface. The new full-stack version is served from `public/`.
