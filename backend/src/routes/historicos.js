const express = require("express");
const pool = require("../db");
const requireAuth = require("../middlewares/requireAuth");

const router = express.Router();
router.use(requireAuth);

const TABLE = "public.saved_scenarios";

function normalizeStatus(raw) {
  const s = String(raw || "active").toLowerCase();
  if (s === "deleted") return "deleted";
  if (s === "all") return "all";
  return "active";
}

// LISTA agregada (recorrente + media)
router.get("/", async (req, res) => {
  try {
    const userId = String(req.user?.sub ?? "");
    if (!userId) return res.status(401).json({ message: "Token sem sub." });

    const status = normalizeStatus(req.query.status);
    const type = req.query.type ? String(req.query.type) : ""; // opcional: recorrente|media

    const whereParts = [`user_id=$1`];
    const params = [userId];

    if (type === "recorrente" || type === "media") {
      params.push(type);
      whereParts.push(`scenario_type=$${params.length}`);
    }

    if (status === "active") whereParts.push(`deleted_at IS NULL`);
    if (status === "deleted") whereParts.push(`deleted_at IS NOT NULL`);

    const orderBy =
      status === "deleted"
        ? `deleted_at DESC, created_at DESC`
        : `created_at DESC`;

    const q = await pool.query(
      `SELECT
         id,
         name,
         EXTRACT(EPOCH FROM created_at)*1000 AS "createdAt",
         EXTRACT(EPOCH FROM deleted_at)*1000 AS "deletedAt",
         file_name AS "fileName",
         active_view AS "activeView",
         salary_column_key AS "salaryColumnKey",
         id_column_key AS "idColumnKey",
         name_column_key AS "nameColumnKey",
         scenario_type AS "scenarioType"
       FROM ${TABLE}
       WHERE ${whereParts.join(" AND ")}
       ORDER BY ${orderBy}
       LIMIT 200`,
      params
    );

    return res.json({ scenarios: q.rows });
  } catch (e) {
    return res.status(500).json({ message: "Erro ao listar históricos.", detail: e.message });
  }
});

// GET completo (serve p/ clicar e atualizar KPI)
router.get("/:id", async (req, res) => {
  try {
    const userId = String(req.user?.sub ?? "");
    const id = String(req.params.id ?? "");

    const q = await pool.query(
      `SELECT
         id,
         name,
         EXTRACT(EPOCH FROM created_at)*1000 AS "createdAt",
         EXTRACT(EPOCH FROM deleted_at)*1000 AS "deletedAt",
         file_name AS "fileName",
         active_view AS "activeView",

         scenario_type AS "scenarioType",

         salary_column_key AS "salaryColumnKey",
         id_column_key AS "idColumnKey",
         name_column_key AS "nameColumnKey",

         area_column_key AS "areaColumnKey",
         role_column_key AS "roleColumnKey",

         data_columns AS "dataColumns",
         rows,
         simulations
       FROM ${TABLE}
       WHERE user_id=$1 AND id=$2
       LIMIT 1`,
      [userId, id]
    );

    if (q.rowCount === 0) return res.status(404).json({ message: "Cenário não encontrado." });
    return res.json({ scenario: q.rows[0] });
  } catch (e) {
    return res.status(500).json({ message: "Erro ao buscar histórico.", detail: e.message });
  }
});

// RESTAURAR (deleted_at -> NULL)
router.patch("/:id/restore", async (req, res) => {
  try {
    const userId = String(req.user?.sub ?? "");
    const id = String(req.params.id ?? "");

    const q = await pool.query(
      `UPDATE ${TABLE}
       SET deleted_at = NULL,
           updated_at = now()
       WHERE user_id=$1
         AND id=$2
         AND deleted_at IS NOT NULL
       RETURNING
         id,
         name,
         EXTRACT(EPOCH FROM created_at)*1000 AS "createdAt",
         file_name AS "fileName",
         active_view AS "activeView",
         salary_column_key AS "salaryColumnKey",
         id_column_key AS "idColumnKey",
         name_column_key AS "nameColumnKey",
         scenario_type AS "scenarioType"`,
      [userId, id]
    );

    if (q.rowCount === 0) return res.status(404).json({ message: "Nada para restaurar (não encontrado ou não deletado)." });
    return res.json({ ok: true, scenario: q.rows[0] });
  } catch (e) {
    return res.status(500).json({ message: "Erro ao restaurar.", detail: e.message });
  }
});

// EXCLUIR DEFINITIVO (hard delete)
router.delete("/:id/permanent", async (req, res) => {
  try {
    const userId = String(req.user?.sub ?? "");
    const id = String(req.params.id ?? "");

    const q = await pool.query(
      `DELETE FROM ${TABLE}
       WHERE user_id=$1
         AND id=$2
         AND deleted_at IS NOT NULL`,
      [userId, id]
    );

    return res.json({ ok: true, deleted: q.rowCount > 0 });
  } catch (e) {
    return res.status(500).json({ message: "Erro ao apagar definitivamente.", detail: e.message });
  }
});

module.exports = router;