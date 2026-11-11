const express = require("express");
const { pool } = require("../database");
const rateLimit = require("express-rate-limit");

const router = express.Router();

// 30 AI queries per minute per IP to prevent spam
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "AI Assistant is busy. Please wait a few seconds before asking another question."
  }
});

// Domain trade definitions with keywords and typical cost ranges
const TRADES = [
  {
    category: "Electrician",
    icon: "⚡",
    keywords: ["electric", "wiring", "switch", "tripping", "mcb", "fuse", "fan", "light", "spark", "power", "shock", "inverter", "socket", "short circuit", "voltage"],
    avgCost: "₹250 – ₹600 for standard fixes; ₹1,200 – ₹3,500 for inverter / rewiring",
    tips: "Always turn off the main MCB breaker before inspecting any sparking socket or loose wiring!"
  },
  {
    category: "Plumber",
    icon: "🔧",
    keywords: ["plumb", "leak", "tap", "pipe", "sink", "drain", "clog", "tank", "toilet", "water", "flush", "geyser", "sewage", "basin"],
    avgCost: "₹200 – ₹500 for tap / leak repair; ₹800 – ₹2,000 for drain unclogging or line replacement",
    tips: "If a pipe bursts or water overflows, immediately close your home's main water inlet valve near the water meter or overhead tank."
  },
  {
    category: "Carpenter",
    icon: "🪚",
    keywords: ["carpent", "wood", "furniture", "door", "cupboard", "wardrobe", "hinge", "lock", "table", "chair", "bed", "drawer", "plywood", "latch"],
    avgCost: "₹300 – ₹800 for door/lock fixes; ₹1,500+ for custom furniture or modular fittings",
    tips: "For sticking wooden doors during monsoon, check if the frame has swollen with humidity before shaving the edges."
  },
  {
    category: "Painter",
    icon: "🎨",
    keywords: ["paint", "wall", "color", "putty", "primer", "stain", "whitewash", "coating", "damp wall", "peeling"],
    avgCost: "₹12 – ₹25 per sq. ft. for interior emulsion; ₹15 – ₹35 per sq. ft. for exterior weather-guard",
    tips: "Fix any wall dampness or seepage before applying paint to prevent bubbles and peeling."
  },
  {
    category: "Mechanic",
    icon: "🛠️",
    keywords: ["mechanic", "car", "bike", "scooter", "engine", "brake", "battery", "jumpstart", "clutch", "puncture", "oil change", "vehicle", "breakdown"],
    avgCost: "₹350 – ₹800 for basic tune-up / jumpstart; parts charged as per MRP",
    tips: "If your car engine overheats, pull over safely, turn off the engine immediately, and do NOT open the radiator cap while hot."
  },
  {
    category: "Cleaning",
    icon: "🧹",
    keywords: ["clean", "deep clean", "bathroom clean", "kitchen clean", "dust", "saniti", "housekeeping", "sofa clean", "chimney"],
    avgCost: "₹999 – ₹1,800 for 1BHK; ₹2,200 – ₹4,500 for full 3BHK deep sanitisation",
    tips: "Schedule deep cleaning once every 3 to 6 months to prevent hard-water stains and grease buildup."
  },
  {
    category: "Construction",
    icon: "🧱",
    keywords: ["construct", "mason", "brick", "cement", "wall repair", "slab", "plaster", "renovation", "civil", "remodel"],
    avgCost: "₹45 – ₹80 per sq. ft. for plastering; daily mason rates ₹800 – ₹1,200 / day",
    tips: "Use certified structural masons when knocking down walls to ensure load-bearing pillars are not disturbed."
  },
  {
    category: "AC Repair",
    icon: "❄️",
    keywords: ["ac", "air condition", "cooling", "compressor", "gas refill", "gas charging", "split ac", "filter", "water leakage ac"],
    avgCost: "₹499 for general foam jet service; ₹1,800 – ₹2,800 for gas charging",
    tips: "Clean your split AC mesh filters every 2 weeks during peak summer to improve cooling and save electricity."
  },
  {
    category: "Appliance Repair",
    icon: "📺",
    keywords: ["appliance", "fridge", "refrigerator", "washing machine", "microwave", "oven", "tv", "induction"],
    avgCost: "₹300 – ₹700 inspection fee; motor / PCB repairs based on manufacturer warranty",
    tips: "Always unplug appliances from power outlets before inspecting plugs or cables."
  },
  {
    category: "Gardening",
    icon: "🌿",
    keywords: ["garden", "lawn", "plants", "grass", "trimming", "landscaping", "organic", "pruning", "potting"],
    avgCost: "₹500 – ₹1,200 per maintenance visit; terrace garden setups starting from ₹3,000",
    tips: "Water potted plants early morning or after sunset to reduce water evaporation."
  },
  {
    category: "Pest Control",
    icon: "🐜",
    keywords: ["pest", "termite", "cockroach", "bed bug", "mosquito", "rodent", "rat", "insects"],
    avgCost: "₹800 – ₹1,500 for cockroach gel; ₹2,500 – ₹5,000 for anti-termite warranty treatment",
    tips: "Opt for government-approved herbal / odorless pest control if you have pets or elderly family members at home."
  },
  {
    category: "Welding",
    icon: "⚙️",
    keywords: ["weld", "grill", "gate", "iron", "steel", "railing", "metal", "balcony"],
    avgCost: "₹400 – ₹900 for minor grill fixes; custom stainless steel works by weight / design",
    tips: "Apply anti-rust red oxide primer before painting any welded outdoor iron gate."
  },
  {
    category: "Masonry & Tiling",
    icon: "🏗️",
    keywords: ["tile", "tiling", "granite", "marble", "countertop", "grouting", "cracked tile"],
    avgCost: "₹25 – ₹45 per sq. ft. for floor tiling installation",
    tips: "Epoxy grouting in bathrooms prevents water seepage between floor tiles permanently."
  },
  {
    category: "Waterproofing",
    icon: "💧",
    keywords: ["waterproof", "damp", "seepage", "roof leak", "terrace leak", "ceiling damp", "crack"],
    avgCost: "₹35 – ₹65 per sq. ft. for elastomeric membrane terrace coating",
    tips: "Fix roof cracks before monsoon begins; apply two coats of waterproofing primer with fiber mesh."
  },
  {
    category: "Other",
    icon: "🧰",
    keywords: ["cctv", "handyman", "drill", "mirror", "curtain", "mounting", "lock change", "doorbell", "camera"],
    avgCost: "₹200 – ₹450 for mounting / drilling; CCTV cameras from ₹1,200 / channel",
    tips: "Our verified multi-trade handymen can bundle multiple odd jobs around the house into one visit!"
  }
];

