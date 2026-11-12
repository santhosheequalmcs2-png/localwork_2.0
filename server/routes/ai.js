const express = require("express");
const { pool } = require("../database");
const rateLimit = require("express-rate-limit");

const router = express.Router();

// 45 AI queries per minute per IP
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 45,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "AI Assistant is busy. Please wait a few seconds before asking another question."
  }
});

// Known Tamil Nadu localities & cities (Coimbatore, Chennai, and major hubs)
const AREAS_AND_CITIES = [
  // Coimbatore & Kongu Region
  "Coimbatore", "Saravanampatti", "Gandhipuram", "RS Puram", "R.S. Puram", "Peelamedu",
  "Saibaba Colony", "Singanallur", "Ukkadam", "Kuniyamuthur", "Vadavalli", "Kovaipudur",
  "Ganapathy", "Thudiyalur", "Sulur", "Pollachi", "Mettupalayam", "Kinathukadavu",
  "Tiruppur", "Erode", "Salem", "Namakkal",
  // Chennai & Suburbs
  "Anna Nagar", "Velachery", "T. Nagar", "T Nagar", "Adyar", "Tambaram", "Guindy",
  "Mylapore", "Porur", "Chromepet", "Koyambedu", "Thiruvanmiyur", "Besant Nagar",
  "Nungambakkam", "Alwarpet", "Saidapet", "Perambur", "Ambattur", "Madipakkam",
  "Sholinganallur", "OMR", "ECR", "Kilpauk", "Egmore", "Royapettah", "Triplicane",
  "Kodambakkam", "Vadapalani", "KK Nagar", "Ashok Nagar", "Pallavaram", "Medavakkam",
  "Thoraipakkam", "Navalur", "Siruseri", "Perungudi", "Alandur", "Avadi", "Poonamallee",
  // Other Tamil Nadu Hubs
  "Madurai", "Trichy", "Tiruchirappalli", "Vellore", "Tirunelveli", "Thoothukudi",
  "Nagercoil", "Kanchipuram", "Tiruvallur", "Chengalpattu", "Hosur", "Thanjavur", "Dindigul"
];

