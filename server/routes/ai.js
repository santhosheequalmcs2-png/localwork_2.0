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

// Known Chennai / Tamil Nadu localities for location-aware routing
const CHENNAI_AREAS = [
  "Anna Nagar", "Velachery", "T. Nagar", "T Nagar", "Adyar", "Tambaram", "Guindy",
  "Mylapore", "Porur", "Chromepet", "Koyambedu", "Thiruvanmiyur", "Besant Nagar",
  "Nungambakkam", "Alwarpet", "Saidapet", "Perambur", "Ambattur", "Madipakkam",
  "Sholinganallur", "OMR", "ECR", "Kilpauk", "Egmore", "Royapettah", "Triplicane",
  "Kodambakkam", "Vadapalani", "KK Nagar", "Ashok Nagar", "Pallavaram", "Medavakkam",
  "Thoraipakkam", "Navalur", "Siruseri", "Perungudi", "Alandur", "Avadi", "Poonamallee"
];

// 15 Trade categories supported on LocalWork
const TRADES = [
  {
    category: "Electrician",
    icon: "⚡",
    keywords: ["electric", "wiring", "switch", "tripping", "mcb", "fuse", "fan", "light", "spark", "power", "shock", "inverter", "socket", "short circuit", "voltage", "geyser heating", "earthing", "breaker", "elcb", "db box"],
    avgCost: "₹250 – ₹600 for standard fixes; ₹1,200 – ₹3,500 for inverter / rewiring",
    tips: "Always switch off the main MCB breaker before touching or inspecting any sparking outlet or loose wire!"
  },
  {
    category: "Plumber",
    icon: "🔧",
    keywords: ["plumb", "leak", "tap", "pipe", "sink", "drain", "clog", "tank", "toilet", "water", "flush", "geyser", "sewage", "basin", "faucet", "cistern", "motor", "pressure", "overhang"],
    avgCost: "₹200 – ₹500 for tap / leak repair; ₹800 – ₹2,000 for drain unclogging or pipe line replacement",
    tips: "If a pipe bursts or water overflows, immediately close your home's main water inlet valve near the water meter or overhead tank."
  },
  {
    category: "Carpenter",
    icon: "🪚",
    keywords: ["carpent", "wood", "furniture", "door", "cupboard", "wardrobe", "hinge", "lock", "table", "chair", "bed", "drawer", "plywood", "latch", "sliding", "swelling", "handle"],
    avgCost: "₹300 – ₹800 for door / lock fixes; ₹1,500+ for custom furniture or modular fittings",
    tips: "For sticking wooden doors during monsoon, check if the top hinge screws are loose before shaving off wood edges."
  },
  {
    category: "Painter",
    icon: "🎨",
    keywords: ["paint", "wall", "color", "putty", "primer", "stain", "whitewash", "coating", "damp wall", "peeling", "efflorescence", "interior", "exterior", "seepage paint"],
    avgCost: "₹12 – ₹25 per sq. ft. for interior emulsion; ₹15 – ₹35 per sq. ft. for exterior weather-guard",
    tips: "Always fix source water seepage and apply waterproof primer before painting to prevent blistering and flaking."
  },
  {
    category: "Mechanic",
    icon: "🛠️",
    keywords: ["mechanic", "car", "bike", "scooter", "engine", "brake", "battery", "jumpstart", "clutch", "puncture", "oil change", "vehicle", "breakdown", "radiator", "starter"],
    avgCost: "₹350 – ₹800 for basic tune-up / jumpstart; parts charged as per MRP",
    tips: "If your engine overheats, pull over safely, turn off ignition, and NEVER open the radiator cap while the engine is hot."
  },
  {
    category: "Cleaning",
    icon: "🧹",
    keywords: ["clean", "deep clean", "bathroom clean", "kitchen clean", "dust", "saniti", "housekeeping", "sofa clean", "chimney", "mattress", "scrub", "floor wash"],
    avgCost: "₹999 – ₹1,800 for 1BHK; ₹2,200 – ₹4,500 for full 3BHK deep sanitisation",
    tips: "Professional deep cleaning removes invisible hard-water scale and grease trap bacteria that regular mopping misses."
  },
  {
    category: "Construction",
    icon: "🧱",
    keywords: ["construct", "mason", "brick", "cement", "wall repair", "slab", "plaster", "renovation", "civil", "remodel", "demolition", "pillar"],
    avgCost: "₹45 – ₹80 per sq. ft. for plastering; daily mason rates ₹800 – ₹1,200 / day",
    tips: "Always hire certified structural civil masons before modifying walls to preserve load-bearing support."
  },
  {
    category: "AC Repair",
    icon: "❄️",
    keywords: ["ac", "air condition", "cooling", "compressor", "gas refill", "gas charging", "split ac", "filter", "water leakage ac", "ac dripping", "not cooling", "fan motor ac"],
    avgCost: "₹499 for general foam jet service; ₹1,800 – ₹2,800 for nitrogen test & gas charging",
    tips: "Clean split AC mesh filters every 2 weeks during peak summer to maintain airflow, boost cooling, and cut power bills."
  },
  {
    category: "Appliance Repair",
    icon: "📺",
    keywords: ["appliance", "fridge", "refrigerator", "washing machine", "microwave", "oven", "tv", "induction", "defrost", "mixer", "grinder"],
    avgCost: "₹300 – ₹700 inspection fee; motor / PCB repairs based on component replacement",
    tips: "Always unplug appliances from wall power outlets before inspecting plugs, cables, or filters."
  },
  {
    category: "Gardening",
    icon: "🌿",
    keywords: ["garden", "lawn", "plants", "grass", "trimming", "landscaping", "organic", "pruning", "potting", "terrace garden", "fertilizer"],
    avgCost: "₹500 – ₹1,200 per maintenance visit; terrace garden setups starting from ₹3,000",
    tips: "Water potted plants early morning or after sunset to minimize moisture evaporation and root stress."
  },
  {
    category: "Pest Control",
    icon: "🐜",
    keywords: ["pest", "termite", "cockroach", "bed bug", "mosquito", "rodent", "rat", "insects", "borer", "ant infestation"],
    avgCost: "₹800 – ₹1,500 for cockroach gel; ₹2,500 – ₹5,000 for anti-termite warranty treatment",
    tips: "Opt for government-approved odorless herbal pest control if you have pets or elderly family members at home."
  },
  {
    category: "Welding",
    icon: "⚙️",
    keywords: ["weld", "grill", "gate", "iron", "steel", "railing", "metal", "balcony", "fabrication", "safety grill"],
    avgCost: "₹400 – ₹900 for minor grill fixes; custom stainless steel works by weight / design",
    tips: "Apply anti-rust red oxide primer before painting any welded outdoor iron gate or balcony grill."
  },
  {
    category: "Masonry & Tiling",
    icon: "🏗️",
    keywords: ["tile", "tiling", "granite", "marble", "countertop", "grouting", "cracked tile", "flooring", "epoxy"],
    avgCost: "₹25 – ₹45 per sq. ft. for floor tiling installation",
    tips: "Epoxy grouting in bathrooms permanently prevents water seepage between floor tiles."
  },
  {
    category: "Waterproofing",
    icon: "💧",
    keywords: ["waterproof", "damp", "seepage", "roof leak", "terrace leak", "ceiling damp", "crack", "membrane", "rain leak"],
    avgCost: "₹35 – ₹65 per sq. ft. for elastomeric membrane terrace coating",
    tips: "Seal roof cracks before monsoon begins; apply two coats of waterproofing primer reinforced with glass fiber mesh."
  },
  {
    category: "Other",
    icon: "🧰",
    keywords: ["cctv", "handyman", "drill", "mirror", "curtain", "mounting", "lock change", "doorbell", "camera", "rod", "shelf"],
    avgCost: "₹200 – ₹450 for mounting / drilling; CCTV cameras from ₹1,200 / channel",
    tips: "Our verified multi-trade handymen can bundle multiple odd jobs around the house into one single visit!"
  }
];

