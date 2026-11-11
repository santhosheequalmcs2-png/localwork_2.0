const env = require("../config/env");

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  if (!env.resendApiKey) {
    throw new Error("Email service is not configured (RESEND_API_KEY is missing).");
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
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; color: #1e293b;">
          <div style="display: flex; align-items: center; margin-bottom: 24px;">
            <h2 style="margin: 0; color: #047857; font-size: 24px; font-weight: 700;">LocalWork</h2>
          </div>
          <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 20px;">Password Reset Request</h3>
          <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6;">Hello <strong>${safeName}</strong>,</p>
          <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
            We received a request to reset your password for your LocalWork account. Click the button below to choose a new password:
          </p>
          <div style="margin: 28px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #059669, #047857); color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);">
              Reset My Password
            </a>
          </div>
          <p style="margin: 24px 0 8px 0; font-size: 13px; color: #64748b; line-height: 1.5;">
            ⏱️ <strong>This link expires in 15 minutes</strong> and can only be used once.
          </p>
          <p style="margin: 0 0 24px 0; font-size: 13px; color: #64748b; line-height: 1.5;">
            If you did not request this password reset, please ignore this email. Your password will remain unchanged.
          </p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5; word-break: break-all;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="${resetUrl}" style="color: #047857; text-decoration: underline;">${resetUrl}</a>
          </p>
        </div>
      `,
      text: `Hello ${name || "there"},

We received a request to reset your LocalWork password.

Reset your password using this link:
${resetUrl}

This link expires in 15 minutes and can only be used once.

If you did not request this, you can safely ignore this email.`
    }),
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[Resend Error ${response.status}]:`, errorBody);
    let parsed;
    try {
      parsed = JSON.parse(errorBody);
    } catch (_) {}
    const detail = parsed?.message || errorBody || "Email dispatch failed";
    throw new Error(`Email provider error: ${detail}`);
  }

  return true;
}

module.exports = { sendPasswordResetEmail };