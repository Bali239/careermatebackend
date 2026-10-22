import http from "node:http";
import app from "./src/app.js";
import { connectDatabase, disconnectDatabase } from "./src/config/database.js";
import { env } from "./src/config/env.js";

let httpServer;
let isShuttingDown = false;

async function startServer() {
  try {
    await connectDatabase();
    httpServer = http.createServer(app);
    httpServer.listen(env.PORT, () => {
      console.info(`API listening on port ${env.PORT} (${env.NODE_ENV}).`);
    });

    httpServer.on("error", (error) => {
      console.error("HTTP server error:", error.message);
      process.exitCode = 1;
      void shutdown();
    });
  } catch (error) {
    console.error(`Server startup failed: ${error.message}`);
    await disconnectDatabase().catch((disconnectError) => {
      console.error(`MongoDB cleanup failed: ${disconnectError.message}`);
    });
    process.exitCode = 1;
  }
}

async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  try {
    if (httpServer?.listening) {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await disconnectDatabase();
    console.info("Server shutdown complete.");
  } catch (error) {
    console.error(`Server shutdown failed: ${error.message}`);
    process.exitCode = 1;
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    void shutdown();
  });
}

await startServer();
