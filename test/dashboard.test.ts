import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { AppConfig } from "../src/config/env.js";
import { hashSessionToken, SESSION_TTL_MS } from "../src/auth/session.js";
import type { AuthRepository, AuthSession, AuthUser, AuthUserWithPassword } from "../src/auth/repository.js";
import type { DashboardDateRange } from "../src/dashboard/validation.js";
import type { DashboardRepository, DashboardSummary } from "../src/dashboard/repository.js";
import { createApp } from "../src/app.js";

const config: AppConfig = {
  nodeEnv: "test",
  port: 4000,
  mongoUri: "mongodb://127.0.0.1:27017/doctor_tracker_test",
  frontendOrigins: ["http://localhost:3000"]
};
const token = "C".repeat(43);
const user: AuthUser = {
  id: "aaaaaaaaaaaaaaaaaaaaaaaa",
  email: "admin@example.com",
  role: "ADMIN",
  isActive: true
};
const csrf = "dashboard-csrf-token-123456789012345678901234567890";

class MemoryAuthRepository implements AuthRepository {
  users = new Map<string, AuthUserWithPassword>();
  sessions = new Map<string, AuthSession>();
  constructor() {
    this.users.set(user.id, { ...user, passwordHash: "not-used-by-dashboard" });
    this.sessions.set(hashSessionToken(token), {
      tokenHash: hashSessionToken(token),
      userId: user.id,
      csrfToken: csrf,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS)
    });
  }
  async findUserByEmail(email: string): Promise<AuthUserWithPassword | null> {
    return [...this.users.values()].find((entry) => entry.email === email) ?? null;
  }
  async findUserById(id: string): Promise<AuthUser | null> {
    const found = this.users.get(id);
    return found ? { id: found.id, email: found.email, role: found.role, isActive: found.isActive } : null;
  }
  async createSession(session: AuthSession): Promise<void> { this.sessions.set(session.tokenHash, session); }
  async findSessionByTokenHash(value: string): Promise<AuthSession | null> { return this.sessions.get(value) ?? null; }
  async deleteSession(value: string): Promise<void> { this.sessions.delete(value); }
  async isFirstAdminRegistrationOpen(): Promise<boolean> { return this.users.size === 0; }
  async registerFirstAdmin(_email: string, _passwordHash: string): Promise<AuthUserWithPassword | null> { return null; }
}

class MemoryDashboardRepository implements DashboardRepository {
  ranges: DashboardDateRange[] = [];
  async getSummary(range: DashboardDateRange): Promise<DashboardSummary> {
    this.ranges.push(range);
    const days: DashboardSummary["dateStatistics"]["days"] = [];
    for (let time = range.from.getTime(); time < range.toExclusive.getTime(); time += 86_400_000) {
      const date = new Date(time).toISOString().slice(0, 10);
      days.push({
        date,
        doctorsCreated: date === range.fromDate ? 2 : 0,
        patientsCreated: date === range.toDate ? 3 : 0
      });
    }
    return {
      totals: { doctors: 7, patients: 21 },
      patientsPerDoctor: [
        { doctorId: "111111111111111111111111", doctorName: "Dr. Example", patientCount: 3 }
      ],
      dateStatistics: { from: range.fromDate, to: range.toDate, days }
    };
  }
}

async function withServer(
  run: (url: string) => Promise<void>,
  dashboardRepo = new MemoryDashboardRepository(),
  authRepo = new MemoryAuthRepository()
): Promise<void> {
  const app = createApp(config, authRepo, undefined, undefined, dashboardRepo);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a port.");
  try {
    await run("http://127.0.0.1:" + (address as AddressInfo).port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function authHeaders(): Record<string, string> {
  return { Cookie: "dt_session=" + token };
}

function utcDay(offset: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

test("dashboard summary requires an active admin session", async () => {
  await withServer(async (url) => {
    const response = await fetch(url + "/api/v1/dashboard/summary");
    const body = await response.json() as { error: { code: string } };
    assert.equal(response.status, 401);
    assert.equal(body.error.code, "UNAUTHENTICATED");
  });
});

test("dashboard summary returns all-time totals, doctor counts and date series", async () => {
  const repo = new MemoryDashboardRepository();
  const from = utcDay(-1);
  const to = utcDay(0);
  await withServer(async (url) => {
    const response = await fetch(url + "/api/v1/dashboard/summary?from=" + from + "&to=" + to, {
      headers: authHeaders()
    });
    const body = await response.json() as {
      data: DashboardSummary;
      meta: { requestId: string };
    };
    assert.equal(response.status, 200);
    assert.equal(body.data.totals.doctors, 7);
    assert.equal(body.data.totals.patients, 21);
    assert.equal(body.data.patientsPerDoctor[0]?.patientCount, 3);
    assert.equal(body.data.dateStatistics.from, from);
    assert.equal(body.data.dateStatistics.to, to);
    assert.equal(body.data.dateStatistics.days.length, 2);
    assert.equal(body.data.dateStatistics.days[0]?.doctorsCreated, 2);
    assert.equal(body.data.dateStatistics.days[1]?.patientsCreated, 3);
    assert.ok(body.meta.requestId);
    assert.equal(repo.ranges.length, 1);
  }, repo);
});

test("dashboard date range defaults to 30 UTC days and rejects invalid, future, oversized or unknown queries", async () => {
  const repo = new MemoryDashboardRepository();
  await withServer(async (url) => {
    const defaultResponse = await fetch(url + "/api/v1/dashboard/summary", { headers: authHeaders() });
    const defaultBody = await defaultResponse.json() as { data: DashboardSummary };
    assert.equal(defaultResponse.status, 200);
    assert.equal(defaultBody.data.dateStatistics.days.length, 30);
    assert.equal(defaultBody.data.dateStatistics.to, utcDay(0));
    assert.equal(repo.ranges[0]?.fromDate, utcDay(-29));

    const invalidQueries = [
      "?sort=createdAt",
      "?from=2026-02-30",
      "?from=" + utcDay(1),
      "?from=" + utcDay(-366) + "&to=" + utcDay(0),
      "?from=" + utcDay(0) + "&to=" + utcDay(-1),
      "?to=" + utcDay(1)
    ];
    for (const query of invalidQueries) {
      const response = await fetch(url + "/api/v1/dashboard/summary" + query, { headers: authHeaders() });
      const body = await response.json() as { error: { code: string } };
      assert.equal(response.status, 400, query);
      assert.equal(body.error.code, "VALIDATION_ERROR", query);
    }
  }, repo);
});
