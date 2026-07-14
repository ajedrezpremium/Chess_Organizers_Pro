import nodemailer from 'nodemailer';
import config from '../config.js';

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  if (config.smtp?.host) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port || 587,
      secure: config.smtp.secure || false,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  } else {
    const test = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: test.user, pass: test.pass },
    });
    console.log(`📧 Email dev mode — ethereal: ${test.user}`);
  }
  return transporter;
}

export async function sendMail({ to, subject, html }) {
  try {
    const t = await getTransporter();
    const info = await t.sendMail({
      from: `"Chess Organizers Pro" <${config.smtp?.user || 'noreply@chessorganizers.dev'}>`,
      to, subject, html,
    });
    if (info.messageId && !config.smtp?.host) {
      console.log(`📧 Preview: ${nodemailer.getTestMessageUrl(info)}`);
    }
    return info;
  } catch (err) {
    console.error('📧 Email error:', err.message);
    return null;
  }
}
