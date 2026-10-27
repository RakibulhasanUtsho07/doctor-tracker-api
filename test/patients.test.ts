import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { AppConfig } from "../src/config/env.js";
import { hashSessionToken, SESSION_TTL_MS } from "../src/auth/session.js";
import type { AuthRepository, AuthSession, AuthUser, AuthUserWithPassword } from "../src/auth/repository.js";
import type { DoctorInput, DoctorListQuery, DoctorListResult, DoctorPatch, DoctorRecord, DoctorRepository } from "../src/doctors/repository.js";
import type { PatientInput, PatientListQuery, PatientListResult, PatientPatch, PatientRecord, PatientRepository } from "../src/patients/repository.js";
import { createApp } from "../src/app.js";

const config: AppConfig = {
  nodeEnv: "test",
  port: 4000,
  mongoUri: "mongodb://127.0.0.1:27017/doctor_tracker_test",
  frontendOrigins: ["http://localhost:3000"]
};
const token = "B".repeat(43);
const csrf = "patient-csrf-token-123456789012345678901234567890";
const user: AuthUser = { id: "aaaaaaaaaaaaaaaaaaaaaaaa", email: "admin@example.com", role: "ADMIN", isActive: true };
const doctorId1 = "111111111111111111111111";
const doctorId2 = "222222222222222222222222";

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
  constructor() {
    const now = new Date();
    this.records.set(doctorId1, {
      id: doctorId1, name: "Dr. One", specialization: "Cardiology",
      hospital: "Central Hospital", phone: "+880 1712-111111",
      email: "one@example.com", createdAt: now, updatedAt: now
    });
    this.records.set(doctorId2, {
      id: doctorId2, name: "Dr. Two", specialization: "Neurology",
      hospital: "North Hospital", phone: "+880 1712-222222",
      email: "two@example.com", createdAt: now, updatedAt: now
    });
  }
  async list(_query: DoctorListQuery): Promise<DoctorListResult> { return { doctors: [...this.records.values()], total: this.records.size }; }
  async create(input: DoctorInput): Promise<DoctorRecord> {
    const now = new Date();
    const id = "333333333333333333333333";
    const doctor = { id, ...input, createdAt: now, updatedAt: now };
    this.records.set(id, doctor);
    return doctor;
  }
  async findById(id: string): Promise<DoctorRecord | null> { return this.records.get(id) ?? null; }
  async update(id: string, input: DoctorPatch): Promise<DoctorRecord | null> {
    const existing = this.records.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...input, updatedAt: new Date() };
    this.records.set(id, updated);
    return updated;
  }
}

class MemoryPatientRepository implements PatientRepository {
  records = new Map<string, PatientRecord>();
  counter = 0;
  async list(query: PatientListQuery): Promise<PatientListResult> {
    const normalize = (value: string) => value.normalize("NFKC").trim().toLowerCase();
    let records = [...this.records.values()];
    if (query.doctorId !== undefined) records = records.filter((patient) => patient.doctorId === query.doctorId);
    if (query.condition !== undefined) records = records.filter((patient) => normalize(patient.condition ?? "") === normalize(query.condition as string));
    if (query.search !== undefined) {
      const search = normalize(query.search);
      records = records.filter((patient) => patient.name && (
        normalize(patient.name).startsWith(search) || normalize(patient.condition ?? "").startsWith(search)
      ));
    }
    if (query.from) records = records.filter((patient) => patient.createdAt >= (query.from as Date));
    if (query.toExclusive) records = records.filter((patient) => patient.createdAt < (query.toExclusive as Date));
    records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
    return { patients: records.slice((query.page - 1) * query.limit, query.page * query.limit), total: records.length };
  }
  async create(input: PatientInput): Promise<PatientRecord> {
    this.counter += 1;
    const id = this.counter.toString(16).padStart(24, "0");
    const now = new Date();
    const patient: PatientRecord = {
      id, doctorId: input.doctorId, name: input.name,
      ...(input.condition !== undefined ? { condition: input.condition } : {}),
      createdAt: now, updatedAt: now
    };
    this.records.set(id, patient);
    return patient;
  }
  async findById(id: string): Promise<PatientRecord | null> { return this.records.get(id) ?? null; }
  async update(id: string, input: PatientPatch): Promise<PatientRecord | null> {
    const existing = this.records.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...input, updatedAt: new Date() };
    this.records.set(id, updated);
    return updated;
  }
  async deleteById(id: string): Promise<boolean> { return this.records.delete(id); }
  async detachFromDoctor(doctorId: string, patientId: string): Promise<boolean> {
    const existing = this.records.get(patientId);
    if (!existing || existing.doctorId !== doctorId) return false;
    this.records.set(patientId, { ...existing, doctorId: null, updatedAt: new Date() });
    return true;
  }
}

async function withServer(
  run: (url: string) => Promise<void>,
  patientRepo = new MemoryPatientRepository(),
  doctorRepo = new MemoryDoctorRepository(),
  authRepo = new MemoryAuthRepository()
) {
  const server = createApp(config, authRepo, doctorRepo, patientRepo).listen(0, "127.0.0.1");
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
  return { Cookie: "dt_session=" + token, ...(withCsrf ? { "X-CSRF-Token": csrf } : {}) };
}
const validPatient = { doctorId: doctorId1, name: "Patient Example", condition: "Hypertension" };

test("patient and doctor-patient routes require an active administrator", async () => {
  await withServer(async (url) => {
    for (const path of ["/api/v1/patients", "/api/v1/doctors/" + doctorId1 + "/patients"]) {
      const response = await fetch(url + path);
      assert.equal(response.status, 401, path);
    }
  });
});

