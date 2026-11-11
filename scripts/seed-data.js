const bcrypt = require("bcryptjs");
const { pool } = require("../server/database");

async function seed() {
  console.log("Starting seed of 10 workmen and 7 jobs/bookings...");

  const defaultPasswordHash = await bcrypt.hash("LocalWork2026!", 10);

  const workmenData = [
    {
      name: "R. Karthik",
      email: "karthik.electrician@localwork.dev",
      phone: "+91 98401 23451",
      location: "Anna Nagar, Chennai",
      service: "Electrician",
      experience: 8,
      description: "Specialist in residential wiring, MCB tripping issues, inverter setups, and electrical appliance troubleshooting.",
      availability: "Available",
      status: "Approved"
    },
    {
      name: "M. Suresh Kumar",
      email: "suresh.plumber@localwork.dev",
      phone: "+91 98402 34562",
      location: "T. Nagar, Chennai",
      service: "Plumber",
      experience: 12,
      description: "Expert in bathroom plumbing repairs, water heater installation, leak detections, and pipeline replacements.",
      availability: "Available",
      status: "Approved"
    },
    {
      name: "Anand Natarajan",
      email: "anand.carpenter@localwork.dev",
      phone: "+91 98403 45673",
      location: "Velachery, Chennai",
      service: "Carpenter",
      experience: 10,
      description: "Custom wooden furniture maker, modular kitchen carpentry, door/lock fittings, and antique furniture restoration.",
      availability: "Available",
      status: "Approved"
    },
    {
      name: "V. Rajesh Kannan",
      email: "rajesh.painter@localwork.dev",
      phone: "+91 98404 56784",
      location: "Adyar, Chennai",
      service: "Painter",
      experience: 7,
      description: "Interior and exterior wall painting, waterproof wall priming, texture designs, and decorative finishings.",
      availability: "Available",
      status: "Approved"
    },
    {
      name: "D. Murugan",
      email: "murugan.mechanic@localwork.dev",
      phone: "+91 98405 67895",
      location: "Tambaram, Chennai",
      service: "Mechanic",
      experience: 14,
      description: "Two-wheeler and small vehicle diagnostics, engine tuning, brake repairs, and on-call roadside assistance.",
      availability: "Available",
      status: "Approved"
    },
    {
      name: "Lakshmi Priya",
      email: "lakshmi.cleaning@localwork.dev",
      phone: "+91 98406 78906",
      location: "Porur, Chennai",
      service: "Cleaning",
      experience: 5,
      description: "Deep house cleaning, kitchen de-greasing, post-renovation cleaning, and upholstery shampooing services.",
      availability: "Available",
      status: "Approved"
    },
    {
      name: "S. Balaji",
      email: "balaji.construction@localwork.dev",
      phone: "+91 98407 89017",
      location: "Guindy, Chennai",
      service: "Construction",
      experience: 15,
      description: "Masonry repairs, tile laying, bathroom remodelling, structural crack patching, and terrace waterproofing.",
      availability: "Available",
      status: "Approved"
    },
    {
      name: "G. Praveen Kumar",
      email: "praveen.electrician@localwork.dev",
      phone: "+91 98408 90128",
      location: "Nungambakkam, Chennai",
      service: "Electrician",
      experience: 6,
      description: "LED lighting design, ceiling fan installations, switchboard replacements, and safety earth testing.",
      availability: "Available",
      status: "Approved"
    },
    {
      name: "K. Manikandan",
      email: "manikandan.plumber@localwork.dev",
      phone: "+91 98409 01239",
      location: "Mylapore, Chennai",
      service: "Plumber",
      experience: 9,
      description: "RO purifier installation, drainage clearing, tap washer replacements, and overhead water tank connections.",
      availability: "Available",
      status: "Approved"
    },
    {
      name: "A. Dinesh",
      email: "dinesh.carpenter@localwork.dev",
      phone: "+91 98410 12340",
      location: "Thiruvanmiyur, Chennai",
      service: "Carpenter",
      experience: 4,
      description: "Wardrobe sliding door repairs, wooden partition installation, hinge adjustments, and window frame fixes.",
      availability: "Available",
      status: "Approved"
    }
  ];

  const createdWorkmenIds = [];

  for (const w of workmenData) {
    // Check if user already exists
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
      console.log(`Created user: ${w.name} (id: ${userId})`);
    } else {
      userId = userRes.rows[0].id;
      console.log(`User already exists: ${w.name} (id: ${userId})`);
    }

    createdWorkmenIds.push(userId);

    // Upsert workman_profile
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

  // Find a customer to assign the bookings to
  const customerRes = await pool.query("SELECT id, name, phone, location FROM users WHERE role = 'customer' LIMIT 3");
  const defaultCustomerId = customerRes.rows[0]?.id || createdWorkmenIds[0];
  const defaultCustomerName = customerRes.rows[0]?.name || "R. Ragul";

  const jobsData = [
    {
      customerId: defaultCustomerId,
      workmanId: createdWorkmenIds[0], // R. Karthik (Electrician)
      customerName: defaultCustomerName,
      phone: "+91 94441 22334",
      address: "14/2, 2nd Avenue, Anna Nagar, Chennai",
      bookingDate: "2026-11-13",
      bookingTime: "10:00 AM",
      notes: "Kitchen main circuit breaker trips whenever the microwave is turned on. Need complete wiring inspection.",
      status: "Accepted"
    },
    {
      customerId: customerRes.rows[1]?.id || defaultCustomerId,
      workmanId: createdWorkmenIds[1], // M. Suresh Kumar (Plumber)
      customerName: customerRes.rows[1]?.name || "K. Vijay",
      phone: "+91 94442 33445",
      address: "Flat 3B, Sunshine Apartments, T. Nagar, Chennai",
      bookingDate: "2026-11-14",
      bookingTime: "11:30 AM",
      notes: "Persistent water leak under the bathroom washbasin and low water pressure in the shower line.",
      status: "Pending"
    },
    {
      customerId: customerRes.rows[2]?.id || defaultCustomerId,
      workmanId: createdWorkmenIds[2], // Anand Natarajan (Carpenter)
      customerName: customerRes.rows[2]?.name || "M. Anitha",
      phone: "+91 94443 44556",
      address: "45 Lake View Road, Velachery, Chennai",
      bookingDate: "2026-11-12",
      bookingTime: "02:00 PM",
      notes: "Master bedroom wardrobe hinges are loose and sliding door is stuck on the lower track.",
      status: "Accepted"
    },
    {
      customerId: defaultCustomerId,
      workmanId: createdWorkmenIds[3], // V. Rajesh Kannan (Painter)
      customerName: defaultCustomerName,
      phone: "+91 94444 55667",
      address: "8 Beach Road, Adyar, Chennai",
      bookingDate: "2026-11-15",
      bookingTime: "09:00 AM",
      notes: "Living room and hallway interior repaint. Wall primer and two coats of washable emulsion.",
      status: "Pending"
    },
    {
      customerId: customerRes.rows[1]?.id || defaultCustomerId,
      workmanId: createdWorkmenIds[5], // Lakshmi Priya (Cleaning)
      customerName: customerRes.rows[1]?.name || "K. Vijay",
      phone: "+91 94445 66778",
      address: "22 Trunk Road, Porur, Chennai",
      bookingDate: "2026-11-13",
      bookingTime: "08:30 AM",
      notes: "Full kitchen deep cleaning, chimney grease removal, and floor sanitization before housewarming event.",
      status: "Completed"
    },
    {
      customerId: customerRes.rows[2]?.id || defaultCustomerId,
      workmanId: createdWorkmenIds[4], // D. Murugan (Mechanic)
      customerName: customerRes.rows[2]?.name || "M. Anitha",
      phone: "+91 94446 77889",
      address: "Plot 19, GST Road, Tambaram, Chennai",
      bookingDate: "2026-11-16",
      bookingTime: "04:00 PM",
      notes: "Scooter front brake pads replacement and periodic oil servicing at doorstep.",
      status: "Accepted"
    },
    {
      customerId: defaultCustomerId,
      workmanId: createdWorkmenIds[6], // S. Balaji (Construction)
      customerName: defaultCustomerName,
      phone: "+91 94447 88990",
      address: "10 Industrial Estate, Guindy, Chennai",
      bookingDate: "2026-11-17",
      bookingTime: "10:30 AM",
      notes: "Balcony floor tile re-grouting and fixing rainwater seepage near the sliding glass balcony door.",
      status: "Pending"
    }
  ];

  for (const j of jobsData) {
    await pool.query(
      `INSERT INTO bookings (customer_id, workman_id, customer_name, phone, address, booking_date, booking_time, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [j.customerId, j.workmanId, j.customerName, j.phone, j.address, j.bookingDate, j.bookingTime, j.notes, j.status]
    );
    console.log(`Created booking for workman ${j.workmanId} with status '${j.status}'`);
  }

  console.log("Successfully seeded 10 workmen and 7 jobs/bookings!");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
