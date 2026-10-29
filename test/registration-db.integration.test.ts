import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { AddressInfo } from "node:net";
import mongoose from "mongoose";
import { MongooseAuthRepository } from "../src/auth/repository.js";
import type { AppConfig } from "../src/config/env.js";
import { createApp } from "../src/app.js";
import { AuthSessionModel } from "../src/models/auth-session.js";
import { InitialAdminSetupModel, INITIAL_ADMIN_SETUP_ID } from "../src/models/initial-admin-setup.js";
import { UserModel } from "../src/models/user.js";

const sourceUri = process.env.MONGODB_URI;
const sourceDatabase = sourceUri?.split("/").pop()?.split("?")[0] ?? "";
const canRun = Boolean(sourceUri && /test/i.test(sourceDatabase));

test("MongoDB-backed first-admin registration is atomic and closes after creation", { skip: !canRun }, async () => {
  const isolatedUri = new URL(sourceUri as string);
  isolatedUri.pathname = `/doctor_tracker_signup_test_${randomUUID().replace(/-/g, "")}`;
  const uri = isolatedUri.toString();
  const email = `first-admin-${randomUUID()}@example.com`;
  const password = "Strong first admin password 2026!";

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5_000 });
  let server: ReturnType<typeof createApp> extends never ? never : import("node:http").Server | undefined;
  try {
    assert.match(mongoose.connection.name ?? "", /test/i, "must use a generated disposable test database");
    await Promise.all([UserModel.init(), AuthSessionModel.init()]);
    const repository = new MongooseAuthRepository();
    assert.equal(await repository.isFirstAdminRegistrationOpen(), true);

    const config: AppConfig = {
      nodeEnv: "test",
      port: 4000,
      mongoUri: uri,
      frontendOrigins: ["http://localhost:3000"]
    };
    server = createApp(config, repository).listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Integration server did not bind to a TCP port.");
    const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

    const [first, concurrent] = await Promise.all([
      fetch(`${baseUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      }),
      fetch(`${baseUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `racer-${randomUUID()}@example.com`, password })
      })
    ]);
    const statuses = [first.status, concurrent.status].sort((a, b) => a - b);
    assert.deepEqual(statuses, [201, 409]);
    assert.equal(await UserModel.countDocuments({}), 1);
    assert.equal(await InitialAdminSetupModel.countDocuments({ _id: INITIAL_ADMIN_SETUP_ID }), 1);
    assert.equal(await repository.isFirstAdminRegistrationOpen(), false);
    assert.equal(await AuthSessionModel.countDocuments({}), 1);

    const closed = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `later-${randomUUID()}@example.com`, password })
    });
    assert.equal(closed.status, 409);
    assert.equal((await closed.json() as { error: { code: string } }).error.code, "REGISTRATION_CLOSED");
    assert.equal(await UserModel.countDocuments({}), 1);
  } finally {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => server?.close((error) => error ? reject(error) : resolve()));
    }
    // This URI is generated above and points only to this test's disposable database.
    await mongoose.connection.dropDatabase().catch(() => undefined);
    await mongoose.disconnect();
  }
});
