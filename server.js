import app from "./src/app.js";
import connectDB from "./src/config/db.js";
import { closeDB } from "./src/config/db.js";

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  async function shutdown(signal) {
    try {
      console.log(`Received ${signal}. Shutting down...`);
      await new Promise((resolve) => server.close(resolve));
      await closeDB();
      process.exit(0);
    } catch (err) {
      console.error("Shutdown failed:", err);
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
