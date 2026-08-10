const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname, { 
  maxAge: "1h",
  extensions: ["html"]
}));

// PostgreSQL 连接
let pool = null;

function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log("[DB] No DATABASE_URL found, running in local-only mode (no sync)");
    return null;
  }
  pool = new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
  });
  pool.on("error", (err) => {
    console.error("[DB] Pool error:", err.message);
  });
  console.log("[DB] PostgreSQL connected");
  return pool;
}

// 初始化数据库表
async function initDB() {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS workbench_state (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(64),
        data JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await p.query(`
      CREATE TABLE IF NOT EXISTS practice_scores (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(64),
        score INTEGER,
        total INTEGER,
        detail JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log("[DB] Tables ready");
  } catch (err) {
    console.error("[DB] Init error:", err.message);
  }
}

// ============ API ============

// 获取最新状态
app.get("/api/state", async (req, res) => {
  const p = getPool();
  if (!p) return res.json({ ok: true, data: null, message: "local-only" });
  try {
    const result = await p.query(
      "SELECT data, updated_at FROM workbench_state ORDER BY updated_at DESC LIMIT 1"
    );
    if (result.rows.length === 0) {
      return res.json({ ok: true, data: null });
    }
    res.json({ ok: true, data: result.rows[0].data, updatedAt: result.rows[0].updated_at });
  } catch (err) {
    console.error("[API] GET /state error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 保存状态
app.post("/api/state", async (req, res) => {
  const p = getPool();
  if (!p) return res.json({ ok: true, message: "local-only" });
  try {
    const { data, deviceId } = req.body;
    if (!data) return res.status(400).json({ ok: false, error: "data is required" });
    await p.query(
      "INSERT INTO workbench_state (device_id, data) VALUES ($1, $2)",
      [deviceId || "unknown", data]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("[API] POST /state error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 保存练习成绩
app.post("/api/score", async (req, res) => {
  const p = getPool();
  if (!p) return res.json({ ok: true, message: "local-only" });
  try {
    const { deviceId, score, total, detail } = req.body;
    await p.query(
      "INSERT INTO practice_scores (device_id, score, total, detail) VALUES ($1, $2, $3, $4)",
      [deviceId || "unknown", score || 0, total || 0, JSON.stringify(detail || {})]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("[API] POST /score error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 获取历史成绩
app.get("/api/scores", async (req, res) => {
  const p = getPool();
  if (!p) return res.json({ ok: true, data: [] });
  try {
    const result = await p.query(
      "SELECT score, total, detail, created_at FROM practice_scores ORDER BY created_at DESC LIMIT 50"
    );
    res.json({ ok: true, data: result.rows });
  } catch (err) {
    console.error("[API] GET /scores error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 健康检查
app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), db: !!getPool() });
});

// SPA fallback: 所有非文件请求返回 index.html
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api/")) return next();
  if (req.path.includes(".")) return next();
  res.sendFile(path.join(__dirname, "index.html"));
});

// 启动
initDB().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n========================================`);
    console.log(`  旺仔学习工作台已启动`);
    console.log(`  本地: http://localhost:${PORT}`);
    console.log(`  线上: 见 Render 部署地址`);
    console.log(`  数据库: ${getPool() ? "已连接" : "未配置(仅本地)"}`);
    console.log(`========================================\n`);
  });
});
