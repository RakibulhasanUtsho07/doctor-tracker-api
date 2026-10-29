import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { AppConfig } from "../src/config/env.js";
import { hashPassword } from "../src/auth/password.js";
import type { AuthRepository, AuthSession, AuthUser, AuthUserWithPassword } from "../src/auth/repository.js";
import { hashSessionToken, SESSION_TTL_MS } from "../src/auth/session.js";
import { createApp } from "../src/app.js";

const config: AppConfig = {
  nodeEnv: "test", port: 4000,
  mongoUri: "mongodb://127.0.0.1:27017/doctor_tracker_test",
  frontendOrigins: ["http://localhost:3000"]
};
const password = "Correct horse battery staple 2026!";
const passwordHash = await hashPassword(password);

class MemoryAuthRepository implements AuthRepository {
  users = new Map<string, AuthUserWithPassword>();
  sessions = new Map<string, AuthSession>();
  registrationGateClaimed = false;

  async findUserByEmail(email: string): Promise<AuthUserWithPassword | null> {
    return this.users.get(email) ?? null;
  }
  async findUserById(id: string): Promise<AuthUser | null> {
    const user = [...this.users.values()].find((candidate) => candidate.id === id);
    return user ? { id: user.id, email: user.email, role: user.role, isActive: user.isActive } : null;
  }
  async createSession(session: AuthSession): Promise<void> { this.sessions.set(session.tokenHash, session); }
  async findSessionByTokenHash(hash: string): Promise<AuthSession | null> { return this.sessions.get(hash) ?? null; }
  async deleteSession(hash: string): Promise<void> { this.sessions.delete(hash); }
  async isFirstAdminRegistrationOpen(): Promise<boolean> {
    return this.users.size === 0 && !this.registrationGateClaimed;
  }
  async registerFirstAdmin(email: string, submittedHash: string): Promise<AuthUserWithPassword | null> {
    if (this.users.size > 0 || this.registrationGateClaimed) return null;
    this.registrationGateClaimed = true;
    const user: AuthUserWithPassword = {
      id: "registered-admin-id-1", email, role: "ADMIN", isActive: true,
      passwordHash: submittedHash
    };
    this.users.set(email, user);
    return user;
  }

  addAdmin(overrides: Partial<AuthUserWithPassword> = {}): AuthUserWithPassword {
    const user: AuthUserWithPassword = {
      id: "admin-id-1", email: "admin@example.com", role: "ADMIN",
      isActive: true, passwordHash, ...overrides
    };
    this.users.set(user.email, user);
    return user;
  }
}

