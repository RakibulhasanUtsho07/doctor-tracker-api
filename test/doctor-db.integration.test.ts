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
import { AuthSessionModel } from "../src/models/auth-session.js";
import { UserModel } from "../src/models/user.js";

const uri = process.env.MONGODB_URI;
const dbName = uri?.split("/").pop()?.split("?")[0] ?? "";
const canRun = Boolean(uri && /test/i.test(dbName));

test("MongoDB doctor CRUD, duplicate policy, indexed filters and bounded pagination", { skip: !canRun }, async () => {
  const runId = randomUUID().replace(/-/g, "");
  const emailPrefix = "doctor-ci-" + runId;
  const email = emailPrefix + "@example.com";
  const password = "Strong integration password 2026!";
  let userId: mongoose.Types.ObjectId | undefined;

  await mongoose.connect(uri as string, { serverSelectionTimeoutMS: 5_000 });
  try {
    assert.match(mongoose.connection.name ?? "", /test/i, "refuse to run against a database without 'test' in its name");
    await Promise.all([UserModel.init(), AuthSessionModel.init(), DoctorModel.init()]);
    const user = await UserModel.create({
      emailNormalized: email,
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      isActive: true
    });
    userId = user._id;

    const baseTime = Date.now();
    const synthetic = Array.from({ length: 300 }, (_unused, index) => {
      const name = "Synthetic Doctor " + String(index).padStart(3, "0");
      const specialization = index % 3 === 0 ? "Cardiology" : index % 3 === 1 ? "Pediatrics" : "Neurology";
      const hospital = index % 2 === 0 ? "Central Hospital" : "North Hospital";
      const suffix = String(index).padStart(3, "0");
      const createdAt = new Date(baseTime - index * 1000);
      return {
        name,
        nameNormalized: name.toLowerCase(),
        specialization,
        specializationNormalized: specialization.toLowerCase(),
        hospital,
        hospitalNormalized: hospital.toLowerCase(),
        phone: "+880 1700-" + suffix,
        emailNormalized: emailPrefix + "-" + suffix + "@example.com",
        createdAt,
        updatedAt: createdAt
      };
    });
    await DoctorModel.insertMany(synthetic, { ordered: true });

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

    try {
      const anonymous = await fetch(baseUrl + "/api/v1/doctors");
      assert.equal(anonymous.status, 401);

      const loginResponse = await fetch(baseUrl + "/api/v1/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      assert.equal(loginResponse.status, 200);
      const loginBody = await loginResponse.json() as { data: { csrfToken: string } };
      const cookieHeader = loginResponse.headers.get("set-cookie");
      assert.ok(cookieHeader);
      const cookiePair = cookieHeader.split(";")[0] ?? "";
      assert.ok(cookiePair.startsWith("dt_session="));
      const headers = { Cookie: cookiePair };
      const writeHeaders = { ...headers, "X-CSRF-Token": loginBody.data.csrfToken, "Content-Type": "application/json" };

      const listed = await fetch(baseUrl + "/api/v1/doctors?search=Synthetic%20Doctor&limit=10&page=2", { headers });
      const listBody = await listed.json() as { data: { doctors: Array<{ id: string }> }; meta: { pagination: { total: number; totalPages: number; page: number; limit: number } } };
      assert.equal(listed.status, 200);
      assert.equal(listBody.meta.pagination.total, 300);
      assert.equal(listBody.meta.pagination.totalPages, 30);
      assert.equal(listBody.meta.pagination.page, 2);
      assert.equal(listBody.data.doctors.length, 10);

      const filtered = await fetch(baseUrl + "/api/v1/doctors?specialization=cardiology&hospital=Central%20Hospital&from=2026-01-01&to=2027-12-31&limit=20", { headers });
      const filteredBody = await filtered.json() as { data: { doctors: Array<{ email: string; specialization: string }> }; meta: { pagination: { total: number } } };
      assert.equal(filtered.status, 200);
      assert.ok(filteredBody.meta.pagination.total > 0);
      assert.ok(filteredBody.data.doctors.every((doctor) => doctor.specialization === "Cardiology"));

      const created = await fetch(baseUrl + "/api/v1/doctors", {
        method: "POST", headers: writeHeaders,
        body: JSON.stringify({
          name: "Dr. Integration Record",
          specialization: "Cardiology",
          hospital: "Central Hospital",
          phone: "+880 1712-111222",
          email: emailPrefix + "-created@example.com"
        })
      });
      assert.equal(created.status, 201);
      const createdBody = await created.json() as { data: { doctor: { id: string; email: string } } };
      const doctorId = createdBody.data.doctor.id;

      const duplicate = await fetch(baseUrl + "/api/v1/doctors", {
        method: "POST", headers: writeHeaders,
        body: JSON.stringify({
          name: "Dr. Duplicate",
          specialization: "Cardiology",
          hospital: "Central Hospital",
          phone: "+880 1712-999999",
          email: (emailPrefix + "-created@example.com").toUpperCase()
        })
      });
      assert.equal(duplicate.status, 409);

      const updated = await fetch(baseUrl + "/api/v1/doctors/" + doctorId, {
        method: "PATCH", headers: writeHeaders, body: JSON.stringify({ name: "Dr. Integration Updated" })
      });
      assert.equal(updated.status, 200);
      const detail = await fetch(baseUrl + "/api/v1/doctors/" + doctorId, { headers });
      assert.equal(detail.status, 200);
      assert.equal((await detail.json() as { data: { doctor: { name: string } } }).data.doctor.name, "Dr. Integration Updated");

      const invalidLimit = await fetch(baseUrl + "/api/v1/doctors?limit=101", { headers });
      assert.equal(invalidLimit.status, 400);

      const query = DoctorModel.find({ specializationNormalized: "cardiology" })
        .sort({ createdAt: -1, _id: -1 }).limit(20);
      const explain = await query.explain("executionStats") as unknown as {
        queryPlanner: { winningPlan: unknown };
        executionStats: { executionTimeMillis: number; totalDocsExamined: number; nReturned: number };
      };
      const stats = explain.executionStats as { executionTimeMillis: number; totalDocsExamined: number; nReturned: number };
      const planText = JSON.stringify(explain.queryPlanner.winningPlan);
      process.stdout.write("DOCTOR_EXPLAIN_EVIDENCE " + JSON.stringify({
        seededRecords: synthetic.length,
        indexName: "doctor_specialization_created_idx",
        winningPlanMentionsIndex: planText.includes("doctor_specialization_created_idx"),
        executionTimeMillis: stats.executionTimeMillis,
        totalDocsExamined: stats.totalDocsExamined,
        nReturned: stats.nReturned
      }) + "\n");
      const hintedExplain = await DoctorModel.find({ specializationNormalized: "cardiology" })
        .sort({ createdAt: -1, _id: -1 })
        .limit(20)
        .hint("doctor_specialization_created_idx")
        .explain("executionStats") as unknown as {
          queryPlanner: { winningPlan: unknown };
          executionStats: { totalDocsExamined: number; nReturned: number };
        };
      assert.ok(JSON.stringify(hintedExplain.queryPlanner.winningPlan).includes("doctor_specialization_created_idx"));
      const hintedStats = hintedExplain.executionStats as { totalDocsExamined: number; nReturned: number };
      assert.ok(hintedStats.totalDocsExamined <= 20);
      assert.equal(hintedStats.nReturned, 20);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  } finally {
    await DoctorModel.deleteMany({ emailNormalized: { $regex: "^doctor-ci-" + runId } }).exec().catch(() => undefined);
    if (userId) {
      await AuthSessionModel.deleteMany({ userId }).exec().catch(() => undefined);
      await UserModel.deleteOne({ _id: userId }).exec().catch(() => undefined);
    }
    await mongoose.disconnect();
  }
});
