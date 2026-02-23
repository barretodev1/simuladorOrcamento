const nodemailer = require("nodemailer");

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = (process.env.SMTP_PASS || "").replace(/\s+/g, ""); // remove espaços
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

if (!SMTP_USER || !SMTP_PASS) {
  console.warn("[MAILER] SMTP_USER/SMTP_PASS não configurados. Emails não serão enviados.");
}

const transporter =
  SMTP_USER && SMTP_PASS
    ? nodemailer.createTransport({
        service: "gmail",
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      })
    : null;

// teste opcional ao iniciar (ajuda muito no Render)
(async () => {
  if (!transporter) return;
  try {
    await transporter.verify();
    console.log("[MAILER] SMTP conectado com sucesso");
  } catch (err) {
    console.error("[MAILER] Falha ao conectar no SMTP:", err);
  }
})();

async function sendEmail({ to, subject, html }) {
  if (!transporter) {
    console.log("[MAIL DEV] To:", to, "Subject:", subject);
    return { ok: false, dev: true };
  }

  try {
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
    });

    console.log("[MAILER] Email enviado:", info.messageId, "to:", to);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error("[MAILER ERROR] sendMail falhou:", err);
    throw err;
  }
}

module.exports = { sendEmail };