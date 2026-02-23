require("dotenv").config();

const path = require("path");
const fs = require("fs");

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Resend } = require("resend");

const pool = require("./db");
const { sendEmail } = require("./mailer");

const scenariosRouter = require("./routes/scenarios");
const scenariosRouterMedia = require("./routes/scenariosmedia");
const accountRouter = require("./routes/account");

const app = express();
app.set("trust proxy", 1);

const isProd = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT) || 3000;

// ==========================
// CORS (deploy-friendly)
// ==========================
/**
 * - Se você subir FRONT + API juntos (mesmo host), pode deixar FRONTEND_ORIGIN vazio -> libera.
 * - Se separar, set:
 *   FRONTEND_ORIGIN="https://seufront.com,https://www.seufront.com"
 */
const rawOrigins = (process.env.FRONTEND_ORIGIN || process.env.APP_URL || "").trim();
const allowedOrigins = rawOrigins
  ? rawOrigins.split(",").map((s) => s.trim()).filter(Boolean)
  : (isProd ? [] : ["https://simulador-orcamento.netlify.app"]);

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl/postman/server-to-server
    if (allowedOrigins.length === 0) return cb(null, true); // single-host
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS bloqueado para: ${origin}`));
  },
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "DELETE", "PATCH", "PUT", "OPTIONS"],
};

app.use(cors(corsOptions));
// ⚠️ Express/router novo não aceita "*" / "/*" => usar RegExp
app.options(/.*/, cors(corsOptions));

app.use(express.json({ limit: "25mb" }));

// ==========================
// Helpers p/ não duplicar rotas
// ==========================
const API_PREFIX = "/api";

const mountBoth = (basePath, router) => {
  app.use(basePath, router);
  app.use(`${API_PREFIX}${basePath}`, router);
};

const getBoth = (routePath, handler) => {
  app.get(routePath, handler);
  app.get(`${API_PREFIX}${routePath}`, handler);
};

const postBoth = (routePath, handler) => {
  app.post(routePath, handler);
  app.post(`${API_PREFIX}${routePath}`, handler);
};

const patchBoth = (routePath, handler) => {
  app.patch(routePath, handler);
  app.patch(`${API_PREFIX}${routePath}`, handler);
};

// ==========================
// ROTAS (routers) - com alias /api
// ==========================
mountBoth("/simulador_de_gastos/historicos", require("./routes/historicos"));
mountBoth("/simulacao_recorrente", scenariosRouter);
mountBoth("/simulacao_media", scenariosRouterMedia);

// (router de account/me/change-password etc.)
mountBoth("/auth", accountRouter);

// ==========================
// Resend + secrets
// ==========================
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const RESET_SECRET = process.env.RESET_JWT_SECRET || process.env.JWT_SECRET;

function generate6DigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendRecoveryEmail(toEmail, code) {
  const subject = "Código de recuperação de senha";
  const html = `
    <div style="font-family: Arial, sans-serif;">
      <h2>Recuperação de senha</h2>
      <p>Seu código é:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
      <p>Esse código expira em 10 minutos.</p>
    </div>
  `;
  await sendEmail({ to: toEmail, subject, html });
}

async function sendRegisterEmail(toEmail, code) {
  const subject = "Código para confirmar seu cadastro";
  const html = `
    <div style="font-family: Arial, sans-serif;">
      <h2>Confirmar criação de conta</h2>
      <p>Seu código é:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
      <p>Esse código expira em 10 minutos.</p>
    </div>
  `;

  // 1) tenta Resend se estiver configurado
  if (resend && process.env.MAIL_FROM) {
    await resend.emails.send({
      from: process.env.MAIL_FROM,
      to: [toEmail],
      subject,
      html,
    });
    return;
  }

  // 2) fallback: SMTP (nodemailer)
  await sendEmail({ to: toEmail, subject, html });
}

// ==========================
// HEALTHCHECK (com alias /api/health)
// ==========================
getBoth("/health", async (req, res) => {
  try {
    const r = await pool.query("SELECT 1 as ok");
    res.json({ ok: true, db: r.rows[0].ok === 1 });
  } catch (e) {
    res.status(500).json({
      ok: false,
      message: "Falha ao consultar o banco no /health",
      detail: e.message,
    });
  }
});

// ==========================
// AUTH - REGISTER (com alias /api/auth/*)
// ==========================
postBoth("/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Dados obrigatórios faltando." });
    }

    const exists = await pool.query("SELECT id FROM public.users WHERE email=$1", [email]);
    if (exists.rowCount > 0) {
      return res.status(409).json({ message: "Email já cadastrado." });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO public.users (name, email, password_hash)
       VALUES ($1,$2,$3)
       RETURNING id, name, email`,
      [name, email, password_hash]
    );

    return res.status(201).json({ user: result.rows[0] });
  } catch (e) {
    console.error("REGISTER ERROR:", e);
    return res.status(500).json({ message: "Erro no cadastro.", detail: e.message });
  }
});