// 15 Trade categories supported on LocalWork with English, Tamil, and Tanglish keywords
const TRADES = [
  {
    category: "Electrician",
    icon: "⚡",
    keywords: [
      "electric", "wiring", "switch", "tripping", "mcb", "fuse", "fan", "light", "spark", "power", "shock",
      "inverter", "socket", "short circuit", "voltage", "geyser heating", "earthing", "breaker", "elcb",
      "db box", "current", "current pochu", "current illa", "fan suthala", "fan slow", "fan odala", "bulb",
      "tube light", "plug", "line test", "generator", "phase", "single phase", "three phase", "wire burn",
      "voltage low", "voltage high", "power cut", "ups", "battery inverter", "ceiling fan"
    ],
    unitCost: { item: "Point wiring / Fan installation", rate: 300, unit: "per point" },
    avgCost: "₹250 – ₹600 for standard fixes; ₹1,200 – ₹3,500 for inverter / rewiring",
    tips: "Always switch off the main MCB breaker before touching or inspecting any sparking outlet or loose wire!"
  },
  {
    category: "Plumber",
    icon: "🔧",
    keywords: [
      "plumb", "leak", "tap", "pipe", "sink", "drain", "clog", "tank", "toilet", "water", "flush", "geyser",
      "sewage", "basin", "faucet", "cistern", "motor", "pressure", "overhang", "thanni", "thanni leak",
      "pipe vedichuruchu", "tap sotha", "water leak", "commode", "over head tank", "submersible", "sump motor",
      "drainage", "water flow", "borewell", "water filter", "wash basin block", "flush tank", "pipeline"
    ],
    unitCost: { item: "Tap replacement / Leak fix", rate: 250, unit: "per fixture" },
    avgCost: "₹200 – ₹500 for tap / leak repair; ₹800 – ₹2,000 for drain unclogging or pipe line replacement",
    tips: "If a pipe bursts or water overflows, immediately close your home's main water inlet valve near the water meter or overhead tank."
  },
  {
    category: "Carpenter",
    icon: "🪚",
    keywords: [
      "carpent", "wood", "furniture", "door", "cupboard", "wardrobe", "hinge", "lock", "table", "chair",
      "bed", "drawer", "plywood", "latch", "sliding", "swelling", "handle", "maram", "door lock", "saavi",
      "lock broken", "wood work", "modular kitchen", "loft", "mesh door", "mosquito net door", "sofa frame",
      "dining table", "tv unit", "wooden polish", "teak", "door close aagala", "door lock jammed", "cabinet"
    ],
    unitCost: { item: "Door lock / Hinge fitting", rate: 350, unit: "per fitting" },
    avgCost: "₹300 – ₹800 for door / lock fixes; ₹1,500+ for custom furniture or modular fittings",
    tips: "For sticking wooden doors during monsoon, check if the top hinge screws are loose before shaving off wood edges."
  },
  {
    category: "Painter",
    icon: "🎨",
    keywords: [
      "paint", "wall", "color", "putty", "primer", "stain", "whitewash", "coating", "damp wall", "peeling",
      "efflorescence", "interior", "exterior", "seepage paint", "vella adikanum", "colour", "distemper",
      "emulsion", "texture paint", "waterproofing paint", "ceiling paint", "enamel", "gate paint", "wall crack"
    ],
    unitCost: { item: "Interior painting (2 coats + putty)", rate: 18, unit: "per sq. ft." },
    avgCost: "₹12 – ₹25 per sq. ft. for interior emulsion; ₹15 – ₹35 per sq. ft. for exterior weather-guard",
    tips: "Always fix source water seepage and apply waterproof primer before painting to prevent blistering and flaking."
  },
  {
    category: "Mechanic",
    icon: "🛠️",
    keywords: [
      "mechanic", "car", "bike", "scooter", "engine", "brake", "battery", "jumpstart", "clutch", "puncture",
      "oil change", "vehicle", "breakdown", "radiator", "starter", "two wheeler", "four wheeler", "bike start aagala",
      "car start", "tyre", "brake pad", "chain lube", "accelerator", "spark plug", "gear", "coolant", "horn"
    ],
    unitCost: { item: "General bike service & oil change", rate: 450, unit: "per visit" },
    avgCost: "₹350 – ₹800 for basic tune-up / jumpstart; parts charged as per MRP",
    tips: "If your engine overheats, pull over safely, turn off ignition, and NEVER open the radiator cap while the engine is hot."
  },
  {
    category: "Cleaning",
    icon: "🧹",
    keywords: [
      "clean", "deep clean", "bathroom clean", "kitchen clean", "dust", "saniti", "housekeeping", "sofa clean",
      "chimney", "mattress", "scrub", "floor wash", "veedu clean", "bathroom stain", "acid wash", "water scale",
      "tiles stain", "carpet clean", "water tank clean", "overhead tank cleaning", "sump cleaning", "window clean"
    ],
    unitCost: { item: "Bathroom deep descaling", rate: 599, unit: "per bathroom" },
    avgCost: "₹999 – ₹1,800 for 1BHK; ₹2,200 – ₹4,500 for full 3BHK deep sanitisation",
    tips: "Professional deep cleaning removes invisible hard-water scale and grease trap bacteria that regular mopping misses."
  },
  {
    category: "Construction",
    icon: "🧱",
    keywords: [
      "construct", "mason", "brick", "cement", "wall repair", "slab", "plaster", "renovation", "civil",
      "remodel", "demolition", "pillar", "kottanar", "sand", "gravel", "concrete", "lintel", "crack repair",
      "beam", "foundation", "compound wall", "parapet", "staircase"
    ],
    unitCost: { item: "Wall plastering & masonry fix", rate: 65, unit: "per sq. ft." },
    avgCost: "₹45 – ₹80 per sq. ft. for plastering; daily mason rates ₹800 – ₹1,200 / day",
    tips: "Always hire certified structural civil masons before modifying walls to preserve load-bearing support."
  },
  {
    category: "AC Repair",
    icon: "❄️",
    keywords: [
      "ac", "air condition", "cooling", "compressor", "gas refill", "gas charging", "split ac", "filter",
      "water leakage ac", "ac dripping", "not cooling", "fan motor ac", "ac cool aagala", "ac kaathu varala",
      "window ac", "inverter ac", "copper pipe", "remote not working", "ac servicing", "jet wash"
    ],
    unitCost: { item: "Split AC Foam Jet Deep Clean", rate: 499, unit: "per unit" },
    avgCost: "₹499 for general foam jet service; ₹1,800 – ₹2,800 for nitrogen test & gas charging",
    tips: "Clean split AC mesh filters every 2 weeks during peak summer to maintain airflow, boost cooling, and cut power bills."
  },
  {
    category: "Appliance Repair",
    icon: "📺",
    keywords: [
      "appliance", "fridge", "refrigerator", "washing machine", "microwave", "oven", "tv", "induction",
      "defrost", "mixer", "grinder", "ro", "water purifier", "geyser", "water heater", "chimney",
      "mixie", "washing machine spin", "washing machine drain", "fridge cooling illa", "ro filter", "tds"
    ],
    unitCost: { item: "Appliance inspection & diagnose", rate: 299, unit: "per appliance" },
    avgCost: "₹300 – ₹700 inspection fee; motor / PCB repairs based on component replacement",
    tips: "Always unplug appliances from wall power outlets before inspecting plugs, cables, or filters."
  },
  {
    category: "Gardening",
    icon: "🌿",
    keywords: [
      "garden", "lawn", "plants", "grass", "trimming", "landscaping", "organic", "pruning", "potting",
      "terrace garden", "fertilizer", "thottam", "sedikku", "tree cutting", "weed", "soil", "compost"
    ],
    unitCost: { item: "Lawn trimming & plant pruning", rate: 499, unit: "per visit" },
    avgCost: "₹500 – ₹1,200 per maintenance visit; terrace garden setups starting from ₹3,000",
    tips: "Water potted plants early morning or after sunset to minimize moisture evaporation and root stress."
  },
  {
    category: "Pest Control",
    icon: "🐜",
    keywords: [
      "pest", "termite", "cockroach", "bed bug", "mosquito", "rodent", "rat", "insects", "borer",
      "ant infestation", "karapan poochi", "karan", "karan poochi", "wood borer", "fogging", "pest spray"
    ],
    unitCost: { item: "Kitchen cockroach herbal gel service", rate: 899, unit: "per apartment" },
    avgCost: "₹800 – ₹1,500 for cockroach gel; ₹2,500 – ₹5,000 for anti-termite warranty treatment",
    tips: "Opt for government-approved odorless herbal pest control if you have pets or elderly family members at home."
  },
  {
    category: "Welding",
    icon: "⚙️",
    keywords: [
      "weld", "grill", "gate", "iron", "steel", "railing", "metal", "balcony", "fabrication", "safety grill",
      "iron gate", "iron door", "arc welding", "gas welding", "stainless steel", "gate hinge broken", "shed"
    ],
    unitCost: { item: "Hinge welding / Minor grill repair", rate: 450, unit: "per spot" },
    avgCost: "₹400 – ₹900 for minor grill fixes; custom stainless steel works by weight / design",
    tips: "Apply anti-rust red oxide primer before painting any welded outdoor iron gate or balcony grill."
  },
  {
    category: "Masonry & Tiling",
    icon: "🏗️",
    keywords: [
      "tile", "tiling", "granite", "marble", "countertop", "grouting", "cracked tile", "flooring", "epoxy",
      "bathroom tile", "floor tile", "wall tile", "tile replacement", "tile fixing", "skirting", "paver block"
    ],
    unitCost: { item: "Floor tile laying & leveling", rate: 35, unit: "per sq. ft." },
    avgCost: "₹25 – ₹45 per sq. ft. for floor tiling installation",
    tips: "Epoxy grouting in bathrooms permanently prevents water seepage between floor tiles."
  },
  {
    category: "Waterproofing",
    icon: "💧",
    keywords: [
      "waterproof", "damp", "seepage", "roof leak", "terrace leak", "ceiling damp", "crack", "membrane",
      "rain leak", "waterproofing coating", "dr fixit", "tar felt", "bathroom seepage", "wall moisture"
    ],
    unitCost: { item: "Terrace elastomeric coating (2 coats)", rate: 45, unit: "per sq. ft." },
    avgCost: "₹35 – ₹65 per sq. ft. for elastomeric membrane terrace coating",
    tips: "Seal roof cracks before monsoon begins; apply two coats of waterproofing primer reinforced with glass fiber mesh."
  },
  {
    category: "Other",
    icon: "🧰",
    keywords: [
      "cctv", "handyman", "drill", "mirror", "curtain", "mounting", "lock change", "doorbell", "camera",
      "rod", "shelf", "tv mount", "photo frame", "curtain rod", "odd job", "general helper", "fitting"
    ],
    unitCost: { item: "Drilling & wall fixture mounting", rate: 199, unit: "up to 3 items" },
    avgCost: "₹200 – ₹450 for mounting / drilling; CCTV cameras from ₹1,200 / channel",
    tips: "Our verified multi-trade handymen can bundle multiple odd jobs around the house into one single visit!"
  }
];

