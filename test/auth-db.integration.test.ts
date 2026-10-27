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
import { AuthSessionModel } from "../src/models/auth-session.js";
import { UserModel } from "../src/models/user.js";

const uri = process.env.MONGODB_URI;
const dbName = uri?.split("/").pop()?.split("?")[0] ?? "";
const canRun = Boolean(uri && /test/i.test(dbName));

test("MongoDB-backed admin session can login, resolve, revoke and reject reuse", { skip: !canRun }, async () => {
  const email = `integration-${randomUUID()}@example.com`;
  const password = "Strong integration password 2026!";
  let userId: mongoose.Types.ObjectId | undefined;

  await mongoose.connect(uri as string, { serverSelectionTimeoutMS: 5_000 });
  try {
    assert.match(mongoose.connection.name ?? "", /test/i, "refuse to run against a database without 'test' in its name");
    await Promise.all([UserModel.init(), AuthSessionModel.init()]);
    const user = await UserModel.create({
      emailNormalized: email,
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      isActive: true
    });
    userId = user._id;

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
    const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

    try {
      const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const loginBody = await loginResponse.json() as { data: { csrfToken: string; user: { email: string } } };
      const cookieHeader = loginResponse.headers.get("set-cookie");
      assert.equal(loginResponse.status, 200);
      assert.equal(loginBody.data.user.email, email);
      assert.ok(loginBody.data.csrfToken.length >= 40);
      assert.ok(cookieHeader);
      const cookiePair = (cookieHeader.split(";")[0] ?? "");
      assert.ok(cookiePair.startsWith("dt_session="));

      assert.equal(await AuthSessionModel.countDocuments({ userId: user._id }), 1);
      const meResponse = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { Cookie: cookiePair } });
      assert.equal(meResponse.status, 200);

      const logoutResponse = await fetch(`${baseUrl}/api/v1/auth/logout`, {
        method: "POST",
        headers: { Cookie: cookiePair, "X-CSRF-Token": loginBody.data.csrfToken }
      });
      assert.equal(logoutResponse.status, 204);
      assert.equal(await AuthSessionModel.countDocuments({ userId: user._id }), 0);

      const reusedResponse = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { Cookie: cookiePair } });
      assert.equal(reusedResponse.status, 401);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  } finally {
    if (userId) {
      await AuthSessionModel.deleteMany({ userId }).exec();
      await UserModel.deleteOne({ _id: userId }).exec();
    }
    await mongoose.disconnect();
  }
});
