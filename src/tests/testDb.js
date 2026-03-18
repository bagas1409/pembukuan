import { newDb } from "pg-mem";

import connectDB, { closeDB, getPool } from "../config/db.js";
import { applySchema } from "../config/schema.js";

let mem = null;

export async function setupTestDb() {
  mem = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = mem.adapters.createPg();
  const pool = new adapter.Pool();

  await connectDB({ pool });
  await applySchema(getPool());

  return { mode: "pg-mem" };
}

export async function resetTestDb() {
  const pool = getPool();
  await pool.query("TRUNCATE users CASCADE");
}

export async function teardownTestDb() {
  await closeDB();
  mem = null;
}
