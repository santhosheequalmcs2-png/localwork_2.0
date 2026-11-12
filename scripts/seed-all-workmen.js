const bcrypt = require("bcryptjs");
const { pool } = require("../server/database");

const WORKMEN_LIST = [
  // 1. Electricians (3)
  {
    name: "S. Rajesh Kumar",
    email: "rajesh.spark@localwork.dev",
    phone: "+91 98401 77123",
    location: "T. Nagar, Chennai",
    service: "Electrician",
    experience: 8,
    description: "Domestic and commercial electrician. Specialises in 3-phase wiring, smart LED fittings, circuit breaker tripping fixes, and inverter battery installation.",
    availability: "Available",
    status: "Approved"
  },
  {
    name: "B. Vijay Anand",
    email: "vijay.electric@localwork.dev",
    phone: "+91 98409 66901",
    location: "Adyar, Chennai",
    service: "Electrician",
    experience: 12,
    description: "Master electrician for luxury apartments & villas. Home automation wiring, electrical surge protector installation, and earthing pit construction.",
    availability: "Available",
    status: "Approved"
  },
  {
    name: "R. Karthik",
    email: "karthik.electrician@localwork.dev",
    phone: "+91 98400 11221",
    location: "Anna Nagar, Chennai",
    service: "Electrician",
    experience: 9,
    description: "Certified electrician with 9 years of field experience in residential electrical wiring, fan installation, switchboard repair, and MCB replacement.",
    availability: "Available",
    status: "Approved"
  },

  // 2. Plumbers (3)
  {
    name: "R. Subramanian",
    email: "subbu.plumber@localwork.dev",
    phone: "+91 98402 88234",
    location: "Velachery, Chennai",
    service: "Plumber",
    experience: 11,
    description: "Expert in bathroom concealed pipe repairs, overhead tank plumbing, high-pressure water pump installation, and underground drainage unclogging.",
    availability: "Available",
    status: "Approved"
  },
  {
    name: "M. Suresh Kumar",
    email: "suresh.plumber@localwork.dev",
    phone: "+91 98400 22332",
    location: "T. Nagar, Chennai",
    service: "Plumber",
    experience: 12,
    description: "Senior plumbing technician. Specialises in bathroom leakage fixes, CPVC/PVC pipeline installations, overhead tank maintenance, and sanitary fitting.",
    availability: "Available",
    status: "Approved"
  },
  {
    name: "K. Manikandan",
    email: "manikandan.plumber@localwork.dev",
    phone: "+91 98400 88998",
    location: "Tambaram, Chennai",
    service: "Plumber",
    experience: 10,
    description: "Water pressure booster pump installation, bathroom pipeline rerouting, RO water purifier plumbing, and concealed leak troubleshooting.",
    availability: "Available",
    status: "Approved"
  },

  // 3. Carpenters (3)
  {
    name: "M. Ravichandran",
    email: "ravi.carpenter@localwork.dev",
    phone: "+91 98403 99345",
    location: "Anna Nagar, Chennai",
    service: "Carpenter",
    experience: 14,
    description: "Custom teakwood carpentry, modular wardrobe design, hydraulic kitchen cabinet installation, sliding door repairs, and premium polish work.",
    availability: "Available",
    status: "Approved"
  },
  {
    name: "Anand Natarajan",
    email: "anand.carpenter@localwork.dev",
    phone: "+91 98400 33443",
    location: "Mylapore, Chennai",
    service: "Carpenter",
    experience: 15,
    description: "Master carpenter skilled in modular kitchen cabinets, wooden wardrobe design, antique furniture restoration, and precision door/window fitting.",
    availability: "Available",
    status: "Approved"
  },
  {
    name: "A. Dinesh",
    email: "dinesh.carpenter@localwork.dev",
    phone: "+91 98400 99009",
    location: "Chromepet, Chennai",
    service: "Carpenter",
    experience: 7,
    description: "Furniture assembly, door lock fitting, modular shelf construction, wooden partition walls, and hydraulic hinges repair.",
    availability: "Available",
    status: "Approved"
  },

  // 4. Painters (2)
  {
    name: "K. Dhanush",
    email: "dhanush.painter@localwork.dev",
    phone: "+91 98404 11456",
    location: "Tambaram, Chennai",
    service: "Painter",
    experience: 7,
    description: "Interior luxury emulsion painting, exterior weather-guard coatings, royal stencil textures, waterproof wall putty application, and wood varnishing.",
    availability: "Available",
    status: "Approved"
  },
  {
    name: "V. Rajesh Kannan",
    email: "rajesh.painter@localwork.dev",
    phone: "+91 98400 44554",
    location: "Velachery, Chennai",
    service: "Painter",
    experience: 8,
    description: "Professional interior and exterior painting services. Expertise in texture walls, waterproof coatings, enamel paint for gates, and dampness treatment.",
    availability: "Available",
    status: "Approved"
  },

  // 5. Mechanics (2)
  {
    name: "J. Anthony Raj",
    email: "anthony.mechanic@localwork.dev",
    phone: "+91 98405 22567",
    location: "Guindy, Chennai",
    service: "Mechanic",
    experience: 10,
    description: "On-demand roadside automobile mechanic. Engine tune-ups, disc brake replacement, battery jumpstart, electrical wire troubleshooting, and oil servicing.",
    availability: "Available",
    status: "Approved"
  },
  {
    name: "D. Murugan",
    email: "murugan.mechanic@localwork.dev",
    phone: "+91 98400 55665",
    location: "Guindy, Chennai",
    service: "Mechanic",
    experience: 11,
    description: "Automobile repair expert. Two-wheeler and four-wheeler regular servicing, brake repair, engine tuning, roadside breakdown assistance, and battery jumpstarts.",
    availability: "Available",
    status: "Approved"
  },

  // 6. Cleaning (2)
  {
    name: "Sundari Meenakshi",
    email: "sundari.cleaning@localwork.dev",
    phone: "+91 98406 33678",
    location: "Mylapore, Chennai",
    service: "Cleaning",
    experience: 6,
    description: "Full apartment deep cleaning, kitchen oil chimney degreasing, bathroom hard-water scale removal, floor machine scrubbing, and sofa steam cleaning.",
    availability: "Available",
    status: "Approved"
  },
  {
    name: "Lakshmi Priya",
    email: "lakshmi.cleaning@localwork.dev",
    phone: "+91 98400 66776",
    location: "Adyar, Chennai",
    service: "Cleaning",
    experience: 6,
    description: "Deep house cleaning specialist. Kitchen degreasing, bathroom sanitisation, tile grout scrubbing, sofa upholstery shampooing, and move-in/move-out cleans.",
    availability: "Available",
    status: "Approved"
  },

  // 7. Construction (2)
  {
    name: "C. Venkatesan",
    email: "venkat.construction@localwork.dev",
    phone: "+91 98407 44789",
    location: "Porur, Chennai",
    service: "Construction",
    experience: 15,
    description: "Civil masonry, structural renovation, brickwork partition walls, reinforced concrete slab works, floor leveling, and boundary compound construction.",
    availability: "Available",
    status: "Approved"
  },
  {
    name: "S. Balaji",
    email: "balaji.construction@localwork.dev",
    phone: "+91 98400 77887",
    location: "Porur, Chennai",
    service: "Construction",
    experience: 14,
    description: "Civil construction supervisor and contractor. Brick masonry, cement plastering, tile flooring, bathroom remodelling, and structural crack repair.",
    availability: "Available",
    status: "Approved"
  },

  // 8. AC Repair (2)
  {
    name: "T. Saravanan",
    email: "saravanan.ac@localwork.dev",
    phone: "+91 98411 23451",
    location: "Kotturpuram, Chennai",
    service: "AC Repair",
    experience: 9,
    description: "Certified inverter AC repair specialist, gas charging, cooling coil replacement, and split AC deep chemical cleaning.",
    availability: "Available",
    status: "Approved"
  },
  {
    name: "K. Vignesh",
    email: "vignesh.ac@localwork.dev",
    phone: "+91 98418 11223",
    location: "Besant Nagar, Chennai",
    service: "AC Repair",
    experience: 8,
    description: "Split and window AC installation, compressor fan repair, PCB board troubleshooting, and jet pump foam wash.",
    availability: "Available",
    status: "Approved"
  },

  // 9. Appliance Repair (2)
  {
    name: "N. Gokul",
    email: "gokul.appliance@localwork.dev",
    phone: "+91 98412 34562",
    location: "Ashok Nagar, Chennai",
    service: "Appliance Repair",
    experience: 11,
    description: "Expert technician for front-load & top-load washing machines, double-door refrigerators, and microwave ovens.",
    availability: "Available",
    status: "Approved"
  },
  {
    name: "P. Aravind",
    email: "aravind.appliance@localwork.dev",
    phone: "+91 98419 22334",
    location: "KK Nagar, Chennai",
    service: "Appliance Repair",
    experience: 7,
    description: "Microwave magnetron replacement, refrigerator defrost sensor repair, and water heater geyser element change.",
    availability: "Available",
    status: "Approved"
  },

  // 10. Gardening (1)
  {
    name: "K. Mohanraj",
    email: "mohanraj.gardener@localwork.dev",
    phone: "+91 98413 45673",
    location: "Besant Nagar, Chennai",
    service: "Gardening",
    experience: 8,
    description: "Organic terrace gardening, landscape trimming, drip irrigation setup, lawn mowing, and decorative plant pruning.",
    availability: "Available",
    status: "Approved"
  },

  // 11. Pest Control (1)
  {
    name: "R. Jayaprakash",
    email: "jayaprakash.pest@localwork.dev",
    phone: "+91 98414 56784",
    location: "Madipakkam, Chennai",
    service: "Pest Control",
    experience: 6,
    description: "Eco-friendly herbal pest control, anti-termite piping treatment, bed bug eradication, and cockroach gel treatments.",
    availability: "Available",
    status: "Approved"
  },

  // 12. Welding (1)
  {
    name: "V. Selvam",
    email: "selvam.welder@localwork.dev",
    phone: "+91 98415 67895",
    location: "Ambattur, Chennai",
    service: "Welding",
    experience: 13,
    description: "Structural arc & argon welding, stainless steel balcony railings, window safety grills, and motorized gate repairs.",
    availability: "Available",
    status: "Approved"
  },

  // 13. Masonry & Tiling (1)
  {
    name: "P. Muthukumar",
    email: "muthu.mason@localwork.dev",
    phone: "+91 98416 78906",
    location: "Perambur, Chennai",
    service: "Masonry & Tiling",
    experience: 16,
    description: "Vitrified floor tile installation, granite kitchen countertop fitting, bathroom floor waterproofing, and wall replastering.",
    availability: "Available",
    status: "Approved"
  },

  // 14. Waterproofing (1)
  {
    name: "S. Manikandan",
    email: "manikandan.waterproof@localwork.dev",
    phone: "+91 98417 89017",
    location: "Chromepet, Chennai",
    service: "Waterproofing",
    experience: 10,
    description: "Terrace rainwater leakage waterproofing, elastomeric membrane coating, bathroom expansion joint sealing, and dampness protection.",
    availability: "Available",
    status: "Approved"
  },

  // 15. Other / Handyman / Smart Home (2)
  {
    name: "P. Selvaraj",
    email: "selva.handyman@localwork.dev",
    phone: "+91 98408 55890",
    location: "Sholinganallur, Chennai",
    service: "Other",
    experience: 9,
    description: "Multi-trade home handyman: Wall mounting (TV, mirror, curtain rods), drilling, door lock replacement, furniture assembly, and general home repairs.",
    availability: "Available",
    status: "Approved"
  },
  {
    name: "N. Soundararajan",
    email: "soundar.security@localwork.dev",
    phone: "+91 98410 77012",
    location: "Alwarpet, Chennai",
    service: "Other",
    experience: 8,
    description: "Smart home security technician: HD CCTV camera setup, DVR/NVR networking, digital video door phone installation, and biometric smart door locks.",
    availability: "Available",
    status: "Approved"
  },

  // Extra pending applicants for Admin Review Panel! (2)
  {
    name: "E. Karthikeyan",
    email: "karthikeyan.applicant@localwork.dev",
    phone: "+91 98420 33445",
    location: "Nungambakkam, Chennai",
    service: "Electrician",
    experience: 5,
    description: "Applicant seeking verification for residential electrical work and solar inverter setup.",
    availability: "Available",
    status: "Pending"
  },
  {
    name: "M. Gopinath",
    email: "gopinath.applicant@localwork.dev",
    phone: "+91 98420 55667",
    location: "Pallavaram, Chennai",
    service: "Plumber",
    experience: 4,
    description: "Applicant looking to join as certified plumber for residential complexes.",
    availability: "Available",
    status: "Pending"
  }
];

