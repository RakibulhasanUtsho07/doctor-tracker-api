import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { AddressInfo } from "node:net";
import mongoose from "mongoose";
import { hashPassword } from "../src/auth/password.js";
import { MongooseAuthRepository } from "../src/auth/repository.js";
import type { AppConfig } from "../src/config/env.js";
import { createApp } from "../src/app.js";
import { DoctorModel } from "../src/models/doctor.js";
import { PatientModel } from "../src/models/patient.js";
import { AuthSessionModel } from "../src/models/auth-session.js";
import { UserModel } from "../src/models/user.js";

const uri = process.env.MONGODB_URI;
const dbName = uri?.split("/").pop()?.split("?")[0] ?? "";
const canRun = Boolean(uri && /test/i.test(dbName));

test("MongoDB patient CRUD, doctor references, detach/delete semantics, filters and index evidence", { skip: !canRun }, async () => {
  const runId = randomUUID().replace(/-/g, "");
  const doctorEmailPrefix = "patient-api-ci-" + runId;
  const patientNamePrefix = "patient synthetic " + runId;
  const adminEmail = "patient-admin-" + runId + "@example.com";
  const password = "Strong patient integration password 2026!";
  let userId: mongoose.Types.ObjectId | undefined;

  await mongoose.connect(uri as string, { serverSelectionTimeoutMS: 5_000 });
  try {
    assert.match(mongoose.connection.name ?? "", /test/i, "refuse to run against a database without 'test' in its name");
    await Promise.all([UserModel.init(), AuthSessionModel.init(), DoctorModel.init(), PatientModel.init()]);
    const user = await UserModel.create({
      emailNormalized: adminEmail,
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      isActive: true
    });
    userId = user._id;

    const doctorOne = await DoctorModel.create({
      name: "Patient API Doctor One",
      nameNormalized: "patient api doctor one",
      specialization: "General Medicine",
      specializationNormalized: "general medicine",
      hospital: "Patient Test Hospital",
      hospitalNormalized: "patient test hospital",
      phone: "+880 1700-100001",
      emailNormalized: doctorEmailPrefix + "-one@example.com"
    });
    const doctorTwo = await DoctorModel.create({
      name: "Patient API Doctor Two",
      nameNormalized: "patient api doctor two",
      specialization: "General Medicine",
      specializationNormalized: "general medicine",
      hospital: "Patient Test Hospital",
      hospitalNormalized: "patient test hospital",
      phone: "+880 1700-100002",
      emailNormalized: doctorEmailPrefix + "-two@example.com"
    });

    const baseTime = Date.now();
    const synthetic = Array.from({ length: 150 }, (_unused, index) => {
      const name = patientNamePrefix + " " + String(index).padStart(3, "0");
      const condition = "Condition-" + (index % 5);
      const createdAt = new Date(baseTime - index * 1000);
      return {
        doctorId: doctorOne._id,
        name,
        nameNormalized: name.toLowerCase(),
        condition,
        conditionNormalized: condition.toLowerCase(),
        createdAt,
        updatedAt: createdAt
      };
    });
    await PatientModel.insertMany(synthetic, { ordered: true });

    const config: AppConfig = {
      nodeEnv: "test",
      port: 4000,
      mongoUri: uri as string,
      frontendOrigins: ["http://localhost:3000"]
    };
    const server = createApp(config, new MongooseAuthRepository()).listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Integration server did not bind to a TCP port.");
    const baseUrl = "http://127.0.0.1:" + (address as AddressInfo).port;
    const oneId = String(doctorOne._id);
    const twoId = String(doctorTwo._id);

    try {
      const anonymous = await fetch(baseUrl + "/api/v1/patients");
      assert.equal(anonymous.status, 401);

      const loginResponse = await fetch(baseUrl + "/api/v1/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, password })
      });
      assert.equal(loginResponse.status, 200);
      const loginBody = await loginResponse.json() as { data: { csrfToken: string } };
      const cookieHeader = loginResponse.headers.get("set-cookie");
      assert.ok(cookieHeader);
      const cookiePair = cookieHeader.split(";")[0] ?? "";
      assert.ok(cookiePair.startsWith("dt_session="));
      const headers = { Cookie: cookiePair };
      const writeHeaders = { ...headers, "X-CSRF-Token": loginBody.data.csrfToken, "Content-Type": "application/json" };

      const invalidRef = await fetch(baseUrl + "/api/v1/patients", {
        method: "POST", headers: writeHeaders,
        body: JSON.stringify({ doctorId: "ffffffffffffffffffffffff", name: "No Doctor Patient" })
      });
      assert.equal(invalidRef.status, 404);

      const list = await fetch(baseUrl + "/api/v1/patients?doctorId=" + oneId + "&condition=condition-1&search=patient%20synthetic&limit=10&page=2&from=2026-01-01&to=2027-12-31", { headers });
      const listBody = await list.json() as { data: { patients: Array<{ id: string; doctorId: string }> }; meta: { pagination: { total: number; totalPages: number; page: number; limit: number } } };
      assert.equal(list.status, 200);
      assert.equal(listBody.meta.pagination.total, 30);
      assert.equal(listBody.meta.pagination.totalPages, 3);
      assert.equal(listBody.meta.pagination.page, 2);
      assert.equal(listBody.data.patients.length, 10);
      assert.ok(listBody.data.patients.every((patient) => patient.doctorId === oneId));

      const associated = await fetch(baseUrl + "/api/v1/doctors/" + oneId + "/patients?search=patient%20synthetic&limit=10&page=2", { headers });
      const associatedBody = await associated.json() as { data: { patients: Array<{ id: string }> }; meta: { pagination: { total: number; page: number; limit: number } } };
      assert.equal(associated.status, 200);
      assert.equal(associatedBody.meta.pagination.total, 150);
      assert.equal(associatedBody.data.patients.length, 10);

      const created = await fetch(baseUrl + "/api/v1/patients", {
        method: "POST", headers: writeHeaders,
        body: JSON.stringify({ doctorId: oneId, name: patientNamePrefix + " API Created", condition: "Follow Up" })
      });
      assert.equal(created.status, 201);
      const createdBody = await created.json() as { data: { patient: { id: string; doctorId: string; condition: string } } };
      const patientId = createdBody.data.patient.id;
      assert.equal(createdBody.data.patient.doctorId, oneId);
      assert.equal(createdBody.data.patient.condition, "Follow Up");

      const patched = await fetch(baseUrl + "/api/v1/patients/" + patientId, {
        method: "PATCH", headers: writeHeaders, body: JSON.stringify({ doctorId: twoId, name: patientNamePrefix + " Reassigned" })
      });
      assert.equal(patched.status, 200);
      const newAssociation = await fetch(baseUrl + "/api/v1/doctors/" + twoId + "/patients?search=" + encodeURIComponent(patientNamePrefix) + "&limit=10", { headers });
      assert.equal(newAssociation.status, 200);
      assert.equal((await newAssociation.json() as { meta: { pagination: { total: number } } }).meta.pagination.total, 1);

      const detached = await fetch(baseUrl + "/api/v1/doctors/" + twoId + "/patients/" + patientId, { method: "DELETE", headers: writeHeaders });
      assert.equal(detached.status, 204);
      const preserved = await fetch(baseUrl + "/api/v1/patients/" + patientId, { headers });
      assert.equal(preserved.status, 200);
      assert.equal((await preserved.json() as { data: { patient: { doctorId: string | null } } }).data.patient.doctorId, null);

      const deleted = await fetch(baseUrl + "/api/v1/patients/" + patientId, { method: "DELETE", headers: writeHeaders });
      assert.equal(deleted.status, 204);
      const absent = await fetch(baseUrl + "/api/v1/patients/" + patientId, { headers });
      assert.equal(absent.status, 404);

      const explain = await PatientModel.find({ doctorId: doctorOne._id })
        .sort({ createdAt: -1, _id: -1 })
        .limit(20)
        .explain("executionStats") as unknown as {
          queryPlanner: { winningPlan: unknown };
          executionStats: { executionTimeMillis: number; totalDocsExamined: number; nReturned: number };
        };
      const stats = explain.executionStats;
      const planText = JSON.stringify(explain.queryPlanner.winningPlan);
      process.stdout.write("PATIENT_EXPLAIN_EVIDENCE " + JSON.stringify({
        seededRecords: synthetic.length,
        indexName: "patient_doctor_created_idx",
        winningPlanMentionsIndex: planText.includes("patient_doctor_created_idx"),
        executionTimeMillis: stats.executionTimeMillis,
        totalDocsExamined: stats.totalDocsExamined,
        nReturned: stats.nReturned
      }) + "\n");
      const hintedExplain = await PatientModel.find({ doctorId: doctorOne._id })
        .sort({ createdAt: -1, _id: -1 })
        .limit(20)
        .hint("patient_doctor_created_idx")
        .explain("executionStats") as unknown as {
          queryPlanner: { winningPlan: unknown };
          executionStats: { totalDocsExamined: number; nReturned: number };
        };
      assert.ok(JSON.stringify(hintedExplain.queryPlanner.winningPlan).includes("patient_doctor_created_idx"));
      assert.ok(hintedExplain.executionStats.totalDocsExamined <= 20);
      assert.equal(hintedExplain.executionStats.nReturned, 20);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  } finally {
    await PatientModel.deleteMany({ nameNormalized: { $regex: "^" + patientNamePrefix } }).exec().catch(() => undefined);
    await DoctorModel.deleteMany({ emailNormalized: { $regex: "^" + doctorEmailPrefix } }).exec().catch(() => undefined);
    if (userId) {
      await AuthSessionModel.deleteMany({ userId }).exec().catch(() => undefined);
      await UserModel.deleteOne({ _id: userId }).exec().catch(() => undefined);
    }
    await mongoose.disconnect();
  }
});
