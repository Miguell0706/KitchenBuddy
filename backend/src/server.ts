import "dotenv/config";
import express from "express";
import cors from "cors";
import { canonicalizeRouter } from "./routes/canonicalize.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "200kb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/canonicalize-items", canonicalizeRouter);

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
