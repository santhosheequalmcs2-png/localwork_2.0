import * as THREE from "/vendor/three/three.module.js";

let csrfToken = "";
let pendingResetToken = "";
let currentUser = null;
let authMode = "register";
let selectedWorkman = null;
let previousView = "customer-view";
let activeDashboard = "customer";

const $ = (id) => document.getElementById(id);

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

const categories = [
  ["⚡", "Electrician"],
  ["🔧", "Plumber"],
  ["🪚", "Carpenter"],
  ["🖌️", "Painter"],
  ["🛠️", "Mechanic"],
  ["🧹", "Cleaning"],
  ["🧱", "Construction"],
  ["🧰", "Other"],
];

async function api(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = { ...(options.headers || {}) };

  if (options.body && typeof options.body !== "string") {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const response = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: "same-origin",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  if (data.csrfToken) {
    csrfToken = data.csrfToken;
  }

  return data;
}

function show(view, { updateHistory = true } = {}) {
  const target = $(view);

  if (!target) {
    console.warn("View not found:", view);
    return;
  }

  // Add the selected view to Chrome browser history.
  if (updateHistory && window.history.state?.localworkView !== view) {
    window.history.pushState(
      { localworkView: view },
      document.title,
      window.location.href,
    );
  }

  document.querySelectorAll(".view").forEach((v) => {
    v.classList.add("hidden");
  });

  target.classList.remove("hidden");

  if (view === "customer-view" && typeof customerThreeAnimate === "function") {
    setTimeout(() => customerThreeAnimate(), 50);
  }

  const isPublicPage = view === "home-view" || view === "auth-view";

  const publicNav = $("public-nav");
  const sidebar = $("dashboard-sidebar");

  if (publicNav) {
    publicNav.classList.toggle("hidden", !isPublicPage);
  }

  if (sidebar) {
    sidebar.classList.toggle("hidden", isPublicPage || !currentUser);
  }

  // Show navigation according to account role.
  document.querySelectorAll("[data-nav-role]").forEach((section) => {
    const role = section.dataset.navRole;

    let visible = false;

    if (role === "admin") {
      visible = currentUser?.role === "admin";
    }

    if (role === "customer") {
      visible = !!currentUser && currentUser.role !== "admin";
    }

    if (role === "workman") {
      visible =
        !!currentUser &&
        currentUser.role !== "admin" &&
        currentUser.applicationStatus === "Approved";
    }

    section.classList.toggle("hidden", !visible);
  });

  $("login-nav").classList.toggle("hidden", !!currentUser);
  $("logout-nav").classList.toggle("hidden", !currentUser);

  // Highlight the active sidebar page.
  document.querySelectorAll("[data-nav-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.navView === view);
  });

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

// Handle Chrome browser Back and Forward buttons.
window.addEventListener("popstate", async (event) => {
  const view = event.state?.localworkView;

  if (!view || !$(view)) {
    show("home-view", { updateHistory: false });
    return;
  }

  // Prevent logged-out users from reopening protected pages.
  const protectedViews = [
    "customer-view",
    "workman-view",
    "admin-view",
    "application-view",
    "profile-view",
    "account-view",
  ];

  if (protectedViews.includes(view) && !currentUser) {
    show("home-view", { updateHistory: false });

    window.history.replaceState(
      { localworkView: "home-view" },
      document.title,
      window.location.pathname,
    );

    return;
  }

  // Check role permissions before showing protected dashboards.
  if (view === "admin-view" && currentUser?.role !== "admin") {
    show("home-view", { updateHistory: false });
    return;
  }

  if (
    view === "workman-view" &&
    currentUser?.applicationStatus !== "Approved"
  ) {
    show("customer-view", { updateHistory: false });
    return;
  }

  if (view === "customer-view") {
    activeDashboard = "customer";
    show(view, { updateHistory: false });

    try {
      await loadWorkmen();
      await loadCustomerBookings();
    } catch (error) {
      toast(error.message);
    }

    return;
  }

  if (view === "workman-view") {
    activeDashboard = "workman";
    show(view, { updateHistory: false });

    try {
      await loadWorkmanBookings();
    } catch (error) {
      toast(error.message);
    }

    return;
  }

  if (view === "admin-view") {
    show(view, { updateHistory: false });

    try {
      await loadAdmin();
    } catch (error) {
      toast(error.message);
    }

    return;
  }

  show(view, { updateHistory: false });
});

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.remove("hidden");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    $("toast").classList.add("hidden");
  }, 3200);
}

/* =========================
   AUTHENTICATION
========================= */