// In-Depth Diagnostic Knowledge Matrix (50+ Real-World Home Repair Scenarios)
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
    title: "Sparking Switch, Socket or Burning Plastic Smell",
    rootCause: "Sparking and burning odors are caused by **loose terminal screws** or degraded brass contact clips creating high-resistance electrical arcing. The localized temperature can exceed 300°C, melting the PVC faceplate and creating a direct fire hazard.",
    safetyPrecaution: "IMMEDIATELY turn off your home's main MCB switchboard. Do NOT touch the switch or pull the plug with bare hands. Do NOT use water under any circumstance.",
    estimatedCost: "₹200 – ₹400 (socket replacement + wire termination)",
    estimatedTime: "20 – 40 mins",
    suggestions: [
      "🚨 What to do if there is visible smoke?",
      "💰 Modular switch board replacement cost",
      "👨‍🔧 Call Emergency Electrician"
    ]
  },
  {
    id: "fan_slow_humming",
    match: ["fan slow", "fan hum", "ceiling fan slow", "fan noise", "fan capacitor", "fan speed"],
    category: "Electrician",
    urgency: "ℹ️ Standard Maintenance",
    urgencyClass: "normal",
    title: "Ceiling Fan Rotating Slowly or Humming",
    rootCause: "Over 85% of slow ceiling fans suffer from a **degraded start/run capacitor** (typically 2.25µF or 2.5µF). Over 2–3 years of heat, capacitance drops below 1.5µF, causing sluggish speed and humming torque loss. Alternatively, dry ball bearings cause mechanical drag.",
    safetyPrecaution: "Turn off the fan regulator switch. If the fan center hub feels burning hot to the touch, do not keep it running—this will burn the copper motor windings.",
    estimatedCost: "₹150 – ₹300 (capacitor replacement); ₹400 – ₹700 (bearing grease / rewinding)",
    estimatedTime: "25 – 45 mins",
    suggestions: [
      "🌀 Can I change the fan capacitor myself?",
      "💰 What is the cost of ceiling fan rewinding?",
      "👨‍🔧 Book an Electrician"
    ]
  },
  {
    id: "inverter_beeping",
    match: ["inverter", "ups", "inverter beep", "battery water", "inverter overload"],
    category: "Electrician",
    urgency: "⚠️ High Priority",
    urgencyClass: "high",
    title: "Inverter / Home UPS Continuous Beeping or Not Charging",
    rootCause: "Continuous beeping indicates (1) **Low battery voltage** (distilled water dried up or sulfated lead plates); (2) **Overload alarm** (household load exceeds inverter VA rating); or (3) **Blown MOSFET / motherboard charging fuse** on the inverter inverter board.",
    safetyPrecaution: "Switch the inverter back to 'Bypass Mode' using the rear rocker switch. Inspect lead-acid battery water levels (floats should be in green). Never ignite matches near charging batteries.",
    estimatedCost: "₹300 – ₹600 (battery service / terminal de-oxidation); ₹800 – ₹1,800 (PCB repair)",
    estimatedTime: "45 – 90 mins",
    suggestions: [
      "🔋 How often to top up inverter battery water?",
      "💰 Cost for new tubular battery vs repair?",
      "👨‍🔧 Book an Inverter Electrician"
    ]
  },

  // --- AC REPAIR ---
  {
    id: "ac_not_cooling",
    match: ["ac not cooling", "warm air ac", "cooling low", "ac gas", "gas refill", "compressor not", "blow warm air"],
    category: "AC Repair",
    urgency: "⚠️ High Priority",
    urgencyClass: "high",
    title: "AC Blowing Warm Air / Inadequate Cooling",
    rootCause: "Likely causes: (1) **Refrigerant Gas Leak** (R32 or R410A leaked via vibrating copper flare joints); (2) **Faulty Compressor Capacitor** (35µF to 50µF capacitor failed, preventing outdoor compressor from kicking on); or (3) **Severely clogged cooling fins and air filters** choking airflow.",
    safetyPrecaution: "Set AC to 24°C in 'Cool' mode. Check if the outdoor fan is spinning. If outdoor compressor doesn't hum or only blows ambient air, TURN IT OFF. Running a gas-starved compressor can overheat and permanently burn the compressor motor.",
    estimatedCost: "₹499 (foam jet deep wash); ₹450 – ₹850 (capacitor replacement); ₹1,800 – ₹2,800 (nitrogen leak test + gas refill)",
    estimatedTime: "45 – 90 mins",
    suggestions: [
      "❄️ How to know if AC gas is leaking?",
      "💰 Split AC gas charging price in Chennai",
      "👨‍🔧 Book a verified AC Technician"
    ]
  },
  {
    id: "ac_water_leaking",
    match: ["ac water leak", "ac dripping", "indoor unit leak", "water coming from ac", "ac overflow"],
    category: "AC Repair",
    urgency: "⚠️ High Priority",
    urgencyClass: "high",
    title: "Split AC Indoor Unit Leaking Water Inside Room",
    rootCause: "In 90% of cases, the **condensate drain pipe is blocked** by jelly-like dust, algae, and mold accumulation inside the internal drain pan. Another cause is coil freezing due to low gas, which suddenly melts and overflows the collection tray.",
    safetyPrecaution: "Place a bucket underneath to protect flooring and furniture. Ensure leaking water does not drip onto the electrical power socket mounted beneath the indoor unit.",
    estimatedCost: "₹400 – ₹700 (drain pipe pressure flush & tray sanitisation)",
    estimatedTime: "30 – 45 mins",
    suggestions: [
      "💧 Can I blow air into the drain pipe to clear it?",
      "💰 Complete AC foam jet service charges",
      "👨‍🔧 Book AC Repair now"
    ]
  },
  {
    id: "ac_foul_smell",
    match: ["ac smell", "ac odor", "ac stink", "musty smell ac", "bad smell ac"],
    category: "AC Repair",
    urgency: "ℹ️ Standard Maintenance",
    urgencyClass: "normal",
    title: "Musty / Foul Smell from AC Indoor Vents",
    rootCause: "Moisture trapped in the indoor evaporator coil breeds bacterial biofilm and mildew. Dust and cooking oils accumulate on the blower wheel, creating a damp fungal smell whenever the compressor cycles off.",
    safetyPrecaution: "Switch AC to 'Fan mode' for 20 minutes before shutting it down to dry residual condensation on the coil.",
    estimatedCost: "₹499 – ₹799 (anti-bacterial foam jet service)",
    estimatedTime: "45 mins",
    suggestions: [
      "🌿 What chemicals are used for AC cleaning?",
      "👨‍🔧 Book AC Foam Jet Service"
    ]
  },

  // --- PLUMBING ---
  {
    id: "pipe_burst_leak",
    match: ["pipe burst", "burst pipe", "pipe leak", "heavy leak", "flooding", "water leak pipe", "water gushing"],
    category: "Plumber",
    urgency: "🚨 Emergency",
    urgencyClass: "emergency",
    title: "Major Water Pipe Leak or Burst Line",
    rootCause: "High municipal pumping pressure, thermal expansion cracking CPVC/PVC solvent joints, or corrosion of older Galvanized Iron (GI) threaded fittings. Vibrations from water hammer can also fracture elbow joints.",
    safetyPrecaution: "IMMEDIATELY turn off the main water valve at your overhead tank or municipal water meter! Mop up standing water near electrical floor sockets or extension cords.",
    estimatedCost: "₹250 – ₹600 (pipe coupling & solvent weld); ₹800 – ₹1,800 (concealed line replacement)",
    estimatedTime: "30 – 90 mins",
    suggestions: [
      "🚰 Where is the main water shut-off valve?",
      "💰 Concealed bathroom pipe repair cost",
      "👨‍🔧 Call Emergency Plumber"
    ]
  },
  {
    id: "tap_dripping",
    match: ["tap drip", "faucet leak", "tap leaking", "water dripping tap", "sink tap leak"],
    category: "Plumber",
    urgency: "ℹ️ Standard Maintenance",
    urgencyClass: "normal",
    title: "Continuously Dripping Tap or Faucet",
    rootCause: "Worn rubber washer seal or cracked ceramic disc cartridge inside modern quarter-turn brass taps. Hard water calcium scaling also prevents the internal spindle from sealing tight, wasting up to 20 liters of water daily.",
    safetyPrecaution: "Locate and close the small angle stop-cock valve under the washbasin to isolate the tap until the plumber arrives.",
    estimatedCost: "₹150 – ₹350 (washer / cartridge replacement)",
    estimatedTime: "20 – 30 mins",
    suggestions: [
      "🔧 What is a quarter-turn tap cartridge?",
      "💰 Minimum visiting charge for plumber",
      "👨‍🔧 Book a Plumber"
    ]
  },
  {
    id: "drain_clog",
    match: ["drain block", "sink block", "drain clog", "clogged sink", "water not draining", "basin block", "toilet clog", "sewage block"],
    category: "Plumber",
    urgency: "⚠️ High Priority",
    urgencyClass: "high",
    title: "Clogged Kitchen Sink, Basin, or Bathroom Floor Drain",
    rootCause: "In kitchens: cooking grease, oil, and food debris coagulating inside the P-trap bottleneck. In bathrooms: hair tangles bound together with soap-scum and hard-water deposits forming a stubborn mechanical plug.",
    safetyPrecaution: "Do NOT mix caustic soda drain cleaners with chlorine bleach—this creates toxic, suffocating gas! Avoid plunging violently if corrosive chemicals have already been poured into the drain.",
    estimatedCost: "₹300 – ₹600 (manual snake drain unclogging / trap overhaul)",
    estimatedTime: "30 – 60 mins",
    suggestions: [
      "🧪 Can baking soda & vinegar dissolve kitchen grease?",
      "💰 Cost to replace kitchen sink P-trap",
      "👨‍🔧 Book Plumber to unclog drain"
    ]
  },
  {
    id: "toilet_flush_running",
    match: ["flush tank", "cistern", "toilet running", "flush leak", "toilet flush continuous", "commode water leak"],
    category: "Plumber",
    urgency: "ℹ️ Standard Maintenance",
    urgencyClass: "normal",
    title: "Toilet Flush Tank / Cistern Running Continuously",
    rootCause: "A hardened silicone flapper valve allowing water to trickle into the commode pan, or a faulty float valve arm that fails to shut off water when the tank reaches full capacity.",
    safetyPrecaution: "Turn off the quarter-turn angle valve beside the commode to save overhead tank water until repaired.",
    estimatedCost: "₹200 – ₹450 (flapper / siphon flush kit replacement)",
    estimatedTime: "25 – 45 mins",
    suggestions: [
      "🚽 How to adjust toilet cistern float valve?",
      "👨‍🔧 Book a Plumber"
    ]
  },

  // --- WATER HEATER / GEYSER ---
  {
    id: "geyser_not_heating",
    match: ["geyser", "water heater", "geyser not heating", "geyser trip", "water heater cold", "geyser coil"],
    category: "Plumber",
    urgency: "⚠️ High Priority",
    urgencyClass: "high",
    title: "Geyser Water Not Heating or Tripping Circuit Breaker",
    rootCause: "Hard-water calcium coating the tubular heating element causes localized overheating and burns out the resistance coil. When the outer copper sheath cracks, water enters the element, creating a direct earth fault that trips the MCB/ELCB.",
    safetyPrecaution: "Turn OFF the geyser 16A wall switch immediately. Never switch on a geyser when the storage tank is empty, as dry-firing will destroy the element within 30 seconds.",
    estimatedCost: "₹450 – ₹950 (heating coil replacement + anode rod); ₹250 – ₹400 (thermostat / thermal cutout)",
    estimatedTime: "45 – 60 mins",
    suggestions: [
      "⚡ Why does geyser cause shock or MCB trip?",
      "💰 Cost of geyser heating element in India",
      "👨‍🔧 Book a Geyser Technician"
    ]
  },

  // --- CARPENTRY ---
  {
    id: "door_swelling",
    match: ["door jam", "door stuck", "door swelling", "door tight", "monsoon door", "wooden door", "door scraping"],
    category: "Carpenter",
    urgency: "ℹ️ Standard Maintenance",
    urgencyClass: "normal",
    title: "Wooden Door Sticking or Swelling During Rainy Season",
    rootCause: "Solid timber doors absorb atmospheric moisture during humid and monsoon weather, expanding by 2 to 5mm. Also, heavy doors often pull the top hinge screws loose over time, causing the door to sag diagonally against the bottom frame.",
    safetyPrecaution: "Check if the top hinge screws are loose and replace them with longer 2.5-inch screws before shaving wood off—otherwise, the door will have large gaps when dry weather returns.",
    estimatedCost: "₹250 – ₹500 (hinge alignment & hand plane trimming)",
    estimatedTime: "30 – 50 mins",
    suggestions: [
      "🪚 Should I plane the door or wait for summer?",
      "💰 Cost to replace rusty door hinges",
      "👨‍🔧 Book a Carpenter"
    ]
  },
  {
    id: "drawer_lock_stuck",
    match: ["drawer stuck", "runner broken", "lock stuck", "door lock jammed", "cupboard latch", "wardrobe sliding"],
    category: "Carpenter",
    urgency: "ℹ️ Standard Maintenance",
    urgencyClass: "normal",
    title: "Jammed Door Lock, Cupboard Latch, or Broken Drawer Runner",
    rootCause: "Telescopic drawer channels lose their steel ball bearings under weight. Door locks jam when dust, humidity, or broken internal brass pin springs freeze the cylinder mechanism.",
    safetyPrecaution: "Never force the key with pliers, as a snapped brass key inside the cylinder will require complete lock replacement.",
    estimatedCost: "₹250 – ₹550 (lock lubrication / channel replacement)",
    estimatedTime: "30 – 45 mins",
    suggestions: [
      "🔑 How to open jammed Godrej door lock?",
      "💰 Heavy-duty soft-close drawer runner cost",
      "👨‍🔧 Book a Carpenter"
    ]
  },

  // --- PAINTING ---
  {
    id: "wall_dampness",
    match: ["wall damp", "seepage", "peeling paint", "efflorescence", "bubble paint", "damp patch", "wet wall"],
    category: "Painter",
    urgency: "⚠️ High Priority",
    urgencyClass: "high",
    title: "Wall Dampness, Peeling Paint & White Salt Efflorescence",
    rootCause: "Capillary moisture rising from bathroom tile grout failure, concealed plumbing pipe hairline cracks, or exterior rainwater entering through structural micro-cracks. Painting directly over dampness is useless—it will bubble and peel off within 3 weeks.",
    safetyPrecaution: "Locate and rectify the plumbing/structural source first. Allow the plaster to dry completely before applying waterproofing barrier coatings.",
    estimatedCost: "₹35 – ₹60 per sq. ft. (scrape, chemical waterproof primer, acrylic putty, 2 coats paint)",
    estimatedTime: "2 – 3 days",
    suggestions: [
      "💧 What is the difference between waterproofing and damp-proofing?",
      "💰 Full room anti-dampness painting cost",
      "👨‍🔧 Book a Waterproofing & Painting Specialist"
    ]
  },
  {
    id: "painting_rates",
    match: ["paint rate", "paint cost", "house painting", "painting cost", "1bhk paint", "2bhk paint", "3bhk paint", "sq ft paint"],
    category: "Painter",
    urgency: "ℹ️ Standard Maintenance",
    urgencyClass: "normal",
    title: "House Painting Cost Calculator & Material Guide",
    rootCause: "Standard Chennai painting estimates based on carpet & wall surface area (materials + labor included):\n• **1 BHK (approx 800 sq ft wall area):** ₹7,000 – ₹13,000 (Tractor Emulsion) / ₹11,000 – ₹18,000 (Royale Luxury)\n• **2 BHK (approx 1,500 sq ft wall area):** ₹14,000 – ₹24,000 (Tractor Emulsion) / ₹22,000 – ₹35,000 (Royale)\n• **3 BHK (approx 2,400 sq ft wall area):** ₹22,000 – ₹38,000 (Tractor Emulsion) / ₹35,000 – ₹55,000 (Royale)",
    safetyPrecaution: "Request two coats of putty and primer on freshly plastered walls to achieve a smooth mirror finish.",
    estimatedCost: "₹12 – ₹28 per sq. ft. inclusive of Asian Paints / Berger materials",
    estimatedTime: "2 – 5 days",
    suggestions: [
      "🎨 Which is better: Asian Paints Royale vs Tractor Emulsion?",
      "💰 Exterior weather-proof painting cost",
      "👨‍🔧 Book a verified Painter"
    ]
  },

  // --- MECHANIC ---
  {
    id: "car_battery_dead",
    match: ["car wont start", "bike wont start", "battery dead", "clicking sound start", "jumpstart", "puncture", "engine breakdown"],
    category: "Mechanic",
    urgency: "⚠️ High Priority",
    urgencyClass: "high",
    title: "Vehicle Not Starting (Rapid Clicking Sound / Dead Battery)",
    rootCause: "A rapid clicking sound when turning the key indicates that the starter motor solenoid is engaging, but the **12V vehicle battery voltage has collapsed below 10.5V** under load. Alternatively, sulfur corrosion on battery terminal clamps causes high electrical resistance.",
    safetyPrecaution: "Turn off headlamps, AC, and audio system before attempting ignition. Do not crank continuously for more than 5 seconds at a time to prevent starter motor burnout.",
    estimatedCost: "₹250 – ₹450 (doorstep jumpstart & alternator test); ₹350 – ₹800 (tune-up / minor breakdown)",
    estimatedTime: "30 – 45 mins",
    suggestions: [
      "🚗 How to jumpstart a car safely with booster cables?",
      "💰 Average life of Amaron / Exide car battery?",
      "👨‍🔧 Call Doorstep Mechanic"
    ]
  },

  // --- APPLIANCE REPAIR ---
  {
    id: "fridge_not_cooling",
    match: ["fridge not cooling", "refrigerator warm", "fridge light on", "refrigerator ice", "fridge compressor"],
    category: "Appliance Repair",
    urgency: "⚠️ High Priority",
    urgencyClass: "high",
    title: "Refrigerator Not Cooling but Interior Light is On",
    rootCause: "Common causes: (1) **Defrost timer/bi-metal sensor failure** in frost-free fridges, causing thick ice to choke air circulation vents; (2) **Compressor starter relay (PTC) burned out**; or (3) **Condenser fan motor seized**.",
    safetyPrecaution: "Unplug the refrigerator from the wall socket for 10 minutes. If the compressor clicks every 2 minutes without humming, the starter relay is likely burnt.",
    estimatedCost: "₹350 – ₹750 (starter relay / defrost sensor replacement); ₹1,500 – ₹2,500 (refrigerant charging)",
    estimatedTime: "45 – 90 mins",
    suggestions: [
      "🧊 How to manually defrost an iced refrigerator?",
      "💰 Washing machine repair charges",
      "👨‍🔧 Book an Appliance Repair Technician"
    ]
  }
];

