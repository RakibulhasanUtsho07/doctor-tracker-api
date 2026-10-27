import type { Request } from "express";
import { HttpError } from "../lib/http-error.js";
import type { DoctorInput, DoctorListQuery, DoctorPatch } from "./repository.js";

const DOCTOR_FIELDS = ["name", "specialization", "hospital", "phone", "email"] as const;
const QUERY_FIELDS = ["search", "specialization", "hospital", "from", "to", "page", "limit"] as const;
const MAX_PAGE = 100_000;
const MAX_SKIP = 100_000;

function invalid(message: string): never {
  throw new HttpError(400, "VALIDATION_ERROR", message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeField(field: (typeof DOCTOR_FIELDS)[number], value: unknown): string {
  if (typeof value !== "string") invalid("Doctor fields must be strings.");
  const normalized = value.normalize("NFKC").trim();
  if (field === "name" && (normalized.length < 2 || normalized.length > 120)) {
    invalid("Name must contain 2 to 120 characters.");
  }
  if (field === "specialization" && (normalized.length < 2 || normalized.length > 120)) {
    invalid("Specialization must contain 2 to 120 characters.");
  }
  if (field === "hospital" && (normalized.length < 2 || normalized.length > 160)) {
    invalid("Hospital must contain 2 to 160 characters.");
  }
  if (field === "phone" && (normalized.length < 5 || normalized.length > 30)) {
    invalid("Phone must contain 5 to 30 characters.");
  }
  if (field === "email" && (
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  )) {
    invalid("Provide a valid email address.");
  }
  return field === "email" ? normalized.toLowerCase() : normalized;
}

export function parseDoctorBody(body: unknown, partial = false): DoctorPatch {
  if (!isRecord(body)) invalid("Provide a JSON object with doctor fields.");
  const keys = Object.keys(body);
  if (keys.some((key) => !(DOCTOR_FIELDS as readonly string[]).includes(key))) {
    invalid("Unexpected doctor fields are not allowed.");
  }
  if (partial && keys.length === 0) invalid("Provide at least one doctor field to update.");
  const result: DoctorPatch = {};
  for (const field of DOCTOR_FIELDS) {
    if (Object.hasOwn(body, field)) result[field] = normalizeField(field, body[field]);
    else if (!partial) invalid("Missing required doctor field: " + field + ".");
  }
  return result;
}

function queryString(record: Record<string, unknown>, key: string, maxLength: number): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") invalid("Query parameter " + key + " must be a single string.");
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    invalid("Query parameter " + key + " must contain 1 to " + maxLength + " characters.");
  }
  return trimmed;
}

function parseDate(value: string | undefined, key: string): Date | undefined {
  if (value === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    invalid("Query parameter " + key + " must use YYYY-MM-DD.");
  }
  const parsed = new Date(value + "T00:00:00.000Z");
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    invalid("Query parameter " + key + " must be a real calendar date.");
  }
  return parsed;
}

function parseInteger(value: unknown, key: string, defaultValue: number, minimum: number, maximum: number): number {
  if (value === undefined) return defaultValue;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    invalid("Query parameter " + key + " must be an integer.");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    invalid("Query parameter " + key + " must be between " + minimum + " and " + maximum + ".");
  }
  return parsed;
}

export function parseDoctorQuery(request: Request): DoctorListQuery {
  const record = request.query as Record<string, unknown>;
  if (Object.keys(record).some((key) => !(QUERY_FIELDS as readonly string[]).includes(key))) {
    invalid("Unknown doctor list query parameter.");
  }

  const search = queryString(record, "search", 100);
  const specialization = queryString(record, "specialization", 100);
  const hospital = queryString(record, "hospital", 160);
  const from = parseDate(queryString(record, "from", 10), "from");
  const to = parseDate(queryString(record, "to", 10), "to");
  if (from && to && from.getTime() > to.getTime()) {
    invalid("The from date must be on or before the to date.");
  }

  const page = parseInteger(record.page, "page", 1, 1, MAX_PAGE);
  const limit = parseInteger(record.limit, "limit", 20, 1, 100);
  if ((page - 1) * limit > MAX_SKIP) {
    invalid("The requested page offset is too large; narrow the search or use an earlier page.");
  }

  const toExclusive = to ? new Date(to.getTime() + 24 * 60 * 60 * 1000) : undefined;
  return {
    ...(search !== undefined ? { search } : {}),
    ...(specialization !== undefined ? { specialization } : {}),
    ...(hospital !== undefined ? { hospital } : {}),
    ...(from !== undefined ? { from } : {}),
    ...(toExclusive !== undefined ? { toExclusive } : {}),
    page,
    limit
  };
}

export function parseDoctorInput(body: unknown): DoctorInput {
  return parseDoctorBody(body, false) as DoctorInput;
}
