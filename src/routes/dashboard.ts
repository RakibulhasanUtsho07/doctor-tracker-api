import { Router } from "express";
import type { AppConfig } from "../config/env.js";
import type { AuthRepository } from "../auth/repository.js";
import { requireAdmin } from "../auth/session.js";
import { parseDashboardRange } from "../dashboard/validation.js";
import type { DashboardRepository } from "../dashboard/repository.js";

export function createDashboardRouter(
  config: AppConfig,
  authRepository: AuthRepository,
  dashboardRepository: DashboardRepository
): Router {
  const router = Router();
  router.use(requireAdmin(authRepository, config));

  router.get("/summary", async (req, res, next) => {
    try {
      const range = parseDashboardRange(req);
      const summary = await dashboardRepository.getSummary(range);
      res.status(200).json({
        data: summary,
        meta: { requestId: res.locals.requestId }
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
