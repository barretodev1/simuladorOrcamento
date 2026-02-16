const express = require("express");
const pool = require("../db");

// ✅ IMPORT IGUAL AO SEU scenarios.js (plural)
const requireAuth = require("../middlewares/requireAuth");

const router = express.Router();
router.use(requireAuth);

// LISTA
router.get("/", async (req, res) => {
  try {
    const userId = String(req.user.sub);

    const q = await pool.query(
      `SELECT
         id,
         name,
         EXTRACT(EPOCH FROM created_at)*1000 AS "createdAt",
         file_name AS "fileName",
         salary_column_key AS "salaryColumnKey"
       FROM public.saved_scenarios_media
       WHERE user_id=$1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    return res.json({ scenarios: q.rows });
  } catch (e) {
    return res.status(500).json({ message: "Erro ao listar cenários MEDIA.", detail: e.message });
  }
});

// GET 1
router.get("/:id", async (req, res) => {
  try {
    const userId = String(req.user.sub);
    const id = String(req.params.id);

    const q = await pool.query(
      `SELECT
         id,
         name,
         EXTRACT(EPOCH FROM created_at)*1000 AS "createdAt",
         file_name AS "fileName",
         salary_column_key AS "salaryColumnKey",
         area_column_key AS "areaColumnKey",
         role_column_key AS "roleColumnKey",
         data_columns AS "dataColumns",
         rows,
         simulations
       FROM public.saved_scenarios_media
       WHERE user_id=$1 AND id=$2
       LIMIT 1`,
      [userId, id]
    );

    if (q.rowCount === 0) return res.status(404).json({ message: "Cenário MEDIA não encontrado." });
    return res.json({ scenario: q.rows[0] });
  } catch (e) {
    return res.status(500).json({ message: "Erro ao buscar cenário MEDIA.", detail: e.message });
  }
});

// UPSERT
router.post("/", async (req, res) => {
  try {
    const userId = String(req.user.sub);

    const s = req.body?.scenario;
    if (!s || typeof s !== "object") {
      return res.status(400).json({ message: "Envie { scenario: {...} }." });
    }

    const id = String(s.id || "");
    const name = String(s.name || "").trim();
    if (!id || !name) return res.status(400).json({ message: "id e name são obrigatórios." });

    const fileName = String(s.fileName || "base.csv");
    const salaryColumnKey = String(s.salaryColumnKey || "");
    const areaColumnKey = String(s.areaColumnKey || "");
    const roleColumnKey = String(s.roleColumnKey || "");

    const dataColumns = Array.isArray(s.dataColumns) ? s.dataColumns : [];
    const rows = Array.isArray(s.rows) ? s.rows : [];
    const simulations = Array.isArray(s.simulations) ? s.simulations : [];

    const createdAtMs = Number(s.createdAt || NaN);
    const createdAtSql = Number.isFinite(createdAtMs) ? new Date(createdAtMs).toISOString() : null;

    const q = await pool.query(
      `INSERT INTO public.saved_scenarios_media (
         user_id, id, name, created_at, updated_at,
         file_name, salary_column_key, area_column_key, role_column_key,
         data_columns, rows, simulations
       )
       VALUES (
         $1,$2,$3,
         COALESCE($4::timestamptz, now()),
         now(),
         $5,$6,$7,$8,
         $9::jsonb,$10::jsonb,$11::jsonb
       )
       ON CONFLICT (user_id, id)
       DO UPDATE SET
         name=EXCLUDED.name,
         updated_at=now(),
         file_name=EXCLUDED.file_name,
         salary_column_key=EXCLUDED.salary_column_key,
         area_column_key=EXCLUDED.area_column_key,
         role_column_key=EXCLUDED.role_column_key,
         data_columns=EXCLUDED.data_columns,
         rows=EXCLUDED.rows,
         simulations=EXCLUDED.simulations
       RETURNING
         id,
         name,
         EXTRACT(EPOCH FROM created_at)*1000 AS "createdAt",
         file_name AS "fileName",
         salary_column_key AS "salaryColumnKey"`,
      [
        userId, id, name, createdAtSql,
        fileName, salaryColumnKey, areaColumnKey, roleColumnKey,
        JSON.stringify(dataColumns),
        JSON.stringify(rows),
        JSON.stringify(simulations),
      ]
    );

    return res.json({ ok: true, scenario: q.rows[0] });
  } catch (e) {
    return res.status(500).json({ message: "Erro ao salvar cenário MEDIA.", detail: e.message });
  }
});

// DELETE
router.delete("/:id", async (req, res) => {
  try {
    const userId = String(req.user.sub);
    const id = String(req.params.id);

    const q = await pool.query(
      `DELETE FROM public.saved_scenarios_media WHERE user_id=$1 AND id=$2`,
      [userId, id]
    );

    return res.json({ ok: true, deleted: q.rowCount > 0 });
  } catch (e) {
    return res.status(500).json({ message: "Erro ao deletar cenário MEDIA.", detail: e.message });
  }
});

module.exports = router;
