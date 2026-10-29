import { createHash, timingSafeEqual } from "node:crypto";
import { Router, type Request, type RequestHandler, type Response } from "express";
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from "../auth/password.js";
import type { AuthContext } from "../auth/session.js";
import {
  SESSION_TTL_MS,
  clearSessionCookie,
  hashSessionToken,
  newCsrfToken,
  newSessionToken,
  requireAdmin,
  requireCsrf,
  setSessionCookie
} from "../auth/session.js";
import type { AuthRepository, AuthUserWithPassword } from "../auth/repository.js";
import type { AppConfig } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const MAX_RATE_LIMIT_KEYS = 10_000;

interface AttemptWindow {
  count: number;
  resetAt: number;
}

function clientKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function createRateLimiter(maxAttempts: number, code: string, message: string) {
  const windows = new Map<string, AttemptWindow>();

  const middleware: RequestHandler = (req, res, next) => {
    const now = Date.now();
    const key = clientKey(req);
    let entry = windows.get(key);

    if (entry && entry.resetAt <= now) {
      windows.delete(key);
      entry = undefined;
    }

    if (!entry && windows.size >= MAX_RATE_LIMIT_KEYS) {
      for (const [candidate, value] of windows) {
        if (value.resetAt <= now) windows.delete(candidate);
      }
      if (windows.size >= MAX_RATE_LIMIT_KEYS) {
        res.setHeader("Retry-After", String(Math.ceil(LOGIN_WINDOW_MS / 1000)));
        next(new HttpError(429, code, message));
        return;
      }
    }

    if (entry && entry.count >= maxAttempts) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      next(new HttpError(429, code, message));
      return;
    }

    if (!entry) {
      entry = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
      windows.set(key, entry);
    }
    entry.count += 1;
    next();
  };

  return {
    middleware,
    clear(req: Request) {
      windows.delete(clientKey(req));
    }
  };
}

function parseLoginBody(body: unknown): { email: string; password: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Provide an email and password.");
  }
  const record = body as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "email" && key !== "password")) {
    throw new HttpError(400, "VALIDATION_ERROR", "Unexpected login fields are not allowed.");
  }
  if (typeof record.email !== "string" || typeof record.password !== "string") {
    throw new HttpError(400, "VALIDATION_ERROR", "Provide an email and password.");
  }

  const email = record.email.trim().toLowerCase();
  if (
    email.length < 3 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    record.password.length < 1 ||
    Buffer.byteLength(record.password, "utf8") > 1024
  ) {
    throw new HttpError(400, "VALIDATION_ERROR", "Provide a valid email and password.");
  }
  return { email, password: record.password };
}

function parseRegistrationBody(
  body: unknown,
  setupTokenRequired: boolean
): { email: string; password: string; setupToken?: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Provide an email and password.");
  }
  const record = body as Record<string, unknown>;
  const allowedFields = setupTokenRequired ? ["email", "password", "setupToken"] : ["email", "password"];
  if (Object.keys(record).some((key) => !allowedFields.includes(key))) {
    throw new HttpError(400, "VALIDATION_ERROR", "Unexpected registration fields are not allowed.");
  }
  if (typeof record.email !== "string" || typeof record.password !== "string") {
    throw new HttpError(400, "VALIDATION_ERROR", "Provide an email and password.");
  }
  if (
    setupTokenRequired &&
    record.setupToken !== undefined &&
    (typeof record.setupToken !== "string" || record.setupToken.length > 512)
  ) {
    throw new HttpError(400, "VALIDATION_ERROR", "Provide a valid one-time setup code.");
  }

  const email = record.email.trim().toLowerCase();
  if (
    email.length < 3 ||
    email.length > 254 ||
    !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) ||
    record.password.length < 14 ||
    record.password.length > 128 ||
    Buffer.byteLength(record.password, "utf8") > 1024
  ) {
    throw new HttpError(400, "VALIDATION_ERROR", "Provide a valid email and a password between 14 and 128 characters.");
  }
  return {
    email,
    password: record.password,
    ...(typeof record.setupToken === "string" ? { setupToken: record.setupToken } : {})
  };
}

