const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const sampleCustomers = [
  { name: "K. Senthil Nathan", email: "senthil.nathan.tn@gmail.com", phone: "+91 94431 88201", location: "Anna Nagar, Chennai" },
  { name: "Priya Radhakrishnan", email: "priya.radha.chennai@gmail.com", phone: "+91 98401 77312", location: "Adyar, Chennai" },
  { name: "V. Meenakshi Sundaram", email: "meenakshi.sundaram@gmail.com", phone: "+91 98840 55192", location: "T. Nagar, Chennai" },
  { name: "Deepak Somasundaram", email: "deepak.soma@outlook.com", phone: "+91 97910 44281", location: "Velachery, Chennai" },
  { name: "Kavitha Ranganathan", email: "kavitha.rangan@gmail.com", phone: "+91 94440 66329", location: "Mylapore, Chennai" },
  { name: "Dr. R. Arvind", email: "dr.arvind.neuro@gmail.com", phone: "+91 98410 99410", location: "Alwarpet, Chennai" },
  { name: "S. Swaminathan", email: "swami.finance@gmail.com", phone: "+91 99620 33817", location: "Thiruvanmiyur, Chennai" }
];

const workmanReviewsData = [
  {
    workmanId: 3, // S. Rajesh Kumar (Electrician)
    reviews: [
      { rating: 5, text: "Fixed our main distribution board tripped MCB neatly. Very knowledgeable electrician." },
      { rating: 5, text: "Installed 4 ceiling fans and extra socket points in our living room with neat casing. On time." },
      { rating: 4, text: "Quick inverter wiring inspection, reasonable charges and safe execution." }
    ]
  },
  {
    workmanId: 4, // B. Vijay Anand (Electrician)
    reviews: [
      { rating: 5, text: "Master electrician! Rewired entire 3BHK flat switchboards with zero mess. Top notch!" },
      { rating: 5, text: "Diagnosed a persistent earthing leakage in 15 mins that other technicians missed." },
      { rating: 5, text: "Arrived in 20 minutes for emergency power trip. Great service." },
      { rating: 4, text: "Very polite, highly skilled and transparent pricing." }
    ]
  },
  {
    workmanId: 5, // R. Karthik (Electrician)
    reviews: [
      { rating: 5, text: "Installed decorative LED strip lights and chandeliers in our shop. Good work." },
      { rating: 4, text: "Good service, came equipped with ladder and testing tools." },
      { rating: 5, text: "Solved short circuit problem promptly and cleaned up after work." }
    ]
  },
  {
    workmanId: 6, // R. Subramanian (Plumber)
    reviews: [
      { rating: 5, text: "Best plumber in the neighborhood. Replaced underground pipeline connector cleanly." },
      { rating: 5, text: "Fixed severe bathroom wall concealed pipe leakage without breaking extra tiles." },
      { rating: 5, text: "Very punctual, brought genuine branded spare parts with bills." },
      { rating: 4, text: "Prompt service on Sunday morning. Fixed kitchen blockage cleanly." }
    ]
  },
  {
    workmanId: 7, // M. Suresh Kumar (Plumber)
    reviews: [
      { rating: 5, text: "Installed overhead water tank automatic float switch valve perfectly." },
      { rating: 4, text: "Kitchen sink drain clog cleared within 30 minutes, cleanly done." },
      { rating: 5, text: "Good plumbing work, tested high pressure water flow before leaving." }
    ]
  },
  {
    workmanId: 8, // K. Manikandan (Plumber)
    reviews: [
      { rating: 4, text: "Replaced bathroom diverter tap and shower arm. Good finish." },
      { rating: 5, text: "Neat work on washing machine water inlet piping." },
      { rating: 4, text: "Satisfied with the work, polite behavior and fair charges." }
    ]
  },
  {
    workmanId: 9, // M. Ravichandran (Carpenter)
    reviews: [
      { rating: 5, text: "Outstanding teakwood door lock repair and wardrobe hinge alignment." },
      { rating: 5, text: "Craftsmanship is exceptional. Custom wooden shelves look beautiful." },
      { rating: 5, text: "Very disciplined and cleaned up wood shavings after finishing." }
    ]
  },
  {
    workmanId: 10, // Anand Natarajan (Carpenter)
    reviews: [
      { rating: 5, text: "Built custom kitchen modular drawer repair. Strong and durable finish." },
      { rating: 5, text: "Fixed heavy sliding wardrobe door that was jammed for weeks." },
      { rating: 4, text: "Professional carpenter with professional power tools." }
    ]
  },
  {
    workmanId: 11, // A. Dinesh (Carpenter)
    reviews: [
      { rating: 4, text: "Repaired dining table legs and dining chairs. Good sturdy fix." },
      { rating: 4, text: "Work completed as promised, took slightly longer but good outcome." },
      { rating: 5, text: "Affordable carpenter for quick household wooden repairs." }
    ]
  },
  {
    workmanId: 12, // K. Dhanush (Painter)
    reviews: [
      { rating: 5, text: "Waterproof primer and 2 coats of emulsion paint applied neatly." },
      { rating: 4, text: "Good wall putty touch-up work in living hall." },
      { rating: 4, text: "Decent painting job, covered furniture before starting." }
    ]
  },
  {
    workmanId: 13, // V. Rajesh Kannan (Painter)
    reviews: [
      { rating: 5, text: "Exterior weather-shield wall coating done with great precision." },
      { rating: 5, text: "Color selection guidance was helpful, paint finish is glossy and smooth." },
      { rating: 4, text: "Completed 2 bedrooms painting on schedule." }
    ]
  },
  {
    workmanId: 14, // J. Anthony Raj (Mechanic)
    reviews: [
      { rating: 5, text: "Brought toolset to doorstep, changed two-wheeler brake pads and clutch cable in 30 mins." },
      { rating: 5, text: "Car battery jump start and alternator belt inspection. Lifesaver!" },
      { rating: 4, text: "Honest mechanic, showed old worn parts before replacing." }
    ]
  },
  {
    workmanId: 15, // D. Murugan (Mechanic)
    reviews: [
      { rating: 4, text: "Bike engine oil change and carburetor tuning completed smoothly." },
      { rating: 5, text: "Quick doorstep puncture and wheel bearing service." },
      { rating: 5, text: "Reliable mechanic for quick roadside support." }
    ]
  },
  {
    workmanId: 16, // Sundari Meenakshi (Cleaning)
    reviews: [
      { rating: 5, text: "Deep kitchen cleaning removed years of stubborn oil and chimney grime. Sparkling clean!" },
      { rating: 5, text: "Bathroom acid wash and tile sanitization was done thoroughly. Highly recommended." },
      { rating: 5, text: "Very sincere and hardworking. Will book monthly." },
      { rating: 4, text: "Eco-friendly cleaning agents used, pleasant fragrance." }
    ]
  },
  {
    workmanId: 17, // Lakshmi Priya (Cleaning)
    reviews: [
      { rating: 5, text: "Sofa vacuuming and deep dust removal done nicely." },
      { rating: 4, text: "Full home move-in cleaning was delivered on time." },
      { rating: 5, text: "Courteous staff, focused on corner areas." }
    ]
  },
  {
    workmanId: 18, // C. Venkatesan (Construction)
    reviews: [
      { rating: 5, text: "Expert civil contractor. Compound wall crack repair and cement plastering done solidly." },
      { rating: 5, text: "Constructed new terrace water tank platform. Excellent structural strength." },
      { rating: 5, text: "True professional, 15 years experience is evident in his precision." }
    ]
  },
  {
    workmanId: 19, // S. Balaji (Construction)
    reviews: [
      { rating: 5, text: "Balcony waterproofing and tile relaying finished cleanly." },
      { rating: 4, text: "Concrete lintel reinforcement done with proper curing instructions." },
      { rating: 5, text: "Good estimation and arrived with adequate labor team." }
    ]
  },
  {
    workmanId: 20, // T. Saravanan (AC Repair)
    reviews: [
      { rating: 5, text: "Foam jet wash service restored AC cooling instantly. Power bill also dropped." },
      { rating: 5, text: "Replaced indoor blower motor capacitor on the spot. Great technician." },
      { rating: 4, text: "Checked gas pressure gauge in front of me before top-up. Very transparent." }
    ]
  },
  {
    workmanId: 21, // K. Vignesh (AC Repair)
    reviews: [
      { rating: 5, text: "Outdoor unit condenser coil cleaning and drain pipe unclogging done neatly." },
      { rating: 4, text: "Split AC relocation and re-installation done with copper pipe insulation." },
      { rating: 5, text: "Polite technician, completed service in under 1 hour." }
    ]
  },
  {
    workmanId: 22, // N. Gokul (Appliance Repair)
    reviews: [
      { rating: 5, text: "Fixed front-load washing machine drum spin error E03 within 45 minutes." },
      { rating: 5, text: "Microwave oven magnetron diode replaced with genuine OEM spare." },
      { rating: 4, text: "Very knowledgeable with all leading home appliance brands." }
    ]
  },
  {
    workmanId: 23, // P. Aravind (Appliance Repair)
    reviews: [
      { rating: 4, text: "Single door refrigerator defrost heater replaced. Cooling restored." },
      { rating: 5, text: "Water purifier RO membrane filter replacement done cleanly." },
      { rating: 4, text: "Reasonable service charge and prompt arrival." }
    ]
  },
  {
    workmanId: 24, // K. Mohanraj (Gardening)
    reviews: [
      { rating: 5, text: "Lawn grass mowing, edge trimming, and fruit tree pruning done beautifully." },
      { rating: 5, text: "Brought natural organic manure and repotted flowering plants with care." },
      { rating: 5, text: "Passionate gardener, our front yard looks vibrant." }
    ]
  },
  {
    workmanId: 25, // R. Jayaprakash (Pest Control)
    reviews: [
      { rating: 5, text: "Odorless herbal gel bait treatment for kitchen cockroaches. Zero insects in 3 days!" },
      { rating: 4, text: "Termite drilling and barrier chemical injection around door frames done systematically." },
      { rating: 5, text: "Gave 1-year service warranty card." }
    ]
  },
  {
    workmanId: 26, // V. Selvam (Welding)
    reviews: [
      { rating: 5, text: "Fabricated strong safety iron grill gate for our main entrance. Solid welding beads." },
      { rating: 5, text: "Repaired rusted terrace shed angle iron joints securely." },
      { rating: 4, text: "Carried portable arc welding machine and safety goggles. Skilled fabricator." }
    ]
  },
  {
    workmanId: 27, // P. Muthukumar (Masonry & Tiling)
    reviews: [
      { rating: 5, text: "Re-tiled 250 sqft kitchen with 2x2 vitrified tiles. Leveling and grouting are 100% flawless." },
      { rating: 5, text: "Brick masonry partition wall built with zero slope defect. Veteran mason." },
      { rating: 5, text: "Arrived at 8:30 AM sharp every day, completed job ahead of schedule." }
    ]
  },
  {
    workmanId: 28, // S. Manikandan (Waterproofing)
    reviews: [
      { rating: 5, text: "Terrace elastomeric waterproof membrane coating applied with fiberglass mesh. No seepage!" },
      { rating: 5, text: "Bathroom sunken slab polyurethane injection stopped downstairs ceiling leakage." },
      { rating: 4, text: "Very thorough inspection using thermal moisture meter." }
    ]
  },
  {
    workmanId: 29, // P. Selvaraj (Other)
    reviews: [
      { rating: 4, text: "Installed 8 HD CCTV dome cameras and configured live mobile app viewing." },
      { rating: 5, text: "Mounted 65-inch curved TV and concealed all HDMI wiring in wall conduit." },
      { rating: 5, text: "Skilled handyman for modern smart home electronics setup." }
    ]
  },
  {
    workmanId: 30, // N. Soundararajan (Other)
    reviews: [
      { rating: 5, text: "Curtain rod brackets, bathroom mirrors, and wall art frames fixed with laser level." },
      { rating: 4, text: "Door closer hydraulic hinge installed properly." },
      { rating: 4, text: "Dependable handyman with full toolbox." }
    ]
  }
];

