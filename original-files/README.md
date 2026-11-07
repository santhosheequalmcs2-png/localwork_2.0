# LocalWork — beginner-friendly hackathon website

LocalWork is a front-end demonstration website that connects customers with local service professionals. It is built with plain HTML, CSS, and JavaScript so you can understand and modify it without a framework.

## Run the website

1. Download and extract `localwork.zip`.
2. Open the `localwork` folder.
3. Double-click `index.html` to open it in a modern browser.
4. For a more realistic local development setup, open the folder in Visual Studio Code and use the **Live Server** extension, then choose **Open with Live Server**.

No build step, package installation, or API key is required.

## Features included

- Responsive home page and service categories.
- Customer and workman registration forms with validation.
- Demo login and logout, role-specific dashboards, and show/hide password.
- Customer search by service and area.
- Fictional sample workman profiles and clearly labelled illustrative demo ratings.
- Workman profile view, edit profile, and availability setting.
- Demo booking request form with date validation.
- Booking requests stored locally in the browser.
- Accessible error messages and modal close controls.

## Important demo limitations

This is **not production authentication**. The demo saves account details and a salted SHA-256 password hash in this browser's `localStorage` so registration/login can be demonstrated. The plain-text password is not saved. However, this client-side hash is not a substitute for secure server-side authentication and browser storage is not secure. **Use only a made-up demo password. Never enter a real or reused password.**

There is no server, database, real-time messaging, payment, real booking delivery, or cross-device account access. A booking request is saved in the same browser and does not notify a workman. Contact details for the sample profiles are fictional. Ratings/review counts are illustrative demo values, not genuine customer reviews. No profile is verified.

To reset the demo, open browser Developer Tools → Application/Storage → Local Storage and remove keys beginning with `localwork_demo_`, or clear this site's local storage.

## Folder structure

```text
localwork/
├── index.html
├── README.md
├── css/
│   └── styles.css
└── js/
    └── app.js
```

## How the code is organised

- `index.html`: page sections, forms, dialogs, and navigation.
- `css/styles.css`: layout, colours, responsive styling, cards, forms, and modals.
- `js/app.js`: sample data, navigation, validation, searching, profile editing, and demo booking storage.

## Moving towards a real website

For a production version, use a backend service such as Firebase Authentication and Firestore or Supabase Auth and a database. Do not store passwords yourself. Enforce role permissions and validate all data on the server. Add real booking status/notifications, verified reviews, consent/privacy text, and abuse reporting before launching publicly.

## Hackathon demo flow

1. Open the site and choose **Find a workman**.
2. Register a customer using a fictional name, email, phone, and password.
3. Search for `Plumber` or select a service category; try `T. Nagar` as the area.
4. Open a profile and test the booking request form.
5. Log out and register a workman account to show the separate dashboard.
6. Edit the workman profile, change availability, and preview the customer-facing profile.
7. Explain that profiles, reviews, contact actions, and booking requests are demo-only.

The project supports the spirit of UN Sustainable Development Goal 8.3 by demonstrating a way to improve visibility for local workers and small service businesses.
