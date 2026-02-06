require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const app = express();
app.use(cors({ origin: "http://localhost:4200" })); // ajusta se sua porta for outra
app.use(express.json());

// healthcheck (só pra testar)
app.get("/health", async (req, res) => {
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


// CADASTRO - chamado pela sua tela /account
app.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Dados obrigatórios faltando." });
    }

    const exists = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (exists.rowCount > 0) {
      return res.status(409).json({ message: "Email já cadastrado." });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1,$2,$3)
       RETURNING id, name, email`,
      [name, email, password_hash]
    );

    return res.status(201).json({ user: result.rows[0] });
  } catch (e) {
      console.error("REGISTER ERROR:", e); // <-- importante
      return res.status(500).json({
      message: "Erro no cadastro.",
      detail: e.message,
  });
}});

// LOGIN - chamado pela sua tela /
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email e senha são obrigatórios." });
    }

    const userQ = await pool.query(
      "SELECT id, name, email, password_hash FROM users WHERE email=$1",
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

    const token = jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (e) {
    return res.status(500).json({ message: "Erro no login." });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`API rodando em http://localhost:${process.env.PORT || 3000}`);
});
