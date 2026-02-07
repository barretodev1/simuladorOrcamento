const nodemailer = require("nodemailer");

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

if (!SMTP_USER || !SMTP_PASS) {
  console.warn("[MAILER] SMTP_USER/SMTP_PASS não configurados. Emails não serão enviados.");
}

const transporter = SMTP_USER && SMTP_PASS
  ? nodemailer.createTransport({
      service: "gmail",
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

async function sendEmail({ to, subject, html }) {
  if (!transporter) {
    console.log("[MAIL DEV] To:", to, "Subject:", subject);
    return { ok: false, dev: true };
  }

  const info = await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    html,
  });

  return { ok: true, messageId: info.messageId };
}

module.exports = { sendEmail };
