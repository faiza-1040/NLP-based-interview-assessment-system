// server/utils/mailer.js
const nodemailer = require('nodemailer');

// If your network/AV does TLS inspection, Gmail’s cert chain looks “self-signed” to Node.
// For local DEV we allow it. For PROD, set SMTP_ALLOW_SELF_SIGNED=false.
const allowSelfSigned = String(process.env.SMTP_ALLOW_SELF_SIGNED || 'true').toLowerCase() === 'true';

const hasCreds =
  !!process.env.SMTP_HOST &&
  !!process.env.SMTP_USER &&
  !!process.env.SMTP_PASS;

const isGmail = (process.env.SMTP_HOST || '').toLowerCase() === 'smtp.gmail.com';

let transporter;
if (hasCreds) {
  const baseOpts = allowSelfSigned ? { tls: { rejectUnauthorized: false } } : {};
  if (isGmail) {
    // Recommended for Gmail with App Password
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,  // your full Gmail address
        pass: process.env.SMTP_PASS,  // 16-char Gmail App Password
      },
      logger: true,
      ...baseOpts,
    });
  } else {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true', // true for 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      logger: true,
      ...baseOpts,
    });
  }
} else {
  // Dev fallback: log emails to console as JSON (no sending)
  transporter = nodemailer.createTransport({ jsonTransport: true });
}

const FROM =
  // Use your authenticated mailbox for best deliverability (SPF/DMARC)
  process.env.SMTP_USER ||
  process.env.MAIL_FROM ||
  '"MCVPARSER" <no-reply@mcvparser.local>';

function logMode() {
  console.log(
    `[mailer] mode=${hasCreds ? (isGmail ? 'SMTP:GMAIL' : 'SMTP:CUSTOM') : 'DEV-LOG'} ` +
    `host=${process.env.SMTP_HOST || 'none'} from=${FROM}` +
    (allowSelfSigned ? '  (TLS:self-signed ALLOWED)' : '')
  );
}

async function verifyTransport() {
  logMode();
  try {
    const ok = await transporter.verify();
    console.log(`[mailer] SMTP ready: ${ok === true ? 'OK' : ok}`);
  } catch (e) {
    console.error('[mailer] SMTP verify FAILED:', e?.message || e);
  }
}

async function sendMail(to, subject, html) {
  if (!to) {
    console.warn('[mailer] No "to" address provided; skipped.');
    return false;
  }
  try {
    const info = await transporter.sendMail({
      from: FROM,
      to,
      subject,
      html,
    });

    if (!hasCreds) {
      console.log('📬 [DEV EMAIL OUTPUT]\n', JSON.stringify(info, null, 2));
    } else {
      console.log('📧 Mail sent:', info.messageId);
    }
    return true;
  } catch (err) {
    console.error('❌ Mail send error:', err?.message || err);
    return false;
  }
}

module.exports = { sendMail, verifyTransport };
