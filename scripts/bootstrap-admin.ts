import "dotenv/config";
import mongoose from "mongoose";
import { hashPassword } from "../src/auth/password.js";
import { loadConfig } from "../src/config/env.js";
import { UserModel } from "../src/models/user.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Set a valid ADMIN_EMAIL for this one-time bootstrap command.");
  }
  if (!password) {
    throw new Error("Set ADMIN_PASSWORD for this one-time bootstrap command.");
  }

  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5_000 });
  await UserModel.init();
  const existing = await UserModel.exists({ emailNormalized: email });
  if (existing) {
    throw new Error("An account with that email already exists; bootstrap will not overwrite it.");
  }

  const passwordHash = await hashPassword(password);
  await UserModel.create({
    emailNormalized: email,
    passwordHash,
    role: "ADMIN",
    isActive: true
  });
  process.stdout.write("Administrator account created. Remove bootstrap variables from the environment.\n");
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown bootstrap failure.";
    process.stderr.write(`Admin bootstrap failed: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
