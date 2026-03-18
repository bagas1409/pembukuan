import dotenv from "dotenv";

import connectDB, { closeDB, getPool } from "../src/config/db.js";
import { applySchema } from "../src/config/schema.js";

dotenv.config();

async function main() {
  await connectDB();
  const pool = getPool();
  await applySchema(pool);
  console.log("Database schema applied.");
}

main()
  .catch((err) => {
    console.error("Failed to apply schema:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDB();
  });