test("patient CRUD validates explicit fields and doctor references; deletion removes the record", async () => {
  await withServer(async (url) => {
    const denied = await fetch(url + "/api/v1/patients", {
      method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(validPatient)
    });
    assert.equal(denied.status, 403);

    const unknownField = await fetch(url + "/api/v1/patients", {
      method: "POST", headers: { ...authHeaders(true), "Content-Type": "application/json" },
      body: JSON.stringify({ ...validPatient, email: "patient@example.com" })
    });
    assert.equal(unknownField.status, 400);

    const missingDoctor = await fetch(url + "/api/v1/patients", {
      method: "POST", headers: { ...authHeaders(true), "Content-Type": "application/json" },
      body: JSON.stringify({ ...validPatient, doctorId: "ffffffffffffffffffffffff" })
    });
    assert.equal(missingDoctor.status, 404);

    const created = await fetch(url + "/api/v1/patients", {
      method: "POST", headers: { ...authHeaders(true), "Content-Type": "application/json" },
      body: JSON.stringify(validPatient)
    });
    assert.equal(created.status, 201);
    const createdBody = await created.json() as { data: { patient: PatientRecord } };
    const id = createdBody.data.patient.id;
    assert.equal(createdBody.data.patient.doctorId, doctorId1);
    assert.equal(Object.hasOwn(createdBody.data.patient, "email"), false);

    const badDoctorPatch = await fetch(url + "/api/v1/patients/" + id, {
      method: "PATCH", headers: { ...authHeaders(true), "Content-Type": "application/json" },
      body: JSON.stringify({ doctorId: "ffffffffffffffffffffffff" })
    });
    assert.equal(badDoctorPatch.status, 404);

    const patched = await fetch(url + "/api/v1/patients/" + id, {
      method: "PATCH", headers: { ...authHeaders(true), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Patient Updated", condition: "Migraine" })
    });
    assert.equal(patched.status, 200);
    const patchedBody = await patched.json() as { data: { patient: PatientRecord } };
    assert.equal(patchedBody.data.patient.name, "Patient Updated");
    assert.equal(patchedBody.data.patient.condition, "Migraine");

    const deleted = await fetch(url + "/api/v1/patients/" + id, {
      method: "DELETE", headers: authHeaders(true)
    });
    assert.equal(deleted.status, 204);
    const missing = await fetch(url + "/api/v1/patients/" + id, { headers: authHeaders() });
    assert.equal(missing.status, 404);
    const invalidId = await fetch(url + "/api/v1/patients/not-an-id", { headers: authHeaders() });
    assert.equal(invalidId.status, 400);
  });
});

test("patient filtering is bounded and removing a doctor association detaches without deleting", async () => {
  const patients = new MemoryPatientRepository();
  await patients.create(validPatient);
  await patients.create({ doctorId: doctorId1, name: "Patient Second", condition: "Migraine" });
  await patients.create({ doctorId: doctorId2, name: "Other Patient", condition: "Migraine" });
  await withServer(async (url) => {
    const list = await fetch(url + "/api/v1/patients?doctorId=" + doctorId1 + "&condition=hypertension&search=patient&from=2026-01-01&to=2027-12-31&limit=1", {
      headers: authHeaders()
    });
    const body = await list.json() as { data: { patients: PatientRecord[] }; meta: { pagination: { total: number; totalPages: number; limit: number } } };
    assert.equal(list.status, 200);
    assert.equal(body.data.patients.length, 1);
    assert.equal(body.data.patients[0]?.doctorId, doctorId1);
    assert.equal(body.meta.pagination.total, 1);
    assert.equal(body.meta.pagination.totalPages, 1);

    const associated = await fetch(url + "/api/v1/doctors/" + doctorId1 + "/patients?limit=1&page=2", {
      headers: authHeaders()
    });
    const associatedBody = await associated.json() as { data: { patients: PatientRecord[] }; meta: { pagination: { total: number; page: number } } };
    assert.equal(associated.status, 200);
    assert.equal(associatedBody.meta.pagination.total, 2);
    assert.equal(associatedBody.meta.pagination.page, 2);
    assert.equal(associatedBody.data.patients.length, 1);

    for (const query of ["?limit=101", "?page=0", "?page=2000&limit=100", "?from=2026-02-30", "?from=2026-12-31&to=2026-01-01", "?extra=1"]) {
      const response = await fetch(url + "/api/v1/patients" + query, { headers: authHeaders() });
      assert.equal(response.status, 400, query);
    }

    const targetId = associatedBody.data.patients[0]?.id;
    assert.ok(targetId);
    const noCsrf = await fetch(url + "/api/v1/doctors/" + doctorId1 + "/patients/" + targetId, {
      method: "DELETE", headers: authHeaders()
    });
    assert.equal(noCsrf.status, 403);
    const detached = await fetch(url + "/api/v1/doctors/" + doctorId1 + "/patients/" + targetId, {
      method: "DELETE", headers: authHeaders(true)
    });
    assert.equal(detached.status, 204);

    const preserved = await fetch(url + "/api/v1/patients/" + targetId, { headers: authHeaders() });
    assert.equal(preserved.status, 200);
    const preservedBody = await preserved.json() as { data: { patient: PatientRecord } };
    assert.equal(preservedBody.data.patient.doctorId, null);

    const wrongAssociation = await fetch(url + "/api/v1/doctors/" + doctorId1 + "/patients/" + targetId, {
      method: "DELETE", headers: authHeaders(true)
    });
    assert.equal(wrongAssociation.status, 404);
  }, patients);
});