function setAuth(mode) {
  authMode = mode;

  $("register-tab").classList.toggle("active", mode === "register");
  $("login-tab").classList.toggle("active", mode === "login");

  $("role-choice").classList.add("hidden");
  $("auth-form").classList.remove("hidden");

  $("signup-fields").classList.toggle("hidden", mode === "login");
  $("signin-fields").classList.toggle("hidden", mode !== "login");

  $("signup-fields")
    .querySelectorAll("input, select, textarea")
    .forEach((field) => {
      field.disabled = mode === "login";
    });

  $("signin-fields")
    .querySelectorAll("input, select, textarea")
    .forEach((field) => {
      field.disabled = mode !== "login";
    });

  $("workman-fields").classList.add("hidden");

  $("workman-fields")
    .querySelectorAll("input, select, textarea")
    .forEach((field) => {
      field.disabled = true;
    });

  $("confirm-wrap").classList.toggle("hidden", mode === "login");

  $("password").autocomplete =
    mode === "login" ? "current-password" : "new-password";

  $("auth-heading").textContent =
    mode === "login" ? "Welcome back" : "Create your account";

  $("auth-submit").textContent = mode === "login" ? "Log in" : "Create account";

  $("auth-error").classList.add("hidden");
}

function openAuth(mode = "register") {
  setAuth(mode);
  show("auth-view");
}
function openForgotPassword() {
  $("forgot-email").value = $("login-email").value;
  $("forgot-message").classList.add("hidden");
  $("forgot-error").classList.add("hidden");

  show("forgot-password-view");
}

/* =========================
   CATEGORIES
========================= */

function renderCategories() {
  $("category-list").innerHTML = categories
    .map(
      ([icon, name]) => `
    <button class="category" data-category="${esc(name)}">
      <span>${icon}</span>
      <b>${esc(name)}</b>
    </button>
  `,
    )
    .join("");

  $("category-list")
    .querySelectorAll("[data-category]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        $("filter-service").value = button.dataset.category;

        if (!currentUser) {
          openAuth("register");
        } else if (currentUser.role !== "admin") {
          activeDashboard = "customer";
          show("customer-view");
          loadWorkmen().catch((e) => toast(e.message));
        }
      });
    });
}

/* =========================
   DASHBOARD ROUTING
========================= */

async function routeUser() {
  if (!currentUser) {
    activeDashboard = "customer";
    show("home-view");
    return;
  }

  if (currentUser.role === "admin") {
    show("admin-view");
    await loadAdmin();
    return;
  }

  const status = currentUser.applicationStatus || "Not Applied";

  $("customer-greeting").textContent =
    `Welcome, ${currentUser.name.split(" ")[0]}! Find local help.`;

  const actionButton = $("customer-workman-action");
  const statusMessage = $("workman-application-status");

  if (status === "Approved") {
    actionButton.textContent = "Workman Dashboard";
    statusMessage.textContent =
      "Your workman application has been approved. You can access your Workman Dashboard.";
  } else if (status === "Pending") {
    actionButton.textContent = "Application Pending";
    statusMessage.textContent =
      "Your workman application is waiting for admin approval.";
  } else if (status === "Rejected") {
    actionButton.textContent = "Resubmit Application";
    statusMessage.textContent = `Your application was rejected. Reason: ${currentUser.rejectionReason || "Please update your details and resubmit."}`;
  } else {
    actionButton.textContent = "Become a Workman";
    statusMessage.textContent =
      "Want to provide local services? Apply to become a workman.";
  }

  // Only approved workmen can enter Workman Dashboard.
  if (activeDashboard === "workman" && status === "Approved") {
    show("workman-view");
    await loadWorkmanBookings();
  } else {
    activeDashboard = "customer";
    show("customer-view");
    await loadWorkmen();
    await loadCustomerBookings();
  }
}

/* =========================
   BECOME A WORKMAN
========================= */

function openApplication() {
  if (!currentUser) {
    openAuth("login");
    return;
  }

  const status = currentUser.applicationStatus || "Not Applied";

  if (status === "Pending") {
    toast("Your application is still waiting for admin approval.");
    return;
  }

  if (status === "Approved") {
    activeDashboard = "workman";
    routeUser().catch((e) => toast(e.message));
    return;
  }

  fillProfile();

  $("profile-error").classList.add("hidden");

  show("application-view");
}

/* =========================
   FIND WORKMEN
========================= */

async function loadWorkmen() {
  const service = $("filter-service").value.trim();
  const location = $("filter-location").value.trim();

  const { workmen } = await api(
    `/api/workmen?service=${encodeURIComponent(service)}&location=${encodeURIComponent(location)}`,
  );

  $("workmen-count").textContent =
    `${workmen.length} profile${workmen.length === 1 ? "" : "s"} found`;

  $("workmen-grid").innerHTML = workmen.length
    ? workmen
        .map(
          (w) => `
      <article class="workman-card">
        <p class="eyebrow">
          ${esc(w.service)} · ${esc(w.availability)}
        </p>

        <h3>${esc(w.name)}</h3>

        <p>${esc(w.description || "Local service professional.")}</p>

        <div class="meta">
          ${esc(w.location)} · ${Number(w.experience) || 0} years' experience
        </div>

        <div class="card-actions">
          <button class="btn btn-light" data-profile="${w.id}">
            View profile
          </button>

          <button class="btn btn-primary" data-book="${w.id}">
            Book
          </button>
        </div>
      </article>
    `,
        )
        .join("")
    : `<div class="empty">No profiles found. Try a different service or area.</div>`;

  $("workmen-grid")
    .querySelectorAll("[data-profile]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        openProfile(Number(button.dataset.profile)).catch((e) =>
          toast(e.message),
        );
      });
    });

  $("workmen-grid")
    .querySelectorAll("[data-book]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        openBooking(Number(button.dataset.book));
      });
    });
}