// In-Depth Diagnostic Knowledge Matrix (35+ Real-World Home Repair Scenarios)
const DIAGNOSTIC_SCENARIOS = [
  // --- ELECTRICAL ---
  {
    id: "mcb_tripping",
    match: ["mcb", "trip", "breaker", "circuit breaker", "power trip", "tripping"],
    category: "Electrician",
    urgency: "⚠️ High Priority",
    urgencyClass: "high",
    title: "Circuit Breaker (MCB / ELCB) Constantly Tripping",
    rootCause: "An MCB trips for 3 main reasons: (1) **Circuit Overload** (drawing more current than rated, e.g., running AC, geyser, and microwave simultaneously on a 16A line); (2) **Short Circuit** (live wire directly contacting neutral due to insulation breakdown or rodent damage); or (3) **Earth Leakage** (faulty heating coil or motor body leaking current to ground).",
    safetyPrecaution: "Unplug all appliances on that circuit. Reset the MCB once. If it trips immediately with zero appliances plugged in, keep it OFF—it is a wiring short circuit. Never force a breaker to stay up.",
    estimatedCost: "₹250 – ₹450 (diagnose & fault isolation); ₹350 – ₹900 (MCB replacement / wiring repair)",
    estimatedTime: "30 – 60 mins",
    suggestions: [
      "⚡ Why does MCB trip when turning on Geyser?",
      "💰 How much to replace a 32A MCB?",
      "👨‍🔧 Book a verified Electrician now"
    ]
  },
  {
    id: "sparking_socket",
    match: ["spark", "burning smell", "smoke socket", "socket spark", "switch burn", "shock"],
    category: "Electrician",
    urgency: "🚨 Emergency",
    urgencyClass: "emergency",
    title: "Sparking Switch or Burning Smell from Wall Outlet",
    rootCause: "Sparking is caused by **loose terminal screws**, worn-out internal brass clips creating an electrical arc, or excessive load causing contacts to melt and char the socket housing.",
    safetyPrecaution: "Do NOT plug or unplug anything. Flip off that switch and immediately shut off the breaker for that room on your main Distribution Board. Avoid touching the socket with bare hands.",
    estimatedCost: "₹200 – ₹350 (replace damaged socket & re-terminate wires)",
    estimatedTime: "20 – 35 mins",
    suggestions: [
      "⚡ How to test if socket is safe?",
      "💰 Modular switchboard replacement cost",
      "👨‍🔧 Book an Emergency Electrician"
    ]
  },
  {
    id: "fan_slow_humming",
    match: ["fan slow", "fan hum", "fan noise", "fan suthala", "fan not spinning", "ceiling fan slow"],
    category: "Electrician",
    urgency: "ℹ️ Standard Maintenance",
    urgencyClass: "normal",
    title: "Ceiling Fan Spinning Very Slowly or Humming Loudly",
    rootCause: "In 90% of cases, the **fan run capacitor** (typically 2.25µF to 3.15µF) has degraded and lost capacitance, failing to create the required starting torque. Dry ball bearings can also cause mechanical drag and a humming sound.",
    safetyPrecaution: "Keep the fan switch off. Never use a stick or hand to spin-start a stalled fan, as the motor winding can overheat and catch fire.",
    estimatedCost: "₹150 – ₹300 (capacitor replacement + lubrication)",
    estimatedTime: "15 – 25 mins",
    suggestions: [
      "⚡ Which capacitor rating is best for my fan?",
      "💰 Ceiling fan rewiring vs new fan cost",
      "👨‍🔧 Schedule fan service"
    ]
  },
  {
    id: "inverter_beeping",
    match: ["inverter beep", "ups beep", "inverter overload", "inverter trip", "inverter sound"],
    category: "Electrician",
    urgency: "⚠️ High Priority",
    urgencyClass: "high",
    title: "Home Inverter Beeping Continuously / Showing Overload",
    rootCause: "Continuous beeping indicates: (1) **Overload Alert** (connected load exceeds inverter VA capacity); (2) **Low Battery Voltage** (battery distilled water dried up or cell dead); or (3) **Faulty Charging Relay**.",
    safetyPrecaution: "Switch off heavy loads (fridge, washing machine) connected to the inverter line. Inspect the battery water level float indicators. Add only battery-grade distilled water if low.",
    estimatedCost: "₹300 – ₹600 (service & battery terminal de-sulfation); battery replacement based on size",
    estimatedTime: "30 – 45 mins",
    suggestions: [
      "⚡ How to check tubular battery distilled water?",
      "💰 Cost to replace inverter battery",
      "👨‍🔧 Book an Inverter Specialist"
    ]
  },

  // --- AC REPAIR ---
  {
    id: "ac_not_cooling",
    match: ["ac not cooling", "ac cool aagala", "ac blow hot", "air conditioner cooling", "ac gas leak"],
    category: "AC Repair",
    urgency: "⚠️ High Priority",
    urgencyClass: "high",
    title: "Split AC Running but Blowing Normal / Warm Air",
    rootCause: "Top causes: (1) **Refrigerant Gas Leakage** (R32 / R410a leak in copper flare joints or cooling coil); (2) **Clogged Air Filter & Evaporator Fins** (blocking airflow); or (3) **Defective Compressor Capacitor** (outdoor fan runs but compressor fails to start).",
    safetyPrecaution: "Turn off the AC if the copper pipes at the outdoor unit show white ice frosting. Running a gas-starved compressor will burn its motor windings.",
    estimatedCost: "₹499 (foam jet wash); ₹1,800 – ₹2,800 (nitrogen leak test + gas charging)",
    estimatedTime: "45 – 90 mins",
    suggestions: [
      "❄️ How to know if AC gas is over?",
      "💰 Gas charging cost for 1.5 Ton Split AC",
      "👨‍🔧 Book an AC Technician now"
    ]
  },
  {
    id: "ac_water_leaking",
    match: ["ac water leak", "ac water drip", "ac drip inside", "ac thanni kottuthu", "ac leaking water"],
    category: "AC Repair",
    urgency: "⚠️ High Priority",
    urgencyClass: "high",
    title: "Water Dripping from Split AC Indoor Unit Inside Room",
    rootCause: "The **condensate drain pipe** is choked with algae, dust slime, or mold, causing the indoor drain tray to overflow. It can also happen if the indoor unit is mounted unlevel or insulation on copper pipes has decayed.",
    safetyPrecaution: "Place a bucket underneath to protect floor furniture and switch off the AC to prevent water from reaching internal electronics and wall sockets.",
    estimatedCost: "₹350 – ₹600 (high-pressure drain flush & tray descaling)",
    estimatedTime: "30 – 45 mins",
    suggestions: [
      "❄️ Can I clear AC drain pipe with vacuum?",
      "💰 AC foam jet deep cleaning price",
      "👨‍🔧 Book AC drain repair"
    ]
  },

  // --- PLUMBING ---
  {
    id: "pipe_burst_leak",
    match: ["pipe burst", "pipe leak", "water gushing", "thanni leak", "pipe crack", "pipe broken"],
    category: "Plumber",
    urgency: "🚨 Emergency",
    urgencyClass: "emergency",
    title: "Burst Water Pipe or Heavy Water Line Leakage",
    rootCause: "CPVC/UPVC joints fail due to water hammer pressure surges, degraded solvent cement, age brittleness, or physical wall drilling damage.",
    safetyPrecaution: "Immediately shut off your home's main water supply gate valve (located near the overhead tank on the terrace or near the sump motor).",
    estimatedCost: "₹350 – ₹800 (section cutout, new coupling & joint replacement)",
    estimatedTime: "30 – 60 mins",
    suggestions: [
      "🔧 Where is my main water gate valve located?",
      "💰 Cost to replace concealed CPVC pipe",
      "👨‍🔧 Call Emergency Plumber"
    ]
  },
  {
    id: "tap_dripping",
    match: ["tap drip", "tap leak", "faucet drip", "leaking tap", "tap sotha", "tap loose"],
    category: "Plumber",
    urgency: "ℹ️ Standard Maintenance",
    urgencyClass: "normal",
    title: "Continuous Dripping from Kitchen / Bathroom Tap",
    rootCause: "The internal **ceramic disc cartridge** or rubber washer inside the tap spindle has worn down from hard-water mineral deposits.",
    safetyPrecaution: "Do not over-tighten the tap handle with pliers, as this can snap the brass thread inside the wall elbow.",
    estimatedCost: "₹150 – ₹300 (cartridge / washer replacement); tap replacement ₹250 labor",
    estimatedTime: "15 – 30 mins",
    suggestions: [
      "🔧 How to fix dripping tap DIY?",
      "💰 Quarter-turn ceramic cartridge price",
      "👨‍🔧 Book Plumber"
    ]
  },
  {
    id: "drain_clog",
    match: ["drain clog", "sink block", "toilet block", "drain slow", "water not draining", "basin block"],
    category: "Plumber",
    urgency: "⚠️ High Priority",
    urgencyClass: "high",
    title: "Kitchen Sink or Bathroom Floor Drain Water Backing Up",
    rootCause: "Accumulation of food grease, soap scum, and hair in the P-trap or main drain line.",
    safetyPrecaution: "Avoid pouring excessive concentrated acid into CPVC pipes—it generates high heat that can melt pipe joints and generate toxic fumes.",
    estimatedCost: "₹300 – ₹700 (mechanical snake drain auger clearance)",
    estimatedTime: "25 – 45 mins",
    suggestions: [
      "🔧 Baking soda & vinegar drain clearing method",
      "💰 Heavy duty drain machine auger price",
      "👨‍🔧 Book Drain Cleaning"
    ]
  },
  {
    id: "geyser_not_heating",
    match: ["geyser not heating", "water heater not hot", "geyser cold", "geyser shock", "geyser trip"],
    category: "Plumber",
    urgency: "⚠️ High Priority",
    urgencyClass: "high",
    title: "Geyser Water Not Heating or Tripping Circuit Breaker",
    rootCause: "Hard-water scale calcification coats the heating element, burning it out. A faulty thermostat can also cut power prematurely.",
    safetyPrecaution: "If the geyser trips the MCB when turned on, NEVER touch the water tap while it is plugged in. Turn off the wall switch immediately.",
    estimatedCost: "₹350 – ₹650 (element replacement + tank descaling); heating coil ₹600 – ₹1,200",
    estimatedTime: "40 – 60 mins",
    suggestions: [
      "🔧 How to descale geyser heating element?",
      "💰 Instant geyser repair charges",
      "👨‍🔧 Book Geyser Service"
    ]
  },

  // --- APPLIANCE REPAIR ---
  {
    id: "washing_machine_spin",
    match: ["washing machine spin", "washing machine drum", "machine not spinning", "clothes soaking wet", "machine vibrating"],
    category: "Appliance Repair",
    urgency: "⚠️ High Priority",
    urgencyClass: "high",
    title: "Washing Machine Drum Not Spinning / Severe Shaking",
    rootCause: "Common causes: (1) **Worn Drive Belt** or motor coupling; (2) **Broken Suspension Springs** causing violent drum wobbling; or (3) **Faulty Lid Switch / Door Lock Sensor** preventing the spin cycle.",
    safetyPrecaution: "Do not overload the machine. If the machine walks across the floor or makes loud screeching noises, stop the cycle immediately to prevent motor burnout.",
    estimatedCost: "₹350 – ₹750 labor; belt / suspension parts at component cost",
    estimatedTime: "45 – 75 mins",
    suggestions: [
      "📺 Front load vs Top load spin issues",
      "💰 Washing machine belt replacement cost",
      "👨‍🔧 Book Appliance Technician"
    ]
  },
  {
    id: "fridge_not_cooling",
    match: ["fridge not cooling", "refrigerator warm", "freezer cold but fridge warm", "fridge cooling illa", "refrigerator frost"],
    category: "Appliance Repair",
    urgency: "⚠️ High Priority",
    urgencyClass: "high",
    title: "Refrigerator Freezer Working but Lower Fridge Compartment Warm",
    rootCause: "In Frost-Free refrigerators, this is typically caused by a **failed defrost heater or bi-metal sensor**, causing heavy ice to choke the air damper duct that sends cold air to the lower section.",
    safetyPrecaution: "Perform a manual 12-hour defrost by turning off power and leaving doors open. If cooling returns temporarily and dies again after 4 days, the defrost circuit needs replacement.",
    estimatedCost: "₹400 – ₹850 (defrost timer / bi-metal thermostat replacement)",
    estimatedTime: "45 – 60 mins",
    suggestions: [
      "📺 Refrigerator gas charging cost",
      "💰 Bi-metal sensor replacement price",
      "👨‍🔧 Book Refrigerator Repair"
    ]
  },
  {
    id: "ro_purifier_bad_taste",
    match: ["ro filter", "purifier taste", "water purifier smell", "ro water slow", "ro membrane", "tds high"],
    category: "Appliance Repair",
    urgency: "ℹ️ Standard Maintenance",
    urgencyClass: "normal",
    title: "RO Water Purifier Tastes Bad or Flow Rate Very Slow",
    rootCause: "Sediment and carbon pre-filters are choked with silt and chlorine, or the **semi-permeable RO membrane** has scaled up, causing high TDS and foul taste.",
    safetyPrecaution: "Stop drinking the water if TDS exceeds 250 ppm or has an off-odor. Replace sediment filters every 6 to 9 months to protect the costly RO membrane.",
    estimatedCost: "₹350 labor; filter cartridge set ₹1,200 – ₹2,500",
    estimatedTime: "30 – 45 mins",
    suggestions: [
      "📺 What is the ideal drinking water TDS?",
      "💰 RO complete filter kit replacement price",
      "👨‍🔧 Book Water Purifier Service"
    ]
  },

  // --- CARPENTRY ---
  {
    id: "door_swelling",
    match: ["door swelling", "door stuck", "door tight", "door frame rub", "monsoon door"],
    category: "Carpenter",
    urgency: "ℹ️ Standard Maintenance",
    urgencyClass: "normal",
    title: "Wooden Door Sticking or Scraping Floor / Frame",
    rootCause: "High atmospheric humidity causes porous wood fibers to absorb moisture and expand. Worn hinge pins can also cause the door to sag.",
    safetyPrecaution: "Check hinge screws first—tightening top screws often lifts the door without needing wood shaving.",
    estimatedCost: "₹250 – ₹500 (plane edges, re-align hinges & adjust latch)",
    estimatedTime: "30 – 45 mins",
    suggestions: [
      "🪚 How to seal wooden door edges against humidity?",
      "💰 Heavy duty brass hinge replacement price",
      "👨‍🔧 Book a Carpenter"
    ]
  },
  {
    id: "drawer_lock_stuck",
    match: ["drawer lock", "lock stuck", "key jammed", "door lock repair", "cupboard lock"],
    category: "Carpenter",
    urgency: "⚠️ High Priority",
    urgencyClass: "high",
    title: "Cupboard / Drawer Lock Jammed or Key Won't Turn",
    rootCause: "Internal brass pin tumblers have seized due to dust, lack of graphite lubrication, or bent key teeth.",
    safetyPrecaution: "Avoid forcing the key with pliers—it will snap inside the cylinder. Do not spray sticky cooking oil.",
    estimatedCost: "₹200 – ₹450 (lock overhaul or cylinder replacement)",
    estimatedTime: "20 – 35 mins",
    suggestions: [
      "🪚 How to extract a broken key from a lock?",
      "💰 Godrej / Europa lock replacement cost",
      "👨‍🔧 Book Locksmith Carpenter"
    ]
  },

  // --- WATERPROOFING & PAINTING ---
  {
    id: "terrace_roof_seepage",
    match: ["roof leak", "terrace leak", "ceiling damp", "water seepage ceiling", "terrace crack"],
    category: "Waterproofing",
    urgency: "⚠️ High Priority",
    urgencyClass: "high",
    title: "Rainwater Dripping from Ceiling / Terrace Slab Cracks",
    rootCause: "Thermal expansion creates micro-cracks in the terrace weathering course or parapet wall joints. Trapped water penetrates porous RCC concrete.",
    safetyPrecaution: "Check for pooling water near terrace rainwater downpipes and clear debris. Avoid heavy walking on damp gypsum false ceilings.",
    estimatedCost: "₹35 – ₹65 per sq. ft. (crack grooving, polyurethane sealant & elastomeric membrane coats)",
    estimatedTime: "2 – 3 days",
    suggestions: [
      "💧 Fiber-mesh terrace waterproofing price",
      "💰 Cost for 1,000 sq ft terrace waterproofing",
      "👨‍🔧 Book Waterproofing Expert"
    ]
  },
  {
    id: "wall_dampness",
    match: ["wall damp", "paint peeling", "seepage wall", "efflorescence", "salt wall", "white powder wall"],
    category: "Painter",
    urgency: "ℹ️ Standard Maintenance",
    urgencyClass: "normal",
    title: "Paint Peeling, Blistering, and White Powder on Wall",
    rootCause: "Rising dampness or adjoining bathroom tile joint seepage carries mineral salts through masonry. As moisture evaporates, salt crystallization pushes paint off.",
    safetyPrecaution: "Do not paint directly over damp walls—it will blister within 3 weeks. The moisture source must be sealed with a waterproofing barrier first.",
    estimatedCost: "₹18 – ₹35 per sq. ft. (anti-damp chemical coating + waterproof primer + 2 coats premium emulsion)",
    estimatedTime: "1 – 2 days",
    suggestions: [
      "🎨 Dr. Fixit Dampguard application method",
      "💰 2BHK wall painting full quote",
      "👨‍🔧 Book a Painter"
    ]
  },

  // --- PEST CONTROL ---
  {
    id: "termite_wood_damage",
    match: ["termite", "karan", "wood borer", "mud tube", "wood hollow", "termite mud"],
    category: "Pest Control",
    urgency: "⚠️ High Priority",
    urgencyClass: "high",
    title: "Termite Mud Tubes on Door Frames, Skirting, or Cupboards",
    rootCause: "Subterranean termites build mud foraging tunnels from ground soil to access cellulose in wooden door frames and furniture.",
    safetyPrecaution: "Do not spray aerosol insect repellent on mud tubes—it repels them into deeper structural timber. Keep affected areas dry.",
    estimatedCost: "₹2,500 – ₹5,000 (pressure chemical drilling & wood injection with warranty)",
    estimatedTime: "2 – 4 hours",
    suggestions: [
      "🐜 Odorless herbal anti-termite treatment",
      "💰 Termite treatment cost per sq ft",
      "👨‍🔧 Book Pest Control Expert"
    ]
  },

  // --- WELDING & FABRICATION ---
  {
    id: "balcony_safety_grill",
    match: ["grill", "gate broken", "balcony safety", "welding", "iron gate", "hinge weld"],
    category: "Welding",
    urgency: "⚠️ High Priority",
    urgencyClass: "high",
    title: "Broken Gate Hinge or Balcony Safety Grill Installation",
    rootCause: "Outdoor iron gates and window grills rust at anchor joints due to rainwater exposure, causing hinge sagging and broken weld spots.",
    safetyPrecaution: "If a balcony railing is loose, restrict access immediately. Secure loose sections with heavy-duty wire until welded.",
    estimatedCost: "₹450 – ₹900 (spot welding & hinge reinforcement); custom safety grills ₹140 – ₹220 / sq. ft.",
    estimatedTime: "1 – 3 hours",
    suggestions: [
      "⚙️ MS vs Stainless Steel safety grill price",
      "💰 Spot welding repair minimum charge",
      "👨‍🔧 Book Certified Welder"
    ]
  }
];

