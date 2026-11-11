const bcrypt = require("bcryptjs");
const { pool } = require("../server/database");

async function seedExtraJobs() {
  console.log("Seeding extra 7 workman categories and jobs...");

  const defaultPasswordHash = await bcrypt.hash("LocalWork2026!", 10);

  const extraWorkmen = [
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
    }
  ];

  const createdIds = [];

  for (const w of extraWorkmen) {
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
      console.log(`Created new workman user: ${w.name} (id: ${userId})`);
    } else {
      userId = userRes.rows[0].id;
    }

    createdIds.push(userId);

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

  // Get customer accounts
  const customers = await pool.query("SELECT id, name, phone FROM users WHERE role = 'customer' LIMIT 4");
  const c1 = customers.rows[0];
  const c2 = customers.rows[1] || c1;
  const c3 = customers.rows[2] || c1;

  // Add 7 extra jobs for these new services
  const extraJobs = [
    {
      customerId: c1.id,
      workmanId: createdIds[0], // AC Repair
      customerName: c1.name,
      phone: "+91 98840 11223",
      address: "12 Gandhi Mandapam Road, Kotturpuram, Chennai",
      bookingDate: "2026-11-14",
      bookingTime: "11:00 AM",
      notes: "Master bedroom split AC not cooling. Air blower works but outdoor compressor fan stops after 5 minutes.",
      status: "Accepted"
    },
    {
      customerId: c2.id,
      workmanId: createdIds[1], // Appliance Repair
      customerName: c2.name,
      phone: "+91 98840 22334",
      address: "56 4th Avenue, Ashok Nagar, Chennai",
      bookingDate: "2026-11-15",
      bookingTime: "03:30 PM",
      notes: "Washing machine display shows error E20 during water draining cycle and drum won't spin.",
      status: "Pending"
    },
    {
      customerId: c3.id,
      workmanId: createdIds[2], // Gardening
      customerName: c3.name,
      phone: "+91 98840 33445",
      address: "24 2nd Seaward Road, Besant Nagar, Chennai",
      bookingDate: "2026-11-16",
      bookingTime: "08:00 AM",
      notes: "Terrace garden lawn trimming, organic fertilizer application, and checking automatic drip nozzles.",
      status: "Accepted"
    },
    {
      customerId: c1.id,
      workmanId: createdIds[3], // Pest Control
      customerName: c1.name,
      phone: "+91 98840 44556",
      address: "89 Medavakkam Main Road, Madipakkam, Chennai",
      bookingDate: "2026-11-17",
      bookingTime: "10:00 AM",
      notes: "Full apartment termite inspection and odorless gel treatment for kitchen cabinets.",
      status: "Pending"
    },
    {
      customerId: c2.id,
      workmanId: createdIds[4], // Welding
      customerName: c2.name,
      phone: "+91 98840 55667",
      address: "15 Industrial Road, Ambattur, Chennai",
      bookingDate: "2026-11-18",
      bookingTime: "02:00 PM",
      notes: "Compound entrance sliding iron gate bottom roller broken and needs spot arc welding.",
      status: "Accepted"
    },
    {
      customerId: c3.id,
      workmanId: createdIds[5], // Masonry & Tiling
      customerName: c3.name,
      phone: "+91 98840 66778",
      address: "31 Paper Mills Road, Perambur, Chennai",
      bookingDate: "2026-11-19",
      bookingTime: "09:30 AM",
      notes: "Replacing hollow floor tiles in dining room and re-fixing loose granite slab at main entrance.",
      status: "Completed"
    },
    {
      customerId: c1.id,
      workmanId: createdIds[6], // Waterproofing
      customerName: c1.name,
      phone: "+91 98840 77889",
      address: "47 Station Road, Chromepet, Chennai",
      bookingDate: "2026-11-20",
      bookingTime: "10:30 AM",
      notes: "Terrace parapet wall joint crack sealing and waterproofing coating before the monsoon rains.",
      status: "Pending"
    }
  ];

  for (const j of extraJobs) {
    await pool.query(
      `INSERT INTO bookings (customer_id, workman_id, customer_name, phone, address, booking_date, booking_time, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [j.customerId, j.workmanId, j.customerName, j.phone, j.address, j.bookingDate, j.bookingTime, j.notes, j.status]
    );
    console.log(`Created extra booking for ${j.customerName} with status '${j.status}'`);
  }

  console.log("Successfully seeded extra 7 workman categories and jobs!");
  process.exit(0);
}

seedExtraJobs().catch(e => {
  console.error("Error seeding extra jobs:", e);
  process.exit(1);
});