/* =========================
   WORKMAN PROFILE
========================= */

async function openProfile(id) {
  const { workman: w } = await api(`/api/workmen/${id}`);

  previousView = "customer-view";

  $("profile-detail").innerHTML = `
    <article class="profile-detail">
      <p class="eyebrow">
        ${esc(w.service)} · ${esc(w.availability)}
      </p>

      <h1>${esc(w.name)}</h1>

      <p>${esc(w.description)}</p>

      <p>
        <b>Area:</b> ${esc(w.location)}
        &nbsp;
        <b>Experience:</b> ${Number(w.experience) || 0} years
      </p>

      <button class="btn btn-primary" id="profile-book">
        Request a booking
      </button>
    </article>
  `;

  $("profile-book").addEventListener("click", () => {
    openBooking(id);
  });

  show("profile-view");
}

/* =========================
   BOOKING
========================= */

function openBooking(id) {
  if (!currentUser || currentUser.role === "admin") {
    toast("Please log in with a customer account to book a workman.");
    openAuth("login");
    return;
  }

  selectedWorkman = id;

  $("booking-name").value = currentUser.name || "";
  $("booking-phone").value = currentUser.phone || "";
  $("booking-address").value = currentUser.location || "";

  $("booking-date").min = new Date().toISOString().slice(0, 10);
  $("booking-date").value = "";

  $("booking-error").classList.add("hidden");

  $("booking-modal").classList.remove("hidden");

  api(`/api/workmen/${id}`)
    .then(({ workman }) => {
      $("booking-person").textContent =
        `Booking request for ${workman.name} (${workman.service})`;
    })
    .catch(() => {});
}

async function saveBooking(event) {
  event.preventDefault();

  try {
    await api("/api/bookings", {
      method: "POST",
      body: {
        workmanId: selectedWorkman,
        customerName: $("booking-name").value,
        phone: $("booking-phone").value,
        address: $("booking-address").value,
        date: $("booking-date").value,
        time: $("booking-time").value,
        notes: $("booking-notes").value,
      },
    });

    $("booking-modal").classList.add("hidden");

    toast("Booking request sent successfully.");

    await loadCustomerBookings();
  } catch (e) {
    $("booking-error").textContent = e.message;
    $("booking-error").classList.remove("hidden");
  }
}

/* =========================
   CUSTOMER BOOKINGS
========================= */

async function loadCustomerBookings() {
  const { bookings } = await api("/api/bookings/mine");

  $("customer-bookings").innerHTML = bookings.length
    ? bookings
        .map(
          (b) => `
      <div class="booking-item">
        <b>${esc(b.workman_name)} · ${esc(b.booking_date)}</b>

        <p>
          ${esc(b.booking_time)} ·
          ${esc(b.address)} ·
          Status: <b>${esc(b.status)}</b>
        </p>

        <p>${esc(b.notes)}</p>
      </div>
    `,
        )
        .join("")
    : `<div class="empty">You have not sent any booking requests yet.</div>`;
}

/* =========================
   WORKMAN BOOKINGS
========================= */

async function loadWorkmanBookings() {
  const { bookings } = await api("/api/bookings/workman");

  $("workman-bookings").innerHTML = bookings.length
    ? bookings
        .map(
          (b) => `
      <div class="booking-item">
        <b>${esc(b.customer_name)} · ${esc(b.booking_date)}</b>

        <p>
          ${esc(b.booking_time)} ·
          ${esc(b.address)} ·
          ${esc(b.phone)}
        </p>

        <p>${esc(b.notes)}</p>

        <b>Status: ${esc(b.status)}</b>

        <div>
          ${
            b.status === "Pending"
              ? `
            <button
              class="btn btn-primary"
              data-status="Accepted"
              data-id="${b.id}">
              Accept
            </button>

            <button
              class="btn btn-light"
              data-status="Declined"
              data-id="${b.id}">
              Decline
            </button>
          `
              : ""
          }
        </div>
      </div>
    `,
        )
        .join("")
    : `<div class="empty">No booking requests yet.</div>`;

  $("workman-bookings")
    .querySelectorAll("[data-status]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await api(`/api/bookings/${button.dataset.id}/status`, {
            method: "PATCH",
            body: {
              status: button.dataset.status,
            },
          });

          toast("Booking status updated.");

          await loadWorkmanBookings();
        } catch (e) {
          toast(e.message);
        }
      });
    });
}

/* =========================
   WORKMAN APPLICATION FORM
========================= */

