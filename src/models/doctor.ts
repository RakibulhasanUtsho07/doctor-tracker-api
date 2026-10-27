import mongoose, { Schema, model, type Model } from "mongoose";

const doctorSchema = new Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  nameNormalized: { type: String, required: true, select: false, maxlength: 120 },
  specialization: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  specializationNormalized: { type: String, required: true, select: false, maxlength: 120 },
  hospital: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
  hospitalNormalized: { type: String, required: true, select: false, maxlength: 160 },
  phone: { type: String, required: true, trim: true, minlength: 5, maxlength: 30 },
  emailNormalized: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 254
  }
}, {
  timestamps: true,
  strict: "throw",
  versionKey: false
});

// Email is the approved identity/duplicate key. Searchable normalized values are
// materialized to support bounded, escaped prefix searches instead of raw regex input.
doctorSchema.index({ emailNormalized: 1 }, { unique: true, name: "doctor_email_unique" });
doctorSchema.index(
  { nameNormalized: 1, createdAt: -1, _id: -1 },
  { name: "doctor_name_created_idx" }
);
doctorSchema.index(
  { specializationNormalized: 1, createdAt: -1, _id: -1 },
  { name: "doctor_specialization_created_idx" }
);
doctorSchema.index(
  { hospitalNormalized: 1, createdAt: -1, _id: -1 },
  { name: "doctor_hospital_created_idx" }
);
doctorSchema.index(
  { createdAt: -1, _id: -1 },
  { name: "doctor_created_desc_idx" }
);

export const DoctorModel = (mongoose.models.Doctor ?? model("Doctor", doctorSchema)) as unknown as Model<any>;
