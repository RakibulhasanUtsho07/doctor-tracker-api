import { DoctorModel } from "../models/doctor.js";

export interface DoctorInput {
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
}

export type DoctorPatch = Partial<DoctorInput>;

export interface DoctorRecord {
  id: string;
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DoctorListQuery {
  search?: string;
  specialization?: string;
  hospital?: string;
  from?: Date;
  toExclusive?: Date;
  page: number;
  limit: number;
}

export interface DoctorListResult {
  doctors: DoctorRecord[];
  total: number;
}

export interface DoctorRepository {
  list(query: DoctorListQuery): Promise<DoctorListResult>;
  create(input: DoctorInput): Promise<DoctorRecord>;
  findById(id: string): Promise<DoctorRecord | null>;
  update(id: string, input: DoctorPatch): Promise<DoctorRecord | null>;
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

function toRecord(document: any): DoctorRecord {
  return {
    id: String(document._id ?? document.id),
    name: document.name,
    specialization: document.specialization,
    hospital: document.hospital,
    phone: document.phone,
    email: document.emailNormalized ?? document.email,
    createdAt: new Date(document.createdAt),
    updatedAt: new Date(document.updatedAt)
  };
}

function normalizedFields(input: DoctorPatch): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (input.name !== undefined) {
    fields.name = input.name;
    fields.nameNormalized = normalizeText(input.name);
  }
  if (input.specialization !== undefined) {
    fields.specialization = input.specialization;
    fields.specializationNormalized = normalizeText(input.specialization);
  }
  if (input.hospital !== undefined) {
    fields.hospital = input.hospital;
    fields.hospitalNormalized = normalizeText(input.hospital);
  }
  if (input.phone !== undefined) fields.phone = input.phone;
  if (input.email !== undefined) fields.emailNormalized = normalizeText(input.email);
  return fields;
}

function escapeRegex(value: string): string {
  let escaped = "";
  const special = "\\.^$|?*+()[]{}-";
  for (const character of value) {
    escaped += special.includes(character) ? "\\" + character : character;
  }
  return escaped;
}

export class MongooseDoctorRepository implements DoctorRepository {
  async list(query: DoctorListQuery): Promise<DoctorListResult> {
    const filter: Record<string, unknown> = {};
    if (query.specialization !== undefined) {
      filter.specializationNormalized = normalizeText(query.specialization);
    }
    if (query.hospital !== undefined) {
      filter.hospitalNormalized = normalizeText(query.hospital);
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
        { specializationNormalized: prefix },
        { hospitalNormalized: prefix },
        { emailNormalized: prefix }
      ];
    }

    const [documents, total] = await Promise.all([
      DoctorModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean()
        .exec(),
      DoctorModel.countDocuments(filter).exec()
    ]);
    return { doctors: documents.map(toRecord), total };
  }

  async create(input: DoctorInput): Promise<DoctorRecord> {
    const document = await DoctorModel.create({
      name: input.name,
      specialization: input.specialization,
      hospital: input.hospital,
      phone: input.phone,
      ...normalizedFields(input),
      emailNormalized: normalizeText(input.email)
    });
    return toRecord(document.toObject());
  }

  async findById(id: string): Promise<DoctorRecord | null> {
    const document = await DoctorModel.findById(id).lean().exec();
    return document ? toRecord(document) : null;
  }

  async update(id: string, input: DoctorPatch): Promise<DoctorRecord | null> {
    const fields = normalizedFields(input);
    if (input.email !== undefined) fields.emailNormalized = normalizeText(input.email);
    const document = await DoctorModel.findByIdAndUpdate(
      id,
      { $set: fields },
      { new: true, runValidators: true }
    ).lean().exec();
    return document ? toRecord(document) : null;
  }
}
