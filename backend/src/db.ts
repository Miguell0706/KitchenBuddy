import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("Missing env var: DATABASE_URL");

export const pool = new Pool({
  connectionString: DATABASE_URL,
  // Render internal PG typically needs SSL in many setups.
  // If yours works without SSL, you can remove this.
  ssl: { rejectUnauthorized: false },
});
