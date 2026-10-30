import "dotenv/config";
import { createServer } from "node:http";
import mongoose from "mongoose";
import type { AppConfig } from "./config/env.js";
import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { ensureDatabaseConnected } from "./database/connect.js";

let config: AppConfig;
try {
  config = loadConfig();
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown configuration error.";
  process.stderr.write("Invalid runtime configuration: " + message + "\n");
  process.exit(1);
}

async function start(): Promise<void> {
  await ensureDatabaseConnected(config);

  const app = createApp(config);
  const server = createServer(app);
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  server.keepAliveTimeout = 5_000;

  server.listen(config.port, () => {
    process.stdout.write("Doctor Tracker API listening on port " + config.port + ".\n");
  });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    process.stdout.write("Received " + signal + "; closing HTTP server and database.\n");
    server.close((error) => {
      if (error) {
        process.stderr.write("HTTP server failed to close cleanly.\n");
        process.exitCode = 1;
      }
      void mongoose.disconnect().catch(() => {
        process.stderr.write("Database connection failed to close cleanly.\n");
        process.exitCode = 1;
      });
    });
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch(async (error: unknown) => {
  // Do not print the URI or raw DB error, which can contain credentials.
  const failure = error instanceof Error ? error.name : "UnknownError";
  process.stderr.write("API startup failed while connecting to the database (" + failure + ").\n");
  process.exitCode = 1;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => undefined);
  }
});