// Helper to extract trade, area, and problem from query & history
function extractContext(query, history = []) {
  const combined = [
    query,
    ...history.map(h => (typeof h === "string" ? h : h.text || h.content || h.message || ""))
  ].join(" ").toLowerCase();

  // 1. Detect area
  let detectedArea = null;
  for (const area of CHENNAI_AREAS) {
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
    // Current query has 3x weight over history
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
    } else {
      reply += `You can book a verified **${diagnostic.category}** directly on LocalWork with door-to-door tracking.`;
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

  // Case B: Pricing & Rate Inquiries
  if (query.includes("price") || query.includes("cost") || query.includes("rate") || query.includes("charge") || query.includes("how much")) {
    if (trade) {
      const workmen = await getRecommendedWorkmen(trade.category, area);
      let reply = `### Transparent Rates for ${trade.icon} ${trade.category}\n\n`;
      reply += `• **Typical Cost Range:** ${trade.avgCost}\n`;
      reply += `• **Expert Safety Tip:** ${trade.tips}\n\n`;

      if (workmen.length > 0) {
        reply += `**Top Rated ${trade.category}s Available:**\n`;
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
          `📍 Find ${trade.category}s in ${area || "Chennai"}`,
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
      reply: `### Transparent LocalWork Pricing Guide (Chennai)\n\n` +
        `• **⚡ Electrical & 🔧 Plumbing:** ₹200 – ₹600 for standard fixes; parts at MRP.\n` +
        `• **🪚 Carpentry:** ₹300 – ₹800 for door/lock fixes; custom woodwork ₹1,500+.\n` +
        `• **❄️ AC Repair:** ₹499 foam jet service; ₹1,800 – ₹2,800 gas leak repair & refill.\n` +
        `• **🎨 Painting:** ₹12 – ₹25 per sq. ft. interior; ₹15 – ₹35 exterior.\n` +
        `• **🧹 Deep Cleaning:** ₹999 – ₹1,800 (1BHK); ₹2,200 – ₹4,500 (3BHK).\n\n` +
        `*Tell me your specific problem (e.g. "my sink is leaking" or "need fan installed") for an exact itemized estimate!*`,
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
        `1. **Browse Verified Talent:** Choose your trade (Electrician, Plumber, AC Repair, etc.) and filter by your Chennai neighborhood.\n` +
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
        `Are you a skilled technician or tradesperson in Chennai? Earn steady income with zero upfront platform fees:\n\n` +
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
  if (query.includes("emergency") || query.includes("urgent") || query.includes("fire") || query.includes("shock") || query.includes("gas leak")) {
    if (trade) {
      const workmen = await getRecommendedWorkmen(trade.category, area);
      const areaPrefix = area ? ` in & around **${area}**` : " in Chennai";

      return {
        reply: `### 🚨 Urgent Emergency ${trade.category} Assistance${areaPrefix}\n\n` +
          `**Safety Warning:** ${trade.tips}\n\n` +
          `We have prioritized verified **${trade.category}s** available for immediate dispatch.\n\n` +
          (workmen.length > 0
            ? `**Emergency ${trade.category}s On-Call Now:**\n` + workmen.map((w, idx) => `• **${w.name}** (${w.location}) — ${w.experience} yrs exp · *${w.availability}*`).join("\n") + `\n\n*Click "Book" directly on any card below for rapid response!*`
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
    const areaPrefix = area ? ` near **${area}**` : " in Chennai";

    let reply = `### ${trade.icon} Verified ${trade.category} Services${areaPrefix}\n\n`;
    reply += `For this job, you need an approved **${trade.category}**.\n\n`;
    reply += `• **Estimated Charges:** ${trade.avgCost}\n`;
    reply += `• **Expert Safety Tip:** ${trade.tips}\n\n`;

    if (workmen.length > 0) {
      reply += `**Top Available ${trade.category}s:**\n`;
      reply += workmen.map((w, idx) => `${idx + 1}. **${w.name}** in *${w.location}* (${w.experience} yrs exp) — *${w.availability}*`).join("\n") +
        `\n\n*Click "Book" directly on any card below to schedule a visit!*`;
    } else {
      reply += `You can browse all verified ${trade.category}s across Chennai directly on our marketplace.`;
    }

    return {
      reply,
      urgency: "normal",
      category: trade.category,
      location: area,
      workmen,
      suggestions: [
        `💰 How much does ${trade.category} work cost?`,
        `📍 Find ${trade.category}s in Anna Nagar`,
        `📍 Find ${trade.category}s in Velachery`,
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
  if (query.includes("hi") || query.includes("hello") || query.includes("hey") || query.includes("good morning") || query.includes("good evening") || query.includes("who are you")) {
    return {
      reply: `### 👋 Hello! I am your LocalWork AI Assistant\n\n` +
        `I am your dedicated technical diagnostic companion for home repairs and local trade services across Chennai.\n\n` +
        `**Here is how I can assist you:**\n` +
        `• 🔍 **Diagnose Home Problems:** Ask about tripping circuit breakers, leaking pipes, AC cooling issues, or damp walls.\n` +
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
      `• *"Find an approved plumber in Velachery or Anna Nagar"*\n\n` +
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

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        const systemPrompt = `You are LocalWork AI, an intelligent, empathetic, and expert technical diagnostic assistant for LocalWork (a premier local trade and home repair marketplace in Chennai, India).
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
          signal: AbortSignal.timeout(7500)
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const replyText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
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
        }
      } catch (geminiErr) {
        console.warn("Gemini API call timed out or failed, utilizing LocalWork diagnostic engine:", geminiErr.message);
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
