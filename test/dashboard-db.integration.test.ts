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
const configuredDbName = uri ? new URL(uri).pathname.replace(/^\//, "") : "";
const canRun = Boolean(uri && /test/i.test(configuredDbName));
const DAY_MS = 86_400_000;

interface ExplainStats {
  executionTimeMillis: number;
  totalDocsExamined: number;
  nReturned: number;
}

function findExecutionStats(value: unknown): ExplainStats | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const stats = record.executionStats;
  if (typeof stats === "object" && stats !== null) {
    const candidate = stats as Record<string, unknown>;
    if (
      typeof candidate.executionTimeMillis === "number" &&
      typeof candidate.totalDocsExamined === "number" &&
      typeof candidate.nReturned === "number"
    ) {
      return {
        executionTimeMillis: candidate.executionTimeMillis,
        totalDocsExamined: candidate.totalDocsExamined,
        nReturned: candidate.nReturned
      };
    }
  }
  for (const child of Object.values(record)) {
    const found = findExecutionStats(child);
    if (found) return found;
  }
  return null;
}

function utcDay(offset: number, todayStart: Date): Date {
  return new Date(todayStart.getTime() + offset * DAY_MS);
}

function doctorDocument(name: string, email: string, phone: string, createdAt: Date) {
  return {
    name,
    nameNormalized: name.normalize("NFKC").trim().toLowerCase(),
    specialization: "General Medicine",
    specializationNormalized: "general medicine",
    hospital: "Dashboard Test Hospital",
    hospitalNormalized: "dashboard test hospital",
    phone,
    emailNormalized: email,
    createdAt,
    updatedAt: createdAt
  };
}

function patientDocument(
  doctorId: mongoose.Types.ObjectId | null,
  name: string,
  condition: string,
  createdAt: Date
) {
  return {
    doctorId,
    name,
    nameNormalized: name.normalize("NFKC").trim().toLowerCase(),
    condition,
    conditionNormalized: condition.normalize("NFKC").trim().toLowerCase(),
    createdAt,
    updatedAt: createdAt
  };
}

