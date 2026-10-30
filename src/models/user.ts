import mongoose, { Schema, model, type Model } from "mongoose";

const userSchema = new Schema({
  emailNormalized: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    maxlength: 254
  },
  passwordHash: {
    type: String,
    required: true,
    select: false
  },
  role: {
    type: String,
    enum: ["ADMIN"],
    required: true,
    default: "ADMIN"
  },
  isActive: {
    type: Boolean,
    required: true,
    default: true
  }
}, {
  timestamps: true,
  strict: "throw",
  versionKey: false
});

export const UserModel = (mongoose.models.User ?? model("User", userSchema)) as unknown as Model<any>;