function fillProfile() {
  $("profile-name").value = currentUser.name || "";
  $("profile-phone").value = currentUser.phone || "";
  $("profile-location").value = currentUser.location || "";

  $("profile-service").value = currentUser.service || "Other";

  $("profile-experience").value = currentUser.experience ?? 0;

  $("profile-availability").value = currentUser.availability || "Available";

  $("profile-description").value = currentUser.description || "";
}

async function saveProfile(event) {
  event.preventDefault();

  try {
    const data = {
      name: $("profile-name").value,
      phone: $("profile-phone").value,
      location: $("profile-location").value,
      service: $("profile-service").value,
      experience: $("profile-experience").value,
      availability: $("profile-availability").value,
      description: $("profile-description").value,
    };

    const result = await api("/api/workmen/me/profile", {
      method: "PUT",
      body: data,
    });

    currentUser = result.user;

    // Stay in Customer Dashboard until admin approval.
    activeDashboard = "customer";

    $("profile-error").classList.add("hidden");

    toast("Application submitted. Waiting for admin approval.");

    await routeUser();
  } catch (e) {
    $("profile-error").textContent = e.message;
    $("profile-error").classList.remove("hidden");
  }
}

/* =========================
   ADMIN DASHBOARD
========================= */

async function loadAdmin() {
  const [overview, applicationData] = await Promise.all([
    api("/api/admin/overview"),
    api("/api/admin/applications"),
  ]);

  const { counts, users, bookings } = overview;
  const { applications } = applicationData;

  // Statistics
  $("admin-stats").innerHTML = Object.entries(counts)
    .map(
      ([key, value]) => `
      <div class="admin-stat">
        <b>${Number(value) || 0}</b>
        <span>${esc(key)}</span>
      </div>
    `,
    )
    .join("");

  // Users
  $("admin-users").innerHTML = users
    .map(
      (u) => `
    <tr>
      <td>${esc(u.name)}</td>
      <td>${esc(u.email)}</td>
      <td>${esc(u.role)}</td>
      <td>${esc(u.createdAt)}</td>
      <td>
        ${
          u.role !== "admin"
            ? `
          <button
            class="btn btn-light"
            data-delete-user="${u.id}">
            Delete
          </button>
        `
            : "Protected"
        }
      </td>
    </tr>
  `,
    )
    .join("");

  $("admin-users")
    .querySelectorAll("[data-delete-user]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        if (
          !confirm(
            "Delete this user account? Their bookings will also be deleted.",
          )
        ) {
          return;
        }

        try {
          await api(`/api/admin/users/${button.dataset.deleteUser}`, {
            method: "DELETE",
          });

          toast("User deleted.");

          await loadAdmin();
        } catch (e) {
          toast(e.message);
        }
      });
    });

  // Workman applications
  $("admin-applications").innerHTML = applications.length
    ? applications
        .map(
          (a) => `
      <article class="booking-item">
        <h3>${esc(a.name)}</h3>

        <p>
          <b>Email:</b> ${esc(a.email)}<br>
          <b>Phone:</b> ${esc(a.phone)}<br>
          <b>Location:</b> ${esc(a.location)}
        </p>

        <p>
          <b>Service:</b> ${esc(a.service)}<br>
          <b>Experience:</b> ${Number(a.experience) || 0} years<br>
          <b>Availability:</b> ${esc(a.availability)}
        </p>

        <p>${esc(a.description)}</p>

        <p>
          <b>Application Status:</b>
          ${esc(a.applicationStatus)}
        </p>

        ${
          a.rejectionReason
            ? `
          <p>
            <b>Rejection reason:</b>
            ${esc(a.rejectionReason)}
          </p>
        `
            : ""
        }

        ${
          a.applicationStatus === "Pending"
            ? `
          <div class="card-actions">
            <button
              class="btn btn-primary"
              data-approve="${a.id}">
              Approve
            </button>

            <button
              class="btn btn-light"
              data-reject="${a.id}">
              Reject
            </button>
          </div>
        `
            : ""
        }
      </article>
    `,
        )
        .join("")
    : `<div class="empty">No workman applications yet.</div>`;

  // Approve applications
  $("admin-applications")
    .querySelectorAll("[data-approve]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Approve this workman application?")) {
          return;
        }

        try {
          await api(
            `/api/admin/applications/${button.dataset.approve}/approve`,
            {
              method: "PATCH",
              body: {},
            },
          );

          toast("Workman application approved.");

          await loadAdmin();
        } catch (e) {
          toast(e.message);
        }
      });
    });

  // Reject applications
  $("admin-applications")
    .querySelectorAll("[data-reject]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const reason = prompt(
          "Enter the reason for rejecting this application (at least 3 characters):",
        );

        if (reason === null) {
          return;
        }

        if (reason.trim().length < 3 || reason.trim().length > 500) {
          toast("Please enter a reason between 3 and 500 characters.");
          return;
        }

        try {
          await api(`/api/admin/applications/${button.dataset.reject}/reject`, {
            method: "PATCH",
            body: {
              reason: reason.trim(),
            },
          });

          toast("Workman application rejected.");

          await loadAdmin();
        } catch (e) {
          toast(e.message);
        }
      });
    });

  // Booking activity
  $("admin-bookings").innerHTML = bookings.length
    ? bookings
        .map(
          (b) => `
      <div class="booking-item">
        <b>
          ${esc(b.customer_account_name)}
          → ${esc(b.workman_name)}
        </b>

        <p>
          ${esc(b.booking_date)} ·
          ${esc(b.booking_time)} ·
          ${esc(b.status)}
        </p>
      </div>
    `,
        )
        .join("")
    : `<div class="empty">No booking activity yet.</div>`;
}

