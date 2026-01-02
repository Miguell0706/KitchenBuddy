import "dotenv/config";
import express from "express";
import cors from "cors";
import { canonicalizeRouter } from "./routes/canonicalize.js";
import { pool } from "./db.js";

pool.query("select 1 as ok").then(
  (r) => console.log("✅ DB connected:", r.rows[0]),
  (e) => console.log("❌ DB connect failed:", e)
);

const app = express();
app.use(cors());
app.use(express.json({ limit: "200kb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/canonicalize-items", canonicalizeRouter);

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
