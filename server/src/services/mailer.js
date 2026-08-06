const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT || 1025),
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
});

const sendMail = ({ to, subject, html }) => transporter.sendMail({
  from: process.env.EMAIL_FROM || 'PulseOps <noreply@pulseops.com>',
  to,
  subject,
  html,
});

module.exports = { sendMail };