/* =========================
   LOGOUT
========================= */

async function logout() {
  try {
    await api("/api/auth/logout", {
      method: "POST",
    });
  } catch (e) {}

  currentUser = null;
  activeDashboard = "customer";
  csrfToken = "";

  await initialise();
}

/* =========================
   THREE.JS ANIMATION
   PRESERVED FROM ORIGINAL
========================= */

function setupThree() {
  const host = $("three-hero");

  if (!host || !window.WebGLRenderingContext) return;

  let renderer;

  try {
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      38,
      host.clientWidth / host.clientHeight,
      0.1,
      100,
    );

    camera.position.set(0, 0, 8);

    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    renderer.setSize(host.clientWidth, host.clientHeight);

    host.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 2.1));

    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(4, 5, 6);
    scene.add(key);

    const group = new THREE.Group();
    scene.add(group);

    const matGreen = new THREE.MeshStandardMaterial({
      color: 0x246b4d,
      roughness: 0.3,
      metalness: 0.12,
    });

    const matLime = new THREE.MeshStandardMaterial({
      color: 0xc8e67b,
      roughness: 0.35,
      metalness: 0.1,
    });

    const matCream = new THREE.MeshStandardMaterial({
      color: 0xf8f4df,
      roughness: 0.45,
    });

    const box = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.25, 1.1), matGreen);

    box.position.set(0, -0.1, 0);
    group.add(box);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.9, 4), matLime);

    roof.rotation.y = Math.PI / 4;
    roof.position.set(0, 1.02, 0);
    group.add(roof);

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.72, 0.06),
      matCream,
    );

    door.position.set(0.3, -0.34, 0.58);
    group.add(door);

    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(2.15, 0.025, 8, 100),
      new THREE.MeshBasicMaterial({
        color: 0x8bad5a,
        transparent: true,
        opacity: 0.7,
      }),
    );

    torus.rotation.x = 0.8;
    group.add(torus);

    const toolGroup = new THREE.Group();
    scene.add(toolGroup);

    const toolMat = new THREE.MeshStandardMaterial({
      color: 0xd69b43,
      metalness: 0.65,
      roughness: 0.25,
    });

    for (let i = 0; i < 3; i++) {
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.32, 0.32),
        i === 1 ? matLime : toolMat,
      );

      cube.position.set((i - 1) * 2.15, Math.sin(i * 2) * 0.65, 0.2);

      toolGroup.add(cube);
    }

    function resize() {
      const w = host.clientWidth;
      const h = host.clientHeight;

      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      renderer.setSize(w, h);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const clock = new THREE.Clock();

    function animate() {
      const t = clock.getElapsedTime();

      group.rotation.y = Math.sin(t * 0.45) * 0.22;
      group.position.y = Math.sin(t * 0.8) * 0.12;

      toolGroup.rotation.y = t * 0.35;

      toolGroup.children.forEach((o, i) => {
        o.position.y = Math.sin(t * 1.3 + i * 2) * 0.7;
      });

      torus.rotation.z = t * 0.15;

      renderer.render(scene, camera);

      requestAnimationFrame(animate);
    }

    animate();
  } catch (err) {
    console.warn("3D scene could not start:", err);

    if (renderer) {
      renderer.dispose();
    }
  }
}

/* ==========================================================================
   CUSTOMER DASHBOARD 3D ANIMATION
   Cozy, welcoming 3D Home & Service Hub (Cream, Emerald Green, Warm Orange)
   ========================================================================== */

let customerThreeAnimate = null;

