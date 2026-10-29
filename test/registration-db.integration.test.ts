import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import mongoose from "mongoose";
import { MongooseAuthRepository } from "../src/auth/repository.js";
import { hashPassword } from "../src/auth/password.js";
import { AuthSessionModel } from "../src/models/auth-session.js";
import { InitialAdminSetupModel, INITIAL_ADMIN_SETUP_ID } from "../src/models/initial-admin-setup.js";
import { UserModel } from "../src/models/user.js";

const sourceUri = process.env.MONGODB_URI;
const sourceDatabase = sourceUri?.split("/").pop()?.split("?")[0] ?? "";
const canRun = Boolean(sourceUri && /test/i.test(sourceDatabase));

test("CLI bootstrap repository atomically creates one initial admin and permanently closes setup", { skip: !canRun }, async () => {
  const isolatedUri = new URL(sourceUri as string);
  isolatedUri.pathname = `/doctor_tracker_bootstrap_test_${randomUUID().replace(/-/g, "")}`;
  const uri = isolatedUri.toString();
  const passwordHash = await hashPassword("Strong first admin password 2026!");

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5_000 });
  try {
    assert.match(mongoose.connection.name ?? "", /test/i, "must use a generated disposable test database");
    await Promise.all([UserModel.init(), AuthSessionModel.init(), InitialAdminSetupModel.init()]);
    const repository = new MongooseAuthRepository();

    assert.equal(await repository.isFirstAdminRegistrationOpen(), true);
    const [one, two] = await Promise.all([
      repository.registerFirstAdmin("first-admin@example.com", passwordHash),
      repository.registerFirstAdmin("second-admin@example.com", passwordHash)
    ]);

    assert.equal([one, two].filter(Boolean).length, 1, "only one concurrent bootstrap claim can create an admin");
    assert.equal(await UserModel.countDocuments({}), 1);
    assert.equal(await InitialAdminSetupModel.countDocuments({ _id: INITIAL_ADMIN_SETUP_ID }), 1);
    assert.equal(await repository.isFirstAdminRegistrationOpen(), false);
    assert.equal(await AuthSessionModel.countDocuments({}), 0, "CLI bootstrap does not create browser sessions");

    const closed = await repository.registerFirstAdmin("later-admin@example.com", passwordHash);
    assert.equal(closed, null);
    assert.equal(await UserModel.countDocuments({}), 1);
  } finally {
    // This URI is generated above and points only to this test's disposable database.
    await mongoose.connection.dropDatabase().catch(() => undefined);
    await mongoose.disconnect();
  }
});
