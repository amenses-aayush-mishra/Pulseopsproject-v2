'use strict';
/**
 * Centralised Nodemailer transporter for all PulseOps emails.
 *
 * Configuration priority:
 *   1. SMTP_HOST + SMTP_PORT + SMTP_USER + SMTP_PASS  → any external SMTP (Gmail, SendGrid, etc.)
 *   2. No credentials but SMTP_HOST set                → relay (local mail server / MailHog)
 *   3. Nothing set (dev)                               → Ethereal test account (auto-created,
 *                                                        preview URL logged to console)
 *
 * Gmail App Password notes:
 *   - Enable 2-FA on the Google account, then create an App Password.
 *   - Set SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_USER=<gmail>, SMTP_PASS=<app-password>.
 *   - family:4 forces IPv4 so ::1 ECONNREFUSED errors are eliminated.
 */
const nodemailer = require('nodemailer');

let _transporter = null;

async function getTransporter() {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    // Production / staging path — real SMTP credentials supplied.
    _transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      // Force IPv4: prevents ECONNREFUSED on systems where ::1 is tried first.
      socketOptions: { family: 4 },
      tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
    });
    console.log(`[mailer] SMTP transporter ready — ${host}:${port} (user: ${user})`);
  } else if (host) {
    // Local relay (MailHog, Papercut, etc.) — no auth needed.
    _transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      socketOptions: { family: 4 },
      tls: { rejectUnauthorized: false },
    });
    console.log(`[mailer] Relay transporter ready — ${host}:${port} (no auth)`);
  } else {
    // Dev fallback — Ethereal ephemeral test account.
    const testAccount = await nodemailer.createTestAccount();
    _transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
      socketOptions: { family: 4 },
    });
    console.log(
      `[mailer] ⚠  No SMTP credentials — using Ethereal test account.\n` +
        `  Preview emails at https://ethereal.email (user: ${testAccount.user})`
    );
  }

  return _transporter;
}

/**
 * Send an email.
 * @param {{ to: string, subject: string, html: string, text?: string }} options
 */
async function sendMail({ to, subject, html, text }) {
  const transport = await getTransporter();
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'PulseOps <noreply@pulseops.dev>';
  const info = await transport.sendMail({ from, to, subject, html, text });

  // Log Ethereal preview URL in development so developers can inspect the mail.
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`[mailer] Preview: ${previewUrl}`);
  }

  return info;
}

// Legacy compatibility — some routes expose transporter.sendMail directly for test stubbing.
// We expose a proxy object so the e2e-audit-runner.js stubs continue working.
const transporter = {
  sendMail: (opts) => sendMail(opts),
};

module.exports = { sendMail, transporter, getTransporter };
