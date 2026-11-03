import "dotenv/config";
import express from "express";
import cors from "cors";
import { canonicalizeRouter } from "./routes/canonicalize.js";
import recipesRouter from "./routes/recipes.js";
import { pool } from "./db.js";
import { initCanonCache } from "./db/initCanonCache.js";
import { initApiUsage } from "./db/initApiUsage.js";
import imagesRouter from "./routes/images.js";
import supportRouter from "./routes/support.js";

const app = express();

// Configure trust proxy separately, after verifying your Render proxy setup.
// An incorrect value can weaken IP-based rate limits.
// app.set("trust proxy", 1);

app.use(cors());
app.use(express.json({ limit: "200kb" }));

// Readiness is deliberately separate from port binding. Render can detect the
// HTTP port immediately, while /health stays 503 until DB initialization works.
let dbReady = false;
let initStage = "not started";

app.get("/health", (_req, res) => {
  if (!dbReady) {
    res.status(503).json({ ok: false, error: "SERVICE_INITIALIZING" });
    return;
  }
  res.json({ ok: true });
});

// Fail closed while the schema isn't ready; avoid uncaught errors when querying
// api_usage_counters before it exists.
app.use("/api", (_req, res, next) => {
  if (!dbReady) {
    res.status(503).json({ ok: false, error: "SERVICE_INITIALIZING" });
    return;
  }
  next();
});

app.use("/api/images", imagesRouter);
app.use("/api/canonicalize-items", canonicalizeRouter);
app.use("/api/recipes", recipesRouter);
app.use("/api/support", supportRouter);

// Cook Now remains deliberately unmounted until Premium verification and
// quota middleware are implemented.
async function initializeDatabase() {
  initStage = "PostgreSQL connection (select 1)";
  console.log("⏳ Database initialization started...");

  const watchdog = setTimeout(() => {
    console.error(`⚠️ Database initialization still waiting at: ${initStage}`);
    console.error("Check Render DATABASE_URL and PostgreSQL availability.");
  }, 15_000);

  try {
    const result = await pool.query("select 1 as ok");
    console.log("✅ DB connected:", result.rows[0]);

    initStage = "canonicalization cache schema";
    await initCanonCache();
    console.log("✅ Canonicalization cache ready");

    initStage = "API usage counters schema";
    await initApiUsage();
    console.log("✅ API usage counters ready");

    dbReady = true;
    initStage = "complete";
    console.log("✅ Backend ready to accept API requests");
  } catch (error) {
    console.error(`❌ Database initialization failed at ${initStage}:`, error);
    // Stay alive for diagnostics; /health and /api remain 503.
  } finally {
    clearTimeout(watchdog);
  }
}

const port = Number(process.env.PORT ?? 10000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT: ${process.env.PORT}`);
}

app.listen(port, "0.0.0.0", () => {
  console.log(`✅ Backend listening on 0.0.0.0:${port}`);
  void initializeDatabase();
});
