import cors from "cors";
import express, { type RequestHandler } from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import type { AuthRepository } from "./auth/repository.js";
import { MongooseAuthRepository } from "./auth/repository.js";
import { loadConfig, type AppConfig } from "./config/env.js";
import { ensureDatabaseConnected } from "./database/connect.js";
import { HttpError } from "./lib/http-error.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { createAuthRouter } from "./routes/auth.js";
import { createDoctorRouter } from "./routes/doctors.js";
import { createPatientRouter, createDoctorPatientRouter } from "./routes/patients.js";
import { createDashboardRouter } from "./routes/dashboard.js";
import type { DashboardRepository } from "./dashboard/repository.js";
import { MongooseDashboardRepository } from "./dashboard/repository.js";
import type { PatientRepository } from "./patients/repository.js";
import { MongoosePatientRepository } from "./patients/repository.js";
import type { DoctorRepository } from "./doctors/repository.js";
import { MongooseDoctorRepository } from "./doctors/repository.js";

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

export interface AppOptions {
  /** Connect lazily for Vercel function requests; local server/tests can connect explicitly. */
  connectDatabaseOnRequest?: boolean;
}

export function createApp(
  config: AppConfig,
  authRepository: AuthRepository = new MongooseAuthRepository(),
  doctorRepository: DoctorRepository = new MongooseDoctorRepository(),
  patientRepository: PatientRepository = new MongoosePatientRepository(),
  dashboardRepository: DashboardRepository = new MongooseDashboardRepository(),
  options: AppOptions = {}
) {
  const app = express();
  // Helmet is a callable default export at runtime; normalize legacy module typings for TS builds.
  const helmetFactory = helmet as unknown as () => RequestHandler;
  app.disable("x-powered-by");
  if (config.nodeEnv === "production") app.set("trust proxy", 1);
  app.use(helmetFactory());
  app.use(requestIdMiddleware);
  app.use(originGuard(config.frontendOrigins));
  app.use(cors({
    origin: config.frontendOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID", "X-CSRF-Token"],
    optionsSuccessStatus: 204
  }));
  app.use(express.json({ limit: "100kb", strict: true }));

  if (options.connectDatabaseOnRequest) {
    app.use((req, res, next) => {
      // Keep liveness independent of MongoDB; Vercel health checks can still confirm
      // the function is serving requests while /ready reports database unavailability.
      if (
        (req.method === "GET" && req.path === "/api/v1/health") ||
        !req.path.startsWith("/api/v1/")
      ) {
        next();
        return;
      }

      void ensureDatabaseConnected(config).then(() => {
        next();
      }).catch((error: unknown) => {
        const requestId = typeof res.locals.requestId === "string"
          ? res.locals.requestId
          : "unavailable";
        const errorType = error instanceof Error ? error.name : "UnknownError";
        // Never log the connection URI or raw driver message.
        process.stderr.write(JSON.stringify({
          level: "error",
          event: "database_connection_failed",
          requestId,
          errorType
        }) + "\n");

        if (res.headersSent) {
          next(error);
          return;
        }
        res.status(503).json({
          error: {
            code: "DATABASE_UNAVAILABLE",
            message: "The API database is temporarily unavailable.",
            requestId
          }
        });
      });
    });
  }

  // Liveness: confirms the HTTP process is serving requests.
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

  // Readiness: indicates whether Mongoose has an active database connection.
  app.get("/api/v1/ready", (_req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({
      data: { status: ready ? "ready" : "not_ready" },
      meta: { requestId: res.locals.requestId }
    });
  });

  app.use("/api/v1/auth", createAuthRouter(config, authRepository));
  app.use("/api/v1/dashboard", createDashboardRouter(config, authRepository, dashboardRepository));
  app.use("/api/v1/doctors", createDoctorPatientRouter(config, authRepository, patientRepository, doctorRepository));
  app.use("/api/v1/doctors", createDoctorRouter(config, authRepository, doctorRepository));
  app.use("/api/v1/patients", createPatientRouter(config, authRepository, patientRepository, doctorRepository));

  app.use((_req, _res, next) => {
    next(new HttpError(404, "NOT_FOUND", "Route not found."));
  });
  app.use(errorHandler);
  return app;
}

// Vercel's Express runtime discovers src/app.ts by filename and requires a
// default-exported application. Keep configuration lazy so importing createApp
// in unit tests does not require production environment variables.
const vercelApp = express();
vercelApp.disable("x-powered-by");
vercelApp.use((helmet as unknown as () => RequestHandler)());

let configuredVercelApp: ReturnType<typeof createApp> | null = null;
vercelApp.use((req, res, next) => {
  try {
    if (!configuredVercelApp) {
      configuredVercelApp = createApp(
        loadConfig(),
        undefined,
        undefined,
        undefined,
        undefined,
        { connectDatabaseOnRequest: true }
      );
    }
    configuredVercelApp(req, res, next);
  } catch (error: unknown) {
    const errorType = error instanceof Error ? error.name : "UnknownError";
    process.stderr.write(JSON.stringify({
      level: "error",
      event: "api_runtime_configuration_invalid",
      errorType
    }) + "\n");
    if (res.headersSent) {
      next(error);
      return;
    }
    res.status(500).json({
      error: {
        code: "INVALID_RUNTIME_CONFIGURATION",
        message: "The API runtime is not configured correctly.",
        requestId: "unavailable"
      }
    });
  }
});

export default vercelApp;