// ==========================
// AUTH - LOGIN (com alias /api/auth/*)
// ==========================
postBoth("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email e senha são obrigatórios." });
    }

    const userQ = await pool.query(
      "SELECT id, name, email, password_hash FROM public.users WHERE email=$1",
      [email]
    );

    if (userQ.rowCount === 0) {
      return res.status(401).json({ message: "Dados incorretos." });
    }

    const user = userQ.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      return res.status(401).json({ message: "Dados incorretos." });
    }

    const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "2h",
    });

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    return res.status(500).json({ message: "Erro no login.", detail: e.message });
  }
});

// ==========================
// CADASTRO COM CÓDIGO (EMAIL)
// ==========================

// 1) Envia código para confirmar cadastro
postBoth("/auth/register/send-code", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Nome, email e senha são obrigatórios." });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Senha deve ter no mínimo 6 caracteres." });
    }

    const exists = await pool.query("SELECT id FROM public.users WHERE email=$1", [email]);
    if (exists.rowCount > 0) {
      return res.status(409).json({ message: "Email já cadastrado. Faça login." });
    }

    const last = await pool.query(
      `SELECT created_at
       FROM public.register_verification_codes
       WHERE email=$1
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );

    if (last.rowCount > 0) {
      const lastDate = new Date(last.rows[0].created_at);
      if (Date.now() - lastDate.getTime() < 60_000) {
        return res.status(429).json({ message: "Aguarde um pouco antes de solicitar outro código." });
      }
    }

    const code = generate6DigitCode();
    const code_hash = await bcrypt.hash(code, 10);
    const password_hash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO public.register_verification_codes (email, name, password_hash, code_hash, expires_at)
       VALUES ($1,$2,$3,$4, now() + interval '10 minutes')`,
      [email, name, password_hash, code_hash]
    );

    await sendRegisterEmail(email, code);

    return res.json({ ok: true, message: "Código enviado para o email." });
  } catch (e) {
    console.error("REGISTER SEND-CODE ERROR:", e);
    return res.status(500).json({ message: "Erro ao enviar código.", detail: e.message });
  }
});

