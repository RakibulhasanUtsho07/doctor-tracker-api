import { Schema, model, models } from "mongoose";

const authSessionSchema = new Schema({
  tokenHash: {
    type: String,
    required: true,
    unique: true,
    select: false
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  csrfToken: {
    type: String,
    required: true,
    select: false
  },
  expiresAt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    required: true,
    default: Date.now
  }
}, {
  versionKey: false,
  strict: "throw"
});

authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthSessionModel = models.AuthSession ?? model("AuthSession", authSessionSchema);
