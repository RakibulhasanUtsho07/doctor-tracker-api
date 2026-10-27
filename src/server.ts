import "dotenv/config";
import type { AppConfig } from "./config/env.js";
import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";

let config: AppConfig;
try {
  config = loadConfig();
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown configuration error.";
  process.stderr.write(`Invalid runtime configuration: ${message}\n`);
  process.exit(1);
}

const app = createApp(config);
const server = app.listen(config.port, () => {
  process.stdout.write(`Doctor Tracker API listening on port ${config.port}.\n`);
});

function shutdown(signal: string): void {
  process.stdout.write(`Received ${signal}; closing HTTP server.\n`);
  server.close((error) => {
    if (error) {
      process.stderr.write("HTTP server failed to close cleanly.\n");
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
