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
  ["❄️", "AC Repair"],
  ["📺", "Appliance Repair"],
  ["🌿", "Gardening"],
  ["🐜", "Pest Control"],
  ["⚙️", "Welding"],
  ["🏗️", "Masonry & Tiling"],
  ["💧", "Waterproofing"],
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
    throw new Error(data.error || data.message || "Something went wrong.");
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

  if (view === "workman-view" && typeof workmanThreeAnimate === "function") {
    setTimeout(() => workmanThreeAnimate(), 50);
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
      if (currentUser) {
        await loadCustomerBookings();
      }
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

  const googleText = $("google-btn-text");
  if (googleText) {
    googleText.textContent = mode === "login" ? "Sign in with Google" : "Sign up with Google";
  }

  if (googleScriptLoaded) {
    renderGoogleButton();
  }

  $("auth-error").classList.add("hidden");
}

let googleClientId = "";
let googleScriptLoaded = false;
let googleInitialized = false;

async function initGoogleAuth() {
  try {
    const config = await api("/api/auth/config").catch(() => ({}));
    googleClientId = (config.googleClientId || "").trim();

    const customBtn = $("google-custom-btn");
    const signinBtnContainer = $("google-signin-btn");

    if (!googleClientId) {
      if (customBtn) {
        customBtn.classList.remove("hidden");
        customBtn.onclick = () => {
          const gm = $("google-modal");
          if (gm) gm.classList.remove("hidden");
          else toast("Google Sign-In: Add GOOGLE_CLIENT_ID to Render environment variables.");
        };
      }
      if (signinBtnContainer) signinBtnContainer.classList.add("hidden");
      return;
    }

    if (!googleScriptLoaded) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        googleScriptLoaded = true;
        renderGoogleButton();
      };
      document.head.appendChild(script);
    } else {
      renderGoogleButton();
    }
  } catch (err) {
    console.error("Failed to initialize Google Auth:", err);
  }
}

function renderGoogleButton() {
  if (!window.google || !window.google.accounts || !window.google.accounts.id || !googleClientId) {
    return;
  }

  const signinBtnContainer = $("google-signin-btn");
  const customBtn = $("google-custom-btn");

  if (!signinBtnContainer) return;

  try {
    if (!googleInitialized) {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredentialResponse,
        auto_select: false
      });
      googleInitialized = true;
    }

    signinBtnContainer.innerHTML = "";
    window.google.accounts.id.renderButton(signinBtnContainer, {
      theme: "outline",
      size: "large",
      type: "standard",
      text: authMode === "login" ? "signin_with" : "signup_with",
      shape: "rectangular",
      logo_alignment: "left",
      width: 280
    });

    signinBtnContainer.classList.remove("hidden");
    if (customBtn) customBtn.classList.add("hidden");
  } catch (e) {
    console.error("Error rendering Google button:", e);
  }
}

