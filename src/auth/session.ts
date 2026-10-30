import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";
import type { AppConfig } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";
import type { AuthRepository, AuthSession, AuthUser } from "./repository.js";

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export interface AuthContext {
  user: AuthUser;
  session: AuthSession;
}

export function sessionCookieName(config: AppConfig): string {
  return config.nodeEnv === "production" ? "__Host-dt_session" : "dt_session";
}

function cookieValue(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function newCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export function setSessionCookie(res: Response, config: AppConfig, token: string): void {
  const secure = config.nodeEnv === "production" ? "; Secure" : "";
  const sameSite = config.nodeEnv === "production" ? "None" : "Strict";
  res.setHeader(
    "Set-Cookie",
    `${sessionCookieName(config)}=${token}; Path=/; HttpOnly${secure}; SameSite=${sameSite}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  );
}

export function clearSessionCookie(res: Response, config: AppConfig): void {
  const secure = config.nodeEnv === "production" ? "; Secure" : "";
  const sameSite = config.nodeEnv === "production" ? "None" : "Strict";
  res.setHeader(
    "Set-Cookie",
    `${sessionCookieName(config)}=; Path=/; HttpOnly${secure}; SameSite=${sameSite}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  );
}

export async function resolveAuthContext(
  req: Request,
  repository: AuthRepository,
  config: AppConfig
): Promise<AuthContext | null> {
  const token = cookieValue(req, sessionCookieName(config));
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;

  const tokenHash = hashSessionToken(token);
  const session = await repository.findSessionByTokenHash(tokenHash);
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await repository.deleteSession(tokenHash);
    return null;
  }

  const user = await repository.findUserById(session.userId);
  if (!user || !user.isActive || user.role !== "ADMIN") {
    await repository.deleteSession(tokenHash);
    return null;
  }
  return { user, session };
}

export function constantTimeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function requireAdmin(
  repository: AuthRepository,
  config: AppConfig
): RequestHandler {
  return async (req, res, next) => {
    try {
      const context = await resolveAuthContext(req, repository, config);
      if (!context) {
        clearSessionCookie(res, config);
        next(new HttpError(401, "UNAUTHENTICATED", "Sign in to continue."));
        return;
      }
      res.locals.authContext = context;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requireCsrf: RequestHandler = (req, res, next) => {
  const context = res.locals.authContext as AuthContext | undefined;
  const header = req.get("X-CSRF-Token");
  if (!context || !header || !constantTimeStringEqual(header, context.session.csrfToken)) {
    next(new HttpError(403, "CSRF_VALIDATION_FAILED", "A valid CSRF token is required."));
    return;
  }
  next();
};
