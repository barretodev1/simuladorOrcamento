const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const requireAuth = require("../middlewares/requireAuth");

const router = express.Router();

// GET /auth/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const q = await pool.query(
      "SELECT id, name, email FROM public.users WHERE id=$1",
      [req.userId]
    );

    if (q.rowCount === 0) return res.status(404).json({ message: "Usuário não encontrado." });

    return res.json({ user: q.rows[0] });
  } catch (e) {
    return res.status(500).json({ message: "Erro ao buscar usuário.", detail: e.message });
  }
});

// PATCH /auth/me  { name?, email? }
router.patch("/me", requireAuth, async (req, res) => {
  try {
    const { name, email } = req.body;

    const newName = (name || "").trim();
    const newEmail = (email || "").trim().toLowerCase();

    if (!newName) return res.status(400).json({ message: "Nome é obrigatório." });
    if (!newEmail || !newEmail.includes("@")) return res.status(400).json({ message: "Email inválido." });

    // checa se email já existe (em outro usuário)
    const exists = await pool.query(
      "SELECT id FROM public.users WHERE email=$1 AND id <> $2",
      [newEmail, req.userId]
    );
    if (exists.rowCount > 0) {
      return res.status(409).json({ message: "Esse email já está em uso." });
    }

    const upd = await pool.query(
      `UPDATE public.users
       SET name=$1, email=$2
       WHERE id=$3
       RETURNING id, name, email`,
      [newName, newEmail, req.userId]
    );

    const user = upd.rows[0];

    // reemite token (bom se o email mudou, pra manter payload coerente)
    const token = jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.json({ user, token });
  } catch (e) {
    return res.status(500).json({ message: "Erro ao atualizar perfil.", detail: e.message });
  }
});

// POST /auth/change-password  { currentPassword, newPassword }
router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Senha atual e nova senha são obrigatórias." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "A nova senha deve ter no mínimo 6 caracteres." });
    }

    const userQ = await pool.query(
      "SELECT id, password_hash FROM public.users WHERE id=$1",
      [req.userId]
    );

    if (userQ.rowCount === 0) return res.status(404).json({ message: "Usuário não encontrado." });

    const user = userQ.rows[0];
    const ok = await bcrypt.compare(currentPassword, user.password_hash);

    if (!ok) return res.status(401).json({ message: "Senha atual incorreta." });

    const password_hash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE public.users SET password_hash=$1 WHERE id=$2",
      [password_hash, req.userId]
    );

    return res.json({ ok: true, message: "Senha atualizada com sucesso." });
  } catch (e) {
    return res.status(500).json({ message: "Erro ao atualizar senha.", detail: e.message });
  }
});

module.exports = router;