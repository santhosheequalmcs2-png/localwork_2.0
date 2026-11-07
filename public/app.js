import * as THREE from "/vendor/three/three.module.js";

let csrfToken = "";
let currentUser = null;
let chosenRole = "customer";
let authMode = "register";
let selectedWorkman = null;
let previousView = "customer-view";
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const categories = [["⚡","Electrician"],["🔧","Plumber"],["🪚","Carpenter"],["🖌️","Painter"],["🛠️","Mechanic"],["🧹","Cleaning"],["🧱","Construction"],["🧰","Other"]];

async function api(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = { ...(options.headers || {}) };
  if (options.body && typeof options.body !== "string") {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  if (!["GET","HEAD","OPTIONS"].includes(method)) headers["X-CSRF-Token"] = csrfToken;
  const response = await fetch(url, { ...options, method, headers, credentials: "same-origin" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  if (data.csrfToken) csrfToken = data.csrfToken;
  return data;
}
function show(view) {
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  $(view).classList.remove("hidden");
  $("login-nav").classList.toggle("hidden", !!currentUser);
  $("logout-nav").classList.toggle("hidden", !currentUser);
  window.scrollTo({top:0,behavior:"smooth"});
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("toast").classList.add("hidden"), 3200);
}
function setAuth(mode, role = null) {
  authMode = mode;
  if (role) chosenRole = role;
  $("register-tab").classList.toggle("active", mode === "register");
  $("login-tab").classList.toggle("active", mode === "login");
  $("role-choice").classList.toggle("hidden", mode === "login" || !chosenRole);
  $("auth-form").classList.toggle("hidden", mode === "register" && !chosenRole);
  $("signup-fields").classList.toggle("hidden", mode === "login");
  $("signin-fields").classList.toggle("hidden", mode !== "login");
  $("workman-fields").classList.toggle("hidden", mode !== "register" || chosenRole !== "workman");
  $("confirm-wrap").classList.toggle("hidden", mode === "login");
  $("password").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("auth-heading").textContent = mode === "login" ? "Welcome back" : `Create a ${chosenRole} account`;
  $("auth-submit").textContent = mode === "login" ? "Log in" : "Create account";
  $("auth-error").classList.add("hidden");
}
function openAuth(mode="register", role=null) { setAuth(mode, role); show("auth-view"); }
function renderCategories() {
  $("category-list").innerHTML = categories.map(([icon,name]) => `<button class="category" data-category="${esc(name)}"><span>${icon}</span><b>${esc(name)}</b></button>`).join("");
  $("category-list").querySelectorAll("[data-category]").forEach(button => button.addEventListener("click", () => {
    $("filter-service").value = button.dataset.category;
    if (!currentUser) openAuth("register","customer");
    else if (currentUser.role === "customer") { show("customer-view"); loadWorkmen(); }
  }));
}
async function routeUser() {
  if (!currentUser) { show("home-view"); return; }
  if (currentUser.role === "customer") {
    $("customer-greeting").textContent = `Welcome, ${currentUser.name.split(" ")[0]}! Find local help.`;
    show("customer-view"); await loadWorkmen(); await loadCustomerBookings();
  } else if (currentUser.role === "workman") {
    show("workman-view"); fillProfile(); await loadWorkmanBookings();
  } else { show("admin-view"); await loadAdmin(); }
}
async function loadWorkmen() {
  const service = $("filter-service").value.trim();
  const location = $("filter-location").value.trim();
  const {workmen} = await api(`/api/workmen?service=${encodeURIComponent(service)}&location=${encodeURIComponent(location)}`);
  $("workmen-count").textContent = `${workmen.length} profile${workmen.length===1?"":"s"} found`;
  $("workmen-grid").innerHTML = workmen.length ? workmen.map(w => `
    <article class="workman-card"><p class="eyebrow">${esc(w.service)} · ${esc(w.availability)}</p><h3>${esc(w.name)}</h3>
    <p>${esc(w.description || "Local service professional.")}</p><div class="meta">${esc(w.location)} · ${Number(w.experience)||0} years' experience</div>
    <div class="card-actions"><button class="btn btn-light" data-profile="${w.id}">View profile</button><button class="btn btn-primary" data-book="${w.id}">Book</button></div></article>`).join("") : `<div class="empty">No profiles found. Try a different service or area.</div>`;
  $("workmen-grid").querySelectorAll("[data-profile]").forEach(b => b.addEventListener("click", () => openProfile(Number(b.dataset.profile))));
  $("workmen-grid").querySelectorAll("[data-book]").forEach(b => b.addEventListener("click", () => openBooking(Number(b.dataset.book))));
}
async function openProfile(id) {
  const {workman:w} = await api(`/api/workmen/${id}`);
  previousView = "customer-view";
  $("profile-detail").innerHTML = `<article class="profile-detail"><p class="eyebrow">${esc(w.service)} · ${esc(w.availability)}</p><h1>${esc(w.name)}</h1><p>${esc(w.description)}</p><p><b>Area:</b> ${esc(w.location)} &nbsp; <b>Experience:</b> ${Number(w.experience)||0} years</p><button class="btn btn-primary" id="profile-book">Request a booking</button></article>`;
  $("profile-book").addEventListener("click", () => openBooking(id));
  show("profile-view");
}
function openBooking(id) {
  if (!currentUser || currentUser.role !== "customer") { toast("Please log in as a customer to book a workman."); openAuth("login"); return; }
  selectedWorkman = id;
  $("booking-name").value = currentUser.name || "";
  $("booking-phone").value = currentUser.phone || "";
  $("booking-address").value = currentUser.location || "";
  $("booking-date").min = new Date().toISOString().slice(0,10);
  $("booking-date").value = "";
  $("booking-error").classList.add("hidden");
  $("booking-modal").classList.remove("hidden");
  api(`/api/workmen/${id}`).then(({workman}) => $("booking-person").textContent = `Booking request for ${workman.name} (${workman.service})`).catch(() => {});
}
async function loadCustomerBookings() {
  const {bookings} = await api("/api/bookings/mine");
  $("customer-bookings").innerHTML = bookings.length ? bookings.map(b => `<div class="booking-item"><b>${esc(b.workman_name)} · ${esc(b.booking_date)}</b><p>${esc(b.booking_time)} · ${esc(b.address)} · Status: <b>${esc(b.status)}</b></p><p>${esc(b.notes)}</p></div>`).join("") : `<div class="empty">You have not sent any booking requests yet.</div>`;
}
async function loadWorkmanBookings() {
  const {bookings} = await api("/api/bookings/workman");
  $("workman-bookings").innerHTML = bookings.length ? bookings.map(b => `<div class="booking-item"><b>${esc(b.customer_name)} · ${esc(b.booking_date)}</b><p>${esc(b.booking_time)} · ${esc(b.address)} · ${esc(b.phone)}</p><p>${esc(b.notes)}</p><b>Status: ${esc(b.status)}</b><div>${b.status==="Pending" ? `<button class="btn btn-primary" data-status="Accepted" data-id="${b.id}">Accept</button><button class="btn btn-light" data-status="Declined" data-id="${b.id}">Decline</button>` : ""}</div></div>`).join("") : `<div class="empty">No booking requests yet.</div>`;
  $("workman-bookings").querySelectorAll("[data-status]").forEach(b => b.addEventListener("click", async () => {
    try { await api(`/api/bookings/${b.dataset.id}/status`, {method:"PATCH",body:{status:b.dataset.status}}); toast("Booking status updated."); await loadWorkmanBookings(); }
    catch(e) { toast(e.message); }
  }));
}
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
      name:$("profile-name").value, phone:$("profile-phone").value, location:$("profile-location").value,
      service:$("profile-service").value, experience:$("profile-experience").value,
      availability:$("profile-availability").value, description:$("profile-description").value
    };
    const result = await api("/api/workmen/me/profile",{method:"PUT",body:data});
    currentUser = result.user; fillProfile(); toast("Your profile has been updated.");
  } catch(e) { $("profile-error").textContent=e.message; $("profile-error").classList.remove("hidden"); }
}
async function saveBooking(event) {
  event.preventDefault();
  try {
    await api("/api/bookings",{method:"POST",body:{
      workmanId:selectedWorkman, customerName:$("booking-name").value, phone:$("booking-phone").value,
      address:$("booking-address").value, date:$("booking-date").value, time:$("booking-time").value,
      notes:$("booking-notes").value
    }});
    $("booking-modal").classList.add("hidden"); toast("Booking request sent successfully.");
    await loadCustomerBookings();
  } catch(e) { $("booking-error").textContent=e.message; $("booking-error").classList.remove("hidden"); }
}
async function loadAdmin() {
  const {counts,users,bookings} = await api("/api/admin/overview");
  $("admin-stats").innerHTML = Object.entries(counts).map(([key,value])=>`<div class="admin-stat"><b>${value}</b><span>${esc(key)}</span></div>`).join("");
  $("admin-users").innerHTML = users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td>${esc(u.createdAt)}</td><td>${u.role!=="admin"?`<button class="btn btn-light" data-delete-user="${u.id}">Delete</button>`:"Protected"}</td></tr>`).join("");
  $("admin-users").querySelectorAll("[data-delete-user]").forEach(b=>b.addEventListener("click",async()=>{
    if(!confirm("Delete this user account? Their bookings will also be deleted."))return;
    try{await api(`/api/admin/users/${b.dataset.deleteUser}`,{method:"DELETE"});toast("User deleted.");await loadAdmin();}catch(e){toast(e.message);}
  }));
  $("admin-bookings").innerHTML = bookings.length ? bookings.map(b=>`<div class="booking-item"><b>${esc(b.customer_account_name)} → ${esc(b.workman_name)}</b><p>${esc(b.booking_date)} · ${esc(b.booking_time)} · ${esc(b.status)}</p></div>`).join("") : `<div class="empty">No booking activity yet.</div>`;
}
async function logout() {
  try { await api("/api/auth/logout",{method:"POST"}); } catch(e) {}
  currentUser=null; csrfToken=""; await initialise();
}
function setupThree() {
  const host = $("three-hero");
  if (!host || !window.WebGLRenderingContext) return;
  let renderer;
  try {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, host.clientWidth/host.clientHeight, .1, 100);
    camera.position.set(0,0,8);
    renderer = new THREE.WebGLRenderer({alpha:true,antialias:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.setSize(host.clientWidth,host.clientHeight);
    host.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff,2.1));
    const key = new THREE.DirectionalLight(0xffffff,2.5); key.position.set(4,5,6); scene.add(key);
    const group = new THREE.Group(); scene.add(group);
    const matGreen = new THREE.MeshStandardMaterial({color:0x246b4d,roughness:.3,metalness:.12});
    const matLime = new THREE.MeshStandardMaterial({color:0xc8e67b,roughness:.35,metalness:.1});
    const matCream = new THREE.MeshStandardMaterial({color:0xf8f4df,roughness:.45});
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.7,1.25,1.1),matGreen); box.position.set(0,-.1,0); group.add(box);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.35,.9,4),matLime); roof.rotation.y=Math.PI/4; roof.position.set(0,1.02,0); group.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(.38,.72,.06),matCream); door.position.set(.3,-.34,.58); group.add(door);
    const torus = new THREE.Mesh(new THREE.TorusGeometry(2.15,.025,8,100),new THREE.MeshBasicMaterial({color:0x8bad5a,transparent:true,opacity:.7})); torus.rotation.x=.8; group.add(torus);
    const toolGroup = new THREE.Group(); scene.add(toolGroup);
    const toolMat = new THREE.MeshStandardMaterial({color:0xd69b43,metalness:.65,roughness:.25});
    for(let i=0;i<3;i++){const cube=new THREE.Mesh(new THREE.BoxGeometry(.32,.32,.32),i===1?matLime:toolMat);cube.position.set((i-1)*2.15,Math.sin(i*2)*.65,.2);toolGroup.add(cube);}
    function resize(){const w=host.clientWidth,h=host.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);}
    const observer = new ResizeObserver(resize); observer.observe(host);
    const clock = new THREE.Clock();
    function animate(){const t=clock.getElapsedTime();group.rotation.y=Math.sin(t*.45)*.22;group.position.y=Math.sin(t*.8)*.12;toolGroup.rotation.y=t*.35;toolGroup.children.forEach((o,i)=>{o.position.y=Math.sin(t*1.3+i*2)*.7;});torus.rotation.z=t*.15;renderer.render(scene,camera);requestAnimationFrame(animate);}
    animate();
  } catch(err) { console.warn("3D scene could not start:",err); if(renderer)renderer.dispose(); }
}
async function initialise() {
  try {
    const csrf = await fetch("/api/auth/csrf",{credentials:"same-origin"});
    const csrfData = await csrf.json(); csrfToken = csrfData.csrfToken;
    try { const me = await api("/api/auth/me"); currentUser = me.user; } catch { currentUser=null; }
    await routeUser();
  } catch(e) { toast("Could not connect to the LocalWork server. Start it with npm start."); show("home-view"); }
}
function bind() {
  $("login-nav").addEventListener("click",()=>openAuth("login"));
  $("logout-nav").addEventListener("click",logout);
  document.querySelectorAll("[data-register]").forEach(b=>b.addEventListener("click",()=>openAuth("register",b.dataset.register)));
  document.querySelectorAll("[data-home]").forEach(b=>b.addEventListener("click",()=>show("home-view")));
  document.querySelectorAll("[data-role]").forEach(b=>b.addEventListener("click",()=>{chosenRole=b.dataset.role;setAuth("register",chosenRole);}));
  $("register-tab").addEventListener("click",()=>{chosenRole=null;setAuth("register");});
  $("login-tab").addEventListener("click",()=>{chosenRole=null;setAuth("login");});
  $("change-role").addEventListener("click",()=>{chosenRole=null;setAuth("register");});
  $("auth-form").addEventListener("submit",async e=>{
    e.preventDefault();$("auth-error").classList.add("hidden");
    try {
      let result;
      if(authMode==="register"){
        if($("password").value!==$("confirm-password").value)throw new Error("Passwords do not match.");
        result=await api("/api/auth/register",{method:"POST",body:{
          name:$("name").value,email:$("email").value,phone:$("phone").value,location:$("location").value,
          password:$("password").value,role:chosenRole,service:$("service").value,
          experience:$("experience").value,description:$("description").value
        }});
      } else result=await api("/api/auth/login",{method:"POST",body:{email:$("login-email").value,password:$("password").value}});
      currentUser=result.user;toast("Welcome to LocalWork!");await routeUser();
    } catch(err){$("auth-error").textContent=err.message;$("auth-error").classList.remove("hidden");}
  });
  $("search-workmen").addEventListener("click",()=>loadWorkmen().catch(e=>toast(e.message)));
  $("filter-service").addEventListener("keydown",e=>{if(e.key==="Enter")loadWorkmen().catch(x=>toast(x.message));});
  $("filter-location").addEventListener("keydown",e=>{if(e.key==="Enter")loadWorkmen().catch(x=>toast(x.message));});
  $("profile-form").addEventListener("submit",saveProfile);
  $("booking-form").addEventListener("submit",saveBooking);
  $("booking-close").addEventListener("click",()=>$("booking-modal").classList.add("hidden"));
  $("booking-modal").addEventListener("click",e=>{if(e.target.id==="booking-modal")$("booking-modal").classList.add("hidden");});
  $("profile-back").addEventListener("click",()=>show(previousView));
  document.addEventListener("keydown",e=>{if(e.key==="Escape")$("booking-modal").classList.add("hidden");});
}
async function start() {
  renderCategories();bind();setupThree();await initialise();
}
start();
