import { Router, type NextFunction } from "express";
import type { AppConfig } from "../config/env.js";
import type { AuthRepository } from "../auth/repository.js";
import { requireAdmin, requireCsrf } from "../auth/session.js";
import { HttpError } from "../lib/http-error.js";
import type { DoctorRepository } from "../doctors/repository.js";
import { parseDoctorBody, parseDoctorInput, parseDoctorQuery } from "../doctors/validation.js";

function mapWriteError(error: unknown): unknown {
  if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
    return new HttpError(409, "DOCTOR_EMAIL_EXISTS", "A doctor with this email already exists.");
  }
  return error;
}

function forwardWriteError(error: unknown, next: NextFunction): void {
  next(mapWriteError(error));
}

function validateDoctorId(value: string): string {
  if (!/^[a-f\d]{24}$/i.test(value)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Doctor ID must be a valid identifier.");
  }
  return value;
}

function ensureFound<T>(value: T | null): T {
  if (value === null) throw new HttpError(404, "NOT_FOUND", "Doctor not found.");
  return value;
}

export function createDoctorRouter(
  config: AppConfig,
  authRepository: AuthRepository,
  doctorRepository: DoctorRepository
): Router {
  const router = Router();
  router.use(requireAdmin(authRepository, config));

  router.get("/", async (req, res, next) => {
    try {
      const query = parseDoctorQuery(req);
      const result = await doctorRepository.list(query);
      res.status(200).json({
        data: { doctors: result.doctors },
        meta: {
          requestId: res.locals.requestId,
          pagination: {
            page: query.page,
            limit: query.limit,
            total: result.total,
            totalPages: Math.ceil(result.total / query.limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", requireCsrf, async (req, res, next) => {
    try {
      const input = parseDoctorInput(req.body);
      const doctor = await doctorRepository.create(input);
      res.status(201).json({
        data: { doctor },
        meta: { requestId: res.locals.requestId }
      });
    } catch (error) {
      forwardWriteError(error, next);
    }
  });

  router.get("/:doctorId", async (req, res, next) => {
    try {
      const idParam: unknown = req.params.doctorId;
      const id = validateDoctorId(typeof idParam === "string" ? idParam : "");
      const doctor = ensureFound(await doctorRepository.findById(id));
      res.status(200).json({
        data: { doctor },
        meta: { requestId: res.locals.requestId }
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:doctorId", requireCsrf, async (req, res, next) => {
    try {
      const idParam: unknown = req.params.doctorId;
      const id = validateDoctorId(typeof idParam === "string" ? idParam : "");
      const input = parseDoctorBody(req.body, true);
      const doctor = ensureFound(await doctorRepository.update(id, input));
      res.status(200).json({
        data: { doctor },
        meta: { requestId: res.locals.requestId }
      });
    } catch (error) {
      forwardWriteError(error, next);
    }
  });

  return router;
}