// 2) Verifica código e cria o usuário
postBoth("/auth/register/verify-code", async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: "Email e código são obrigatórios." });
    }

    const recQ = await client.query(
      `SELECT id, email, name, password_hash, code_hash, attempts, expires_at, consumed_at
       FROM public.register_verification_codes
       WHERE email=$1 AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );

    if (recQ.rowCount === 0) {
      return res.status(404).json({ message: "Nenhum código ativo encontrado. Solicite novamente." });
    }

    const rec = recQ.rows[0];

    if (new Date(rec.expires_at).getTime() < Date.now()) {
      return res.status(410).json({ message: "Código expirado. Solicite um novo." });
    }

    if (rec.attempts >= 5) {
      return res.status(429).json({ message: "Muitas tentativas. Solicite um novo código." });
    }

    const ok = await bcrypt.compare(code, rec.code_hash);

    if (!ok) {
      await client.query(
        `UPDATE public.register_verification_codes
         SET attempts = attempts + 1
         WHERE id=$1`,
        [rec.id]
      );
      return res.status(401).json({ message: "Código incorreto. Confira e tente novamente." });
    }

    await client.query("BEGIN");

    const exists = await client.query("SELECT id FROM public.users WHERE email=$1", [email]);
    if (exists.rowCount > 0) {
      await client.query(
        `UPDATE public.register_verification_codes SET consumed_at = now(), verified_at = now()
         WHERE id=$1`,
        [rec.id]
      );
      await client.query("COMMIT");
      return res.status(409).json({ message: "Esse email já foi cadastrado. Faça login." });
    }

    const result = await client.query(
      `INSERT INTO public.users (name, email, password_hash)
       VALUES ($1,$2,$3)
       RETURNING id, name, email`,
      [rec.name, rec.email, rec.password_hash]
    );

    await client.query(
      `UPDATE public.register_verification_codes
       SET verified_at = now(), consumed_at = now(), attempts = attempts + 1
       WHERE id=$1`,
      [rec.id]
    );

    await client.query("COMMIT");

    return res.json({ ok: true, user: result.rows[0] });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("REGISTER VERIFY-CODE ERROR:", e);
    return res.status(500).json({ message: "Erro ao validar código.", detail: e.message });
  } finally {
    client.release();
  }
});

// ==========================
// RECUPERAÇÃO DE SENHA
// ==========================

// 1) Enviar código
postBoth("/auth/recovery/send-code", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email é obrigatório." });

    const userQ = await pool.query("SELECT id, email FROM public.users WHERE email=$1", [email]);

    if (userQ.rowCount === 0) {
      return res.status(404).json({
        message: "Esse email não possui conta. Crie uma conta para continuar.",
      });
    }

    const last = await pool.query(
      `SELECT created_at
       FROM public.password_recovery_codes
       WHERE email=$1
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );

    if (last.rowCount > 0) {
      const lastDate = new Date(last.rows[0].created_at);
      if (Date.now() - lastDate.getTime() < 60_000) {
        return res.status(429).json({ message: "Aguarde um pouco antes de solicitar outro código." });
      }
    }

    const user = userQ.rows[0];
    const code = generate6DigitCode();
    const code_hash = await bcrypt.hash(code, 10);

    await pool.query(
      `INSERT INTO public.password_recovery_codes (user_id, email, code_hash, expires_at)
       VALUES ($1,$2,$3, now() + interval '10 minutes')`,
      [user.id, email, code_hash]
    );

    await sendRecoveryEmail(email, code);

    return res.json({ ok: true, message: "Código enviado para o email." });
  } catch (e) {
    console.error("SEND-CODE ERROR:", e);
    return res.status(500).json({ message: "Erro ao enviar código.", detail: e.message });
  }
});

