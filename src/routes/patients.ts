import { Router } from "express";
import type { AppConfig } from "../config/env.js";
import type { AuthRepository } from "../auth/repository.js";
import { requireAdmin, requireCsrf } from "../auth/session.js";
import { HttpError } from "../lib/http-error.js";
import type { DoctorRepository } from "../doctors/repository.js";
import type { PatientRepository } from "../patients/repository.js";
import { parsePatientBody, parsePatientInput, parsePatientQuery } from "../patients/validation.js";

function validateIdentifier(value: string, label: string): string {
  if (!/^[a-f\d]{24}$/i.test(value)) {
    throw new HttpError(400, "VALIDATION_ERROR", label + " ID must be a valid identifier.");
  }
  return value;
}

function ensureFound<T>(value: T | null): T {
  if (value === null) throw new HttpError(404, "NOT_FOUND", "Patient not found.");
  return value;
}

export function createPatientRouter(
  config: AppConfig,
  authRepository: AuthRepository,
  patientRepository: PatientRepository,
  doctorRepository: DoctorRepository
): Router {
  const router = Router();
  router.use(requireAdmin(authRepository, config));

  router.get("/", async (req, res, next) => {
    try {
      const query = parsePatientQuery(req);
      const result = await patientRepository.list(query);
      res.status(200).json({
        data: { patients: result.patients },
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
      const input = parsePatientInput(req.body);
      if (!await doctorRepository.findById(input.doctorId)) {
        next(new HttpError(404, "DOCTOR_NOT_FOUND", "Doctor not found."));
        return;
      }
      const patient = await patientRepository.create(input);
      res.status(201).json({
        data: { patient },
        meta: { requestId: res.locals.requestId }
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:patientId", async (req, res, next) => {
    try {
      const value: unknown = req.params.patientId;
      const id = validateIdentifier(typeof value === "string" ? value : "", "Patient");
      const patient = ensureFound(await patientRepository.findById(id));
      res.status(200).json({
        data: { patient },
        meta: { requestId: res.locals.requestId }
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:patientId", requireCsrf, async (req, res, next) => {
    try {
      const value: unknown = req.params.patientId;
      const id = validateIdentifier(typeof value === "string" ? value : "", "Patient");
      const input = parsePatientBody(req.body, true);
      if (input.doctorId !== undefined && !await doctorRepository.findById(input.doctorId)) {
        next(new HttpError(404, "DOCTOR_NOT_FOUND", "Doctor not found."));
        return;
      }
      const patient = ensureFound(await patientRepository.update(id, input));
      res.status(200).json({
        data: { patient },
        meta: { requestId: res.locals.requestId }
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:patientId", requireCsrf, async (req, res, next) => {
    try {
      const value: unknown = req.params.patientId;
      const id = validateIdentifier(typeof value === "string" ? value : "", "Patient");
      const deleted = await patientRepository.deleteById(id);
      if (!deleted) {
        next(new HttpError(404, "NOT_FOUND", "Patient not found."));
        return;
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function createDoctorPatientRouter(
  config: AppConfig,
  authRepository: AuthRepository,
  patientRepository: PatientRepository,
  doctorRepository: DoctorRepository
): Router {
  const router = Router();

  router.get("/:doctorId/patients", requireAdmin(authRepository, config), async (req, res, next) => {
    try {
      const value: unknown = req.params.doctorId;
      const doctorId = validateIdentifier(typeof value === "string" ? value : "", "Doctor");
      if (!await doctorRepository.findById(doctorId)) {
        next(new HttpError(404, "NOT_FOUND", "Doctor not found."));
        return;
      }
      const query = parsePatientQuery(req, false);
      const result = await patientRepository.list({ ...query, doctorId });
      res.status(200).json({
        data: { patients: result.patients },
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

  router.delete("/:doctorId/patients/:patientId", requireAdmin(authRepository, config), requireCsrf, async (req, res, next) => {
    try {
      const rawDoctorId: unknown = req.params.doctorId;
      const rawPatientId: unknown = req.params.patientId;
      const doctorId = validateIdentifier(typeof rawDoctorId === "string" ? rawDoctorId : "", "Doctor");
      const patientId = validateIdentifier(typeof rawPatientId === "string" ? rawPatientId : "", "Patient");
      if (!await doctorRepository.findById(doctorId)) {
        next(new HttpError(404, "NOT_FOUND", "Doctor not found."));
        return;
      }
      const detached = await patientRepository.detachFromDoctor(doctorId, patientId);
      if (!detached) {
        next(new HttpError(404, "NOT_FOUND", "Patient not found for this doctor."));
        return;
      }
      // The patient record remains; only the doctor association is removed.
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
