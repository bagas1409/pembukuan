import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.resolve(__dirname, "../../sql/001_init.sql");

export async function applySchema(db) {
  const sql = await readFile(schemaPath, "utf8");
  await db.query(sql);
}