// Helper to extract trade, area, and problem from query & history
function extractContext(query, history = []) {
  const combined = [
    query,
    ...history.map(h => (typeof h === "string" ? h : h.text || h.content || h.message || ""))
  ].join(" ").toLowerCase();

  // 1. Detect area (Coimbatore, Chennai, and other TN hubs)
  let detectedArea = null;
  for (const area of AREAS_AND_CITIES) {
    if (combined.includes(area.toLowerCase())) {
      detectedArea = area;
      break;
    }
  }

  // 2. Detect trade category
  let matchedTrade = null;
  let highestScore = 0;

  for (const trade of TRADES) {
    let score = 0;
    for (const kw of trade.keywords) {
      if (query.toLowerCase().includes(kw)) score += 3;
      else if (combined.includes(kw)) score += 1;
    }
    if (query.toLowerCase().includes(trade.category.toLowerCase())) score += 6;

    if (score > highestScore) {
      highestScore = score;
      matchedTrade = trade;
    }
  }

  // 3. Detect diagnostic scenario
  let matchedDiagnostic = null;
  for (const diag of DIAGNOSTIC_SCENARIOS) {
    for (const phrase of diag.match) {
      if (query.toLowerCase().includes(phrase)) {
        matchedDiagnostic = diag;
        break;
      }
      if (phrase.includes(" ")) {
        const words = phrase.split(" ");
        if (words.every(w => combined.includes(w))) {
          matchedDiagnostic = diag;
          break;
        }
      }
    }
    if (matchedDiagnostic) break;
  }

  return {
    area: detectedArea,
    trade: matchedTrade,
    diagnostic: matchedDiagnostic,
    score: highestScore
  };
}

