import type { Request } from "express";
import { HttpError } from "../lib/http-error.js";
import type { PatientInput, PatientListQuery, PatientPatch } from "./repository.js";

const PATIENT_FIELDS = ["doctorId", "name", "condition"] as const;
const QUERY_FIELDS = ["search", "doctorId", "condition", "from", "to", "page", "limit"] as const;
const MAX_PAGE = 100_000;
const MAX_SKIP = 100_000;

function invalid(message: string): never {
  throw new HttpError(400, "VALIDATION_ERROR", message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validObjectId(value: string): boolean {
  return /^[a-f\d]{24}$/i.test(value);
}

function parsePatientField(field: (typeof PATIENT_FIELDS)[number], value: unknown): string {
  if (typeof value !== "string") invalid("Patient fields must be strings.");
  const normalized = value.normalize("NFKC").trim();
  if (field === "doctorId" && !validObjectId(normalized)) {
    invalid("Doctor ID must be a valid identifier.");
  }
  if (field === "name" && (normalized.length < 2 || normalized.length > 120)) {
    invalid("Name must contain 2 to 120 characters.");
  }
  if (field === "condition" && (normalized.length < 1 || normalized.length > 100)) {
    invalid("Condition must contain 1 to 100 characters when supplied.");
  }
  return normalized;
}

export function parsePatientBody(body: unknown, partial = false): PatientPatch {
  if (!isRecord(body)) invalid("Provide a JSON object with patient fields.");
  if (Object.keys(body).some((key) => !(PATIENT_FIELDS as readonly string[]).includes(key))) {
    invalid("Unexpected patient fields are not allowed.");
  }
  if (partial && Object.keys(body).length === 0) invalid("Provide at least one patient field to update.");
  const result: PatientPatch = {};
  for (const field of PATIENT_FIELDS) {
    if (Object.hasOwn(body, field)) result[field] = parsePatientField(field, body[field]);
    else if (!partial && field !== "condition") invalid("Missing required patient field: " + field + ".");
  }
  return result;
}

function queryString(record: Record<string, unknown>, key: string, maxLength: number): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") invalid("Query parameter " + key + " must be a single string.");
  const trimmed = value.normalize("NFKC").trim();
  if (trimmed.length < 1 || trimmed.length > maxLength) {
    invalid("Query parameter " + key + " must contain 1 to " + maxLength + " characters.");
  }
  return trimmed;
}

function parseDate(value: string | undefined, key: string): Date | undefined {
  if (value === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid("Query parameter " + key + " must use YYYY-MM-DD.");
  const parsed = new Date(value + "T00:00:00.000Z");
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    invalid("Query parameter " + key + " must be a real calendar date.");
  }
  return parsed;
}

function parseInteger(value: unknown, key: string, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) invalid("Query parameter " + key + " must be an integer.");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    invalid("Query parameter " + key + " must be between " + minimum + " and " + maximum + ".");
  }
  return parsed;
}

export function parsePatientQuery(request: Request, allowDoctorId = true): PatientListQuery {
  const record = request.query as Record<string, unknown>;
  const allowed = allowDoctorId ? QUERY_FIELDS : QUERY_FIELDS.filter((field) => field !== "doctorId");
  if (Object.keys(record).some((key) => !(allowed as readonly string[]).includes(key))) {
    invalid("Unknown patient list query parameter.");
  }

  const search = queryString(record, "search", 100);
  const doctorId = allowDoctorId ? queryString(record, "doctorId", 24) : undefined;
  if (doctorId !== undefined && !validObjectId(doctorId)) invalid("Doctor ID must be a valid identifier.");
  const condition = queryString(record, "condition", 100);
  const from = parseDate(queryString(record, "from", 10), "from");
  const to = parseDate(queryString(record, "to", 10), "to");
  if (from && to && from.getTime() > to.getTime()) invalid("The from date must be on or before the to date.");

  const page = parseInteger(record.page, "page", 1, 1, MAX_PAGE);
  const limit = parseInteger(record.limit, "limit", 20, 1, 100);
  if ((page - 1) * limit > MAX_SKIP) {
    invalid("The requested page offset is too large; narrow the search or use an earlier page.");
  }

  const toExclusive = to ? new Date(to.getTime() + 24 * 60 * 60 * 1000) : undefined;
  return {
    ...(search !== undefined ? { search } : {}),
    ...(doctorId !== undefined ? { doctorId } : {}),
    ...(condition !== undefined ? { condition } : {}),
    ...(from !== undefined ? { from } : {}),
    ...(toExclusive !== undefined ? { toExclusive } : {}),
    page,
    limit
  };
}

export function parsePatientInput(body: unknown): PatientInput {
  return parsePatientBody(body, false) as PatientInput;
}