function setupCustomerThree() {
  const host = $("customer-three-hero");
  if (!host || !window.WebGLRenderingContext) return;

  let renderer;

  try {
    const scene = new THREE.Scene();
    const w = host.clientWidth || 320;
    const h = host.clientHeight || 250;

    const camera = new THREE.PerspectiveCamera(36, w / h, 0.1, 100);
    camera.position.set(3.8, 3.1, 5.6);
    camera.lookAt(0, 0.4, 0);

    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    host.appendChild(renderer.domElement);

    // Warm, welcoming lighting
    const ambientLight = new THREE.AmbientLight(0xfff8ee, 2.0);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffedd5, 2.2);
    sunLight.position.set(5, 7, 4);
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0xdcfce7, 0.9);
    fillLight.position.set(-4, -2, -3);
    scene.add(fillLight);

    // House Root Group
    const houseGroup = new THREE.Group();
    scene.add(houseGroup);

    // Materials
    const matCream = new THREE.MeshStandardMaterial({
      color: 0xfdfbf7,
      roughness: 0.45,
      metalness: 0.05,
    });

    const matRoof = new THREE.MeshStandardMaterial({
      color: 0x247a52,
      roughness: 0.3,
      metalness: 0.12,
    });

    const matOrange = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      roughness: 0.4,
      metalness: 0.08,
    });

    const matWindow = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.5,
      roughness: 0.2,
    });

    const matLawn = new THREE.MeshStandardMaterial({
      color: 0xe5efe3,
      roughness: 0.7,
    });

    const matTreeLeaves = new THREE.MeshStandardMaterial({
      color: 0x1e6b47,
      roughness: 0.4,
    });

    const matWood = new THREE.MeshStandardMaterial({
      color: 0x854d0e,
      roughness: 0.7,
    });

    // 1. Garden Pedestal Base (Lawn)
    const lawn = new THREE.Mesh(
      new THREE.CylinderGeometry(2.35, 2.45, 0.2, 32),
      matLawn,
    );
    lawn.position.set(0, -0.7, 0);
    houseGroup.add(lawn);

    // Cobblestone walkway
    const walkway = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.02, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xd3e0d2, roughness: 0.8 }),
    );
    walkway.position.set(0.2, -0.59, 1.1);
    houseGroup.add(walkway);

    // 2. House Body (Warm Cream)
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 1.2, 1.45),
      matCream,
    );
    body.position.set(0, 0, 0);
    houseGroup.add(body);

    // 3. Gable Roof (Emerald Green)
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 0.88, 4),
      matRoof,
    );
    roof.position.set(0, 1.04, 0);
    roof.rotation.y = Math.PI / 4;
    houseGroup.add(roof);

    // 4. Front Door (Warm Orange)
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.68, 0.06),
      matOrange,
    );
    door.position.set(0.2, -0.26, 0.74);
    houseGroup.add(door);

    // Golden Door Knob
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 }),
    );
    knob.position.set(0.33, -0.26, 0.78);
    houseGroup.add(knob);

    // 5. Windows (Glowing Warm Amber)
    const winFront = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.34, 0.04),
      matWindow,
    );
    winFront.position.set(-0.46, 0.16, 0.74);
    houseGroup.add(winFront);

    const winSide = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.34, 0.34),
      matWindow,
    );
    winSide.position.set(0.84, 0.16, 0);
    houseGroup.add(winSide);

    // 6. Chimney (Warm Orange)
    const chimney = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.58, 0.25),
      matOrange,
    );
    chimney.position.set(0.5, 1.18, -0.2);
    houseGroup.add(chimney);

    // 7. Chimney Smoke Puffs (translucent rising bubbles)
    const smokeGroup = new THREE.Group();
    houseGroup.add(smokeGroup);
    const smokeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
      roughness: 0.9,
    });
    const smokePuffs = [];
    for (let i = 0; i < 3; i++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.08 + i * 0.02, 8, 8),
        smokeMat,
      );
      puff.position.set(0.5, 1.5 + i * 0.2, -0.2);
      smokeGroup.add(puff);
      smokePuffs.push(puff);
    }

    // 8. Garden Tree (Wood trunk + lush emerald foliage)
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 0.55, 8),
      matWood,
    );
    trunk.position.set(-1.35, -0.36, 0.6);
    houseGroup.add(trunk);

    const foliage = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 12, 12),
      matTreeLeaves,
    );
    foliage.position.set(-1.35, 0.08, 0.6);
    houseGroup.add(foliage);

    // 9. Orbiting Service Icons / Orbs
    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);

    // Blue Orb (Plumbing)
    const plumbingOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2, metalness: 0.3 }),
    );
    plumbingOrb.position.set(2.2, 0.3, 0);
    orbitGroup.add(plumbingOrb);

    // Gold Spark (Electrical)
    const electricalOrb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.14, 0),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.5,
        roughness: 0.2,
      }),
    );
    electricalOrb.position.set(-2.0, 0.7, 0.8);
    orbitGroup.add(electricalOrb);

    // Warm Orange Tool Cube (Carpentry / Craft)
    const toolCube = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.2, 0.2),
      matOrange,
    );
    toolCube.position.set(0.4, 0.2, -2.1);
    orbitGroup.add(toolCube);

    function resize() {
      const currentW = host.clientWidth || 320;
      const currentH = host.clientHeight || 250;
      camera.aspect = currentW / currentH;
      camera.updateProjectionMatrix();
      renderer.setSize(currentW, currentH);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const clock = new THREE.Clock();
    let isRunning = false;

    function animate() {
      const customerView = $("customer-view");
      if (!customerView || customerView.classList.contains("hidden") || document.hidden) {
        isRunning = false;
        return;
      }

      isRunning = true;
      requestAnimationFrame(animate);

      const t = clock.getElapsedTime();

      // Gentle floating house sway
      houseGroup.rotation.y = Math.sin(t * 0.3) * 0.25;
      houseGroup.position.y = Math.sin(t * 0.8) * 0.06;

      // Orbiting service items
      orbitGroup.rotation.y = t * 0.45;
      electricalOrb.rotation.x = t;
      electricalOrb.rotation.y = t * 1.5;
      toolCube.rotation.x = t * 0.8;
      toolCube.rotation.z = t * 0.5;

      // Animated chimney smoke puffs
      smokePuffs.forEach((puff, idx) => {
        puff.position.y = 1.45 + ((t * 0.4 + idx * 0.35) % 0.8);
        const progress = ((t * 0.4 + idx * 0.35) % 0.8) / 0.8;
        puff.scale.setScalar(1 + progress * 0.8);
      });

      renderer.render(scene, camera);
    }

    customerThreeAnimate = () => {
      resize();
      if (!isRunning) {
        clock.start();
        animate();
      }
    };

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && $("customer-view") && !$("customer-view").classList.contains("hidden")) {
        customerThreeAnimate();
      }
    });

  } catch (err) {
    console.warn("Could not start Customer 3D canvas:", err.message);
    if (renderer) renderer.dispose();
  }
}