// Fetch real approved workmen with smart location sorting
async function getRecommendedWorkmen(category, area = null) {
  if (!category) return [];
  try {
    let queryText = "";
    let params = [];

    if (area) {
      queryText = `
        SELECT u.id, u.name, u.location, u.phone, wp.service, wp.experience, wp.description, wp.availability
        FROM users u
        JOIN workman_profiles wp ON wp.user_id = u.id
        WHERE wp.application_status = 'Approved'
          AND wp.service ILIKE '%' || $1 || '%'
        ORDER BY
          CASE WHEN u.location ILIKE '%' || $2 || '%' THEN 0 ELSE 1 END,
          wp.experience DESC
        LIMIT 3
      `;
      params = [category.slice(0, 5), area];
    } else {
      queryText = `
        SELECT u.id, u.name, u.location, u.phone, wp.service, wp.experience, wp.description, wp.availability
        FROM users u
        JOIN workman_profiles wp ON wp.user_id = u.id
        WHERE wp.application_status = 'Approved'
          AND wp.service ILIKE '%' || $1 || '%'
        ORDER BY wp.experience DESC
        LIMIT 3
      `;
      params = [category.slice(0, 5)];
    }

    const res = await pool.query(queryText, params);
    return res.rows;
  } catch (err) {
    console.warn("AI DB query warning:", err.message);
    return [];
  }
}

