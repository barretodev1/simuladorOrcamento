const express = require("express");
const pool = require("../db");
const requireAuth = require("../middlewares/requireAuth");

const router = express.Router();

// todas as rotas abaixo exigem login
router.use(requireAuth);

// LISTA (resumo p/ sidebar) - não manda rows pra não pesar
router.get("/", async (req, res) => {
  try {
    const userId = String(req.user?.sub ?? "");
    if (!userId) return res.status(401).json({ message: "Token sem sub." });

    const q = await pool.query(
      `SELECT id, name, created_at AS "createdAt", file_name AS "fileName",
              active_view AS "activeView", salary_column_key AS "salaryColumnKey",
              id_column_key AS "idColumnKey", name_column_key AS "nameColumnKey"
       FROM public.saved_scenarios
       WHERE user_id=$1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    return res.json({ scenarios: q.rows });
  } catch (e) {
    return res.status(500).json({ message: "Erro ao listar cenários.", detail: e.message });
  }
});

// GET 1 cenário completo (com rows/data_columns)
router.get("/:id", async (req, res) => {
  try {
    const userId = String(req.user?.sub ?? "");
    const id = String(req.params.id ?? "");

    const q = await pool.query(
      `SELECT id, name, EXTRACT(EPOCH FROM created_at)*1000 AS "createdAt",
              file_name AS "fileName", active_view AS "activeView",
              salary_column_key AS "salaryColumnKey",
              id_column_key AS "idColumnKey", name_column_key AS "nameColumnKey",
              data_columns AS "dataColumns", rows
       FROM public.saved_scenarios
       WHERE user_id=$1 AND id=$2
       LIMIT 1`,
      [userId, id]
    );

    if (q.rowCount === 0) return res.status(404).json({ message: "Cenário não encontrado." });

    const row = q.rows[0];
    // rows vem como jsonb; pode retornar direto
    return res.json({ scenario: row });
  } catch (e) {
    return res.status(500).json({ message: "Erro ao buscar cenário.", detail: e.message });
  }
});

// UPSERT (salva ou atualiza)
router.post("/", async (req, res) => {
  try {
    const userId = String(req.user?.sub ?? "");
    if (!userId) return res.status(401).json({ message: "Token sem sub." });

    const s = req.body?.scenario;
    if (!s || typeof s !== "object") {
      return res.status(400).json({ message: "Payload inválido. Envie { scenario: {...} }." });
    }

    const id = String(s.id ?? "");
    const name = String(s.name ?? "").trim();
    const fileName = String(s.fileName ?? "base.csv");
    const activeView = String(s.activeView ?? "area");
    const salaryColumnKey = String(s.salaryColumnKey ?? "");
    const idColumnKey = String(s.idColumnKey ?? "");
    const nameColumnKey = String(s.nameColumnKey ?? "");
    const dataColumns = s.dataColumns ?? [];
    const rows = s.rows ?? [];

    if (!id || !name) {
      return res.status(400).json({ message: "id e name são obrigatórios no scenario." });
    }
    if (activeView !== "area" && activeView !== "empresa") {
      return res.status(400).json({ message: "activeView inválido." });
    }
    if (!Array.isArray(dataColumns) || !Array.isArray(rows)) {
      return res.status(400).json({ message: "dataColumns e rows precisam ser arrays." });
    }

    // createdAt opcional (se não vier, o banco usa now())
    // se vier, tenta preservar
    const createdAtMs = Number(s.createdAt ?? NaN);
    const hasCreatedAt = Number.isFinite(createdAtMs) && createdAtMs > 0;
    const createdAtSql = hasCreatedAt ? new Date(createdAtMs).toISOString() : null;

    const q = await pool.query(
      `INSERT INTO public.saved_scenarios (
          user_id, id, name, created_at, updated_at,
          file_name, active_view, salary_column_key, id_column_key, name_column_key,
          data_columns, rows
       )
       VALUES (
          $1, $2, $3,
          COALESCE($4::timestamptz, now()),
          now(),
          $5, $6, $7, $8, $9,
          $10::jsonb, $11::jsonb
       )
       ON CONFLICT (user_id, id)
       DO UPDATE SET
          name = EXCLUDED.name,
          updated_at = now(),
          file_name = EXCLUDED.file_name,
          active_view = EXCLUDED.active_view,
          salary_column_key = EXCLUDED.salary_column_key,
          id_column_key = EXCLUDED.id_column_key,
          name_column_key = EXCLUDED.name_column_key,
          data_columns = EXCLUDED.data_columns,
          rows = EXCLUDED.rows
       RETURNING
          id, name, created_at AS "createdAt", file_name AS "fileName",
          active_view AS "activeView", salary_column_key AS "salaryColumnKey",
          id_column_key AS "idColumnKey", name_column_key AS "nameColumnKey"`,
      [
        userId,
        id,
        name,
        createdAtSql,
        fileName,
        activeView,
        salaryColumnKey,
        idColumnKey,
        nameColumnKey,
        JSON.stringify(dataColumns),
        JSON.stringify(rows),
      ]
    );

    return res.json({ ok: true, scenario: q.rows[0] });
  } catch (e) {
    return res.status(500).json({ message: "Erro ao salvar cenário.", detail: e.message });
  }
});

// DELETE
router.delete("/:id", async (req, res) => {
  try {
    const userId = String(req.user?.sub ?? "");
    const id = String(req.params.id ?? "");

    const q = await pool.query(
      `DELETE FROM public.saved_scenarios
       WHERE user_id=$1 AND id=$2`,
      [userId, id]
    );

    return res.json({ ok: true, deleted: q.rowCount > 0 });
  } catch (e) {
    return res.status(500).json({ message: "Erro ao deletar cenário.", detail: e.message });
  }
});

module.exports = router;