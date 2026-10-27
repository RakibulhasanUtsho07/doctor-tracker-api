import cors from "cors";
import express, { type RequestHandler } from "express";
import helmet from "helmet";
import type { AppConfig } from "./config/env.js";
import { HttpError } from "./lib/http-error.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestIdMiddleware } from "./middleware/request-id.js";

function originGuard(allowedOrigins: string[]): RequestHandler {
  const allowlist = new Set(allowedOrigins);
  return (req, _res, next) => {
    const origin = req.get("origin");
    if (origin && !allowlist.has(origin)) {
      next(new HttpError(403, "ORIGIN_NOT_ALLOWED", "This request origin is not allowed."));
      return;
    }
    next();
  };
}

export function createApp(config: AppConfig) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(requestIdMiddleware);
  app.use(originGuard(config.frontendOrigins));
  app.use(cors({
    origin: config.frontendOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    optionsSuccessStatus: 204
  }));
  app.use(express.json({ limit: "100kb", strict: true }));

  // Liveness only: Step 1 deliberately does not open a MongoDB connection.
  app.get("/api/v1/health", (_req, res) => {
    res.status(200).json({
      data: {
        status: "ok",
        service: "doctor-tracker-api",
        timestamp: new Date().toISOString()
      },
      meta: { requestId: res.locals.requestId }
    });
  });

  app.use((_req, _res, next) => {
    next(new HttpError(404, "NOT_FOUND", "Route not found."));
  });
  app.use(errorHandler);
  return app;
}