// Dynamic mathematical cost estimator (e.g. "1200 sq ft painting", "3 fans")
function calculateDynamicQuote(query, trade) {
  if (!trade || !trade.unitCost) return null;

  // Match numbers followed by sq ft / fans / doors / units / points
  const sqftMatch = query.match(/(\d+)\s*(?:sq\s*ft|sqft|square\s*feet|feet)/i);
  const qtyMatch = query.match(/(\d+)\s*(?:unit|units|point|points|fan|fans|door|doors|tap|taps|ac|nos|pieces)/i);

  let quantity = 0;
  let unitName = "";

  if (sqftMatch) {
    quantity = parseInt(sqftMatch[1], 10);
    unitName = "sq. ft.";
  } else if (qtyMatch) {
    quantity = parseInt(qtyMatch[1], 10);
    unitName = "units";
  }

  if (quantity > 0 && quantity < 100000) {
    const total = quantity * trade.unitCost.rate;
    const minEst = Math.round(total * 0.9);
    const maxEst = Math.round(total * 1.15);

    return {
      quantity,
      unitName,
      rate: trade.unitCost.rate,
      serviceName: trade.unitCost.item,
      totalMin: minEst.toLocaleString("en-IN"),
      totalMax: maxEst.toLocaleString("en-IN")
    };
  }

  return null;
}