/* =========================
   INITIALISE
========================= */

async function initialise() {
  try {
    const csrf = await fetch("/api/auth/csrf", {
      credentials: "same-origin",
    });

    const csrfData = await csrf.json();

    csrfToken = csrfData.csrfToken;

    // Check whether the user opened a password reset link
    pendingResetToken =
      new URLSearchParams(window.location.search).get("resetToken") || "";

    // Set the starting page in browser history.
    window.history.replaceState(
      { localworkView: "home-view" },
      document.title,
      window.location.pathname,
    );
    if (pendingResetToken) {
      // Remove the token from the browser address bar
      window.history.replaceState(
        { localworkView: "reset-password-view" },
        document.title,
        window.location.pathname,
      );

      show("reset-password-view");
      return;
    }

    try {
      const me = await api("/api/auth/me");
      currentUser = me.user;
    } catch {
      currentUser = null;
    }

    await routeUser();
  } catch (e) {
    toast(
      "Could not connect to the LocalWork server. Start it with npm start.",
    );
    show("home-view");
  }
}
// Load the logged-in user's account profile
async function loadAccountProfile() {
  if (!currentUser) {
    openAuth("login");
    return;
  }

  try {
    const result = await api("/api/profile/me");

    currentUser = result.user;

    $("account-name").value = currentUser.name || "";
    $("account-email").value = currentUser.email || "";
    $("account-phone").value = currentUser.phone || "";
    $("account-location").value = currentUser.location || "";
    $("account-role").value =
      currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);

    $("account-profile-error").classList.add("hidden");

    show("account-view");
  } catch (error) {
    toast(error.message);
  }
}

// Save updated account profile
async function saveAccountProfile(event) {
  event.preventDefault();

  const errorBox = $("account-profile-error");
  errorBox.classList.add("hidden");

  try {
    const result = await api("/api/profile/me", {
      method: "PUT",
      body: {
        name: $("account-name").value,
        phone: $("account-phone").value,
        location: $("account-location").value,
      },
    });

    currentUser = result.user;

    toast("Profile updated successfully!");

    await loadAccountProfile();
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.classList.remove("hidden");
  }
}
/* =========================
   EVENT LISTENERS
========================= */

