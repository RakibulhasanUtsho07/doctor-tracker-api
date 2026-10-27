import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { AppConfig } from "../src/config/env.js";
import { hashSessionToken, SESSION_TTL_MS } from "../src/auth/session.js";
import type { AuthRepository, AuthSession, AuthUser, AuthUserWithPassword } from "../src/auth/repository.js";
import type { DoctorInput, DoctorListQuery, DoctorListResult, DoctorPatch, DoctorRecord, DoctorRepository } from "../src/doctors/repository.js";
import { createApp } from "../src/app.js";

const config: AppConfig = {
  nodeEnv: "test",
  port: 4000,
  mongoUri: "mongodb://127.0.0.1:27017/doctor_tracker_test",
  frontendOrigins: ["http://localhost:3000"]
};
const token = "A".repeat(43);
const csrf = "csrf-test-token-123456789012345678901234567890123456";
const user: AuthUser = { id: "aaaaaaaaaaaaaaaaaaaaaaaa", email: "admin@example.com", role: "ADMIN", isActive: true };

class MemoryAuthRepository implements AuthRepository {
  users = new Map<string, AuthUserWithPassword>();
  sessions = new Map<string, AuthSession>();
  constructor() {
    this.users.set(user.id, { ...user, passwordHash: "not-used-in-this-router" });
    this.sessions.set(hashSessionToken(token), {
      tokenHash: hashSessionToken(token), userId: user.id, csrfToken: csrf,
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
}

class MemoryDoctorRepository implements DoctorRepository {
  records = new Map<string, DoctorRecord>();
  counter = 0;
  async list(query: DoctorListQuery): Promise<DoctorListResult> {
    let records = [...this.records.values()];
    const normalize = (value: string) => value.normalize("NFKC").trim().toLowerCase();
    if (query.search) {
      const search = normalize(query.search);
      records = records.filter((doctor) =>
        [doctor.name, doctor.specialization, doctor.hospital, doctor.email]
          .some((value) => normalize(value).startsWith(search))
      );
    }
    if (query.specialization) records = records.filter((doctor) => normalize(doctor.specialization) === normalize(query.specialization as string));
    if (query.hospital) records = records.filter((doctor) => normalize(doctor.hospital) === normalize(query.hospital as string));
    if (query.from) records = records.filter((doctor) => doctor.createdAt >= (query.from as Date));
    if (query.toExclusive) records = records.filter((doctor) => doctor.createdAt < (query.toExclusive as Date));
    records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
    return {
      doctors: records.slice((query.page - 1) * query.limit, query.page * query.limit),
      total: records.length
    };
  }
  async create(input: DoctorInput): Promise<DoctorRecord> {
    if ([...this.records.values()].some((doctor) => doctor.email.toLowerCase() === input.email.toLowerCase())) {
      throw Object.assign(new Error("duplicate"), { code: 11000 });
    }
    this.counter += 1;
    const id = this.counter.toString(16).padStart(24, "0");
    const now = new Date();
    const doctor: DoctorRecord = { id, ...input, createdAt: now, updatedAt: now };
    this.records.set(id, doctor);
    return doctor;
  }
  async findById(id: string): Promise<DoctorRecord | null> { return this.records.get(id) ?? null; }
  async update(id: string, input: DoctorPatch): Promise<DoctorRecord | null> {
    const existing = this.records.get(id);
    if (!existing) return null;
    if (input.email && [...this.records.values()].some((doctor) => doctor.id !== id && doctor.email.toLowerCase() === input.email?.toLowerCase())) {
      throw Object.assign(new Error("duplicate"), { code: 11000 });
    }
    const updated = { ...existing, ...input, updatedAt: new Date() };
    this.records.set(id, updated);
    return updated;
  }
}

async function withServer(run: (url: string) => Promise<void>, repo = new MemoryDoctorRepository(), auth = new MemoryAuthRepository()) {
  const server = createApp(config, auth, repo).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a port.");
  try {
    await run("http://127.0.0.1:" + (address as AddressInfo).port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function authHeaders(withCsrf = false): Record<string, string> {
  return {
    Cookie: "dt_session=" + token,
    ...(withCsrf ? { "X-CSRF-Token": csrf } : {})
  };
}

const validDoctor = {
  name: "Dr. Amina Rahman",
  specialization: "Cardiology",
  hospital: "Central Hospital",
  phone: "+880 1712-345678",
  email: "amina@example.com"
};

test("doctor endpoints require an active administrator session", async () => {
  await withServer(async (url) => {
    const response = await fetch(url + "/api/v1/doctors");
    const body = await response.json() as { error: { code: string } };
    assert.equal(response.status, 401);
    assert.equal(body.error.code, "UNAUTHENTICATED");
  });
});

test("doctor CRUD validates body fields, enforces CSRF and rejects duplicate email", async () => {
  await withServer(async (url) => {
    const noCsrf = await fetch(url + "/api/v1/doctors", {
      method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(validDoctor)
    });
    assert.equal(noCsrf.status, 403);

    const badBody = await fetch(url + "/api/v1/doctors", {
      method: "POST", headers: { ...authHeaders(true), "Content-Type": "application/json" },
      body: JSON.stringify({ ...validDoctor, isAdmin: true })
    });
    assert.equal(badBody.status, 400);

    const created = await fetch(url + "/api/v1/doctors", {
      method: "POST", headers: { ...authHeaders(true), "Content-Type": "application/json" },
      body: JSON.stringify(validDoctor)
    });
    assert.equal(created.status, 201);
    const createdBody = await created.json() as { data: { doctor: DoctorRecord } };
    const id = createdBody.data.doctor.id;
    assert.equal(createdBody.data.doctor.email, "amina@example.com");

    const duplicate = await fetch(url + "/api/v1/doctors", {
      method: "POST", headers: { ...authHeaders(true), "Content-Type": "application/json" },
      body: JSON.stringify({ ...validDoctor, email: "AMINA@example.com" })
    });
    assert.equal(duplicate.status, 409);

    const detail = await fetch(url + "/api/v1/doctors/" + id, { headers: authHeaders() });
    assert.equal(detail.status, 200);
    const missing = await fetch(url + "/api/v1/doctors/ffffffffffffffffffffffff", { headers: authHeaders() });
    assert.equal(missing.status, 404);
    const invalidId = await fetch(url + "/api/v1/doctors/not-an-id", { headers: authHeaders() });
    assert.equal(invalidId.status, 400);

    const patched = await fetch(url + "/api/v1/doctors/" + id, {
      method: "PATCH", headers: { ...authHeaders(true), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Dr. Amina R." })
    });
    assert.equal(patched.status, 200);
    const patchedBody = await patched.json() as { data: { doctor: DoctorRecord } };
    assert.equal(patchedBody.data.doctor.name, "Dr. Amina R.");

    for (const payload of [{}, { password: "no" }, { email: "bad-email" }]) {
      const response = await fetch(url + "/api/v1/doctors/" + id, {
        method: "PATCH", headers: { ...authHeaders(true), "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      assert.equal(response.status, 400);
    }
  });
});

test("doctor list validates bounded pagination, date filters and normalized prefix search", async () => {
  const repo = new MemoryDoctorRepository();
  await repo.create(validDoctor);
  await repo.create({
    name: "Dr. Kamal Hossain", specialization: "Neurology",
    hospital: "North Hospital", phone: "+880 1812-345678", email: "kamal@example.com"
  });
  await withServer(async (url) => {
    const response = await fetch(url + "/api/v1/doctors?search=dr.%20a&specialization=cardiology&hospital=Central%20Hospital&from=2026-01-01&to=2027-12-31&limit=1&page=1", {
      headers: authHeaders()
    });
    const body = await response.json() as { data: { doctors: DoctorRecord[] }; meta: { pagination: { page: number; limit: number; total: number; totalPages: number } } };
    assert.equal(response.status, 200);
    assert.equal(body.data.doctors.length, 1);
    assert.equal(body.meta.pagination.total, 1);
    assert.equal(body.meta.pagination.totalPages, 1);

    const page = await fetch(url + "/api/v1/doctors?page=2&limit=1", { headers: authHeaders() });
    const pageBody = await page.json() as { meta: { pagination: { page: number; limit: number; total: number; totalPages: number } } };
    assert.equal(page.status, 200);
    assert.equal(pageBody.meta.pagination.page, 2);
    assert.equal(pageBody.meta.pagination.total, 2);
    assert.equal(pageBody.meta.pagination.totalPages, 2);

    for (const query of [
      "?limit=101", "?page=0", "?sort=createdAt", "?from=2026-02-30",
      "?from=2026-12-31&to=2026-01-01", "?page=2000&limit=100"
    ]) {
      const invalid = await fetch(url + "/api/v1/doctors" + query, { headers: authHeaders() });
      assert.equal(invalid.status, 400, query);
    }
  }, repo);
});
