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

// If Render is your trusted single reverse-proxy hop, verify and enable trust proxy
// so req.ip represents the actual caller. Misconfiguration can undermine IP limits.
// app.set("trust proxy", 1);

app.use(cors());
app.use(express.json({ limit: "200kb" }));
app.use("/api/images", imagesRouter);
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/canonicalize-items", canonicalizeRouter);
app.use("/api/recipes", recipesRouter);
app.use("/api/support", supportRouter);

// Deliberately do NOT mount /api/cook-now here yet. That router requires
// server-verifiable Premium authentication + persistent quota middleware;
// the app's getCookNowAccessToken() currently returns null by design.

async function start() {
  try {
    const result = await pool.query("select 1 as ok");
    console.log("✅ DB connected:", result.rows[0]);
    await initCanonCache();
    await initApiUsage();
    const port = Number(process.env.PORT ?? 8787);
    app.listen(port, () => {
      console.log(`Backend listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("❌ Backend startup failed:", error);
    process.exitCode = 1;
  }
}
void start();
