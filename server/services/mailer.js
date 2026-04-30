const nodemailer = require('nodemailer');

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const hasAuth = Boolean(process.env.SMTP_USER);

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number.isNaN(smtpPort) ? 587 : smtpPort,
    secure: smtpPort === 465,
    auth: hasAuth
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  });

  return cachedTransporter;
}

async function sendMail(to, subject, html) {
  if (!process.env.SMTP_HOST) {
    console.warn('SMTP_HOST is not set. Skipping outbound email.');
    return;
  }

  const from = process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@campusconnect.app';
  const transporter = getTransporter();

  await transporter.sendMail({
    from,
    to,
    subject,
    html,
  });
}

module.exports = {
  sendMail,
};
