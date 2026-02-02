import "dotenv/config";
import express from "express";
import cors from "cors";
import { canonicalizeRouter } from "./routes/canonicalize.js";
import recipesRouter from "./routes/recipes.js";
import { pool } from "./db.js";
import { initCanonCache } from "./db/initCanonCache.js";
import imagesRouter from "./routes/images.js";

pool
  .query("select 1 as ok")
  .then(async (r) => {
    console.log("✅ DB connected:", r.rows[0]);
    await initCanonCache();
  })
  .catch((e) => {
    console.log("❌ DB connect failed:", e);
  });

const app = express();
app.use(cors());
app.use(express.json({ limit: "200kb" }));
app.use("/api/images", imagesRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/canonicalize-items", canonicalizeRouter);
app.use("/api/recipes", recipesRouter);

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