async function seedVariedReviews() {
  console.log("Starting varied reviews seeding...");

  // 1. Ensure sample customers exist
  const customerIds = [];
  const dummyHash = await bcrypt.hash("Customer123!", 10);

  for (const c of sampleCustomers) {
    const existing = await pool.query("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [c.email]);
    if (existing.rows.length) {
      customerIds.push(existing.rows[0].id);
    } else {
      const ins = await pool.query(
        `INSERT INTO users (name, email, phone, location, role, password_hash)
         VALUES ($1, $2, $3, $4, 'customer', $5) RETURNING id`,
        [c.name, c.email, c.phone, c.location, dummyHash]
      );
      customerIds.push(ins.rows[0].id);
    }
  }

  console.log(`Customer pool ready with ${customerIds.length} verified customers.`);

  // 2. Iterate each workman review profile
  let totalReviewsSeeded = 0;
  let totalBookingsSeeded = 0;

  for (const wData of workmanReviewsData) {
    // Verify workman exists
    const wmCheck = await pool.query("SELECT id, name FROM users WHERE id = $1", [wData.workmanId]);
    if (!wmCheck.rows.length) continue;

    const workman = wmCheck.rows[0];

    for (let i = 0; i < wData.reviews.length; i++) {
      const r = wData.reviews[i];
      const custId = customerIds[i % customerIds.length];

      // Create a completed booking for this customer and workman
      const bookingInsert = await pool.query(
        `INSERT INTO bookings (customer_id, workman_id, customer_name, phone, address, booking_date, booking_time, notes, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Completed', NOW() - ($9 || ' days')::INTERVAL)
         RETURNING id`,
        [
          custId,
          workman.id,
          sampleCustomers[i % sampleCustomers.length].name,
          sampleCustomers[i % sampleCustomers.length].phone,
          sampleCustomers[i % sampleCustomers.length].location,
          "2026-11-0" + (i + 1),
          "10:00 AM",
          "Completed scheduled local service appointment.",
          (i + 1) * 3
        ]
      );

      const bookingId = bookingInsert.rows[0].id;
      totalBookingsSeeded++;

      // Insert the review
      await pool.query(
        `INSERT INTO reviews (booking_id, customer_id, workman_id, rating, review_text, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW() - ($6 || ' days')::INTERVAL)
         ON CONFLICT (booking_id) DO UPDATE SET rating = EXCLUDED.rating, review_text = EXCLUDED.review_text`,
        [bookingId, custId, workman.id, r.rating, r.text, (i + 1) * 3]
      );
      totalReviewsSeeded++;
    }
  }

  // 3. Print out average ratings for all workmen
  const summary = await pool.query(`
    SELECT
      u.id, u.name, wp.service,
      ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
      COUNT(r.id)::int AS reviews_count
    FROM users u
    JOIN workman_profiles wp ON wp.user_id = u.id
    LEFT JOIN reviews r ON r.workman_id = u.id
    WHERE wp.application_status = 'Approved'
    GROUP BY u.id, wp.service
    ORDER BY u.id
  `);

  console.log("\n=== UPDATED RATINGS FOR ALL WORKMEN ===");
  console.table(summary.rows);
  console.log(`\nSuccessfully seeded ${totalReviewsSeeded} verified reviews across ${summary.rows.length} workmen!`);
}

module.exports = { seedVariedReviews };

if (require.main === module) {
  seedVariedReviews()
    .then(() => pool.end())
    .catch((err) => {
      console.error("Seeding failed:", err);
      pool.end();
      process.exit(1);
    });
}