async function handleGoogleCredentialResponse(response) {
  if (!response || !response.credential) {
    toast("Google sign-in was cancelled.");
    return;
  }

  $("auth-error").classList.add("hidden");

  try {
    const result = await api("/api/auth/google", {
      method: "POST",
      body: {
        credential: response.credential
      }
    });

    currentUser = result.user;
    activeDashboard = "customer";
    toast(`Welcome to LocalWork, ${currentUser.name || "Customer"}!`);
    await routeUser();
  } catch (err) {
    $("auth-error").textContent = err.message;
    $("auth-error").classList.remove("hidden");
  }
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
        <div class="workman-card-top-row">
          <p class="eyebrow">${esc(w.service)}</p>
          <span class="workman-avail-pill ${w.availability === 'Available' ? 'status-avail' : 'status-busy'}">
            ● ${esc(w.availability || 'Available')}
          </span>
        </div>

        <h3>${esc(w.name)}</h3>

        <div class="workman-rating-strip">
          <span class="workman-rating-stars">★ ${Number(w.rating || 4.8).toFixed(1)}</span>
          <span class="workman-review-count">(${Number(w.reviewCount || 0)} ${Number(w.reviewCount) === 1 ? 'review' : 'reviews'})</span>
        </div>

        <p>${esc(w.description || "Local service professional.")}</p>

        <div class="meta">
          📍 ${esc(w.location)} · 💼 ${Number(w.experience) || 0} years' experience
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
  const [{ workman: w }, { reviews = [] } = {}] = await Promise.all([
    api(`/api/workmen/${id}`),
    api(`/api/reviews/workman/${id}`).catch(() => ({ reviews: [] }))
  ]);

  previousView = "customer-view";

  const reviewsHtml = reviews.length
    ? reviews.map((r) => `
        <div class="profile-review-card">
          <div class="review-card-top">
            <strong>${esc(r.customer_name)}</strong>
            <span class="review-stars-badge">★ ${r.rating}/5</span>
          </div>
          <p class="review-text">"${esc(r.review_text || 'Great service and professional conduct!')}"</p>
          <small class="review-date">Verified Customer · ${new Date(r.created_at).toLocaleDateString()}</small>
        </div>
      `).join("")
    : `<div class="empty">No written reviews yet. Be the first customer to book and rate ${esc(w.name)}!</div>`;

  $("profile-detail").innerHTML = `
    <article class="profile-detail">
      <div class="workman-card-top-row">
        <p class="eyebrow">${esc(w.service)}</p>
        <span class="workman-avail-pill ${w.availability === 'Available' ? 'status-avail' : 'status-busy'}">
          ● ${esc(w.availability || 'Available')}
        </span>
      </div>

      <h1>${esc(w.name)}</h1>

      <div class="workman-rating-strip" style="margin-bottom: 16px;">
        <span class="workman-rating-stars" style="font-size: 1.05rem;">★ ${Number(w.rating || 4.8).toFixed(1)}</span>
        <span class="workman-review-count" style="font-size: 0.9rem;">(${Number(w.reviewCount || 0)} customer ${Number(w.reviewCount) === 1 ? 'review' : 'reviews'})</span>
      </div>

      <p>${esc(w.description)}</p>

      <p>
        <b>Area:</b> ${esc(w.location)}
        &nbsp;
        <b>Experience:</b> ${Number(w.experience) || 0} years
      </p>

      <button class="btn btn-primary" id="profile-book" style="margin-bottom: 28px;">
        Request a booking
      </button>

      <div class="profile-reviews-wrapper">
        <h3 style="margin: 0 0 14px; font: 800 1.2rem Manrope, sans-serif;">Customer Reviews & Ratings</h3>
        <div class="profile-reviews-list">
          ${reviewsHtml}
        </div>
      </div>
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
  if (!currentUser) {
    const container = $("customer-bookings");
    if (container) container.innerHTML = "";
    return;
  }

  const { bookings } = await api("/api/bookings/mine");

  $("customer-bookings").innerHTML = bookings.length
    ? bookings
        .map((b) => {
          const statusLower = (b.status || "").toLowerCase();
          return `
      <div class="booking-item customer-booking-card booking-status-${statusLower}">
        <div class="customer-booking-header">
          <div>
            <h4 class="customer-booking-title">${esc(b.workman_name)} <span class="service-pill">(${esc(b.workman_service)})</span></h4>
            <div class="customer-booking-time">📅 ${esc(b.booking_date)} at ${esc(b.booking_time)}</div>
          </div>
          <span class="job-status-pill status-${statusLower}">
            ${esc(b.status)}
          </span>
        </div>

        <div class="customer-booking-address">
          <span>📍 ${esc(b.address)}</span>
        </div>

        ${b.notes ? `<div class="customer-booking-notes"><strong>Note:</strong> ${esc(b.notes)}</div>` : ""}

        ${
          b.customer_rating
            ? `
          <div class="customer-reviewed-box">
            <span class="star-pill">★ ${b.customer_rating}/5 Rated</span>
            ${b.customer_review ? `<span class="review-quote">"${esc(b.customer_review)}"</span>` : ""}
          </div>
        `
            : ""
        }

        <div class="customer-booking-actions">
          <button class="btn btn-light customer-chat-btn"
            data-chat-id="${b.id}"
            data-partner-name="${esc(b.workman_name)}"
            data-service="${esc(b.workman_service)}"
            data-datetime="${esc(b.booking_date)} at ${esc(b.booking_time)}"
            data-location="${esc(b.address)}"
            data-status="${esc(b.status)}">
            💬 Chat ${Number(b.message_count) > 0 ? `<span class="chat-count-pill">${b.message_count}</span>` : ""}
          </button>

          ${
            b.status === "Pending"
              ? `
            <button class="btn btn-light customer-cancel-btn" data-cancel-id="${b.id}">
              ✕ Cancel Request
            </button>
          `
              : ""
          }

          ${
            b.status === "Completed" && !b.customer_rating
              ? `
            <button class="btn btn-primary customer-rate-btn" data-rate-booking-id="${b.id}" data-workman-name="${esc(b.workman_name)}">
              ⭐ Rate Workman
            </button>
          `
              : ""
          }
        </div>
      </div>
    `;
        })
        .join("")
    : `<div class="empty">You have not sent any booking requests yet. Browse workmen and schedule your first service!</div>`;

  // Bind cancel buttons
  $("customer-bookings").querySelectorAll("[data-cancel-id]").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("Are you sure you want to cancel this booking request?")) return;
      try {
        await api(`/api/bookings/${btn.dataset.cancelId}/status`, {
          method: "PATCH",
          body: { status: "Cancelled" }
        });
        toast("Booking request has been cancelled.");
        await loadCustomerBookings();
      } catch (err) {
        toast(err.message);
      }
    };
  });

  // Bind rate buttons
  $("customer-bookings").querySelectorAll("[data-rate-booking-id]").forEach((btn) => {
    btn.onclick = () => {
      if (typeof window.openReviewModal === "function") {
        window.openReviewModal(Number(btn.dataset.rateBookingId), btn.dataset.workmanName);
      }
    };
  });

  // Bind chat buttons
  $("customer-bookings").querySelectorAll(".customer-chat-btn").forEach((btn) => {
    btn.onclick = () => {
      if (typeof window.openBookingChat === "function") {
        window.openBookingChat(Number(btn.dataset.chatId), btn.dataset.partnerName, {
          service: btn.dataset.service,
          datetime: btn.dataset.datetime,
          location: btn.dataset.location,
          status: btn.dataset.status
        });
      }
    };
  });
}

/* =========================
   WORKMAN BOOKINGS
========================= */

async function loadWorkmanBookings() {
  const { bookings } = await api("/api/bookings/workman");

  // Populate Workman Profile Strip & Greeting
  if (currentUser) {
    const greetingEl = $("workman-greeting");
    if (greetingEl) {
      greetingEl.textContent = `Welcome back, ${currentUser.name.split(" ")[0]}!`;
    }
    if ($("workman-trade-name")) {
      $("workman-trade-name").textContent = currentUser.service || "Tradesperson";
    }
    if ($("workman-trade-location")) {
      $("workman-trade-location").textContent = currentUser.location || "Nearby";
    }
    if ($("workman-trade-experience")) {
      $("workman-trade-experience").textContent = `${Number(currentUser.experience) || 0} Years`;
    }
    if ($("workman-trade-availability")) {
      $("workman-trade-availability").textContent = currentUser.availability || "Available";
    }

    // Wire up Availability Toggle Button
    const availBtn = $("workman-avail-toggle-btn");
    const availText = $("workman-trade-availability");
    if (availBtn) {
      const isAvail = (currentUser.availability || "Available") === "Available";
      availBtn.className = `workman-avail-toggle-btn ${isAvail ? "status-online" : "status-offline"}`;
      if (availText) availText.textContent = isAvail ? "Available" : "Busy";

      availBtn.onclick = async () => {
        const nextStatus = isAvail ? "Busy" : "Available";
        try {
          await api("/api/workmen/me/availability", {
            method: "PATCH",
            body: { availability: nextStatus }
          });
          currentUser.availability = nextStatus;
          toast(`Status updated: You are now ${nextStatus}!`);
          await loadWorkmanBookings();
        } catch (err) {
          toast(err.message);
        }
      };
    }
  }

  // Calculate Real-Time Booking Statistics
  const total = bookings.length;
  const pending = bookings.filter((b) => b.status === "Pending").length;
  const active = bookings.filter((b) => b.status === "Accepted").length;
  const completed = bookings.filter((b) => b.status === "Completed").length;

  if ($("workman-stat-total")) $("workman-stat-total").textContent = total;
  if ($("workman-stat-pending")) $("workman-stat-pending").textContent = pending;
  if ($("workman-stat-active")) $("workman-stat-active").textContent = active;
  if ($("workman-stat-completed")) $("workman-stat-completed").textContent = completed;

  // Render Modern Job Cards
  $("workman-bookings").innerHTML = bookings.length
    ? bookings
        .map(
          (b) => `
      <div class="workman-job-card workman-job-${(b.status || "").toLowerCase()}">
        <div class="job-card-header">
          <div>
            <h3 class="job-customer-name">${esc(b.customer_name)}</h3>
            <span class="job-date">📅 ${esc(b.booking_date)} at ${esc(b.booking_time)}</span>
          </div>
          <span class="job-status-pill status-${(b.status || "").toLowerCase()}">
            ${esc(b.status)}
          </span>
        </div>

        <div class="job-card-details">
          <div class="job-detail-row">
            <span class="detail-icon">📍</span>
            <span>${esc(b.address)}</span>
          </div>
          <div class="job-detail-row">
            <span class="detail-icon">📞</span>
            <a href="tel:${esc(b.phone)}" class="job-phone-link">${esc(b.phone)}</a>
          </div>
          ${
            b.notes
              ? `<div class="job-notes-box">
                  <strong>Customer Note:</strong> ${esc(b.notes)}
                </div>`
              : ""
          }
          ${
            b.review_rating
              ? `<div class="customer-reviewed-box" style="margin-top: 8px;">
                  <span class="star-pill">★ ${b.review_rating}/5 Rated by Customer</span>
                  ${b.review_comment ? `<span class="review-quote">"${esc(b.review_comment)}"</span>` : ""}
                </div>`
              : ""
          }
        </div>

        <div class="job-card-actions">
          <button
            class="btn btn-light workman-chat-btn"
            data-chat-id="${b.id}"
            data-partner-name="${esc(b.customer_name)}"
            data-service="${esc(currentUser?.service || 'Service')}"
            data-datetime="${esc(b.booking_date)} at ${esc(b.booking_time)}"
            data-location="${esc(b.address)}"
            data-status="${esc(b.status)}">
            💬 Chat with Customer ${Number(b.message_count) > 0 ? `<span class="chat-count-pill">${b.message_count}</span>` : ""}
          </button>

          ${
            b.status === "Pending"
              ? `
            <button
              class="btn btn-workman-accept"
              data-status="Accepted"
              data-id="${b.id}">
              ✓ Accept Request
            </button>
            <button
              class="btn btn-workman-decline"
              data-status="Declined"
              data-id="${b.id}">
              ✕ Decline
            </button>
          `
              : b.status === "Accepted"
              ? `
            <button
              class="btn btn-workman-complete"
              data-status="Completed"
              data-id="${b.id}">
              ★ Mark as Completed
            </button>
          `
              : ""
          }
        </div>
      </div>
    `,
        )
        .join("")
    : `<div class="workman-empty-jobs">
        <div class="empty-icon">🧰</div>
        <h3>No booking requests yet</h3>
        <p>When customers in your area request your trade skills, their job requests will appear here with contact details.</p>
       </div>`;

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

          toast(`Booking marked as ${button.dataset.status}.`);
          await loadWorkmanBookings();
        } catch (e) {
          toast(e.message);
        }
      });
    });

  // Bind workman chat buttons
  $("workman-bookings").querySelectorAll(".workman-chat-btn").forEach((btn) => {
    btn.onclick = () => {
      if (typeof window.openBookingChat === "function") {
        window.openBookingChat(Number(btn.dataset.chatId), btn.dataset.partnerName, {
          service: btn.dataset.service,
          datetime: btn.dataset.datetime,
          location: btn.dataset.location,
          status: btn.dataset.status
        });
      }
    };
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

  const metricMeta = {
    users: { label: "Total Accounts", icon: "👥" },
    customers: { label: "Active Customers", icon: "🏡" },
    workmen: { label: "Approved Workmen", icon: "⚡" },
    bookings: { label: "Platform Bookings", icon: "📋" },
    pending: { label: "Pending Bookings", icon: "⏳" },
    pendingApplications: { label: "Pending Approvals", icon: "🛡️" },
  };

  // Statistics
  $("admin-stats").innerHTML = Object.entries(counts)
    .map(
      ([key, value]) => {
        const meta = metricMeta[key] || { label: key };
        return `
        <div class="admin-stat">
          <b>${Number(value) || 0}</b>
          <span>${esc(meta.label)}</span>
        </div>
      `;
      }
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
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "X-CSRF-Token": csrfToken,
        "Content-Type": "application/json"
      }
    });
  } catch (e) {
    console.warn("Logout request:", e);
  }

  currentUser = null;
  activeDashboard = "customer";
  csrfToken = "";

  show("home-view");
  toast("You have logged out.");

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
   Interactive 3D Home Repair & Service Hub
   Features: Multi-Trade Tools (Electric Bulb, Plumber Wrench, Painter Roller,
             AC Cooling Turbine, Garden Pot, and Service Station)
   Theme: Emerald Green, Warm Amber Gold, Polished Chrome, Fresh Mint
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
    camera.position.set(3.4, 2.9, 5.2);
    camera.lookAt(0, 0.25, 0);

    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    host.appendChild(renderer.domElement);

    // Warm, welcoming multi-directional studio lighting
    const ambientLight = new THREE.AmbientLight(0xfff8ee, 1.8);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffedd5, 2.2);
    sunLight.position.set(5, 7, 4);
    scene.add(sunLight);

    const emeraldFill = new THREE.DirectionalLight(0xdcfce7, 1.2);
    emeraldFill.position.set(-4, -2, -3);
    scene.add(emeraldFill);

    const topLight = new THREE.DirectionalLight(0xffffff, 1.4);
    topLight.position.set(0, 6, 2);
    scene.add(topLight);

    // Root Group
    const serviceRoot = new THREE.Group();
    scene.add(serviceRoot);

    // Materials Palette
    const matEmerald = new THREE.MeshStandardMaterial({
      color: 0x1d754b,
      metalness: 0.25,
      roughness: 0.35,
    });

    const matDarkEmerald = new THREE.MeshStandardMaterial({
      color: 0x103d27,
      metalness: 0.3,
      roughness: 0.4,
    });

    const matGold = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.85,
      roughness: 0.2,
    });

    const matChrome = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.95,
      roughness: 0.12,
    });

    const matBlueGrip = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.2,
      roughness: 0.45,
    });

    const matBulbGlass = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.65,
      roughness: 0.15,
      transparent: true,
      opacity: 0.9,
    });

    const matWaterDrop = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
    });

    const matPaintRoller = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.65,
      metalness: 0.1,
    });

    const matTerracotta = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      roughness: 0.75,
      metalness: 0.05,
    });

    const matPlantLeaf = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      roughness: 0.45,
      metalness: 0.1,
    });

    const matTurbine = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      metalness: 0.7,
      roughness: 0.2,
    });

    const matBase = new THREE.MeshStandardMaterial({
      color: 0xedf6eb,
      roughness: 0.6,
      metalness: 0.05,
    });

    // 1. Two-Tier Service Pedestal Base
    const basePedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(2.25, 2.4, 0.18, 36),
      matBase
    );
    basePedestal.position.set(0, -0.65, 0);
    serviceRoot.add(basePedestal);

    const goldRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.3, 0.035, 10, 36),
      matGold
    );
    goldRing.rotation.x = Math.PI / 2;
    goldRing.position.set(0, -0.56, 0);
    serviceRoot.add(goldRing);

    const innerInlay = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.45, 0.08, 32),
      matDarkEmerald
    );
    innerInlay.position.set(0, -0.52, 0);
    serviceRoot.add(innerInlay);

    // 2. Central Service Repair Station Caddy
    const stationGroup = new THREE.Group();
    serviceRoot.add(stationGroup);

    const stationBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.75, 0.85),
      matEmerald
    );
    stationBox.position.set(0, -0.12, 0);
    stationGroup.add(stationBox);

    // Chrome handle bar on top of station
    const handleBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.95, 12),
      matChrome
    );
    handleBar.rotation.z = Math.PI / 2;
    handleBar.position.set(0, 0.42, 0);
    stationGroup.add(handleBar);

    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 10), matChrome);
    postL.position.set(-0.42, 0.32, 0);
    stationGroup.add(postL);

    const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 10), matChrome);
    postR.position.set(0.42, 0.32, 0);
    stationGroup.add(postR);

    // Golden Front Emblem Badge
    const emblem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.05, 24),
      matGold
    );
    emblem.rotation.x = Math.PI / 2;
    emblem.position.set(0, -0.12, 0.45);
    stationGroup.add(emblem);

    const emblemStar = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.12, 0),
      matChrome
    );
    emblemStar.position.set(0, -0.12, 0.48);
    stationGroup.add(emblemStar);

    // 3. Trade Object A: ⚡ Electrician (Floating Glowing Bulb & Spark)
    const bulbGroup = new THREE.Group();
    const bulbGlass = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), matBulbGlass);
    bulbGlass.position.set(0, 0.24, 0);
    bulbGroup.add(bulbGlass);

    const bulbBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.18, 14), matGold);
    bulbBase.position.set(0, -0.04, 0);
    bulbGroup.add(bulbBase);

    const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), matGold);
    spark.position.set(0, 0.6, 0);
    bulbGroup.add(spark);

    bulbGroup.position.set(-1.3, 0.45, 0.4);
    bulbGroup.rotation.z = 0.2;
    serviceRoot.add(bulbGroup);

    // 4. Trade Object B: 🔧 Plumber & Mechanic (Adjustable Wrench & Water Droplet)
    const wrenchGroup = new THREE.Group();
    const wrenchShaft = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.95, 0.06), matBlueGrip);
    wrenchGroup.add(wrenchShaft);

    const wrenchHead = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.12), matChrome);
    wrenchHead.position.set(0, 0.52, 0);
    wrenchGroup.add(wrenchHead);

    const wrenchJaw = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.12), matChrome);
    wrenchJaw.position.set(0.12, 0.65, 0);
    wrenchGroup.add(wrenchJaw);

    const droplet = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 14), matWaterDrop);
    droplet.scale.set(1, 1.4, 1);
    droplet.position.set(0.32, 0.25, 0.2);
    wrenchGroup.add(droplet);

    wrenchGroup.position.set(1.35, 0.4, 0.35);
    wrenchGroup.rotation.z = -0.3;
    wrenchGroup.rotation.x = 0.2;
    serviceRoot.add(wrenchGroup);

    // 5. Trade Object C: 🎨 Painter (Paint Roller with Emerald Paint)
    const rollerGroup = new THREE.Group();
    const rollerCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.65, 20),
      matPaintRoller
    );
    rollerCylinder.rotation.z = Math.PI / 2;
    rollerGroup.add(rollerCylinder);

    const rollerArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.45, 0.04),
      matChrome
    );
    rollerArm.position.set(0.35, -0.22, 0);
    rollerGroup.add(rollerArm);

    const rollerHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.45, 10),
      matDarkEmerald
    );
    rollerHandle.position.set(0.35, -0.55, 0);
    rollerGroup.add(rollerHandle);

    rollerGroup.position.set(0.65, 0.95, -0.85);
    rollerGroup.rotation.x = 0.35;
    rollerGroup.rotation.y = -0.4;
    serviceRoot.add(rollerGroup);

    // 6. Trade Object D: ❄️ AC Repair (Spinning Turbine Cooling Fan)
    const turbineGroup = new THREE.Group();
    const turbineHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.08, 16),
      matChrome
    );
    turbineHub.rotation.x = Math.PI / 2;
    turbineGroup.add(turbineHub);

    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.32, 0.02), matTurbine);
      blade.rotation.z = (i * Math.PI) / 2;
      blade.position.set(
        Math.cos((i * Math.PI) / 2) * 0.18,
        Math.sin((i * Math.PI) / 2) * 0.18,
        0
      );
      blade.rotation.y = 0.3;
      turbineGroup.add(blade);
    }

    turbineGroup.position.set(-0.85, 0.95, -0.75);
    serviceRoot.add(turbineGroup);

    // 7. Trade Object E: 🪴 Gardening (Potted Terracotta Plant)
    const plantGroup = new THREE.Group();
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.16, 0.32, 16),
      matTerracotta
    );
    plantGroup.add(pot);

    const leaf1 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), matPlantLeaf);
    leaf1.scale.set(0.6, 1.2, 0.3);
    leaf1.rotation.z = 0.4;
    leaf1.position.set(0.08, 0.24, 0);
    plantGroup.add(leaf1);

    const leaf2 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), matPlantLeaf);
    leaf2.scale.set(0.6, 1.2, 0.3);
    leaf2.rotation.z = -0.4;
    leaf2.position.set(-0.08, 0.24, 0);
    plantGroup.add(leaf2);

    plantGroup.position.set(-0.7, -0.34, 1.15);
    serviceRoot.add(plantGroup);

    // 8. Ambient Service Sparkles / Orbs
    const sparklesGroup = new THREE.Group();
    serviceRoot.add(sparklesGroup);

    const sparkles = [];
    const sparkleColors = [0xf59e0b, 0x10b981, 0x38bdf8, 0xea580c];
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.06 + (i % 3) * 0.02, 0),
        new THREE.MeshStandardMaterial({
          color: sparkleColors[i % sparkleColors.length],
          emissive: sparkleColors[i % sparkleColors.length],
          emissiveIntensity: 0.5,
          roughness: 0.2
        })
      );
      sp.position.set(
        (Math.cos(i * 1.05) * 1.8),
        0.2 + (i % 3) * 0.35,
        (Math.sin(i * 1.05) * 1.8)
      );
      sparklesGroup.add(sp);
      sparkles.push(sp);
    }

    // Interactive Drag to Rotate
    let isDragging = false;
    let prevMouseX = 0;
    let targetRotationY = 0;

    host.addEventListener("mousedown", (e) => {
      isDragging = true;
      prevMouseX = e.clientX;
    });

    window.addEventListener("mouseup", () => {
      isDragging = false;
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      prevMouseX = e.clientX;
      targetRotationY += deltaX * 0.01;
    });

    // Touch support for mobile
    host.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        prevMouseX = e.touches[0].clientX;
      }
    }, { passive: true });

    window.addEventListener("touchend", () => {
      isDragging = false;
    });

    window.addEventListener("touchmove", (e) => {
      if (!isDragging || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - prevMouseX;
      prevMouseX = e.touches[0].clientX;
      targetRotationY += deltaX * 0.012;
    }, { passive: true });

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

      // Smooth rotation with user drag damping + gentle idle sway
      if (!isDragging) {
        targetRotationY += 0.004;
      }
      serviceRoot.rotation.y += (targetRotationY - serviceRoot.rotation.y) * 0.08;

      // Gentle floating bob
      serviceRoot.position.y = Math.sin(t * 0.8) * 0.05;

      // Spin AC cooling turbine
      turbineGroup.rotation.z = t * 2.8;

      // Pulse bulb filament
      matBulbGlass.emissiveIntensity = 0.5 + Math.sin(t * 3.2) * 0.25;
      bulbGroup.position.y = 0.45 + Math.sin(t * 1.6) * 0.08;
      spark.rotation.y = t * 1.5;

      // Bob wrench and droplet
      wrenchGroup.position.y = 0.4 + Math.cos(t * 1.4) * 0.07;
      droplet.position.y = 0.25 + Math.sin(t * 2.2) * 0.06;

      // Bob paint roller
      rollerGroup.position.y = 0.95 + Math.sin(t * 1.8 + 1) * 0.07;

      // Orbit sparkles
      sparkles.forEach((sp, idx) => {
        sp.rotation.x = t * (1 + idx * 0.2);
        sp.rotation.y = t * (1.2 + idx * 0.3);
        sp.position.y = 0.2 + (idx % 3) * 0.35 + Math.sin(t * 2 + idx) * 0.08;
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
/* ==========================================================================
   WORKMAN DASHBOARD 3D ANIMATION
   Heavy-Duty Contractor Toolbox with Floating Tools (Hammer, Spanner, Screwdriver)
   Theme: Charcoal, Electric Blue, Amber
   ========================================================================== */

let workmanThreeAnimate = null;

function setupWorkmanThree() {
  const host = $("workman-three-hero");
  if (!host || !window.WebGLRenderingContext) return;

  let renderer;

  try {
    const scene = new THREE.Scene();
    const w = host.clientWidth || 320;
    const h = host.clientHeight || 250;

    const camera = new THREE.PerspectiveCamera(36, w / h, 0.1, 100);
    camera.position.set(3.4, 3.2, 5.2);
    camera.lookAt(0, 0.3, 0);

    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    host.appendChild(renderer.domElement);

    // Dramatic Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const blueLight = new THREE.DirectionalLight(0x3b82f6, 2.8);
    blueLight.position.set(5, 5, 4);
    scene.add(blueLight);

    const amberLight = new THREE.DirectionalLight(0xf59e0b, 2.2);
    amberLight.position.set(-4, -2, -3);
    scene.add(amberLight);

    const topWhiteLight = new THREE.DirectionalLight(0xf8fafc, 2.0);
    topWhiteLight.position.set(0, 6, 2);
    scene.add(topWhiteLight);

    // Root Group
    const toolboxRoot = new THREE.Group();
    scene.add(toolboxRoot);

    // Materials (Charcoal, Electric Blue, Amber, Chrome, Wood)
    const matCharcoal = new THREE.MeshStandardMaterial({
      color: 0x1a212b,
      metalness: 0.65,
      roughness: 0.3,
    });

    const matBlue = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      metalness: 0.55,
      roughness: 0.25,
    });

    const matAmber = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.8,
      roughness: 0.2,
    });

    const matChrome = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.9,
      roughness: 0.15,
    });

    const matDarkMetal = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.8,
      roughness: 0.4,
    });

    const matWood = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      metalness: 0.1,
      roughness: 0.65,
    });

    // 1. Heavy-Duty Toolbox Base (Charcoal)
    const boxBody = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 1.05, 1.25),
      matCharcoal,
    );
    boxBody.position.set(0, -0.4, 0);
    toolboxRoot.add(boxBody);

    // Electric Blue Lid
    const boxLid = new THREE.Mesh(
      new THREE.BoxGeometry(2.16, 0.28, 1.3),
      matBlue,
    );
    boxLid.position.set(0, 0.2, 0);
    toolboxRoot.add(boxLid);

    // Top Handle (Sturdy Arch)
    const handleBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.08, 0.08),
      matDarkMetal,
    );
    handleBar.position.set(0, 0.5, 0);
    toolboxRoot.add(handleBar);

    const handlePostL = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.22, 0.08),
      matDarkMetal,
    );
    handlePostL.position.set(-0.42, 0.4, 0);
    toolboxRoot.add(handlePostL);

    const handlePostR = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.22, 0.08),
      matDarkMetal,
    );
    handlePostR.position.set(0.42, 0.4, 0);
    toolboxRoot.add(handlePostR);

    // Amber Heavy-Duty Metal Clasps
    const latchL = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.25, 0.06),
      matAmber,
    );
    latchL.position.set(-0.55, 0.02, 0.64);
    toolboxRoot.add(latchL);

    const latchR = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.25, 0.06),
      matAmber,
    );
    latchR.position.set(0.55, 0.02, 0.64);
    toolboxRoot.add(latchR);

    // Corner Protectors (4 Bottom corners)
    const cornerOffsets = [
      [-1.04, -0.88, 0.61],
      [1.04, -0.88, 0.61],
      [-1.04, -0.88, -0.61],
      [1.04, -0.88, -0.61],
    ];
    cornerOffsets.forEach(([cx, cy, cz]) => {
      const corner = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.16, 0.14),
        matDarkMetal,
      );
      corner.position.set(cx, cy, cz);
      toolboxRoot.add(corner);
    });

    // 2. Floating Professional Tools Group
    const toolsOrbitGroup = new THREE.Group();
    scene.add(toolsOrbitGroup);

    // Tool A: Hammer (🔨)
    const hammer = new THREE.Group();
    const hammerHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.055, 1.15, 10),
      matWood,
    );
    hammerHandle.position.set(0, -0.2, 0);
    hammer.add(hammerHandle);

    const hammerHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.28, 0.46),
      matChrome,
    );
    hammerHead.position.set(0, 0.38, 0.05);
    hammer.add(hammerHead);

    const hammerFace = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12),
      matChrome,
    );
    hammerFace.rotation.x = Math.PI / 2;
    hammerFace.position.set(0, 0.38, 0.3);
    hammer.add(hammerFace);

    hammer.position.set(1.9, 0.8, 0);
    hammer.rotation.z = 0.4;
    hammer.rotation.x = 0.3;
    toolsOrbitGroup.add(hammer);

    // Tool B: Chrome Spanner / Wrench (🔧)
    const spanner = new THREE.Group();
    const spannerShaft = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 1.1, 0.05),
      matChrome,
    );
    spanner.add(spannerShaft);

    const jawOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16),
      matChrome,
    );
    jawOuter.position.set(0, 0.55, 0);
    spanner.add(jawOuter);

    const ringOuter = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.04, 8, 20),
      matChrome,
    );
    ringOuter.position.set(0, -0.55, 0);
    spanner.add(ringOuter);

    spanner.position.set(-1.8, 0.7, 0.6);
    spanner.rotation.z = -0.5;
    spanner.rotation.y = 0.4;
    toolsOrbitGroup.add(spanner);

    // Tool C: Amber Screwdriver (🪛)
    const screwdriver = new THREE.Group();
    const driverHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.08, 0.48, 12),
      matAmber,
    );
    screwdriver.add(driverHandle);

    const driverShank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8),
      matChrome,
    );
    driverShank.position.set(0, 0.58, 0);
    screwdriver.add(driverShank);

    const driverTip = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.12, 0.02),
      matDarkMetal,
    );
    driverTip.position.set(0, 0.98, 0);
    screwdriver.add(driverTip);

    screwdriver.position.set(0.2, 0.9, -1.8);
    screwdriver.rotation.x = -0.6;
    toolsOrbitGroup.add(screwdriver);

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
      const workmanView = $("workman-view");
      if (!workmanView || workmanView.classList.contains("hidden") || document.hidden) {
        isRunning = false;
        return;
      }

      isRunning = true;
      requestAnimationFrame(animate);

      const t = clock.getElapsedTime();

      // Gentle floating toolbox sway
      toolboxRoot.rotation.y = Math.sin(t * 0.35) * 0.22;
      toolboxRoot.position.y = Math.sin(t * 0.7) * 0.06;

      // Orbiting floating tools
      toolsOrbitGroup.rotation.y = t * 0.4;

      hammer.rotation.y = t * 0.8;
      hammer.position.y = 0.8 + Math.sin(t * 1.2) * 0.14;

      spanner.rotation.x = t * 0.6;
      spanner.position.y = 0.7 + Math.sin(t * 1.4 + 1) * 0.12;

      screwdriver.rotation.z = t * 0.9;
      screwdriver.position.y = 0.9 + Math.sin(t * 1.3 + 2) * 0.15;

      renderer.render(scene, camera);
    }

    workmanThreeAnimate = () => {
      resize();
      if (!isRunning) {
        clock.start();
        animate();
      }
    };

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && $("workman-view") && !$("workman-view").classList.contains("hidden")) {
        workmanThreeAnimate();
      }
    });

  } catch (err) {
    console.warn("Could not start Workman 3D canvas:", err.message);
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

    // Initialize Google Identity Services
    initGoogleAuth();

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

  // Sidebar and Navbar logout
  document.querySelectorAll("#sidebar-logout, #logout-nav, .logout-link").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  });

  // Google custom button click
  const customGoogleBtn = $("google-custom-btn");
  if (customGoogleBtn) {
    customGoogleBtn.addEventListener("click", () => {
      if (!googleClientId) {
        const gm = $("google-modal");
        if (gm) gm.classList.remove("hidden");
        else toast("Google Sign-In: Add your GOOGLE_CLIENT_ID in Render Environment variables to activate.");
      }
    });
  }

  // Google modal controls
  const googleModal = $("google-modal");
  const googleClose = $("google-modal-close");
  const googleDemoBtn = $("google-demo-login-btn");

  if (googleClose) {
    googleClose.addEventListener("click", () => {
      if (googleModal) googleModal.classList.add("hidden");
    });
  }

  if (googleModal) {
    googleModal.addEventListener("click", (e) => {
      if (e.target.id === "google-modal") {
        googleModal.classList.add("hidden");
      }
    });
  }

  if (googleDemoBtn) {
    googleDemoBtn.addEventListener("click", async () => {
      if (googleModal) googleModal.classList.add("hidden");
      await handleGoogleCredentialResponse({ credential: "demo_google_account" });
    });
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
      const revModal = $("review-modal");
      if (revModal) revModal.classList.add("hidden");
      if (typeof window.closeBookingChat === "function") window.closeBookingChat();
    }
  });

  // Initialize Review & Star Rating Modal
  initReviewModal();

  // Initialize Booking Direct Chat Modal
  initBookingChat();

  // Initialize Floating AI Assistant
  initAIAssistant();
}

/* =========================
   REVIEW & STAR RATING MODAL
========================= */

let currentReviewRating = 5;

function initReviewModal() {
  const modal = $("review-modal");
  const closeBtn = $("review-modal-close");
  const form = $("review-form");
  const starsContainer = $("star-rating-stars");
  const ratingLabel = $("rating-label");

  if (!modal || !form) return;

  const RATING_LABELS = {
    1: "1 Star — Poor Experience",
    2: "2 Stars — Below Average",
    3: "3 Stars — Satisfactory",
    4: "4 Stars — Very Good Service",
    5: "5 Stars — Excellent Service!"
  };

  function updateStars(val) {
    currentReviewRating = val;
    if (ratingLabel) {
      ratingLabel.textContent = RATING_LABELS[val] || `${val} Stars`;
    }
    if (starsContainer) {
      starsContainer.querySelectorAll(".star-btn").forEach((btn) => {
        const starNum = Number(btn.dataset.rating);
        if (starNum <= val) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
    }
  }

  if (starsContainer) {
    starsContainer.querySelectorAll(".star-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        updateStars(Number(btn.dataset.rating));
      });
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
  }

  modal.addEventListener("click", (e) => {
    if (e.target.id === "review-modal") modal.classList.add("hidden");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = $("review-error");
    if (errorEl) errorEl.classList.add("hidden");

    const bookingId = $("review-booking-id").value;
    const reviewText = $("review-comment").value.trim();

    try {
      await api("/api/reviews", {
        method: "POST",
        body: {
          bookingId: Number(bookingId),
          rating: currentReviewRating,
          reviewText
        }
      });

      modal.classList.add("hidden");
      toast("Thank you! Your rating and review have been recorded.");
      await loadCustomerBookings();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message;
        errorEl.classList.remove("hidden");
      } else {
        toast(err.message);
      }
    }
  });

  window.openReviewModal = function(bookingId, workmanName) {
    $("review-booking-id").value = bookingId;
    if ($("review-workman-name-display")) {
      $("review-workman-name-display").textContent = `Reviewing service by ${workmanName}`;
    }
    $("review-comment").value = "";
    if ($("review-error")) $("review-error").classList.add("hidden");
    updateStars(5);
    modal.classList.remove("hidden");
  };
}

/* ========================================================
   BOOKING DIRECT CHAT MODAL
   ======================================================== */

let activeChatBookingId = null;
let chatPollInterval = null;

function initBookingChat() {
  const modal = $("chat-modal");
  const closeBtn = $("chat-modal-close");
  const form = $("chat-form");
  const input = $("chat-message-input");
  const messagesContainer = $("chat-messages-container");

  if (!modal || !form || !input) return;

  function closeBookingChat() {
    activeChatBookingId = null;
    if (chatPollInterval) {
      clearInterval(chatPollInterval);
      chatPollInterval = null;
    }
    modal.classList.add("hidden");
  }

  window.closeBookingChat = closeBookingChat;

  if (closeBtn) closeBtn.onclick = closeBookingChat;

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeBookingChat();
  });

  async function loadChatMessages(bookingId, shouldScroll = false) {
    if (!bookingId || activeChatBookingId !== bookingId) return;

    try {
      const data = await api(`/api/bookings/${bookingId}/messages`);
      const msgs = data.messages || [];

      if (activeChatBookingId !== bookingId) return;

      if (!msgs.length) {
        messagesContainer.innerHTML = `
          <div class="chat-empty-box">
            <div class="empty-icon">💬</div>
            <h4>Direct Service Chat</h4>
            <p>No messages yet. Send a note to confirm arrival time, gate directions, or clarify job requirements!</p>
          </div>
        `;
        return;
      }

      const isScrolledToBottom =
        messagesContainer.scrollHeight - messagesContainer.clientHeight <=
        messagesContainer.scrollTop + 60;

      messagesContainer.innerHTML = msgs
        .map((m) => {
          const isMe = currentUser && m.sender_id === currentUser.id;
          const roleBadge = m.sender_role === "admin" ? " [Admin]" : "";
          const timeStr = new Date(m.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
          });

          return `
            <div class="chat-bubble-wrap ${isMe ? "chat-msg-me" : "chat-msg-partner"}">
              <span class="chat-sender-label">${isMe ? "You" : esc(m.sender_name + roleBadge)}</span>
              <div class="chat-bubble">${esc(m.message_text)}</div>
              <span class="chat-time-stamp">${timeStr}</span>
            </div>
          `;
        })
        .join("");

      if (shouldScroll || isScrolledToBottom) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    } catch (err) {
      console.warn("Failed to load chat messages:", err.message);
    }
  }

  window.openBookingChat = function(bookingId, partnerName, meta = {}) {
    activeChatBookingId = bookingId;
    $("chat-booking-id").value = bookingId;

    if ($("chat-modal-title")) {
      $("chat-modal-title").textContent = partnerName ? `Chat with ${partnerName}` : "Service Chat";
    }

    if ($("chat-meta-service")) {
      $("chat-meta-service").textContent = meta.service ? `🛠️ ${meta.service}` : "🛠️ Local Service";
    }

    if ($("chat-meta-datetime")) {
      $("chat-meta-datetime").textContent = meta.datetime ? `📅 ${meta.datetime}` : "";
    }

    if ($("chat-meta-location")) {
      $("chat-meta-location").textContent = meta.location ? `📍 ${meta.location}` : "";
    }

    if ($("chat-booking-status-badge")) {
      const statusText = meta.status || "Active";
      $("chat-booking-status-badge").textContent = statusText;
      $("chat-booking-status-badge").className = `job-status-pill status-${statusText.toLowerCase()}`;
    }

    messagesContainer.innerHTML = `<div class="chat-loading-placeholder">Loading conversation...</div>`;
    modal.classList.remove("hidden");
    input.value = "";
    input.focus();

    loadChatMessages(bookingId, true);

    if (chatPollInterval) clearInterval(chatPollInterval);
    chatPollInterval = setInterval(() => {
      if (activeChatBookingId && !modal.classList.contains("hidden")) {
        loadChatMessages(activeChatBookingId, false);
      }
    }, 3000);
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || !activeChatBookingId) return;

    const sendBtn = $("chat-send-btn");
    if (sendBtn) sendBtn.disabled = true;

    try {
      await api(`/api/bookings/${activeChatBookingId}/messages`, {
        method: "POST",
        body: { messageText: text }
      });
      input.value = "";
      await loadChatMessages(activeChatBookingId, true);
    } catch (err) {
      toast(err.message || "Failed to send message.");
    } finally {
      if (sendBtn) sendBtn.disabled = false;
      input.focus();
    }
  });
}

/* =========================
   AI ASSISTANT WIDGET
========================= */

function formatAIMarkdown(text) {
  if (!text) return "";
  let html = esc(text);

  // Markdown Headers: ### Heading -> <h4 class="ai-bubble-heading">Heading</h4>
  html = html.replace(/^### (.*$)/gim, '<h4 class="ai-bubble-heading">$1</h4>');

  // Bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Italic *text*
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Format Urgency Banners
  html = html.replace(
    /<strong>Urgency Level:<\/strong>\s*(?:🚨|&#128680;)?\s*Emergency[^\n<]*/gi,
    '<div class="ai-urgency-banner emergency"><span class="ai-urgency-icon">🚨</span><span><strong>Emergency</strong> — Immediate Action Required</span></div>'
  );
  html = html.replace(
    /<strong>Urgency Level:<\/strong>\s*(?:⚠️|&#9888;)?\s*High Priority[^\n<]*/gi,
    '<div class="ai-urgency-banner high"><span class="ai-urgency-icon">⚠️</span><span><strong>High Priority</strong> — Timely Repair Needed</span></div>'
  );
  html = html.replace(
    /<strong>Urgency Level:<\/strong>\s*(?:ℹ️|&#8505;)?\s*Standard[^\n<]*/gi,
    '<div class="ai-urgency-banner normal"><span class="ai-urgency-icon">ℹ️</span><span><strong>Standard Maintenance</strong></span></div>'
  );

  // Bullet points and Paragraphs
  const lines = html.split("\n");
  let inList = false;
  const formatted = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("• ") || trimmed.startsWith("- ")) {
      if (!inList) {
        formatted.push("<ul>");
        inList = true;
      }
      formatted.push(`<li>${trimmed.slice(2)}</li>`);
    } else {
      if (inList) {
        formatted.push("</ul>");
        inList = false;
      }
      if (trimmed) {
        if (trimmed.startsWith("<h4") || trimmed.startsWith("<div class=\"ai-urgency-banner")) {
          formatted.push(trimmed);
        } else {
          formatted.push(`<p>${trimmed}</p>`);
        }
      }
    }
  }
  if (inList) formatted.push("</ul>");
  return formatted.join("");
}

function initAIAssistant() {
  const fab = $("ai-assistant-fab");
  const fabContainer = $("ai-fab-container");
  const win = $("ai-chat-window");
  const closeBtn = $("ai-close-btn");
  const clearBtn = $("ai-clear-btn");
  const form = $("ai-chat-form");
  const input = $("ai-chat-input");
  const messagesContainer = $("ai-chat-messages");

  if (!fab || !win || !form) return;

  // Conversational Multi-Turn Memory
  let aiChatHistory = [];

  // ============================================
  // DRAGGABLE / MOVABLE FAB BUTTON LOGIC
  // ============================================
  let isDragging = false;
  let hasMoved = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  function onPointerDown(e) {
    if (e.type === "mousedown" && e.button !== 0) return;

    const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;

    isDragging = true;
    hasMoved = false;
    startX = clientX;
    startY = clientY;

    const targetEl = fabContainer || fab;
    const rect = targetEl.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    targetEl.style.bottom = "auto";
    targetEl.style.right = "auto";
    targetEl.style.left = `${initialLeft}px`;
    targetEl.style.top = `${initialTop}px`;
    fab.classList.add("dragging");

    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    window.addEventListener("touchmove", onPointerMove, { passive: false });
    window.addEventListener("touchend", onPointerUp);
  }

  function onPointerMove(e) {
    if (!isDragging) return;

    const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;

    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      hasMoved = true;
      if (e.cancelable) e.preventDefault();
    }

    if (!hasMoved) return;

    const targetEl = fabContainer || fab;
    const rect = targetEl.getBoundingClientRect();
    const width = rect.width || 120;
    const height = rect.height || 48;

    // Viewport bounds with 10px safe margin
    const minX = 10;
    const maxX = window.innerWidth - width - 10;
    const minY = 10;
    const maxY = window.innerHeight - height - 10;

    let newLeft = initialLeft + deltaX;
    let newTop = initialTop + deltaY;

    newLeft = Math.max(minX, Math.min(newLeft, maxX));
    newTop = Math.max(minY, Math.min(newTop, maxY));

    targetEl.style.left = `${newLeft}px`;
    targetEl.style.top = `${newTop}px`;

    // If chat window is open, update its docked position
    if (!win.classList.contains("hidden")) {
      positionChatWindow();
    }
  }

  function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;
    fab.classList.remove("dragging");

    window.removeEventListener("mousemove", onPointerMove);
    window.removeEventListener("mouseup", onPointerUp);
    window.removeEventListener("touchmove", onPointerMove);
    window.removeEventListener("touchend", onPointerUp);
  }

  fab.addEventListener("mousedown", onPointerDown);
  fab.addEventListener("touchstart", onPointerDown, { passive: true });

  // Intelligent window docking relative to current FAB position
  function positionChatWindow() {
    const targetEl = fabContainer || fab;
    const fabRect = targetEl.getBoundingClientRect();
    const winWidth = Math.min(380, window.innerWidth - 32);
    const winHeight = Math.min(520, window.innerHeight - 120);
    const pad = 14;

    // Horizontal placement: align with FAB, keeping window fully on-screen
    let left = fabRect.left;
    if (left + winWidth > window.innerWidth - pad) {
      left = window.innerWidth - winWidth - pad;
    }
    left = Math.max(pad, left);

    // Vertical placement: place above FAB if in bottom half, below if in top half
    let top;
    if (fabRect.top > window.innerHeight / 2) {
      top = fabRect.top - winHeight - 10;
    } else {
      top = fabRect.bottom + 10;
    }
    top = Math.max(pad, Math.min(top, window.innerHeight - winHeight - pad));

    win.style.bottom = "auto";
    win.style.right = "auto";
    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
  }

  fab.addEventListener("click", (e) => {
    if (hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const willOpen = win.classList.contains("hidden");
    win.classList.toggle("hidden");

    if (willOpen) {
      positionChatWindow();
      if (input) input.focus();
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", () => win.classList.add("hidden"));
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      aiChatHistory = [];
      messagesContainer.innerHTML = `
        <div class="ai-msg ai-msg-bot">
          <div class="ai-bubble">
            <p>👋 <strong>Chat cleared! How can I help you today?</strong></p>
            <p>I can diagnose home repair issues, provide Chennai price estimates, and connect you with verified tradespeople.</p>
          </div>
        </div>
        <div class="ai-prompt-chips" id="ai-prompt-chips">
          <button type="button" class="ai-chip" data-prompt="My circuit breaker MCB keeps tripping">⚡ MCB Tripping</button>
          <button type="button" class="ai-chip" data-prompt="How much does fixing a leaking pipe or tap cost?">🔧 Leak Repair Cost</button>
          <button type="button" class="ai-chip" data-prompt="My AC is not cooling properly">❄️ AC Not Cooling</button>
          <button type="button" class="ai-chip" data-prompt="How much for 2BHK house painting in Chennai?">🎨 Painting Estimate</button>
          <button type="button" class="ai-chip" data-prompt="How do I book a workman?">📅 How to Book?</button>
        </div>
      `;
      bindChips();
    });
  }

  function bindChips() {
    messagesContainer.querySelectorAll(".ai-chip").forEach((chip) => {
      chip.onclick = () => {
        const text = chip.dataset.prompt;
        if (text) sendAIMessage(text);
      };
    });
  }

  bindChips();

  async function sendAIMessage(userText) {
    const text = (userText || "").trim();
    if (!text) return;

    if (input) input.value = "";

    // Track in conversation history
    aiChatHistory.push({ role: "user", text });

    // Append user message to UI
    const userMsgEl = document.createElement("div");
    userMsgEl.className = "ai-msg ai-msg-user";
    userMsgEl.innerHTML = `<div class="ai-bubble"><p>${esc(text)}</p></div>`;
    messagesContainer.appendChild(userMsgEl);

    // Remove any previous temporary reply suggestion chips
    messagesContainer.querySelectorAll(".ai-reply-chips").forEach((el) => el.remove());

    // Typing indicator
    const typingEl = document.createElement("div");
    typingEl.className = "ai-typing";
    typingEl.innerHTML = `<span></span><span></span><span></span>`;
    messagesContainer.appendChild(typingEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      const data = await api("/api/ai/chat", {
        method: "POST",
        body: {
          message: text,
          history: aiChatHistory.slice(-8)
        }
      });

      typingEl.remove();

      // Record bot reply in conversation history
      if (data && data.reply) {
        aiChatHistory.push({ role: "bot", text: data.reply });
      }

      const botMsgEl = document.createElement("div");
      botMsgEl.className = "ai-msg ai-msg-bot";

      // Build Workman Cards if returned
      let workmenHtml = "";
      if (Array.isArray(data.workmen) && data.workmen.length > 0) {
        workmenHtml = `
          <div class="ai-workmen-container">
            <div class="ai-workmen-heading">Verified Local Tradespeople:</div>
            <div class="ai-workmen-list">
              ${data.workmen.map((w) => `
                <div class="ai-workman-card">
                  <div class="ai-workman-info">
                    <div class="ai-workman-top">
                      <span class="ai-workman-name">${esc(w.name)}</span>
                      <span class="ai-workman-badge ${w.availability === 'Available' ? 'status-avail' : 'status-busy'}">
                        ● ${esc(w.availability || 'Available')}
                      </span>
                    </div>
                    <div class="ai-workman-meta">
                      <span>📍 ${esc(w.location || 'Chennai')}</span>
                      <span>•</span>
                      <span>💼 ${esc(w.experience || 0)} yrs exp</span>
                    </div>
                  </div>
                  <button type="button" class="ai-workman-book-btn" data-id="${w.id}">
                    📅 Book
                  </button>
                </div>
              `).join("")}
            </div>
          </div>
        `;
      }

      // Build Action Button if provided
      let actionHtml = "";
      if (data.action) {
        actionHtml = `<button type="button" class="ai-action-btn" data-action-type="${esc(data.action.type)}" data-category="${esc(data.action.category || "")}">
          ${esc(data.action.label || "Take Action")} →
        </button>`;
      }

      botMsgEl.innerHTML = `
        <div class="ai-bubble">
          ${formatAIMarkdown(data.reply)}
          ${workmenHtml}
          ${actionHtml}
        </div>
      `;
      messagesContainer.appendChild(botMsgEl);

      // Handle workman book clicks directly from chat
      botMsgEl.querySelectorAll(".ai-workman-book-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const workmanId = Number(btn.dataset.id);
          if (workmanId) {
            win.classList.add("hidden");
            openBooking(workmanId);
          }
        });
      });

      // Handle category / explore action buttons
      const actBtn = botMsgEl.querySelector(".ai-action-btn");
      if (actBtn) {
        actBtn.addEventListener("click", () => {
          const type = actBtn.dataset.actionType;
          const cat = actBtn.dataset.category;

          if (type === "filter" && cat) {
            $("filter-service").value = cat;
            if (!currentUser) {
              openAuth("register");
            } else {
              activeDashboard = "customer";
              show("customer-view");
              loadWorkmen().catch((e) => toast(e.message));
            }
            win.classList.add("hidden");
          } else if (type === "apply_workman") {
            if (!currentUser) openAuth("register");
            else openWorkmanApplication();
            win.classList.add("hidden");
          } else if (type === "explore") {
            if (!currentUser) show("home-view");
            else {
              activeDashboard = "customer";
              show("customer-view");
              loadWorkmen().catch((e) => toast(e.message));
            }
            win.classList.add("hidden");
          }
        });
      }

      // Dynamic Contextual Suggestion Chips
      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        const chipsEl = document.createElement("div");
        chipsEl.className = "ai-prompt-chips ai-reply-chips";
        chipsEl.innerHTML = data.suggestions.map((s) => `
          <button type="button" class="ai-chip" data-prompt="${esc(s)}">${esc(s)}</button>
        `).join("");
        messagesContainer.appendChild(chipsEl);

        chipsEl.querySelectorAll(".ai-chip").forEach((chip) => {
          chip.onclick = () => {
            const promptText = chip.dataset.prompt;
            if (promptText) sendAIMessage(promptText);
          };
        });
      }
    } catch (err) {
      typingEl.remove();
      const errEl = document.createElement("div");
      errEl.className = "ai-msg ai-msg-bot";
      errEl.innerHTML = `<div class="ai-bubble" style="color: #dc2626;"><p>Sorry, I had trouble answering that. Please try again.</p></div>`;
      messagesContainer.appendChild(errEl);
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (input && input.value.trim()) {
      sendAIMessage(input.value.trim());
    }
  });
}

/* =========================
   THEME (LIGHT / DARK MODE)
========================= */

function initTheme() {
  const topbarBtn = $("theme-toggle-btn");
  const sidebarBtn = $("sidebar-theme-toggle");

  function getPreferredTheme() {
    const saved = localStorage.getItem("localwork_theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    const isDark = theme === "dark";
    if (isDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
    }

    // Update topbar button icon and title
    if (topbarBtn) {
      const icon = topbarBtn.querySelector(".theme-toggle-icon");
      if (icon) icon.textContent = isDark ? "☀️" : "🌙";
      topbarBtn.title = isDark ? "Switch to Light Mode" : "Switch to Dark Mode";
      topbarBtn.setAttribute("aria-label", isDark ? "Switch to Light Mode" : "Switch to Dark Mode");
    }

    // Update sidebar button icon and label
    if (sidebarBtn) {
      const sIcon = sidebarBtn.querySelector(".theme-sidebar-icon");
      const sLabel = sidebarBtn.querySelector(".theme-sidebar-label");
      if (sIcon) sIcon.textContent = isDark ? "☀️" : "🌙";
      if (sLabel) sLabel.textContent = isDark ? "Light Mode" : "Dark Mode";
      sidebarBtn.title = isDark ? "Switch to Light Mode" : "Switch to Dark Mode";
    }

    try {
      localStorage.setItem("localwork_theme", theme);
    } catch (e) {}
  }

  function toggleTheme() {
    const isCurrentlyDark = document.documentElement.classList.contains("dark");
    applyTheme(isCurrentlyDark ? "light" : "dark");
  }

  // Initial sync
  applyTheme(getPreferredTheme());

  if (topbarBtn) topbarBtn.addEventListener("click", toggleTheme);
  if (sidebarBtn) sidebarBtn.addEventListener("click", toggleTheme);

  // Sync with OS theme changes if user hasn't explicitly set a preference
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      const saved = localStorage.getItem("localwork_theme");
      if (!saved) {
        applyTheme(e.matches ? "dark" : "light");
      }
    });
  }
}

/* =========================
   START APPLICATION
========================= */

async function start() {
  initTheme();
  renderCategories();
  bind();
  try { setupThree(); } catch (e) { console.warn("Three hero:", e); }
  try { setupCustomerThree(); } catch (e) { console.warn("Three customer:", e); }
  try { setupWorkmanThree(); } catch (e) { console.warn("Three workman:", e); }

  await initialise();
}

start();
