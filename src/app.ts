import cors from "cors";
import express, { type RequestHandler } from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import type { AuthRepository } from "./auth/repository.js";
import { MongooseAuthRepository } from "./auth/repository.js";
import type { AppConfig } from "./config/env.js";
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

export function createApp(
const helmetFactory = helmet as unknown as () => RequestHandler;
  config: AppConfig,
  authRepository: AuthRepository = new MongooseAuthRepository(),
  doctorRepository: DoctorRepository = new MongooseDoctorRepository(),
  patientRepository: PatientRepository = new MongoosePatientRepository(),
  dashboardRepository: DashboardRepository = new MongooseDashboardRepository()
) {
  const app = express();
  app.disable("x-powered-by");
  if (config.nodeEnv === "production") app.set("trust proxy", 1);
  app.use(helmet());
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
