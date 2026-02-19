const express = require("express");
const pool = require("../db");
const requireAuth = require("../middlewares/requireAuth");

const router = express.Router();

// este router é SEMPRE do tipo media
const SCENARIO_TYPE = "media";

// todas as rotas abaixo exigem login
router.use(requireAuth);

// LISTA (resumo p/ sidebar)
router.get("/", async (req, res) => {
  try {
    const userId = String(req.user?.sub ?? "");
    if (!userId) return res.status(401).json({ message: "Token sem sub." });

    const q = await pool.query(
      `SELECT
         id,
         name,
         (EXTRACT(EPOCH FROM created_at) * 1000)::bigint AS "createdAt",
         file_name AS "fileName",
         active_view AS "activeView",
         salary_column_key AS "salaryColumnKey",
         id_column_key AS "idColumnKey",
         name_column_key AS "nameColumnKey",
         scenario_type AS "scenarioType"
       FROM public.saved_scenarios
       WHERE user_id=$1 AND scenario_type=$2
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId, SCENARIO_TYPE]
    );

    return res.json({ scenarios: q.rows });
  } catch (e) {
    return res.status(500).json({ message: "Erro ao listar cenários.", detail: e.message });
  }
});

// GET 1 cenário completo
router.get("/:id", async (req, res) => {
  try {
    const userId = String(req.user?.sub ?? "");
    if (!userId) return res.status(401).json({ message: "Token sem sub." });

    const id = String(req.params.id ?? "");

    const q = await pool.query(
      `SELECT
         id,
         name,
         (EXTRACT(EPOCH FROM created_at) * 1000)::bigint AS "createdAt",
         file_name AS "fileName",
         active_view AS "activeView",
         salary_column_key AS "salaryColumnKey",
         id_column_key AS "idColumnKey",
         name_column_key AS "nameColumnKey",
         scenario_type AS "scenarioType",
         data_columns AS "dataColumns",
         rows
       FROM public.saved_scenarios
       WHERE user_id=$1 AND scenario_type=$2 AND id=$3
       LIMIT 1`,
      [userId, SCENARIO_TYPE, id]
    );

    if (q.rowCount === 0) return res.status(404).json({ message: "Cenário não encontrado." });

    return res.json({ scenario: q.rows[0] });
  } catch (e) {
    return res.status(500).json({ message: "Erro ao buscar cenário.", detail: e.message });
  }
});

// UPSERT
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

    // createdAt opcional
    const createdAtMs = Number(s.createdAt ?? NaN);
    const hasCreatedAt = Number.isFinite(createdAtMs) && createdAtMs > 0;
    const createdAtSql = hasCreatedAt ? new Date(createdAtMs).toISOString() : null;

    // força tipo media (não depende do front)
    const scenarioType = SCENARIO_TYPE;

    const q = await pool.query(
      `INSERT INTO public.saved_scenarios (
         user_id, id, name, scenario_type,
         created_at, updated_at,
         file_name, active_view, salary_column_key, id_column_key, name_column_key,
         data_columns, rows
       )
       VALUES (
         $1, $2, $3, $4,
         COALESCE($5::timestamptz, now()), now(),
         $6, $7, $8, $9, $10,
         $11::jsonb, $12::jsonb
       )
       ON CONFLICT (user_id, id)
       DO UPDATE SET
         name = EXCLUDED.name,
         scenario_type = EXCLUDED.scenario_type,
         updated_at = now(),
         file_name = EXCLUDED.file_name,
         active_view = EXCLUDED.active_view,
         salary_column_key = EXCLUDED.salary_column_key,
         id_column_key = EXCLUDED.id_column_key,
         name_column_key = EXCLUDED.name_column_key,
         data_columns = EXCLUDED.data_columns,
         rows = EXCLUDED.rows
       RETURNING
         id,
         name,
         (EXTRACT(EPOCH FROM created_at) * 1000)::bigint AS "createdAt",
         file_name AS "fileName",
         active_view AS "activeView",
         salary_column_key AS "salaryColumnKey",
         id_column_key AS "idColumnKey",
         name_column_key AS "nameColumnKey",
         scenario_type AS "scenarioType"`,
      [
        userId,
        id,
        name,
        scenarioType,
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
    if (!userId) return res.status(401).json({ message: "Token sem sub." });

    const id = String(req.params.id ?? "");

    const q = await pool.query(
      `DELETE FROM public.saved_scenarios
       WHERE user_id=$1 AND scenario_type=$2 AND id=$3`,
      [userId, SCENARIO_TYPE, id]
    );

    return res.json({ ok: true, deleted: q.rowCount > 0 });
  } catch (e) {
    return res.status(500).json({ message: "Erro ao deletar cenário.", detail: e.message });
  }
});

module.exports = router;