async function withServer(
  repository: AuthRepository,
  run: (baseUrl: string) => Promise<void>,
  appConfig: AppConfig = config
): Promise<void> {
  const server = createApp(appConfig, repository).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port.");
  try {
    await run(`http://127.0.0.1:${(address as AddressInfo).port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function login(baseUrl: string, email = "ADMIN@example.com", submittedPassword = password) {
  return fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: submittedPassword })
  });
}

function register(baseUrl: string, email = "first-admin@example.com", submittedPassword = password, extra: Record<string, unknown> = {}) {
  return fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: submittedPassword, ...extra })
  });
}

function cookie(response: Response, name = "dt_session"): string {
  const header = response.headers.get("set-cookie");
  assert.ok(header);
  const pair = header.split(";")[0];
  if (!pair?.startsWith(`${name}=`)) throw new Error("Expected session cookie name.");
  return pair;
}

test("first-admin registration opens initially, creates a session, then closes permanently", async () => {
  const repo = new MemoryAuthRepository();
  await withServer(repo, async (url) => {
    const statusBefore = await fetch(`${url}/api/v1/auth/registration-status`);
    assert.equal(statusBefore.status, 200);
    assert.match(statusBefore.headers.get("cache-control") ?? "", /no-store/);
    assert.equal((await statusBefore.json() as { data: { registrationOpen: boolean } }).data.registrationOpen, true);

    const response = await register(url, " FIRST-ADMIN@EXAMPLE.COM ");
    const body = await response.json() as { data: { user: { email: string; role: string }; csrfToken: string; expiresAt: string } };
    assert.equal(response.status, 201);
    assert.equal(body.data.user.email, "first-admin@example.com");
    assert.equal(body.data.user.role, "ADMIN");
    assert.ok(body.data.csrfToken.length >= 40);
    assert.ok(Number.isFinite(Date.parse(body.data.expiresAt)));
    assert.equal(Object.hasOwn(body.data.user, "passwordHash"), false);
    assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
    assert.equal(repo.sessions.size, 1);

    const statusAfter = await fetch(`${url}/api/v1/auth/registration-status`);
    assert.equal((await statusAfter.json() as { data: { registrationOpen: boolean } }).data.registrationOpen, false);
    const second = await register(url, "second-admin@example.com");
    assert.equal(second.status, 409);
    assert.equal((await second.json() as { error: { code: string } }).error.code, "REGISTRATION_CLOSED");
    assert.equal(repo.users.size, 1);
  });
});

test("registration validates email, password length and rejects client-supplied roles", async () => {
  const repo = new MemoryAuthRepository();
  await withServer(repo, async (url) => {
    assert.equal((await register(url, "not-an-email")).status, 400);
    assert.equal((await register(url, "weak@example.com", "short")).status, 400);
    assert.equal((await register(url, "role@example.com", password, { role: "ADMIN", isActive: true })).status, 400);
    assert.equal(repo.users.size, 0);
    assert.equal(await repo.isFirstAdminRegistrationOpen(), true);
  });
});

test("concurrent registration attempts can create at most one administrator", async () => {
  const repo = new MemoryAuthRepository();
  await withServer(repo, async (url) => {
    const [one, two] = await Promise.all([
      register(url, "first@example.com"),
      register(url, "second@example.com")
    ]);
    assert.deepEqual([one.status, two.status].sort((a, b) => a - b), [201, 409]);
    assert.equal(repo.users.size, 1);
    assert.equal(repo.sessions.size, 1);
  });
});

test("registration is rate limited after five attempts per client window", async () => {
  const repo = new MemoryAuthRepository();
  await withServer(repo, async (url) => {
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await register(url, "invalid")).status, 400);
    }
    const limited = await register(url, "another-invalid");
    assert.equal(limited.status, 429);
    assert.equal((await limited.json() as { error: { code: string } }).error.code, "REGISTRATION_RATE_LIMITED");
    assert.equal(repo.users.size, 0);
  });
});

test("login creates an opaque HttpOnly session and returns CSRF token", async () => {
  const repo = new MemoryAuthRepository(); repo.addAdmin();
  await withServer(repo, async (url) => {
    const response = await login(url);
    const body = await response.json() as { data: { user: { email: string; role: string }; csrfToken: string } };
    assert.equal(response.status, 200);
    assert.equal(body.data.user.email, "admin@example.com");
    assert.equal(body.data.user.role, "ADMIN");
    assert.ok(body.data.csrfToken.length >= 40);
    assert.equal(Object.hasOwn(body.data.user, "passwordHash"), false);
    const pair = cookie(response);
    assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
    assert.match(response.headers.get("set-cookie") ?? "", /SameSite=Strict/);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    const token = pair.slice("dt_session=".length);
    assert.equal(token.length, 43);
    assert.equal(repo.sessions.size, 1);
    assert.equal(repo.sessions.has(token), false);
    assert.ok(repo.sessions.has(hashSessionToken(token)));
  });
});

test("invalid and unknown accounts receive the same generic login error", async () => {
  const repo = new MemoryAuthRepository(); repo.addAdmin();
  await withServer(repo, async (url) => {
    const wrong = await login(url, "admin@example.com", "wrong password");
    const missing = await login(url, "missing@example.com", "wrong password");
    const a = await wrong.json() as { error: { code: string; message: string } };
    const b = await missing.json() as { error: { code: string; message: string } };
    assert.equal(wrong.status, 401); assert.equal(missing.status, 401);
    assert.equal(a.error.code, "INVALID_CREDENTIALS");
    assert.equal(a.error.message, b.error.message);
    assert.equal(repo.sessions.size, 0);
  });
});

test("login rejects extra fields and current-user denies anonymous requests", async () => {
  const repo = new MemoryAuthRepository();
  await withServer(repo, async (url) => {
    const invalid = await fetch(`${url}/api/v1/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password, role: "ADMIN" })
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json() as { error: { code: string } }).error.code, "VALIDATION_ERROR");
    const me = await fetch(`${url}/api/v1/auth/me`);
    assert.equal(me.status, 401);
    assert.equal((await me.json() as { error: { code: string } }).error.code, "UNAUTHENTICATED");
  });
});