// 2) Verificar código -> resetToken
postBoth("/auth/recovery/verify-code", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: "Email e código são obrigatórios." });
    }

    const recQ = await pool.query(
      `SELECT id, user_id, code_hash, attempts, expires_at, verified_at, consumed_at
       FROM public.password_recovery_codes
       WHERE email=$1 AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );

    if (recQ.rowCount === 0) {
      return res.status(404).json({ message: "Nenhum código ativo encontrado. Solicite um novo." });
    }

    const rec = recQ.rows[0];

    if (new Date(rec.expires_at).getTime() < Date.now()) {
      return res.status(410).json({ message: "Código expirado. Solicite um novo." });
    }

    if (rec.attempts >= 5) {
      return res.status(429).json({ message: "Muitas tentativas. Solicite um novo código." });
    }

    const ok = await bcrypt.compare(code, rec.code_hash);

    if (!ok) {
      await pool.query(
        `UPDATE public.password_recovery_codes
         SET attempts = attempts + 1
         WHERE id=$1`,
        [rec.id]
      );
      return res.status(401).json({ message: "Código incorreto. Confira e tente novamente." });
    }

    await pool.query(
      `UPDATE public.password_recovery_codes
       SET verified_at = now(), attempts = attempts + 1
       WHERE id=$1`,
      [rec.id]
    );

    const resetToken = jwt.sign(
      { scope: "password_reset", email, prcId: rec.id, sub: rec.user_id },
      RESET_SECRET,
      { expiresIn: "15m" }
    );

    return res.json({ valid: true, resetToken });
  } catch (e) {
    console.error("VERIFY-CODE ERROR:", e);
    return res.status(500).json({ message: "Erro ao validar código.", detail: e.message });
  }
});

// 3) Trocar senha
postBoth("/auth/recovery/reset-password", async (req, res) => {
  try {
    const { email, resetToken, newPassword } = req.body;

    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({ message: "Dados obrigatórios faltando." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Senha deve ter no mínimo 6 caracteres." });
    }

    let payload;
    try {
      payload = jwt.verify(resetToken, RESET_SECRET);
    } catch {
      return res.status(401).json({ message: "Token inválido ou expirado." });
    }

    if (payload.scope !== "password_reset" || payload.email !== email || !payload.prcId) {
      return res.status(401).json({ message: "Token inválido." });
    }

    const recQ = await pool.query(
      `SELECT id, user_id, expires_at, verified_at, consumed_at
       FROM public.password_recovery_codes
       WHERE id=$1 AND email=$2`,
      [payload.prcId, email]
    );

    if (recQ.rowCount === 0) return res.status(401).json({ message: "Recuperação inválida." });

    const rec = recQ.rows[0];

    if (!rec.verified_at) return res.status(401).json({ message: "Código ainda não foi confirmado." });
    if (rec.consumed_at) return res.status(401).json({ message: "Recuperação já utilizada. Solicite novamente." });
    if (new Date(rec.expires_at).getTime() < Date.now()) return res.status(410).json({ message: "Código expirado." });

    const password_hash = await bcrypt.hash(newPassword, 10);

    await pool.query("UPDATE public.users SET password_hash=$1 WHERE id=$2", [
      password_hash,
      rec.user_id,
    ]);

    await pool.query("UPDATE public.password_recovery_codes SET consumed_at = now() WHERE id=$1", [
      rec.id,
    ]);

    return res.json({ ok: true, message: "Senha atualizada com sucesso." });
  } catch (e) {
    console.error("RESET-PASSWORD ERROR:", e);
    return res.status(500).json({ message: "Erro ao resetar senha.", detail: e.message });
  }
});

// ==========================
// SERVIR ANGULAR EM PRODUÇÃO (SPA fallback)
// ==========================
function resolveAngularDist() {
  if (process.env.ANGULAR_DIST) return path.resolve(process.env.ANGULAR_DIST);

  const candidates = [
    path.join(__dirname, "../../frontend/dist/simuladorOrcamento"), // se server.js está em backend/src
    path.join(__dirname, "../frontend/dist/simuladorOrcamento"),    // se server.js está em backend/
    path.join(process.cwd(), "frontend", "dist", "simuladorOrcamento"),
  ];

  const found = candidates.find((p) => fs.existsSync(p));
  return found || candidates[0];
}

if (isProd) {
  const distPath = resolveAngularDist();

  app.use(express.static(distPath));

  // não engolir API e assets
  const apiBlock = /^(\/api\/|\/auth|\/simulacao_media|\/simulacao_recorrente|\/simulador_de_gastos|\/health)(\/|$)/;

  // router novo: usar RegExp em vez de "*"
  app.get(/.*/, (req, res) => {
    if (apiBlock.test(req.path)) {
      return res.status(404).json({ message: "Rota não encontrada." });
    }
    return res.sendFile(path.join(distPath, "index.html"));
  });
}

// ==========================
// ERROS
// ==========================
app.use((err, req, res, next) => {
  if (err && typeof err.message === "string" && err.message.startsWith("CORS bloqueado")) {
    return res.status(403).json({ message: err.message });
  }
  return next(err);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API rodando na porta ${PORT} (NODE_ENV=${process.env.NODE_ENV || "dev"})`);
});