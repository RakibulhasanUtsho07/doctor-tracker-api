import mongoose from "mongoose";
import { PatientModel } from "../models/patient.js";

export interface PatientInput {
  doctorId: string;
  name: string;
  condition?: string;
}

export type PatientPatch = Partial<PatientInput>;

export interface PatientRecord {
  id: string;
  doctorId: string | null;
  name: string;
  condition?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatientListQuery {
  search?: string;
  doctorId?: string;
  condition?: string;
  from?: Date;
  toExclusive?: Date;
  page: number;
  limit: number;
}

export interface PatientListResult {
  patients: PatientRecord[];
  total: number;
}

export interface PatientRepository {
  list(query: PatientListQuery): Promise<PatientListResult>;
  create(input: PatientInput): Promise<PatientRecord>;
  findById(id: string): Promise<PatientRecord | null>;
  update(id: string, input: PatientPatch): Promise<PatientRecord | null>;
  deleteById(id: string): Promise<boolean>;
  detachFromDoctor(doctorId: string, patientId: string): Promise<boolean>;
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

function toRecord(document: any): PatientRecord {
  const condition = typeof document.condition === "string" && document.condition.length > 0
    ? { condition: document.condition }
    : {};
  return {
    id: String(document._id ?? document.id),
    doctorId: document.doctorId ? String(document.doctorId) : null,
    name: document.name,
    ...condition,
    createdAt: new Date(document.createdAt),
    updatedAt: new Date(document.updatedAt)
  };
}

function escapeRegex(value: string): string {
  let escaped = "";
  const special = "\\.^$|?*+()[]{}-";
  for (const character of value) {
    escaped += special.includes(character) ? "\\" + character : character;
  }
  return escaped;
}

function toFilter(query: PatientListQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (query.doctorId !== undefined) {
    filter.doctorId = new mongoose.Types.ObjectId(query.doctorId);
  }
  if (query.condition !== undefined) {
    filter.conditionNormalized = normalizeText(query.condition);
  }
  if (query.from !== undefined || query.toExclusive !== undefined) {
    const createdAt: Record<string, Date> = {};
    if (query.from !== undefined) createdAt.$gte = query.from;
    if (query.toExclusive !== undefined) createdAt.$lt = query.toExclusive;
    filter.createdAt = createdAt;
  }
  if (query.search !== undefined) {
    const prefix = new RegExp("^" + escapeRegex(normalizeText(query.search)));
    filter.$or = [
      { nameNormalized: prefix },
      { conditionNormalized: prefix }
    ];
  }
  return filter;
}

function normalizedFields(input: PatientPatch): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (input.doctorId !== undefined) fields.doctorId = new mongoose.Types.ObjectId(input.doctorId);
  if (input.name !== undefined) {
    fields.name = input.name;
    fields.nameNormalized = normalizeText(input.name);
  }
  if (input.condition !== undefined) {
    fields.condition = input.condition;
    fields.conditionNormalized = normalizeText(input.condition);
  }
  return fields;
}

export class MongoosePatientRepository implements PatientRepository {
  async list(query: PatientListQuery): Promise<PatientListResult> {
    const filter = toFilter(query);
    const [documents, total] = await Promise.all([
      PatientModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean()
        .exec(),
      PatientModel.countDocuments(filter).exec()
    ]);
    return { patients: documents.map(toRecord), total };
  }

  async create(input: PatientInput): Promise<PatientRecord> {
    const document = await PatientModel.create({
      doctorId: new mongoose.Types.ObjectId(input.doctorId),
      name: input.name,
      nameNormalized: normalizeText(input.name),
      ...(input.condition !== undefined
        ? { condition: input.condition, conditionNormalized: normalizeText(input.condition) }
        : {})
    });
    return toRecord(document.toObject());
  }

  async findById(id: string): Promise<PatientRecord | null> {
    const document = await PatientModel.findById(id).lean().exec();
    return document ? toRecord(document) : null;
  }

  async update(id: string, input: PatientPatch): Promise<PatientRecord | null> {
    const document = await PatientModel.findByIdAndUpdate(
      id,
      { $set: normalizedFields(input) },
      { new: true, runValidators: true }
    ).lean().exec();
    return document ? toRecord(document) : null;
  }

  async deleteById(id: string): Promise<boolean> {
    return Boolean(await PatientModel.findByIdAndDelete(id).exec());
  }

  async detachFromDoctor(doctorId: string, patientId: string): Promise<boolean> {
    const document = await PatientModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(patientId),
        doctorId: new mongoose.Types.ObjectId(doctorId)
      },
      { $set: { doctorId: null } },
      { new: true, runValidators: true }
    ).lean().exec();
    return document !== null;
  }
}