test("current-user validates a persisted admin session and expiry", async () => {
  const repo = new MemoryAuthRepository(); const user = repo.addAdmin();
  const token = "A".repeat(43); const tokenHash = hashSessionToken(token);
  repo.sessions.set(tokenHash, {
    tokenHash, userId: user.id, csrfToken: "csrf-token-expected",
    expiresAt: new Date(Date.now() + SESSION_TTL_MS)
  });
  await withServer(repo, async (url) => {
    const response = await fetch(`${url}/api/v1/auth/me`, { headers: { Cookie: `dt_session=${token}` } });
    const body = await response.json() as { data: { user: { role: string }; csrfToken: string } };
    assert.equal(response.status, 200);
    assert.equal(body.data.user.role, "ADMIN");
    assert.equal(body.data.csrfToken, "csrf-token-expected");
  });
  repo.sessions.set(tokenHash, { tokenHash, userId: user.id, csrfToken: "expired", expiresAt: new Date(Date.now() - 1000) });
  await withServer(repo, async (url) => {
    const response = await fetch(`${url}/api/v1/auth/me`, { headers: { Cookie: `dt_session=${token}` } });
    assert.equal(response.status, 401);
    assert.equal(repo.sessions.has(tokenHash), false);
  });
});

test("logout requires CSRF and then revokes the session", async () => {
  const repo = new MemoryAuthRepository(); const user = repo.addAdmin();
  const token = "B".repeat(43); const tokenHash = hashSessionToken(token);
  repo.sessions.set(tokenHash, {
    tokenHash, userId: user.id, csrfToken: "expected-csrf",
    expiresAt: new Date(Date.now() + SESSION_TTL_MS)
  });
  await withServer(repo, async (url) => {
    const denied = await fetch(`${url}/api/v1/auth/logout`, {
      method: "POST", headers: { Cookie: `dt_session=${token}` }
    });
    assert.equal(denied.status, 403);
    assert.equal(repo.sessions.has(tokenHash), true);
    const allowed = await fetch(`${url}/api/v1/auth/logout`, {
      method: "POST", headers: { Cookie: `dt_session=${token}`, "X-CSRF-Token": "expected-csrf" }
    });
    assert.equal(allowed.status, 204);
    assert.equal(repo.sessions.has(tokenHash), false);
    assert.match(allowed.headers.get("set-cookie") ?? "", /Max-Age=0/);
  });
});

test("login limits the sixth failed attempt and production cookie is Secure", async () => {
  const repo = new MemoryAuthRepository(); repo.addAdmin();
  await withServer(repo, async (url) => {
    for (let i = 0; i < 5; i += 1) assert.equal((await login(url, "admin@example.com", "wrong password")).status, 401);
    const limited = await login(url, "admin@example.com", "wrong password");
    assert.equal(limited.status, 429);
    assert.equal((await limited.json() as { error: { code: string } }).error.code, "LOGIN_RATE_LIMITED");
    assert.ok(Number(limited.headers.get("retry-after")) > 0);
  });

  const production = new MemoryAuthRepository(); production.addAdmin();
  await withServer(production, async (url) => {
    const response = await login(url);
    const header = response.headers.get("set-cookie") ?? "";
    assert.equal(response.status, 200);
    assert.match(header, /^__Host-dt_session=/);
    assert.match(header, /; Secure/);
    assert.match(header, /SameSite=None/);
  }, { ...config, nodeEnv: "production" });
});