// Advanced Rule-Based & Diagnostic LocalWork Intelligence Engine
async function getExpertLocalWorkResponse(userQuery, history = []) {
  const query = userQuery.toLowerCase().trim();
  const context = extractContext(userQuery, history);
  const trade = context.trade;
  const area = context.area;
  const diagnostic = context.diagnostic;

  // Case A: Specific Technical Problem Diagnostic Match
  if (diagnostic) {
    const targetTrade = TRADES.find(t => t.category === diagnostic.category) || trade;
    const workmen = await getRecommendedWorkmen(diagnostic.category, area);

    let reply = `### ${diagnostic.title}\n\n`;
    reply += `**Urgency Level:** ${diagnostic.urgency}\n\n`;
    reply += `**Root Cause Analysis:**\n${diagnostic.rootCause}\n\n`;
    reply += `**Immediate Safety Precaution:**\n${diagnostic.safetyPrecaution}\n\n`;
    reply += `**Estimated Pricing & Time:**\n`;
    reply += `• **Labor & Fix:** ${diagnostic.estimatedCost}\n`;
    reply += `• **Expected Time:** ${diagnostic.estimatedTime}\n\n`;

    if (workmen.length > 0) {
      const areaNote = area ? ` in & around **${area}**` : "";
      reply += `**Verified ${diagnostic.category}s Available Now${areaNote}:**\n`;
      reply += workmen.map((w, idx) => `• **${w.name}** (${w.location}) — ${w.experience} yrs exp · *${w.availability}*`).join("\n");
      reply += `\n\n*Click "Book" directly on any card below to schedule a visit.*`;
    } else {
      reply += `You can book a verified **${diagnostic.category}** directly on LocalWork with doorstep service and guaranteed satisfaction.`;
    }

    return {
      reply,
      urgency: diagnostic.urgencyClass,
      category: diagnostic.category,
      location: area,
      diagnostics: {
        rootCause: diagnostic.rootCause,
        urgency: diagnostic.urgency,
        estimatedCost: diagnostic.estimatedCost,
        estimatedTime: diagnostic.estimatedTime,
        safetyTip: diagnostic.safetyPrecaution
      },
      workmen,
      suggestions: diagnostic.suggestions,
      action: {
        type: "filter",
        category: diagnostic.category,
        label: `⚡ Book ${diagnostic.category}`
      }
    };
  }

  // Case B: Dynamic Pricing & Cost Calculation Inquiries
  if (query.includes("price") || query.includes("cost") || query.includes("rate") || query.includes("charge") || query.includes("how much") || query.includes("estimate") || query.includes("quote")) {
    if (trade) {
      const dynamicCalc = calculateDynamicQuote(query, trade);
      const workmen = await getRecommendedWorkmen(trade.category, area);

      let reply = `### Transparent Rates for ${trade.icon} ${trade.category}\n\n`;

      if (dynamicCalc) {
        reply += `**Estimated Quote for ${dynamicCalc.quantity} ${dynamicCalc.unitName} (${dynamicCalc.serviceName}):**\n`;
        reply += `• **Base Rate:** ₹${dynamicCalc.rate} ${trade.unitCost.unit}\n`;
        reply += `• **Estimated Total:** **₹${dynamicCalc.totalMin} – ₹${dynamicCalc.totalMax}** (Labor & standard materials)\n\n`;
      } else {
        reply += `• **Typical Cost Range:** ${trade.avgCost}\n`;
        reply += `• **Expert Safety Tip:** ${trade.tips}\n\n`;
      }

      if (workmen.length > 0) {
        const areaNote = area ? ` in ${area}` : "";
        reply += `**Top Rated ${trade.category}s Available${areaNote}:**\n`;
        reply += workmen.map(w => `• **${w.name}** (${w.location}) — ${w.experience} yrs exp · *${w.availability}*`).join("\n");
      }

      return {
        reply,
        urgency: "normal",
        category: trade.category,
        location: area,
        workmen,
        suggestions: [
          `⚡ How do I book a ${trade.category}?`,
          `📍 Find ${trade.category}s in ${area || "Coimbatore / Chennai"}`,
          `🔧 What tools does the workman bring?`
        ],
        action: {
          type: "filter",
          category: trade.category,
          label: `View ${trade.category}s`
        }
      };
    }

    return {
      reply: `### Transparent LocalWork Pricing Guide (Tamil Nadu)\n\n` +
        `• **⚡ Electrical & 🔧 Plumbing:** ₹200 – ₹600 for standard fixes; parts at MRP.\n` +
        `• **🪚 Carpentry:** ₹300 – ₹800 for door/lock fixes; custom woodwork ₹1,500+.\n` +
        `• **❄️ AC Repair:** ₹499 foam jet service; ₹1,800 – ₹2,800 gas leak repair & refill.\n` +
        `• **🎨 Painting:** ₹12 – ₹25 per sq. ft. interior; ₹15 – ₹35 exterior.\n` +
        `• **🧹 Deep Cleaning:** ₹999 – ₹1,800 (1BHK); ₹2,200 – ₹4,500 (3BHK).\n` +
        `• **💧 Waterproofing:** ₹35 – ₹65 per sq. ft. elastomeric roof membrane.\n\n` +
        `*Specify your job (e.g. "paint 1000 sq ft" or "fix 2 fans") for a dynamic itemized breakdown!*`,
      urgency: "normal",
      suggestions: [
        "⚡ MCB tripping cost",
        "❄️ Split AC gas refill cost",
        "🔧 Leaking pipe repair cost",
        "🎨 2BHK painting quote"
      ],
      action: { type: "explore", label: "Explore Trades" }
    };
  }

  // Case C: How to Book or How it Works
  if (query.includes("how to book") || query.includes("how does it work") || query.includes("how do i book") || query.includes("booking process")) {
    return {
      reply: `### How LocalWork Works in 3 Easy Steps\n\n` +
        `1. **Browse Verified Talent:** Choose your trade (Electrician, Plumber, AC Repair, Welding, etc.) and filter by your locality.\n` +
        `2. **Schedule in 30 Seconds:** Click **"Book"** on your preferred workman's card, pick your date and convenient time slot, and describe the task.\n` +
        `3. **Doorstep Service:** The workman receives your request instantly, confirms the visit, and arrives on time with all required tools!`,
      urgency: "normal",
      suggestions: [
        "⚡ Book an Electrician",
        "🔧 Book a Plumber",
        "💼 Apply as a Workman",
        "💰 View Pricing Guide"
      ],
      action: { type: "explore", label: "Browse Services" }
    };
  }

  // Case D: Workman Applications
  if (
    query.includes("workman application") ||
    query.includes("join as workman") ||
    query.includes("join as a workman") ||
    query.includes("become a workman") ||
    query.includes("apply as workman") ||
    query.includes("apply as a workman") ||
    query.includes("register as workman") ||
    (query.includes("workman") && (query.includes("earn") || query.includes("join") || query.includes("apply") || query.includes("register") || query.includes("job") || query.includes("income")))
  ) {
    return {
      reply: `### Join LocalWork as an Approved Service Professional\n\n` +
        `Are you a skilled technician or tradesperson in Coimbatore, Chennai, or Tamil Nadu? Earn steady income with zero upfront platform fees:\n\n` +
        `1. Log in or create your LocalWork account.\n` +
        `2. Click **"Become a Workman"** in the sidebar navigation.\n` +
        `3. Select your primary trade, enter your experience (in years), and write a summary of your skills.\n` +
        `4. Our admin team verifies and approves applications within 24 hours so you can start receiving local customer bookings!`,
      urgency: "normal",
      suggestions: [
        "📝 Open Workman Application Form",
        "💼 What trades are in demand?",
        "💰 How do workman payouts work?"
      ],
      action: { type: "apply_workman", label: "Apply as Workman" }
    };
  }

  // Case E: Emergency queries
  if (query.includes("emergency") || query.includes("urgent") || query.includes("fire") || query.includes("shock") || query.includes("gas leak") || query.includes("pipe burst") || query.includes("flooding")) {
    if (trade) {
      const workmen = await getRecommendedWorkmen(trade.category, area);
      const areaPrefix = area ? ` in & around **${area}**` : " in your area";

      return {
        reply: `### 🚨 Urgent Emergency ${trade.category} Assistance${areaPrefix}\n\n` +
          `**Safety Warning:** ${trade.tips}\n\n` +
          `We have prioritized verified **${trade.category}s** available for immediate dispatch.\n\n` +
          (workmen.length > 0
            ? `**Emergency ${trade.category}s On-Call Now:**\n` + workmen.map(w => `• **${w.name}** (${w.location}) — ${w.experience} yrs exp · *${w.availability}*`).join("\n") + `\n\n*Click "Book" directly on any card below for rapid response!*`
            : `Search our emergency network to confirm the nearest technician.`),
        urgency: "emergency",
        category: trade.category,
        location: area,
        workmen,
        suggestions: [
          `⚡ Contact nearest ${trade.category}`,
          `🚰 Emergency safety protocol`,
          `💰 Emergency service visit fee`
        ],
        action: {
          type: "filter",
          category: trade.category,
          label: `🚨 Book Emergency ${trade.category}`
        }
      };
    }

    return {
      reply: `### 🚨 Immediate Home Emergency Protocol\n\n` +
        `1. **Electrical Sparking / Burning Odor:** Immediately flip OFF the main Distribution Board (MCB) switch. Do not touch switches or appliances.\n` +
        `2. **Water Line Burst / Gushing:** Close the main water isolation wheel valve at your overhead tank or water meter immediately.\n` +
        `3. **LPG Gas Cylinder Smell:** Do NOT touch any electric switch, torch, or mobile phone. Open all doors and windows, and close the regulator valve.\n\n` +
        `Once safe, search our emergency tradespeople to resolve the fault permanently.`,
      urgency: "emergency",
      suggestions: [
        "⚡ Call Emergency Electrician",
        "🔧 Call Emergency Plumber",
        "🚰 Where is the main water valve?"
      ],
      action: { type: "explore", label: "Find Emergency Workman" }
    };
  }

  // Case F: Trade Mentioned (General)
  if (trade) {
    const workmen = await getRecommendedWorkmen(trade.category, area);
    const areaPrefix = area ? ` near **${area}**` : " in your area";

    let reply = `### ${trade.icon} Verified ${trade.category} Services${areaPrefix}\n\n`;
    reply += `For this job, you need an approved **${trade.category}**.\n\n`;
    reply += `• **Estimated Charges:** ${trade.avgCost}\n`;
    reply += `• **Expert Safety Tip:** ${trade.tips}\n\n`;

    if (workmen.length > 0) {
      reply += `**Top Available ${trade.category}s:**\n`;
      reply += workmen.map((w, idx) => `${idx + 1}. **${w.name}** in *${w.location}* (${w.experience} yrs exp) — *${w.availability}*`).join("\n") +
        `\n\n*Click "Book" directly on any card below to schedule a visit!*`;
    } else {
      reply += `You can browse all verified ${trade.category}s directly on our marketplace.`;
    }

    return {
      reply,
      urgency: "normal",
      category: trade.category,
      location: area,
      workmen,
      suggestions: [
        `💰 How much does ${trade.category} work cost?`,
        `📍 Find ${trade.category}s in Coimbatore`,
        `📍 Find ${trade.category}s in Chennai`,
        `📅 How to book a ${trade.category}?`
      ],
      action: {
        type: "filter",
        category: trade.category,
        label: `⚡ Book ${trade.category}`
      }
    };
  }

  // Case G: Friendly Greetings
  if (query.includes("hi") || query.includes("hello") || query.includes("hey") || query.includes("good morning") || query.includes("good evening") || query.includes("who are you") || query.includes("vanakkam")) {
    return {
      reply: `### 👋 Vanakkam & Hello! I am your LocalWork AI Assistant\n\n` +
        `I am your dedicated technical diagnostic companion for home repairs, maintenance, and local trade services across Tamil Nadu.\n\n` +
        `**Here is how I can assist you:**\n` +
        `• 🔍 **Diagnose Home Problems:** Ask about tripping circuit breakers, leaking pipes, AC cooling issues, washing machines, or damp walls.\n` +
        `• 💰 **Get Instant Price Estimates:** Clear labor and material ranges in ₹ INR.\n` +
        `• 👨‍🔧 **Connect with Verified Workmen:** Direct access to approved electricians, plumbers, carpenters, painters, and AC technicians in your area.\n` +
        `• 🚨 **Safety Guidance:** Step-by-step precautions before professional help arrives.\n\n` +
        `*What home repair or service can I assist you with today?*`,
      urgency: "normal",
      suggestions: [
        "⚡ MCB keeps tripping",
        "❄️ AC not cooling properly",
        "🔧 Leaking tap or pipe",
        "💰 View transparent prices",
        "📅 How to book a workman?"
      ],
      action: { type: "explore", label: "Browse Services" }
    };
  }

  // Default Fallback
  return {
    reply: `### I'm here to help with your home service needs!\n\n` +
      `You can describe any home maintenance problem or ask for pricing:\n\n` +
      `• *"My circuit breaker keeps tripping — what is the cause?"*\n` +
      `• *"Split AC is dripping water inside the room"* \n` +
      `• *"How much does 2BHK wall painting cost?"*\n` +
      `• *"Find an approved plumber or electrician near me"*\n\n` +
      `*What trade or repair would you like help with?*`,
    urgency: "normal",
    suggestions: [
      "⚡ MCB keeps tripping",
      "❄️ AC not cooling",
      "🔧 Leaking water pipe",
      "🧹 Deep cleaning cost",
      "📅 How to book a workman?"
    ],
    action: { type: "explore", label: "Explore Services" }
  };
}