test("MongoDB dashboard reconciles totals, doctor counts, UTC boundaries and indexed date aggregates", { skip: !canRun }, async () => {
  const runId = randomUUID().replace(/-/g, "");
  const testUrl = new URL(uri as string);
  testUrl.pathname = "/doctor_tracker_dashboard_test_" + runId;
  const testUri = testUrl.toString();
  const adminEmail = "dashboard-admin-" + runId + "@example.com";
  const password = "Strong dashboard integration password 2026!";
  let userId: mongoose.Types.ObjectId | undefined;

  await mongoose.connect(testUri, { serverSelectionTimeoutMS: 5_000 });
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

    const config: AppConfig = {
      nodeEnv: "test",
      port: 4000,
      mongoUri: testUri,
      frontendOrigins: ["http://localhost:3000"]
    };
    const server = createApp(config, new MongooseAuthRepository()).listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Integration server did not bind to a TCP port.");
    const baseUrl = "http://127.0.0.1:" + (address as AddressInfo).port;

    try {
      const loginResponse = await fetch(baseUrl + "/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, password })
      });
      assert.equal(loginResponse.status, 200);
      const loginBody = await loginResponse.json() as { data: { csrfToken: string } };
      const cookieHeader = loginResponse.headers.get("set-cookie");
      assert.ok(cookieHeader);
      const cookiePair = cookieHeader.split(";")[0] ?? "";
      assert.ok(cookiePair.startsWith("dt_session="));
      const headers = { Cookie: cookiePair };

      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const yesterdayStart = utcDay(-1, todayStart);
      const twoDaysAgoStart = utcDay(-2, todayStart);
      const todayText = todayStart.toISOString().slice(0, 10);
      const yesterdayText = yesterdayStart.toISOString().slice(0, 10);
      const twoDaysAgoText = twoDaysAgoStart.toISOString().slice(0, 10);

      const emptyResponse = await fetch(
        baseUrl + "/api/v1/dashboard/summary?from=" + todayText + "&to=" + todayText,
        { headers }
      );
      const emptyBody = await emptyResponse.json() as {
        data: {
          totals: { doctors: number; patients: number };
          patientsPerDoctor: unknown[];
          dateStatistics: { days: Array<{ doctorsCreated: number; patientsCreated: number }> };
        };
      };
      assert.equal(emptyResponse.status, 200);
      assert.deepEqual(emptyBody.data.totals, { doctors: 0, patients: 0 });
      assert.equal(emptyBody.data.patientsPerDoctor.length, 0);
      assert.deepEqual(emptyBody.data.dateStatistics.days, [{ date: todayText, doctorsCreated: 0, patientsCreated: 0 }]);

      const doctorDocs = [
        doctorDocument("Dashboard " + runId + " Alpha", "dashboard-" + runId + "-alpha@example.com", "+880-1000001", twoDaysAgoStart),
        doctorDocument("Dashboard " + runId + " Beta", "dashboard-" + runId + "-beta@example.com", "+880-1000002", yesterdayStart),
        doctorDocument("Dashboard " + runId + " Gamma", "dashboard-" + runId + "-gamma@example.com", "+880-1000003", todayStart)
      ];
      for (let index = 0; index < 300; index += 1) {
        const name = "Dashboard " + runId + " Synthetic Doctor " + String(index).padStart(3, "0");
        const createdAt = new Date(todayStart.getTime() - ((index % 120) + 3) * DAY_MS + index * 1000);
        const suffix = String(index).padStart(3, "0");
        doctorDocs.push(doctorDocument(
          name,
          "dashboard-" + runId + "-synthetic-" + suffix + "@example.com",
          "+880-2" + suffix.padStart(5, "0"),
          createdAt
        ));
      }
      const doctors = await DoctorModel.insertMany(doctorDocs, { ordered: true, timestamps: false });
      const alpha = doctors[0];
      const beta = doctors[1];
      const gamma = doctors[2];
      assert.ok(alpha && beta && gamma);

      const patientDocs = [
        patientDocument(alpha._id, "Dashboard " + runId + " Alpha Patient One", "Hypertension", twoDaysAgoStart),
        patientDocument(alpha._id, "Dashboard " + runId + " Alpha Patient Two", "Migraine", yesterdayStart),
        patientDocument(beta._id, "Dashboard " + runId + " Beta Patient", "Asthma", new Date(todayStart.getTime() - 1)),
        patientDocument(null, "Dashboard " + runId + " Detached Patient", "Follow Up", todayStart)
      ];
      for (let index = 0; index < 150; index += 1) {
        const name = "Dashboard " + runId + " Synthetic Patient " + String(index).padStart(3, "0");
        const createdAt = new Date(todayStart.getTime() - ((index % 120) + 3) * DAY_MS + index * 1000);
        const assignedDoctor = doctors[index + 3];
        assert.ok(assignedDoctor);
        patientDocs.push(patientDocument(assignedDoctor._id, name, "Synthetic Condition", createdAt));
      }
      await PatientModel.insertMany(patientDocs, { ordered: true, timestamps: false });

      const response = await fetch(
        baseUrl + "/api/v1/dashboard/summary?from=" + twoDaysAgoText + "&to=" + yesterdayText,
        { headers }
      );
      const body = await response.json() as {
        data: {
          totals: { doctors: number; patients: number };
          patientsPerDoctor: Array<{ doctorId: string; doctorName: string; patientCount: number }>;
          dateStatistics: { from: string; to: string; days: Array<{ date: string; doctorsCreated: number; patientsCreated: number }> };
        };
      };
      assert.equal(response.status, 200);
      assert.deepEqual(body.data.totals, { doctors: 303, patients: 154 });
      assert.equal(body.data.patientsPerDoctor.length, 303);

      const countById = new Map(body.data.patientsPerDoctor.map((row) => [row.doctorId, row.patientCount]));
      assert.equal(countById.get(String(alpha._id)), 2);
      assert.equal(countById.get(String(beta._id)), 1);
      assert.equal(countById.get(String(gamma._id)), 0);
      assert.equal(
        body.data.patientsPerDoctor.reduce((total, row) => total + row.patientCount, 0),
        153,
        "detached patients count toward all-time patient totals but not per-doctor associations"
      );

      assert.equal(body.data.dateStatistics.from, twoDaysAgoText);
      assert.equal(body.data.dateStatistics.to, yesterdayText);
      assert.deepEqual(body.data.dateStatistics.days, [
        { date: twoDaysAgoText, doctorsCreated: 1, patientsCreated: 1 },
        { date: yesterdayText, doctorsCreated: 1, patientsCreated: 2 }
      ]);

      const invalid = await fetch(baseUrl + "/api/v1/dashboard/summary?from=" + twoDaysAgoText + "&to=" + todayText + "&fields=patientName", { headers });
      assert.equal(invalid.status, 400);

      const doctorPipeline = [
        { $match: { createdAt: { $gte: twoDaysAgoStart, $lt: todayStart } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: "UTC"
              }
            },
            count: { $sum: 1 }
          }
        }
      ];
      const patientPipeline = [
        { $match: { createdAt: { $gte: twoDaysAgoStart, $lt: todayStart } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: "UTC"
              }
            },
            count: { $sum: 1 }
          }
        }
      ];
      const [doctorExplain, patientExplain, lookupExplain] = await Promise.all([
        DoctorModel.aggregate(doctorPipeline).hint("doctor_created_desc_idx").explain("executionStats") as Promise<unknown>,
        PatientModel.aggregate(patientPipeline).hint("patient_created_desc_idx").explain("executionStats") as Promise<unknown>,
        DoctorModel.aggregate([
          {
            $lookup: {
              from: PatientModel.collection.name,
              let: { currentDoctorId: "$_id" },
              pipeline: [
                { $match: { $expr: { $eq: ["$doctorId", "$$currentDoctorId"] } } },
                { $count: "patientCount" }
              ],
              as: "patientStats"
            }
          },
          { $project: { _id: 1, name: 1, patientCount: { $ifNull: [{ $arrayElemAt: ["$patientStats.patientCount", 0] }, 0] } } }
        ]).explain("executionStats") as Promise<unknown>
      ]);

      const doctorPlanText = JSON.stringify(doctorExplain);
      const patientPlanText = JSON.stringify(patientExplain);
      const lookupPlanText = JSON.stringify(lookupExplain);
      assert.ok(doctorPlanText.includes("doctor_created_desc_idx"));
      assert.ok(patientPlanText.includes("patient_created_desc_idx"));
      assert.ok(lookupPlanText.includes("patient_doctor_created_idx"));

      const doctorStats = findExecutionStats(doctorExplain);
      const patientStats = findExecutionStats(patientExplain);
      assert.ok(doctorStats);
      assert.ok(patientStats);
      assert.ok(doctorStats.totalDocsExamined <= 2);
      assert.ok(patientStats.totalDocsExamined <= 3);
      process.stdout.write("DASHBOARD_EXPLAIN_EVIDENCE " + JSON.stringify({
        persistedDoctors: doctors.length,
        persistedPatients: patientDocs.length,
        dateRangeDays: 2,
        doctorDateIndex: "doctor_created_desc_idx",
        doctorDateIndexExecutionTimeMillis: doctorStats.executionTimeMillis,
        doctorDateIndexDocsExamined: doctorStats.totalDocsExamined,
        doctorDateIndexReturned: doctorStats.nReturned,
        patientDateIndex: "patient_created_desc_idx",
        patientDateIndexExecutionTimeMillis: patientStats.executionTimeMillis,
        patientDateIndexDocsExamined: patientStats.totalDocsExamined,
        patientDateIndexReturned: patientStats.nReturned,
        patientCountLookupIndex: "patient_doctor_created_idx",
        patientCountLookupIndexFound: lookupPlanText.includes("patient_doctor_created_idx")
      }) + "\n");
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  } finally {
    await mongoose.connection.dropDatabase().catch(() => undefined);
    await mongoose.disconnect().catch(() => undefined);
  }
});
