import mongoose from "mongoose";
import type { AppConfig } from "../config/env.js";
import { AuthSessionModel } from "../models/auth-session.js";
import { DoctorModel } from "../models/doctor.js";
import { PatientModel } from "../models/patient.js";
import { UserModel } from "../models/user.js";

let connectionAttempt: Promise<void> | null = null;

async function initializeModels(): Promise<void> {
  await Promise.all([
    UserModel.init(),
    AuthSessionModel.init(),
    DoctorModel.init(),
    PatientModel.init()
  ]);
}

/**
 * Establishes and reuses the process-local Mongoose connection.
 * Failed attempts are cleared so a later request can retry safely.
 */
export async function ensureDatabaseConnected(config: AppConfig): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    await initializeModels();
    return;
  }

  // If Mongoose was disconnected after a previous successful invocation,
  // discard the old resolved promise and establish a fresh connection.
  if (mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
    connectionAttempt = null;
  }

  if (!connectionAttempt) {
    const connect = mongoose.connection.readyState === 2
      ? mongoose.connection.asPromise()
      : mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5_000 });

    const attempt = connect.then(async () => {
      await initializeModels();
    });
    connectionAttempt = attempt.catch((error: unknown) => {
      connectionAttempt = null;
      throw error;
    });
  }

  await connectionAttempt;
}