// POST /api/ai/chat
router.post("/chat", aiLimiter, async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Please provide a valid question." });
    }

    const sanitizedMessage = message.trim().slice(0, 500);
    const safeHistory = Array.isArray(history) ? history.slice(-8) : [];

    // Check if live Gemini API key is available
    const geminiKey = process.env.GEMINI_API_KEY || "";

    if (geminiKey) {
      try {
        const context = extractContext(sanitizedMessage, safeHistory);
        const liveWorkmen = context.trade ? await getRecommendedWorkmen(context.trade.category, context.area) : [];

        // Try Gemini 1.5 Flash first, then 2.0 Flash or 1.5 Pro
        const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];
        let replyText = null;

        for (const model of models) {
          try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
            const systemPrompt = `You are LocalWork AI, an intelligent, empathetic, and expert technical diagnostic assistant for LocalWork (a premier local trade and home repair marketplace in Tamil Nadu, India including Coimbatore, Chennai, and other cities).
Format your answers in clean Markdown with:
1. Technical diagnosis & root cause (why it happens).
2. Urgency rating (🚨 Emergency, ⚠️ High Priority, or ℹ️ Standard Maintenance).
3. Realistic pricing in INR (₹) including estimated labor and parts.
4. Immediate DIY safety precautions.
5. Polite recommendation to book an approved LocalWork professional.
Keep answers concise, direct, and actionable. Avoid unnecessary fluff.`;

            // Format conversational contents for Gemini API
            const contents = [];
            for (const item of safeHistory) {
              const role = item.role === "user" ? "user" : "model";
              const text = item.text || item.content || item.message || "";
              if (text) {
                contents.push({ role, parts: [{ text }] });
              }
            }
            contents.push({
              role: "user",
              parts: [{
                text: `${systemPrompt}\n\nUser Question: ${sanitizedMessage}`
              }]
            });

            const geminiRes = await fetch(geminiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents,
                generationConfig: {
                  temperature: 0.6,
                  maxOutputTokens: 400
                }
              }),
              signal: AbortSignal.timeout(6000)
            });

            if (geminiRes.ok) {
              const geminiData = await geminiRes.json();
              replyText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (replyText) break;
            }
          } catch (modelErr) {
            // Try next model if timed out or failed
          }
        }

        if (replyText) {
          const ruleFallback = await getExpertLocalWorkResponse(sanitizedMessage, safeHistory);
          return res.json({
            reply: replyText.trim(),
            urgency: ruleFallback.urgency,
            category: ruleFallback.category,
            location: ruleFallback.location,
            workmen: liveWorkmen.length > 0 ? liveWorkmen : ruleFallback.workmen,
            suggestions: ruleFallback.suggestions,
            action: ruleFallback.action
          });
        }
      } catch (geminiErr) {
        console.warn("Gemini API call warning, utilizing LocalWork diagnostic engine:", geminiErr.message);
      }
    }

    // High-performance built-in LocalWork Intelligence & Diagnostic Engine
    const result = await getExpertLocalWorkResponse(sanitizedMessage, safeHistory);
    return res.json(result);
  } catch (err) {
    console.error("AI Assistant error:", err);
    res.status(500).json({
      error: "AI Assistant is temporarily unavailable. Please try again."
    });
  }
});

module.exports = router;
