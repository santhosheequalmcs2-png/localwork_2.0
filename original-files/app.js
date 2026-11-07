/* LocalWork hackathon demo.
   This app uses localStorage for demonstration only. It does NOT provide secure authentication,
   server-side storage, real messaging, or real booking delivery. Never use real passwords here. */
const STORAGE = {users:"localwork_demo_users_v1", current:"localwork_demo_current_v1", bookings:"localwork_demo_bookings_v1", custom:"localwork_demo_custom_workmen_v1"};
const categories = [
  {name:"Electrician",icon:"⚡",caption:"Wiring & repairs"},
  {name:"Plumber",icon:"🔧",caption:"Leaks & fittings"},
  {name:"Carpenter",icon:"🪚",caption:"Woodwork & furniture"},
  {name:"Painter",icon:"🖌️",caption:"Walls & finishes"},
  {name:"Mechanic",icon:"🛠️",caption:"Vehicle repairs"},
  {name:"Cleaning",icon:"🧹",caption:"Home & office"},
  {name:"Construction",icon:"🧱",caption:"Building work"},
  {name:"Other",icon:"🧰",caption:"Other local skills"}
];
const demoWorkmen = [
 {id:"demo-1",name:"Arun Kumar",service:"Electrician",location:"Anna Nagar, Chennai",experience:6,description:"Electrical repairs, fan and light installation, switchboard work, and basic home wiring. I focus on careful work and clear communication.",phone:"9000000001",email:"arun.demo@example.com",availability:"Available",rating:4.8,reviews:24,skills:["Wiring","Fan installation","Switchboards"],avatar:"👨‍🔧",demo:true},
 {id:"demo-2",name:"Meena Ravi",service:"Plumber",location:"T. Nagar, Chennai",experience:5,description:"Home plumbing, tap replacement, leak checks, sink fitting, and bathroom maintenance.",phone:"9000000002",email:"meena.demo@example.com",availability:"Available",rating:4.7,reviews:18,skills:["Leak repair","Tap fitting","Pipes"],avatar:"👩‍🔧",demo:true},
 {id:"demo-3",name:"Karthik S",service:"Carpenter",location:"Velachery, Chennai",experience:8,description:"Furniture assembly, shelf installation, door adjustments, and small custom woodwork projects.",phone:"9000000003",email:"karthik.demo@example.com",availability:"Busy",rating:4.9,reviews:31,skills:["Furniture","Shelves","Door repair"],avatar:"🧑‍🔧",demo:true},
 {id:"demo-4",name:"Priya M",service:"Painter",location:"Adyar, Chennai",experience:4,description:"Interior wall painting, touch-ups, surface preparation, and neat finishing for small homes and rooms.",phone:"9000000004",email:"priya.demo@example.com",availability:"Available",rating:4.6,reviews:12,skills:["Interior painting","Touch-ups","Finishing"],avatar:"👩‍🎨",demo:true},
 {id:"demo-5",name:"Rafiq Ahmed",service:"Mechanic",location:"Guindy, Chennai",experience:7,description:"Basic two-wheeler servicing, brake checks, oil changes, and routine maintenance.",phone:"9000000005",email:"rafiq.demo@example.com",availability:"Available",rating:4.7,reviews:20,skills:["Two-wheelers","Routine service","Brake checks"],avatar:"👨‍🔧",demo:true},
 {id:"demo-6",name:"Lakshmi P",service:"Cleaning",location:"Mylapore, Chennai",experience:3,description:"Home deep cleaning, kitchen cleaning, and move-in or move-out cleaning assistance.",phone:"9000000006",email:"lakshmi.demo@example.com",availability:"Available",rating:4.5,reviews:9,skills:["Home cleaning","Kitchen","Deep cleaning"],avatar:"🧹",demo:true},
 {id:"demo-7",name:"Suresh Babu",service:"Construction",location:"Porur, Chennai",experience:10,description:"Small masonry jobs, tile repair, plaster patching, and general renovation assistance.",phone:"9000000007",email:"suresh.demo@example.com",availability:"Busy",rating:4.8,reviews:27,skills:["Masonry","Tile repair","Renovation"],avatar:"👷",demo:true},
 {id:"demo-8",name:"Naveen Raj",service:"Electrician",location:"Tambaram, Chennai",experience:2,description:"Home electrical troubleshooting, light fitting, and basic appliance connection support.",phone:"9000000008",email:"naveen.demo@example.com",availability:"Available",rating:4.4,reviews:6,skills:["Light fitting","Troubleshooting","Appliances"],avatar:"🧑‍🔧",demo:true}
];
let selectedRole = "customer";
let authMode = "register";
let currentProfileId = null;
let lastResultsSource = "customer";
let activeCategory = "";
let toastTimer = null;
const $ = id => document.getElementById(id);
const read = (key, fallback) => { try { const value=localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const allCustom = () => read(STORAGE.custom, []);
const allWorkmen = () => [...demoWorkmen, ...allCustom().filter(w=>w.role==="workman").map(w=>({...w,demo:false}))];
const currentUser = () => read(STORAGE.current, null);
const allUsers = () => read(STORAGE.users, []);
const initialsAvatar = name => name && name.trim() ? "🧑‍🔧" : "👤";

function showView(viewId) {
  document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));
  $(viewId).classList.remove("hidden");
  $("header-login").classList.toggle("hidden", !!currentUser());
  $("header-logout").classList.toggle("hidden", !currentUser());
  window.scrollTo({top:0,behavior:"smooth"});
}
function toast(message) {
  $("toast").textContent=message; $("toast").classList.remove("hidden");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>$("toast").classList.add("hidden"),3200);
}
function goHome(){showView("home-view");}
function openAuth(mode="register", role=null) {
  authMode=mode;
  if(role) selectedRole=role;
  updateAuthMode();
  showView("auth-view");
}
function updateAuthMode(){
  $("tab-register").classList.toggle("active",authMode==="register");
  $("tab-login").classList.toggle("active",authMode==="login");
  $("role-picker").classList.toggle("hidden",authMode==="login" || !!selectedRole);
  $("auth-form").classList.toggle("hidden",authMode==="register" && !selectedRole);
  $("register-fields").classList.toggle("hidden",authMode!=="register");
  $("login-fields").classList.toggle("hidden",authMode!=="login");
  $("password-fields").classList.toggle("hidden",authMode!=="register");
  $("workman-fields").classList.toggle("hidden",authMode!=="register" || selectedRole!=="workman");
  $("form-title").textContent=authMode==="login"?"Log in to LocalWork":`Register as ${selectedRole==="workman"?"a Workman":"a Customer"}`;
  $("form-subtitle").textContent=authMode==="login"?"Welcome back. Enter your demo account details.":"A few details to get started.";
  $("submit-auth").textContent=authMode==="login"?"Log in":"Register as "+(selectedRole==="workman"?"Workman":"Customer");
  $("form-error").classList.add("hidden");
}
function renderCategories(targetId, small=false){
  $(targetId).innerHTML=categories.map(c=>`<button class="category-card ${activeCategory===c.name?"selected":""}" data-category="${escapeHTML(c.name)}"><span class="category-icon">${c.icon}</span><strong>${escapeHTML(c.name)}</strong><small>${escapeHTML(c.caption)}</small></button>`).join("");
  $(targetId).querySelectorAll("[data-category]").forEach(btn=>btn.addEventListener("click",()=>{
    activeCategory=activeCategory===btn.dataset.category?"":btn.dataset.category;
    if(targetId==="home-categories"){openAuth("register","customer");$("search-service").value=activeCategory;renderCategories("dashboard-categories",true);renderResults();}
    else {renderCategories("dashboard-categories",true);$("search-service").value=activeCategory;renderResults();}
  }));
}
function loginUser(user){write(STORAGE.current,{id:user.id,role:user.role,email:user.email});routeByRole();}
function routeByRole(){
  const user=currentUser();
  if(!user){goHome();return;}
  $("header-login").classList.add("hidden");$("header-logout").classList.remove("hidden");
  if(user.role==="customer"){showView("customer-view");$("customer-welcome").textContent=`Welcome${user.name?" back, "+user.name.split(" ")[0]:""}! Find local help.`;renderCategories("dashboard-categories",true);renderResults();}
  else {showView("workman-view");renderWorkmanDashboard();}
}
async function hashDemoPassword(password, salt){
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function handleRegister(){
  const name=$("full-name").value.trim(), email=$("email").value.trim().toLowerCase(), phone=$("phone").value.trim(), location=$("location").value.trim(), password=$("password").value, confirm=$("confirm-password").value;
  const err=$("form-error"); let message="";
  if(!name||!email||!phone||!location||!password||!confirm) message="Please complete all required fields.";
  else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) message="Enter a valid email address.";
  else if(!/^[+\d\s()-]{8,18}$/.test(phone)) message="Enter a valid phone number (at least 8 digits).";
  else if(password.length<8) message="Use at least 8 characters for your demo password.";
  else if(password!==confirm) message="The passwords do not match.";
  else if(allUsers().some(u=>u.email===email)) message="An account with this email already exists in this browser. Try logging in.";
  if(selectedRole==="workman" && !message){
    if(!$("service").value) message="Choose the type of work you provide.";
    else if($("experience").value==="" || Number($("experience").value)<0 || Number($("experience").value)>70) message="Enter experience between 0 and 70 years.";
    else if(!$("description").value.trim()) message="Add a short description of your skills.";
  }
  if(message){err.textContent=message;err.classList.remove("hidden");return;}
  const passwordSalt = crypto.getRandomValues(new Uint8Array(16)).reduce((s,b)=>s+b.toString(16).padStart(2,"0"),"");
  const passwordHash = await hashDemoPassword(password, passwordSalt);
  const user={id:"user-"+Date.now(),role:selectedRole,name,email,phone,location,service:selectedRole==="workman"?$("service").value:"",experience:selectedRole==="workman"?Number($("experience").value):0,description:selectedRole==="workman"?$("description").value.trim():"",availability:selectedRole==="workman"?$("availability").value:"Available",skills:selectedRole==="workman"?$("description").value.trim().split(/[,.]/).map(s=>s.trim()).filter(Boolean).slice(0,4):[],avatar:initialsAvatar(name),demo:false, passwordSalt, passwordHash};
  // Demo only: a salted browser-side hash avoids saving the plain-text password, but is NOT production authentication.
  const users=allUsers();users.push(user);write(STORAGE.users,users);
  if(user.role==="workman"){const custom=allCustom();custom.push(user);write(STORAGE.custom,custom);}
  loginUser(user);toast("Demo account created. Welcome to LocalWork!");
}
async function handleLogin(){
  const email=$("login-email").value.trim().toLowerCase(), password=$("login-password").value;
  const err=$("form-error");
  const candidate=allUsers().find(u=>u.email===email);
  const candidateHash = candidate && candidate.passwordSalt && candidate.passwordHash ? await hashDemoPassword(password, candidate.passwordSalt) : "";
  const user = candidate && candidateHash === candidate.passwordHash ? candidate : null;
  if(!email||!password){err.textContent="Enter your email and password.";err.classList.remove("hidden");return;}
  if(!user){err.textContent="No matching demo account found. Register first in this browser.";err.classList.remove("hidden");return;}
  loginUser(user);toast("Logged in to demo mode.");
}
function renderResults(){
  const service=$("search-service").value.trim().toLowerCase(), location=$("search-location").value.trim().toLowerCase();
  let list=allWorkmen().filter(w=>(!service||w.service.toLowerCase().includes(service)||w.name.toLowerCase().includes(service)||((w.skills||[]).join(" ").toLowerCase().includes(service)))&&(!location||w.location.toLowerCase().includes(location)));
  if(activeCategory && !service) list=list.filter(w=>w.service.toLowerCase()===activeCategory.toLowerCase());
  $("results-title").textContent=service||location?`Results${service?" for "+$("search-service").value:""}${location?" near "+$("search-location").value:""}`:"Workmen to explore";
  $("result-count").textContent=`${list.length} profile${list.length===1?"":"s"}`;
  if(!list.length){$("workman-results").innerHTML='<div class="no-results"><strong>No matching profiles yet</strong>Try a different service or area. The demo data mainly uses Chennai neighbourhoods.</div>';return;}
  $("workman-results").innerHTML=list.map(w=>workmanCard(w)).join("");
  $("workman-results").querySelectorAll("[data-profile]").forEach(b=>b.addEventListener("click",()=>openProfile(b.dataset.profile,"customer-view")));
  $("workman-results").querySelectorAll("[data-contact]").forEach(b=>b.addEventListener("click",()=>contactWorkman(b.dataset.contact)));
  $("workman-results").querySelectorAll("[data-book]").forEach(b=>b.addEventListener("click",()=>openBooking(b.dataset.book)));
}
function workmanCard(w){
 return `<article class="workman-card"><div class="card-top"><div class="avatar">${escapeHTML(w.avatar||"🧑‍🔧")}</div><div><h3>${escapeHTML(w.name)}</h3><div class="service-label">${escapeHTML(w.service)}</div></div></div><p>${escapeHTML((w.description||"Local service professional.").slice(0,115))}${(w.description||"").length>115?"…":""}</p><div class="card-meta"><span>⌖ ${escapeHTML(w.location)}</span><span>◷ ${Number(w.experience)||0} yrs exp.</span><span>${w.availability==="Available"?"● Available":"● Busy"}</span></div><div class="card-meta">${w.demo?`<span class="rating">★ ${w.rating} (${w.reviews} demo reviews)</span>`:"<span>Rating not yet available</span>"}<span>${w.demo?"Sample profile":"User profile"}</span></div><div class="card-actions"><button class="btn btn-light" data-profile="${escapeHTML(w.id)}">View profile</button><button class="btn btn-primary" data-contact="${escapeHTML(w.id)}">Contact</button></div></article>`;
}
function openProfile(id, source="customer-view"){
 const w=allWorkmen().find(p=>p.id===id);if(!w){toast("This profile could not be found.");return;}
 currentProfileId=id;lastResultsSource=source;
 $("profile-back").onclick=()=>{showView(lastResultsSource);if(lastResultsSource==="customer-view")renderResults();else renderWorkmanDashboard();};
 const skills=(w.skills||[]).length?w.skills:[w.service,"Local service","Customer support"];
 $("profile-detail").innerHTML=`<article class="profile-detail-card"><div class="profile-detail-head"><div class="avatar">${escapeHTML(w.avatar||"🧑‍🔧")}</div><div><span class="demo-tag">${w.demo?"FICTIONAL DEMO PROFILE":"COMMUNITY PROFILE"}</span><h1>${escapeHTML(w.name)}</h1><p>${escapeHTML(w.service)} · ${escapeHTML(w.location)}</p></div></div><div class="profile-detail-grid"><div><div class="eyebrow">ABOUT THE WORKMAN</div><h2>Skills & introduction</h2><p class="profile-description">${escapeHTML(w.description||"No introduction has been added yet.")}</p><div class="skill-chips">${skills.map(s=>`<span class="skill-chip">${escapeHTML(s)}</span>`).join("")}</div><div style="margin-top:30px"><div class="eyebrow">RATINGS & REVIEWS</div><h2>${w.demo?`★ ${w.rating} / 5 — illustrative demo rating`:"No rating yet"}</h2>${w.demo?`<div class="demo-review"><strong>Sample review summary</strong><p>This profile uses fictional demonstration data. These are not genuine customer reviews.</p><small>DEMO CONTENT — NOT A REAL REVIEW</small></div>`:'<p class="muted">Ratings and reviews will appear here when a real review system is configured.</p>'}</div></div><aside class="profile-sidebox"><div class="eyebrow">QUICK DETAILS</div><div class="profile-facts"><div class="profile-fact"><span>◷</span><div><strong>${Number(w.experience)||0} years</strong><small>Experience</small></div></div><div class="profile-fact"><span>⌖</span><div><strong>${escapeHTML(w.location)}</strong><small>Service area</small></div></div><div class="profile-fact"><span>●</span><div><strong>${escapeHTML(w.availability||"Not specified")}</strong><small>Availability</small></div></div><div class="profile-fact"><span>☎</span><div><strong>${escapeHTML(w.phone||"Not provided")}</strong><small>Demo contact detail</small></div></div></div><button class="btn btn-primary" data-profile-book="${escapeHTML(w.id)}">Request booking</button><button class="btn btn-light" data-profile-contact="${escapeHTML(w.id)}">Contact workman</button><p class="fine-print">${w.demo?"Fictional profile and contact details. Do not call or message.":"Contact is a demo action; no message is delivered."}</p></aside></div></article>`;
 $("profile-detail").querySelector("[data-profile-book]").addEventListener("click",()=>openBooking(id));
 $("profile-detail").querySelector("[data-profile-contact]").addEventListener("click",()=>contactWorkman(id));
 showView("profile-view");
}
function contactWorkman(id){
 const w=allWorkmen().find(p=>p.id===id);if(!w)return;
 if(w.demo){toast("Demo contact only: "+w.name+"'s phone and email are fictional.");return;}
 toast("Demo contact: use the displayed contact details to discuss the job. No message is sent by LocalWork.");
}
function openBooking(id){
 const w=allWorkmen().find(p=>p.id===id);if(!w)return;
 if(!currentUser()||currentUser().role!=="customer"){toast("Log in as a customer to request a booking.");openAuth("register","customer");return;}
 currentProfileId=id;$("booking-for").textContent=`Requesting a booking with ${w.name} (${w.service}).`;
 $("booking-customer").value=currentUser().name||"";$("booking-phone").value=currentUser().phone||"";$("booking-address").value=currentUser().location||"";
 $("booking-date").min=new Date().toISOString().slice(0,10);$("booking-date").value="";
 $("booking-notes").value="";$("booking-error").classList.add("hidden");$("booking-modal").classList.remove("hidden");
}
function saveBooking(){
 const customer=$("booking-customer").value.trim(),phone=$("booking-phone").value.trim(),address=$("booking-address").value.trim(),date=$("booking-date").value;
 let message="";if(!customer||!phone||!address||!date)message="Please complete your name, phone, address, and preferred date.";
 else if(date<new Date().toISOString().slice(0,10))message="Choose today or a future date.";
 if(message){$("booking-error").textContent=message;$("booking-error").classList.remove("hidden");return;}
 const request={id:"booking-"+Date.now(),workmanId:currentProfileId,customerId:currentUser().id,customer,phone,address,date,time:$("booking-time").value,notes:$("booking-notes").value.trim(),status:"Demo request saved"};
 const bookings=read(STORAGE.bookings,[]);bookings.push(request);write(STORAGE.bookings,bookings);
 $("booking-modal").classList.add("hidden");toast("Demo booking saved in this browser. The workman was not notified.");
}
function renderWorkmanDashboard(){
 const user=currentUser();if(!user||user.role!=="workman")return;
 const latest=allWorkmen().find(w=>w.id===user.id)||user;
 $("workman-avatar").textContent=latest.avatar||"🧑‍🔧";
 $("workman-profile-summary").innerHTML=`<div class="profile-facts"><div class="profile-fact"><span>◉</span><div><strong>${escapeHTML(latest.name)}</strong><small>${escapeHTML(latest.email)}</small></div></div><div class="profile-fact"><span>☎</span><div><strong>${escapeHTML(latest.phone)}</strong><small>Contact number</small></div></div><div class="profile-fact"><span>⌖</span><div><strong>${escapeHTML(latest.location)}</strong><small>Service area</small></div></div><div class="profile-fact"><span>🔧</span><div><strong>${escapeHTML(latest.service)}</strong><small>${Number(latest.experience)||0} years of experience</small></div></div></div><p class="profile-description">${escapeHTML(latest.description)}</p>`;
 $("availability-status").value=latest.availability||"Available";$("availability-label").textContent=latest.availability||"Available";
 const bookings=read(STORAGE.bookings,[]).filter(b=>b.workmanId===user.id);
 $("workman-bookings").innerHTML=bookings.length?bookings.map(b=>`<div class="demo-review"><strong>${escapeHTML(b.date)} · ${escapeHTML(b.time)}</strong><p>${escapeHTML(b.customer)} — ${escapeHTML(b.address)}</p><small>DEMO REQUEST · NOT SENT OR CONFIRMED</small></div>`).join(""):"No booking requests for this account yet. Requests made to fictional sample profiles will not appear here.";
}
function openEditProfile(){
 const user=currentUser();if(!user||user.role!=="workman")return;
 const w=allWorkmen().find(p=>p.id===user.id)||user;
 $("edit-name").value=w.name||"";$("edit-phone").value=w.phone||"";$("edit-location").value=w.location||"";$("edit-service").value=w.service||"Other";$("edit-experience").value=w.experience??0;$("edit-description").value=w.description||"";$("edit-error").classList.add("hidden");$("edit-modal").classList.remove("hidden");
}
function saveProfile(){
 const user=currentUser(),name=$("edit-name").value.trim(),phone=$("edit-phone").value.trim(),location=$("edit-location").value.trim(),service=$("edit-service").value,experience=Number($("edit-experience").value),description=$("edit-description").value.trim();
 let error="";if(!name||!phone||!location||!description)error="Please complete all profile fields.";else if(!/^[+\d\s()-]{8,18}$/.test(phone))error="Enter a valid phone number.";else if($("edit-experience").value===""||experience<0||experience>70)error="Experience must be between 0 and 70 years.";
 if(error){$("edit-error").textContent=error;$("edit-error").classList.remove("hidden");return;}
 const updated={...user,name,phone,location,service,experience,description,skills:description.split(/[,.]/).map(s=>s.trim()).filter(Boolean).slice(0,4)};
 write(STORAGE.users,allUsers().map(u=>u.id===user.id?updated:u));
 write(STORAGE.current,{id:updated.id,role:updated.role,email:updated.email});
 write(STORAGE.custom,allCustom().map(w=>w.id===user.id?updated:w).concat(allCustom().some(w=>w.id===user.id)?[]:[updated]));
 $("edit-modal").classList.add("hidden");renderWorkmanDashboard();toast("Your demo profile has been updated.");
}
function logout(){localStorage.removeItem(STORAGE.current);activeCategory="";goHome();toast("You have logged out.");}
function init(){
 renderCategories("home-categories");$("header-login").addEventListener("click",()=>openAuth("login",null));
 $("header-logout").addEventListener("click",logout);
 document.querySelectorAll('[data-action="home"]').forEach(b=>b.addEventListener("click",e=>{e.preventDefault();goHome();}));
 document.querySelectorAll('[data-action="choose-customer"]').forEach(b=>b.addEventListener("click",()=>openAuth("register","customer")));
 document.querySelectorAll('[data-action="choose-workman"]').forEach(b=>b.addEventListener("click",()=>openAuth("register","workman")));
 document.querySelectorAll('[data-action="services"]').forEach(b=>b.addEventListener("click",e=>{e.preventDefault();goHome();document.getElementById("services").scrollIntoView({behavior:"smooth"});}));
 document.querySelectorAll('[data-action="how"]').forEach(b=>b.addEventListener("click",e=>{e.preventDefault();goHome();document.getElementById("how-it-works").scrollIntoView({behavior:"smooth"});}));
 $("tab-register").addEventListener("click",()=>{authMode="register";selectedRole=null;updateAuthMode();});
 $("tab-login").addEventListener("click",()=>{authMode="login";selectedRole=null;updateAuthMode();});
 document.querySelectorAll("[data-role]").forEach(b=>b.addEventListener("click",()=>{selectedRole=b.dataset.role;authMode="register";updateAuthMode();}));
 $("back-to-roles").addEventListener("click",()=>{selectedRole=null;authMode="register";updateAuthMode();});
 $("auth-form").addEventListener("submit",e=>{e.preventDefault();authMode==="login"?handleLogin():handleRegister();});
 $("show-password").addEventListener("change",()=>["password","confirm-password"].forEach(id=>$(id).type=$("show-password").checked?"text":"password"));
 $("search-button").addEventListener("click",()=>{activeCategory="";renderCategories("dashboard-categories",true);renderResults();});
 $("search-service").addEventListener("keydown",e=>{if(e.key==="Enter"){activeCategory="";renderResults();}});
 $("search-location").addEventListener("keydown",e=>{if(e.key==="Enter")renderResults();});
 $("clear-filters").addEventListener("click",()=>{$("search-service").value="";$("search-location").value="";activeCategory="";renderCategories("dashboard-categories",true);renderResults();});
 $("edit-profile-button").addEventListener("click",openEditProfile);$("edit-profile-form").addEventListener("submit",e=>{e.preventDefault();saveProfile();});
 $("availability-status").addEventListener("change",e=>{const user=currentUser();if(!user)return;const updatedUsers=allUsers().map(u=>u.id===user.id?{...u,availability:e.target.value}:u);write(STORAGE.users,updatedUsers);write(STORAGE.custom,allCustom().map(w=>w.id===user.id?{...w,availability:e.target.value}:w));$("availability-label").textContent=e.target.value;renderWorkmanDashboard();toast("Availability updated in demo mode.");});
 $("preview-profile-button").addEventListener("click",()=>{const u=currentUser();if(u)openProfile(u.id,"workman-view");});
 $("profile-back").addEventListener("click",()=>showView(lastResultsSource));
 $("booking-form").addEventListener("submit",e=>{e.preventDefault();saveBooking();});
 document.querySelectorAll('[data-action="close-edit"]').forEach(b=>b.addEventListener("click",()=>$("edit-modal").classList.add("hidden")));
 document.querySelectorAll('[data-action="close-booking"]').forEach(b=>b.addEventListener("click",()=>$("booking-modal").classList.add("hidden")));
 ["edit-modal","booking-modal"].forEach(id=>$(id).addEventListener("click",e=>{if(e.target.id===id)$(id).classList.add("hidden");}));
 document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".modal").forEach(m=>m.classList.add("hidden"));});
 const today=new Date().toISOString().slice(0,10);$("booking-date").min=today;
 const session=currentUser();if(session){const user=allUsers().find(u=>u.id===session.id);if(user)routeByRole();else{localStorage.removeItem(STORAGE.current);goHome();}}else goHome();
}
init();