function bind() {
  $("login-nav").addEventListener("click", () => {
    openAuth("login");
  });

  $("logout-nav").addEventListener("click", logout);

  // Open My Profile
  document.querySelectorAll('[data-nav-action="profile"]').forEach((button) => {
    button.addEventListener("click", () => {
      loadAccountProfile();
    });
  });
  // Become a Workman / Workman Dashboard
  $("customer-workman-action").addEventListener("click", () => {
    openApplication();
  });

  // Return to Customer Dashboard
  $("workman-customer-action").addEventListener("click", async () => {
    activeDashboard = "customer";

    try {
      await routeUser();
    } catch (e) {
      toast(e.message);
    }
  });

  // Registration buttons
  document.querySelectorAll("[data-register]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.register === "workman") {
        openApplication();
      } else {
        openAuth("register");
      }
    });
  });

  // Home buttons
  document.querySelectorAll("[data-home]").forEach((button) => {
    button.addEventListener("click", () => {
      show("home-view");
    });
  });
  // Dashboard sidebar navigation
  document.querySelectorAll("[data-nav-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      const view = button.dataset.navView;

      try {
        if (view === "home-view") {
          show("home-view");
        } else if (view === "customer-view") {
          activeDashboard = "customer";
          await routeUser();
        } else if (view === "workman-view") {
          if (currentUser?.applicationStatus !== "Approved") {
            toast("Your workman application must be approved first.");
            return;
          }

          activeDashboard = "workman";
          await routeUser();
        } else if (view === "admin-view") {
          if (currentUser?.role !== "admin") {
            toast("Access denied.");
            return;
          }

          show("admin-view");
          await loadAdmin();
        } else if (view === "application-view") {
          openApplication();
        }
      } catch (error) {
        toast(error.message);
      }
    });
  });

  // Sidebar logout
  const sidebarLogout = $("sidebar-logout");

  if (sidebarLogout) {
    sidebarLogout.addEventListener("click", logout);
  }

  // Register and login tabs
  $("register-tab").addEventListener("click", () => {
    setAuth("register");
  });

  $("login-tab").addEventListener("click", () => {
    setAuth("login");
  });
  $("forgot-password-btn").addEventListener("click", openForgotPassword);

  $("forgot-back").addEventListener("click", () => {
    setAuth("login");
    show("auth-view");
  });

  // Forgot password form
  $("forgot-password-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    $("forgot-message").classList.add("hidden");
    $("forgot-error").classList.add("hidden");

    try {
      const result = await api("/api/auth/forgot-password", {
        method: "POST",
        body: {
          email: $("forgot-email").value.trim(),
        },
      });

      $("forgot-message").textContent = result.message;
      $("forgot-message").classList.remove("hidden");
    } catch (err) {
      $("forgot-error").textContent = err.message;
      $("forgot-error").classList.remove("hidden");
    }
  });

  // Reset password form
  $("reset-password-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    $("reset-message").classList.add("hidden");
    $("reset-error").classList.add("hidden");

    try {
      const password = $("reset-new-password").value;
      const confirmPassword = $("reset-confirm-password").value;

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      const token = pendingResetToken;

      if (!token) {
        throw new Error("Reset link is missing. Please request a new one.");
      }

      const result = await api("/api/auth/reset-password", {
        method: "POST",
        body: {
          token,
          password,
        },
      });

      $("reset-message").textContent = result.message;
      pendingResetToken = "";
      $("reset-message").classList.remove("hidden");

      $("reset-password-form").reset();

      window.history.replaceState({}, document.title, window.location.pathname);

      setTimeout(() => {
        setAuth("login");
        show("auth-view");
      }, 2000);
    } catch (err) {
      $("reset-error").textContent = err.message;
      $("reset-error").classList.remove("hidden");
    }
  });

  // Authentication form
  $("auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    $("auth-error").classList.add("hidden");

    try {
      let result;

      if (authMode === "register") {
        if ($("password").value !== $("confirm-password").value) {
          throw new Error("Passwords do not match.");
        }

        result = await api("/api/auth/register", {
          method: "POST",
          body: {
            name: $("name").value,
            email: $("email").value,
            phone: $("phone").value,
            location: $("location").value,
            password: $("password").value,
          },
        });
      } else {
        result = await api("/api/auth/login", {
          method: "POST",
          body: {
            email: $("login-email").value,
            password: $("password").value,
          },
        });
      }

      currentUser = result.user;

      activeDashboard = "customer";

      toast("Welcome to LocalWork!");

      await routeUser();
    } catch (err) {
      $("auth-error").textContent = err.message;
      $("auth-error").classList.remove("hidden");
    }
  });

  // Quick-Filter Category Cards for Customer Dashboard
  document.querySelectorAll(".customer-category-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const category = btn.dataset.category || "";
      const serviceInput = $("filter-service");

      if (serviceInput.value.toLowerCase() === category.toLowerCase()) {
        serviceInput.value = "";
        btn.classList.remove("active");
      } else {
        serviceInput.value = category;
        document
          .querySelectorAll(".customer-category-card")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      }

      loadWorkmen().catch((e) => toast(e.message));
    });
  });

  // Search workmen
  $("search-workmen").addEventListener("click", () => {
    loadWorkmen().catch((e) => toast(e.message));
  });

  $("filter-service").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      loadWorkmen().catch((e) => toast(e.message));
    }
  });

  $("filter-location").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      loadWorkmen().catch((e) => toast(e.message));
    }
  });

  // Workman application form
  $("profile-form").addEventListener("submit", saveProfile);

  // My Account Profile form
  $("account-profile-form").addEventListener("submit", saveAccountProfile);
  // Booking form
  $("booking-form").addEventListener("submit", saveBooking);

  $("booking-close").addEventListener("click", () => {
    $("booking-modal").classList.add("hidden");
  });

  $("booking-modal").addEventListener("click", (event) => {
    if (event.target.id === "booking-modal") {
      $("booking-modal").classList.add("hidden");
    }
  });

  // Return from profile page
  $("profile-back").addEventListener("click", () => {
    show(previousView);
  });

  // Close booking modal using Escape
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      $("booking-modal").classList.add("hidden");
    }
  });
}

/* =========================
   START APPLICATION
========================= */

async function start() {
  renderCategories();
  bind();
  setupThree();
  setupCustomerThree();

  await initialise();
}

start();
