import mongoose, { Schema, model, type Model } from "mongoose";

const patientSchema = new Schema({
  doctorId: {
    type: Schema.Types.ObjectId,
    ref: "Doctor",
    default: null
  },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  nameNormalized: { type: String, required: true, select: false, maxlength: 120 },
  // The assignment does not define a controlled condition vocabulary, so this
  // minimum-scope field is free text and is never logged by request handlers.
  condition: { type: String, trim: true, maxlength: 100 },
  conditionNormalized: { type: String, select: false, maxlength: 100 }
}, {
  timestamps: true,
  strict: "throw",
  versionKey: false
});

// One patient is associated with at most one doctor. null means explicitly
// detached, not deleted; DELETE /patients/:id remains the destructive operation.
patientSchema.index(
  { doctorId: 1, createdAt: -1, _id: -1 },
  { name: "patient_doctor_created_idx" }
);
patientSchema.index(
  { nameNormalized: 1, createdAt: -1, _id: -1 },
  { name: "patient_name_created_idx" }
);
patientSchema.index(
  { conditionNormalized: 1, createdAt: -1, _id: -1 },
  { name: "patient_condition_created_idx" }
);
patientSchema.index(
  { createdAt: -1, _id: -1 },
  { name: "patient_created_desc_idx" }
);

export const PatientModel = (mongoose.models.Patient ?? model("Patient", patientSchema)) as unknown as Model<any>;
