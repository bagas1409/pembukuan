import { Pool, types as pgTypes } from "pg";

let pool = null;

function getConnectionString() {
  const url = process.env.DATABASE_URL;
  if (url) return url;

  const host = process.env.PGHOST || "localhost";
  const port = process.env.PGPORT || "5432";
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;
  const database = process.env.PGDATABASE;
  if (!user || !password || !database) {
    throw new Error(
      "DATABASE_URL or (PGUSER, PGPASSWORD, PGDATABASE) is required",
    );
  }

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(
    database,
  )}`;
}

function configureTypeParsers() {
  // NUMERIC
  pgTypes.setTypeParser(1700, (val) => (val === null ? null : Number(val)));
  // INT8
  pgTypes.setTypeParser(20, (val) => (val === null ? null : Number(val)));
}

export function getPool() {
  if (!pool)
    throw new Error("Database not initialized. Call connectDB() first.");
  return pool;
}

export async function closeDB() {
  if (pool) {
    const p = pool;
    pool = null;
    await p.end();
  }
}

export default async function connectDB({ pool: externalPool } = {}) {
  if (pool) return pool;

  configureTypeParsers();

  if (externalPool) {
    pool = externalPool;
    return pool;
  }

  pool = new Pool({ connectionString: getConnectionString() });
  await pool.query("SELECT 1");
  return pool;
}
