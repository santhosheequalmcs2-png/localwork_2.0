const { z } = require("zod");
function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Please check the submitted information." });
    }
    req.body = parsed.data;
    next();
  };
}
const email = z.string().trim().email().max(254).transform(v => v.toLowerCase());
const phone = z.string().trim().min(8).max(18).regex(/^[+\d\s()-]+$/, "Enter a valid phone number.");
const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  phone,
  location: z.string().trim().min(2).max(120),
  password: z.string().min(10).max(128),
 role: z.literal("customer").optional().default("customer"),
});
const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
const forgotPasswordSchema = z.object({
  email
});

const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i, "Invalid or expired reset link."),
  password: z.string().min(10).max(128)
});
const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone,
  location: z.string().trim().min(2).max(120),
  service: z.string().trim().min(1).max(40),
  experience: z.coerce.number().int().min(0).max(70),
  description: z.string().trim().min(10).max(1000),
  availability: z.enum(["Available", "Busy"])
});
const accountProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone,
  location: z.string().trim().min(2).max(120)
});
const bookingSchema = z.object({
  workmanId: z.coerce.number().int().positive(),
  customerName: z.string().trim().min(2).max(80),
  phone,
  address: z.string().trim().min(3).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().trim().min(3).max(40),
  notes: z.string().trim().max(1000).optional().default("")
}).superRefine((v, ctx) => {
  if (v.date < new Date().toISOString().slice(0, 10)) ctx.addIssue({ code: "custom", path: ["date"], message: "Choose today or a future date." });
});
const statusSchema = z.object({ status: z.enum(["Accepted", "Declined", "Completed", "Cancelled"]) });
module.exports = {
  validate,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  loginSchema,
  profileSchema,
  accountProfileSchema,
  bookingSchema,
  statusSchema
};