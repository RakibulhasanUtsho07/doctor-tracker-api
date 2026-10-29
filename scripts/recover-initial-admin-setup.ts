import "dotenv/config";
import mongoose from "mongoose";
import { loadConfig } from "../src/config/env.js";
import { INITIAL_ADMIN_SETUP_ID, InitialAdminSetupModel } from "../src/models/initial-admin-setup.js";
import { UserModel } from "../src/models/user.js";

const MINIMUM_STALE_MINUTES = 15;
const MAXIMUM_STALE_MINUTES = 24 * 60;

async function main(): Promise<void> {
  if (process.env.CONFIRM_STALE_INITIAL_ADMIN_SETUP !== "YES") {
    throw new Error(
      "Refusing recovery. Stop every API instance and bootstrap process, verify no signup is active, then set CONFIRM_STALE_INITIAL_ADMIN_SETUP=YES."
    );
  }

  const rawAge = process.env.STALE_INITIAL_ADMIN_MINUTES ?? String(MINIMUM_STALE_MINUTES);
  const staleMinutes = Number(rawAge);
  if (
    !Number.isInteger(staleMinutes) ||
    staleMinutes < MINIMUM_STALE_MINUTES ||
    staleMinutes > MAXIMUM_STALE_MINUTES
  ) {
    throw new Error(
      `STALE_INITIAL_ADMIN_MINUTES must be an integer from ${MINIMUM_STALE_MINUTES} to ${MAXIMUM_STALE_MINUTES}.`
    );
  }

  const config = loadConfig();
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5_000 });

  try {
    await Promise.all([UserModel.init(), InitialAdminSetupModel.init()]);

    if (await UserModel.exists({})) {
      throw new Error("An account already exists. The initial-admin setup marker must not be reset.");
    }

    const marker = await InitialAdminSetupModel.findById(INITIAL_ADMIN_SETUP_ID).lean().exec();
    if (!marker) {
      process.stdout.write("No initial-admin setup marker exists; nothing to recover.\n");
      return;
    }

    if (marker.completedAt || marker.userId) {
      throw new Error("The setup marker indicates a completed setup. Refusing to remove it.");
    }

    const cutoff = new Date(Date.now() - staleMinutes * 60_000);
    if (!(marker.claimedAt instanceof Date) || marker.claimedAt >= cutoff) {
      throw new Error(
        `The incomplete marker is not older than ${staleMinutes} minutes. Refusing to remove it.`
      );
    }

    // Re-check immediately before the compare-and-delete. Operators must stop
    // all API/CLI instances first; this command never deletes user records.
    if (await UserModel.exists({})) {
      throw new Error("An account appeared during recovery. Refusing to remove the setup marker.");
    }

    const result = await InitialAdminSetupModel.deleteOne({
      _id: INITIAL_ADMIN_SETUP_ID,
      completedAt: null,
      userId: null,
      claimedAt: { $lt: cutoff }
    }).exec();

    if (result.deletedCount !== 1) {
      throw new Error("The setup marker changed during recovery. No marker was removed.");
    }

    process.stdout.write(
      "Removed the stale, incomplete initial-admin setup marker. No user data was deleted. " +
      "Registration can reopen only if the user collection remains empty.\n"
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown setup-recovery failure.";
  process.stderr.write(`Initial-admin setup recovery failed: ${message}\n`);
  process.exitCode = 1;
});
