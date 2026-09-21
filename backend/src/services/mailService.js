const nodemailer = require('nodemailer');

function mailConfig() {
  const host = process.env.MAIL_HOST;
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port: Number(process.env.MAIL_PORT || 587),
    secure: process.env.MAIL_SECURE === 'true',
    user,
    pass,
    from: process.env.MAIL_FROM || user
  };
}

function createTransport() {
  const config = mailConfig();
  if (!config) return null;
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass }
  });
}

async function sendMail({ to, subject, text, html }) {
  const config = mailConfig();
  if (!config) {
    throw Object.assign(new Error('Email service is not configured'), { code: 'MAIL_NOT_CONFIGURED' });
  }
  const transporter = createTransport();
  if (!transporter) {
    throw Object.assign(new Error('Email service is not configured'), { code: 'MAIL_NOT_CONFIGURED' });
  }
  await transporter.sendMail({ from: config.from, to, subject, text, html });
}

module.exports = { sendMail, mailConfig };