// Fallback rule-based LocalWork AI Engine
async function getRuleBasedResponse(userQuery) {
  const query = userQuery.toLowerCase().trim();

  // 1. Identify matched trades
  let matchedTrade = null;
  let highestScore = 0;

  for (const trade of TRADES) {
    let score = 0;
    for (const kw of trade.keywords) {
      if (query.includes(kw)) {
        score += (kw === trade.category.toLowerCase() ? 3 : 1);
      }
    }
    if (score > highestScore) {
      highestScore = score;
      matchedTrade = trade;
    }
  }

  // 2. Fetch real workmen from database if a trade is detected
  let recommendedWorkmen = [];
  if (matchedTrade) {
    try {
      const dbRes = await pool.query(
        `SELECT u.id, u.name, u.location, u.phone, wp.service, wp.experience, wp.description, wp.availability
         FROM users u
         JOIN workman_profiles wp ON wp.user_id = u.id
         WHERE wp.application_status = 'Approved'
         AND wp.service ILIKE '%' || $1 || '%'
         ORDER BY wp.experience DESC
         LIMIT 3`,
        [matchedTrade.category.slice(0, 5)]
      );
      recommendedWorkmen = dbRes.rows;
    } catch (e) {
      console.warn("AI DB query warning:", e.message);
    }
  }

  // 3. Platform FAQs
  if (query.includes("how to book") || query.includes("how does it work") || query.includes("how do i book")) {
    return {
      reply: `**How LocalWork Works in 3 Easy Steps:**\n\n` +
        `1. **Explore & Select:** Browse verified local tradespeople by service category or location.\n` +
        `2. **Submit a Request:** Click the **"Book"** button on any workman's card, pick your preferred date & time slot, and describe the job.\n` +
        `3. **Job Confirmed:** The workman receives your request, accepts it, and arrives with appropriate tools at your doorstep!`,
      action: { type: "explore", label: "Browse Services" }
    };
  }

  if (query.includes("workman application") || query.includes("join as workman") || query.includes("become a workman") || query.includes("apply as workman")) {
    return {
      reply: `**Want to Earn with LocalWork?**\n\n` +
        `1. Create an account or log in.\n` +
        `2. Click **"Apply as a Workman"** in the navigation menu.\n` +
        `3. Select your trade, specify your years of experience, and write a short summary of your skills.\n` +
        `4. Our admin team will review and approve your profile within 24 hours so customers can start booking you!`,
      action: { type: "apply_workman", label: "Apply as Workman" }
    };
  }

  if (query.includes("price") || query.includes("cost") || query.includes("rate") || query.includes("charges") || query.includes("how much")) {
    if (matchedTrade) {
      let reply = `**Estimated Rates for ${matchedTrade.icon} ${matchedTrade.category}:**\n\n` +
        `• **Typical Cost:** ${matchedTrade.avgCost}\n` +
        `• **Expert Tip:** ${matchedTrade.tips}\n\n`;

      if (recommendedWorkmen.length > 0) {
        reply += `**Recommended Verified ${matchedTrade.category}s Available Now:**\n` +
          recommendedWorkmen.map(w => `• **${w.name}** (${w.location}) — ${w.experience} yrs exp · *${w.availability}*`).join("\n");
      }

      return {
        reply,
        category: matchedTrade.category,
        workmen: recommendedWorkmen,
        action: { type: "filter", category: matchedTrade.category, label: `View ${matchedTrade.category}s` }
      };
    }

    return {
      reply: `**Transparent Pricing on LocalWork:**\n\n` +
        `• **Electrical & Plumbing:** ₹200 – ₹600 for typical fixes\n` +
        `• **Carpentry & Painting:** ₹300 – ₹1,500+ depending on scope\n` +
        `• **Deep Cleaning:** ₹1,000 – ₹4,500 based on house size (1BHK–3BHK)\n` +
        `• **AC & Appliances:** ₹499 service / inspection fee\n\n` +
        `*Tell me your specific problem (e.g. "my sink is leaking" or "need fan installed") for an exact estimate!*`,
      action: { type: "explore", label: "Explore Trades" }
    };
  }

  // 4. Trade-specific recommendation
  if (matchedTrade) {
    let reply = `I can help with that! For this issue, you need a verified **${matchedTrade.icon} ${matchedTrade.category}**.\n\n` +
      `• **Estimated Cost:** ${matchedTrade.avgCost}\n` +
      `• **Safety Tip:** ${matchedTrade.tips}\n\n`;

    if (recommendedWorkmen.length > 0) {
      reply += `**Top Verified ${matchedTrade.category}s on LocalWork:**\n` +
        recommendedWorkmen.map((w, idx) => `${idx + 1}. **${w.name}** in *${w.location}* (${w.experience} yrs exp)`).join("\n") +
        `\n\nClick the button below to view their full profile and schedule a booking:`;
    } else {
      reply += `You can search our live database for available ${matchedTrade.category}s near your neighborhood.`;
    }

    return {
      reply,
      category: matchedTrade.category,
      workmen: recommendedWorkmen,
      action: { type: "filter", category: matchedTrade.category, label: `⚡ Book ${matchedTrade.category}` }
    };
  }

  // 5. Emergency queries
  if (query.includes("emergency") || query.includes("urgent") || query.includes("burst") || query.includes("fire") || query.includes("sparking")) {
    return {
      reply: `⚠️ **Emergency Home Safety Precautions:**\n\n` +
        `1. **Electrical Spark / Burning Smell:** Immediately switch off your home's Main Distribution Board (MCB) switch. Do not touch wet switches.\n` +
        `2. **Major Water Pipe Burst:** Turn off the main water isolation valve near your overhead tank or water meter immediately.\n` +
        `3. **LPG Gas Leak:** Do NOT touch any electrical switches or matchsticks. Open all windows and turn off the gas cylinder regulator.\n\n` +
        `Once safe, search for an emergency **Electrician** or **Plumber** on LocalWork.`,
      action: { type: "explore", label: "Find Emergency Workman" }
    };
  }

  // 6. Greetings & friendly conversational answers
  if (query.includes("hi") || query.includes("hello") || query.includes("hey") || query.includes("good morning") || query.includes("good evening")) {
    return {
      reply: `👋 **Hello! I am your LocalWork AI Assistant.**\n\n` +
        `I can help you:\n` +
        `• 🔍 **Find the right professional** for any home repair or trade.\n` +
        `• 💰 **Get realistic cost estimates** for plumbing, electrical, carpentry, painting, etc.\n` +
        `• 📅 **Guide you through booking** or applying as a workman.\n\n` +
        `*What service or home issue can I help you with today?*`,
      action: { type: "explore", label: "Browse Services" }
    };
  }

  // Default helpful response
  return {
    reply: `I'm here to help with all your home service needs! You can ask me:\n\n` +
      `• *"My circuit breaker keeps tripping — who should I call?"*\n` +
      `• *"How much does AC gas filling or leak repair cost?"*\n` +
      `• *"Find me an experienced plumber in Velachery or Anna Nagar"*\n` +
      `• *"How do I book a technician?"*\n\n` +
      `*What trade or repair would you like assistance with?*`,
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

    // If GEMINI_API_KEY is configured in Render or .env, we can enhance with live Gemini LLM
    const geminiKey = process.env.GEMINI_API_KEY || "";

    if (geminiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        const systemPrompt = `You are LocalWork AI, an intelligent assistant for LocalWork - a trusted local trade marketplace in India connecting customers with approved tradespeople (Electrician, Plumber, Carpenter, Painter, Mechanic, Cleaning, Construction, AC Repair, Appliance Repair, Gardening, Pest Control, Welding, Masonry, Waterproofing). Provide helpful, concise, well-formatted answers with estimated prices in INR (₹) and safety advice when relevant.`;

        const geminiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${systemPrompt}\n\nUser Question: ${sanitizedMessage}` }]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 350
            }
          }),
          signal: AbortSignal.timeout(8000)
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const replyText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (replyText) {
            // Also detect category for interactive button
            const ruleFallback = await getRuleBasedResponse(sanitizedMessage);
            return res.json({
              reply: replyText.trim(),
              category: ruleFallback.category,
              workmen: ruleFallback.workmen,
              action: ruleFallback.action
            });
          }
        }
      } catch (geminiErr) {
        console.warn("Gemini API call failed, falling back to local engine:", geminiErr.message);
      }
    }

    // High-performance built-in LocalWork Intelligence Engine
    const result = await getRuleBasedResponse(sanitizedMessage);
    return res.json(result);
  } catch (err) {
    console.error("AI Assistant error:", err);
    res.status(500).json({
      error: "AI Assistant is temporarily unavailable. Please try again."
    });
  }
});

module.exports = router;