async function seedAllWorkmenAndJobs() {
  console.log("Starting full seed: 26 Approved Workmen, 2 Pending Applicants, and 12 Bookings...");

  const defaultPasswordHash = await bcrypt.hash("LocalWork2026!", 10);
  const createdApprovedIds = [];

  for (const w of WORKMEN_LIST) {
    let userRes = await pool.query("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [w.email]);
    let userId;

    if (userRes.rows.length === 0) {
      const insertUser = await pool.query(
        `INSERT INTO users (name, email, phone, location, role, password_hash)
         VALUES ($1, $2, $3, $4, 'customer', $5)
         RETURNING id`,
        [w.name, w.email, w.phone, w.location, defaultPasswordHash]
      );
      userId = insertUser.rows[0].id;
    } else {
      userId = userRes.rows[0].id;
    }

    if (w.status === "Approved") {
      createdApprovedIds.push({ id: userId, service: w.service, name: w.name });
    }

    await pool.query(
      `INSERT INTO workman_profiles (user_id, service, experience, description, availability, application_status)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE
       SET service = EXCLUDED.service,
           experience = EXCLUDED.experience,
           description = EXCLUDED.description,
           availability = EXCLUDED.availability,
           application_status = EXCLUDED.application_status`,
      [userId, w.service, w.experience, w.description, w.availability, w.status]
    );
  }

  // Get customer accounts for booking references
  const custRes = await pool.query("SELECT id, name, phone FROM users WHERE role = 'customer' ORDER BY id ASC LIMIT 5");
  const customers = custRes.rows;
  const c1 = customers[0];
  const c2 = customers[1] || c1;
  const c3 = customers[2] || c1;

  const bookingsList = [
    {
      customerId: c1.id,
      workmanId: createdApprovedIds[0].id, // Electrician
      customerName: c1.name,
      phone: "+91 98840 11223",
      address: "14 Gandhi Road, T. Nagar, Chennai",
      bookingDate: "2026-11-15",
      bookingTime: "10:00 AM",
      notes: "Main fuse box tripping repeatedly when inverter charges.",
      status: "Accepted"
    },
    {
      customerId: c2.id,
      workmanId: createdApprovedIds[3].id, // Plumber
      customerName: c2.name,
      phone: "+91 98840 22334",
      address: "22 100-Ft Bypass Road, Velachery, Chennai",
      bookingDate: "2026-11-16",
      bookingTime: "02:30 PM",
      notes: "Kitchen sink drain completely clogged and leaking under counter.",
      status: "Pending"
    },
    {
      customerId: c3.id,
      workmanId: createdApprovedIds[6].id, // Carpenter
      customerName: c3.name,
      phone: "+91 98840 33445",
      address: "88 Shanthi Colony, Anna Nagar, Chennai",
      bookingDate: "2026-11-14",
      bookingTime: "11:00 AM",
      notes: "Modular kitchen cabinet hydraulic hinges replacement.",
      status: "Completed"
    },
    {
      customerId: c1.id,
      workmanId: createdApprovedIds[9].id, // Painter
      customerName: c1.name,
      phone: "+91 98840 11223",
      address: "5 GST Road, Tambaram, Chennai",
      bookingDate: "2026-11-17",
      bookingTime: "09:00 AM",
      notes: "Living room accent wall royal texture painting.",
      status: "Accepted"
    },
    {
      customerId: c2.id,
      workmanId: createdApprovedIds[11].id, // Mechanic
      customerName: c2.name,
      phone: "+91 98840 22334",
      address: "12 SIDCO Industrial Estate, Guindy, Chennai",
      bookingDate: "2026-11-18",
      bookingTime: "04:00 PM",
      notes: "Car battery dead and needs on-site jumpstart.",
      status: "Pending"
    },
    {
      customerId: c3.id,
      workmanId: createdApprovedIds[13].id, // Cleaning
      customerName: c3.name,
      phone: "+91 98840 33445",
      address: "3 South Mada St, Mylapore, Chennai",
      bookingDate: "2026-11-19",
      bookingTime: "08:30 AM",
      notes: "Full 3BHK flat deep cleaning and floor scrubbing.",
      status: "Accepted"
    },
    {
      customerId: c1.id,
      workmanId: createdApprovedIds[15].id, // Construction
      customerName: c1.name,
      phone: "+91 98840 11223",
      address: "24 Mount-Poonamallee Rd, Porur, Chennai",
      bookingDate: "2026-11-20",
      bookingTime: "10:00 AM",
      notes: "Brickwork partition wall and plastering.",
      status: "Pending"
    },
    {
      customerId: c2.id,
      workmanId: createdApprovedIds[17].id, // AC Repair
      customerName: c2.name,
      phone: "+91 98840 22334",
      address: "7 Gandhi Mandapam Rd, Kotturpuram, Chennai",
      bookingDate: "2026-11-21",
      bookingTime: "11:30 AM",
      notes: "Inverter AC not cooling and outdoor fan noisy.",
      status: "Accepted"
    },
    {
      customerId: c3.id,
      workmanId: createdApprovedIds[19].id, // Appliance
      customerName: c3.name,
      phone: "+91 98840 33445",
      address: "56 4th Avenue, Ashok Nagar, Chennai",
      bookingDate: "2026-11-22",
      bookingTime: "03:00 PM",
      notes: "Washing machine display error E20 and drain pump repair.",
      status: "Pending"
    },
    {
      customerId: c1.id,
      workmanId: createdApprovedIds[21].id, // Gardening
      customerName: c1.name,
      phone: "+91 98840 11223",
      address: "18 Beach Road, Besant Nagar, Chennai",
      bookingDate: "2026-11-23",
      bookingTime: "08:00 AM",
      notes: "Lawn trimming and organic terrace vegetable setup.",
      status: "Completed"
    },
    {
      customerId: c2.id,
      workmanId: createdApprovedIds[24].id, // Other (Handyman)
      customerName: c2.name,
      phone: "+91 98840 22334",
      address: "Tower 2, OMR IT Expressway, Sholinganallur, Chennai",
      bookingDate: "2026-11-24",
      bookingTime: "01:00 PM",
      notes: "65-inch TV wall mounting and curtain rod drilling.",
      status: "Pending"
    },
    {
      customerId: c3.id,
      workmanId: createdApprovedIds[25].id, // Other (Security)
      customerName: c3.name,
      phone: "+91 98840 33445",
      address: "15 TTK Road, Alwarpet, Chennai",
      bookingDate: "2026-11-25",
      bookingTime: "05:00 PM",
      notes: "4-Channel HD CCTV camera setup and DVR networking.",
      status: "Accepted"
    }
  ];

  for (const b of bookingsList) {
    const existing = await pool.query(
      `SELECT id FROM bookings WHERE customer_id = $1 AND workman_id = $2 AND booking_date = $3`,
      [b.customerId, b.workmanId, b.bookingDate]
    );

    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO bookings (customer_id, workman_id, customer_name, phone, address, booking_date, booking_time, notes, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [b.customerId, b.workmanId, b.customerName, b.phone, b.address, b.bookingDate, b.bookingTime, b.notes, b.status]
      );
    }
  }

  // Seed varied customer reviews for all approved workmen
  try {
    const { seedVariedReviews } = require("./seed-varied-reviews");
    await seedVariedReviews();
  } catch (revSeedErr) {
    console.warn("Reviews seeding notice:", revSeedErr.message);
  }

  const approvedCount = await pool.query("SELECT count(*) FROM workman_profiles WHERE application_status = 'Approved'");
  const pendingCount = await pool.query("SELECT count(*) FROM workman_profiles WHERE application_status = 'Pending'");
  const bookingsCount = await pool.query("SELECT count(*) FROM bookings");
  const usersCount = await pool.query("SELECT count(*) FROM users");

  console.log("=== SEEDING SUMMARY ===");
  console.log(`Total Users in DB: ${usersCount.rows[0].count}`);
  console.log(`Approved Workmen: ${approvedCount.rows[0].count}`);
  console.log(`Pending Approvals: ${pendingCount.rows[0].count}`);
  console.log(`Platform Bookings: ${bookingsCount.rows[0].count}`);
}

module.exports = { seedAllWorkmenAndJobs };

if (require.main === module) {
  seedAllWorkmenAndJobs()
    .then(() => {
      console.log("Done!");
      return pool.end();
    })
    .catch((err) => {
      console.error(err);
      pool.end();
      process.exit(1);
    });
}
