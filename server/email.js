const env = require("../config/env");

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  if (!env.resendApiKey) {
    throw new Error("Email service is not configured.");
  }

  const safeName = String(name || "there")
    .replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [to],
      subject: "Reset your LocalWork password",
      html: `
        <h2>Password Reset</h2>
        <p>Hello ${safeName},</p>
        <p>We received a request to reset your LocalWork password.</p>
        <p>
          <a href="${resetUrl}">Reset My Password</a>
        </p>
        <p>This link expires in 15 minutes and can only be used once.</p>
        <p>If you did not request this, you can ignore this email.</p>
      `,
      text: `Hello ${name || "there"},

We received a request to reset your LocalWork password.

Reset your password using this link:
${resetUrl}

This link expires in 15 minutes and can only be used once.

If you did not request this, ignore this email.`
    }),
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error("Password reset email could not be sent.");
  }

  return true;
}

module.exports = { sendPasswordResetEmail };