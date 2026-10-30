import mongoose, { Schema, model, type Model } from "mongoose";

/**
 * Durable single-use gate for creating the initial administrator.
 *
 * This marker lives in the same database as users and is claimed with an
 * atomic insert. The unique _id makes concurrent signup/bootstrap attempts
 * mutually exclusive without requiring a multi-document transaction.
 */
const initialAdminSetupSchema = new Schema({
  _id: { type: String, required: true },
  claimedAt: { type: Date, required: true, default: Date.now },
  completedAt: { type: Date, default: null },
  userId: { type: Schema.Types.ObjectId, default: null }
}, {
  collection: "system_settings",
  versionKey: false,
  strict: "throw"
});

export const INITIAL_ADMIN_SETUP_ID = "initial-admin-setup";

export const InitialAdminSetupModel = (
  mongoose.models.InitialAdminSetup ??
  model("InitialAdminSetup", initialAdminSetupSchema)
) as unknown as Model<any>;
