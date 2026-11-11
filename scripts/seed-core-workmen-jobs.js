const bcrypt = require("bcryptjs");
const { pool } = require("../server/database");

async function seedCoreWorkmenAndJobs() {
  console.log("Seeding 10 core workmen and 7 extra jobs into Neon DB...");

  const defaultPasswordHash = await bcrypt.hash("LocalWork2026!", 10);

  const newWorkmen = [
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
      name: "N. Soundararajan",
      email: "soundar.security@localwork.dev",
      phone: "+91 98410 77012",
      location: "Alwarpet, Chennai",
      service: "Other",
      experience: 8,
      description: "Smart home security technician: HD CCTV camera setup, DVR/NVR networking, digital video door phone installation, and biometric smart door locks.",
      availability: "Available",
      status: "Approved"
    }
  ];

  const createdIds = [];

  for (const w of newWorkmen) {
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

    createdIds.push({ id: userId, service: w.service, name: w.name });

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
  const custRes = await pool.query("SELECT id, name, phone, location FROM users WHERE role = 'customer' ORDER BY id ASC LIMIT 5");
  const customers = custRes.rows;
  const c1 = customers[0];
  const c2 = customers[1] || c1;
  const c3 = customers[2] || c1;

  // Add 7 realistic jobs (bookings) across the core trades
  const jobsToSeed = [
    {
      customerId: c1.id,
      workmanId: createdIds[0].id, // Electrician - S. Rajesh Kumar
      customerName: c1.name,
      phone: c1.phone || "+91 98840 12345",
      address: "Flat 3B, Sunshine Apartments, 1st Main Rd, T. Nagar, Chennai",
      bookingDate: "2026-11-16",
      bookingTime: "10:30 AM",
      notes: "Main electrical distribution box tripping whenever AC and geyser run together. Need circuit breaker diagnosis and load balancing.",
      status: "Accepted"
    },
    {
      customerId: c2.id,
      workmanId: createdIds[1].id, // Plumber - R. Subramanian
      customerName: c2.name,
      phone: c2.phone || "+91 98840 23456",
      address: "14 Lakeview Enclave, 100 Feet Bypass Rd, Velachery, Chennai",
      bookingDate: "2026-11-17",
      bookingTime: "02:00 PM",
      notes: "Kitchen sink drain blocked and severe leakage under the granite counter. Need pipe replacement and water pressure check.",
      status: "Pending"
    },
    {
      customerId: c3.id,
      workmanId: createdIds[2].id, // Carpenter - M. Ravichandran
      customerName: c3.name,
      phone: c3.phone || "+91 98840 34567",
      address: "Plot 88, 5th Avenue, Shanthi Colony, Anna Nagar, Chennai",
      bookingDate: "2026-11-15",
      bookingTime: "11:00 AM",
      notes: "Sliding wardrobe door came off track and 2 modular kitchen drawers need new soft-close hydraulic hinges.",
      status: "Completed"
    },
    {
      customerId: c1.id,
      workmanId: createdIds[3].id, // Painter - K. Dhanush
      customerName: c1.name,
      phone: c1.phone || "+91 98840 12345",
      address: "29 GST Road, Near Sanatorium, Tambaram, Chennai",
      bookingDate: "2026-11-18",
      bookingTime: "09:00 AM",
      notes: "Living room accent wall painting with waterproof primer coating and Asian Paints Royale luxury emulsion.",
      status: "Accepted"
    },
    {
      customerId: c2.id,
      workmanId: createdIds[4].id, // Mechanic - J. Anthony Raj
      customerName: c2.name,
      phone: c2.phone || "+91 98840 23456",
      address: "5 Industrial Estate Road, Guindy, Chennai",
      bookingDate: "2026-11-19",
      bookingTime: "04:30 PM",
      notes: "Car battery completely drained and engine won't crank. Need on-site jumpstart and alternator charging test.",
      status: "Pending"
    },
    {
      customerId: c3.id,
      workmanId: createdIds[5].id, // Cleaning - Sundari Meenakshi
      customerName: c3.name,
      phone: c3.phone || "+91 98840 34567",
      address: "7 South Mada Street, Mylapore, Chennai",
      bookingDate: "2026-11-20",
      bookingTime: "08:30 AM",
      notes: "Deep home cleaning for 3BHK flat including bathroom acid descaling, window mosquito mesh scrubbing, and kitchen tile degreasing.",
      status: "Accepted"
    },
    {
      customerId: c1.id,
      workmanId: createdIds[7].id, // Other (Handyman) - P. Selvaraj
      customerName: c1.name,
      phone: c1.phone || "+91 98840 12345",
      address: "Tower 4, OMR IT Expressway, Sholinganallur, Chennai",
      bookingDate: "2026-11-21",
      bookingTime: "12:00 PM",
      notes: "Wall mounting a 65-inch Samsung OLED TV with heavy-duty swivel bracket, plus fixing 3 curtain rods and 2 bathroom mirror cabinets.",
      status: "Pending"
    }
  ];

  for (const job of jobsToSeed) {
    const existingJob = await pool.query(
      `SELECT id FROM bookings WHERE customer_id = $1 AND workman_id = $2 AND booking_date = $3`,
      [job.customerId, job.workmanId, job.bookingDate]
    );

    if (existingJob.rows.length === 0) {
      await pool.query(
        `INSERT INTO bookings (customer_id, workman_id, customer_name, phone, address, booking_date, booking_time, notes, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [job.customerId, job.workmanId, job.customerName, job.phone, job.address, job.bookingDate, job.bookingTime, job.notes, job.status]
      );
      console.log(`Inserted booking: ${job.customerName} -> Workman ID ${job.workmanId} (${job.bookingDate}) [${job.status}]`);
    } else {
      console.log(`Booking already exists for customer ${job.customerId} and workman ${job.workmanId} on ${job.bookingDate}`);
    }
  }

  console.log("Core workmen and jobs seeding completed successfully!");
}

seedCoreWorkmenAndJobs()
  .then(() => pool.end())
  .catch((err) => {
    console.error("Seeding error:", err);
    pool.end();
    process.exit(1);
  });
