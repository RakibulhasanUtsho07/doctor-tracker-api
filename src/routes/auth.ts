import { Router, type Request, type RequestHandler } from "express";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "../auth/password.js";
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
import type { AuthRepository } from "../auth/repository.js";
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

function createLoginRateLimiter() {
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
        next(new HttpError(429, "LOGIN_RATE_LIMITED", "Too many login attempts. Try again later."));
        return;
      }
    }

    if (entry && entry.count >= LOGIN_MAX_ATTEMPTS) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      next(new HttpError(429, "LOGIN_RATE_LIMITED", "Too many login attempts. Try again later."));
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

function publicUser(user: { id: string; email: string; role: string }) {
  return { id: user.id, email: user.email, role: user.role };
}

export function createAuthRouter(config: AppConfig, repository: AuthRepository): Router {
  const router = Router();
  const loginLimit = createLoginRateLimiter();

  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
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

      loginLimit.clear(req);
      setSessionCookie(res, config, token);
      res.status(200).json({
        data: {
          user: publicUser(user),
          csrfToken,
          expiresAt: expiresAt.toISOString()
        },
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
