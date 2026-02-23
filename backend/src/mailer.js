const nodemailer = require("nodemailer");
const dns = require("dns");

// força preferência por IPv4 (ajuda em hosts que falham com IPv6)
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (_) {}

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = (process.env.SMTP_PASS || "").replace(/\s+/g, ""); // remove espaços
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

if (!SMTP_USER || !SMTP_PASS) {
  console.warn("[MAILER] SMTP_USER/SMTP_PASS não configurados. Emails não serão enviados.");
}

const transporter =
  SMTP_USER && SMTP_PASS
    ? nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,            // STARTTLS (melhor que 465 pro seu caso)
        secure: false,        // false na 587
        requireTLS: true,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
        tls: {
          servername: "smtp.gmail.com",
        },
        family: 4,            // força IPv4 na conexão
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      })
    : null;

// teste de conexão ao subir (aparece no log do Render)
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