function matchesSetupToken(candidate: string | undefined, expected: string): boolean {
  // Compare fixed-length digests so unequal candidate lengths do not bypass
  // timingSafeEqual or cause a length-dependent early return.
  const candidateDigest = createHash("sha256").update(candidate ?? "", "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(candidateDigest, expectedDigest);
}

function publicUser(user: { id: string; email: string; role: string }) {
  return { id: user.id, email: user.email, role: user.role };
}

async function establishSession(
  res: Response,
  config: AppConfig,
  repository: AuthRepository,
  user: AuthUserWithPassword
): Promise<{ user: ReturnType<typeof publicUser>; csrfToken: string; expiresAt: string }> {
  const token = newSessionToken();
  const tokenHash = hashSessionToken(token);
  const csrfToken = newCsrfToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await repository.createSession({
    tokenHash,
    userId: user.id,
    csrfToken,
    expiresAt
  });
  setSessionCookie(res, config, token);
  return {
    user: publicUser(user),
    csrfToken,
    expiresAt: expiresAt.toISOString()
  };
}

export function createAuthRouter(config: AppConfig, repository: AuthRepository): Router {
  const router = Router();
  const loginLimit = createRateLimiter(
    LOGIN_MAX_ATTEMPTS,
    "LOGIN_RATE_LIMITED",
    "Too many sign-in attempts. Try again later."
  );
  const registrationLimit = createRateLimiter(
    LOGIN_MAX_ATTEMPTS,
    "REGISTRATION_RATE_LIMITED",
    "Too many registration attempts. Try again later."
  );

  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  router.get("/registration-status", async (_req, res, next) => {
    try {
      const setupClaimOpen = await repository.isFirstAdminRegistrationOpen();
      const setupDisabled = setupClaimOpen &&
        config.nodeEnv === "production" &&
        !config.initialAdminSetupToken;
      res.status(200).json({
        data: {
          registrationOpen: setupClaimOpen && !setupDisabled,
          setupCodeRequired: Boolean(config.initialAdminSetupToken),
          setupDisabled
        },
        meta: { requestId: res.locals.requestId }
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/register", registrationLimit.middleware, async (req, res, next) => {
    try {
      if (!(await repository.isFirstAdminRegistrationOpen())) {
        next(new HttpError(
          409,
          "REGISTRATION_CLOSED",
          "Initial registration is unavailable. Sign in if you already have an account or contact the system operator."
        ));
        return;
      }

      if (config.nodeEnv === "production" && !config.initialAdminSetupToken) {
        next(new HttpError(
          503,
          "REGISTRATION_SETUP_DISABLED",
          "Initial administrator setup is disabled until the system operator configures a one-time setup code."
        ));
        return;
      }

      const { email, password, setupToken } = parseRegistrationBody(
        req.body,
        Boolean(config.initialAdminSetupToken)
      );
      if (
        config.initialAdminSetupToken &&
        !matchesSetupToken(setupToken, config.initialAdminSetupToken)
      ) {
        next(new HttpError(403, "INVALID_SETUP_CODE", "The one-time setup code is invalid."));
        return;
      }

      const passwordHash = await hashPassword(password);
      const user = await repository.registerFirstAdmin(email, passwordHash);
      if (!user) {
        next(new HttpError(
          409,
          "REGISTRATION_CLOSED",
          "Initial registration is unavailable. Sign in if you already have an account or contact the system operator."
        ));
        return;
      }

      const session = await establishSession(res, config, repository, user);
      registrationLimit.clear(req);
      res.status(201).json({
        data: session,
        meta: { requestId: res.locals.requestId }
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/login", loginLimit.middleware, async (req, res, next) => {
    try {
      const { email, password } = parseLoginBody(req.body);
      const user = await repository.findUserByEmail(email);
      const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
      const passwordMatches = await verifyPassword(password, passwordHash);

      if (!user || !user.isActive || user.role !== "ADMIN" || !passwordMatches) {
        next(new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect."));
        return;
      }

      const session = await establishSession(res, config, repository, user);
      loginLimit.clear(req);
      res.status(200).json({
        data: session,
        meta: { requestId: res.locals.requestId }
      });
    } catch (error) {
      next(error);
    }
  });

  const adminOnly = requireAdmin(repository, config);
  router.get("/me", adminOnly, (_req, res) => {
    const context = res.locals.authContext as AuthContext;
    res.status(200).json({
      data: {
        user: publicUser(context.user),
        csrfToken: context.session.csrfToken,
        expiresAt: context.session.expiresAt.toISOString()
      },
      meta: { requestId: res.locals.requestId }
    });
  });

  router.post("/logout", adminOnly, requireCsrf, async (_req, res, next) => {
    try {
      const context = res.locals.authContext as AuthContext;
      await repository.deleteSession(context.session.tokenHash);
      clearSessionCookie(res, config);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
