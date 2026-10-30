import type { Request } from "express";
import { HttpError } from "../lib/http-error.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 366;

export interface DashboardDateRange {
  from: Date;
  toExclusive: Date;
  fromDate: string;
  toDate: string;
}

function invalid(message: string): never {
  throw new HttpError(400, "VALIDATION_ERROR", message);
}

function parseDate(value: unknown, key: string): { date: Date; text: string } | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    invalid("Query parameter " + key + " must use YYYY-MM-DD.");
  }
  const date = new Date(value + "T00:00:00.000Z");
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    invalid("Query parameter " + key + " must be a real calendar date.");
  }
  return { date, text: value };
}

export function parseDashboardRange(request: Request, now = new Date()): DashboardDateRange {
  const query = request.query as Record<string, unknown>;
  if (Object.keys(query).some((key) => key !== "from" && key !== "to")) {
    invalid("Unknown dashboard query parameter.");
  }

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const todayText = new Date(today).toISOString().slice(0, 10);
  const requestedFrom = parseDate(query.from, "from");
  const requestedTo = parseDate(query.to, "to");

  let fromTime: number;
  let fromDate: string;
  if (requestedFrom) {
    fromTime = requestedFrom.date.getTime();
    fromDate = requestedFrom.text;
  } else if (requestedTo) {
    fromTime = requestedTo.date.getTime() - (DEFAULT_RANGE_DAYS - 1) * DAY_MS;
    fromDate = new Date(fromTime).toISOString().slice(0, 10);
  } else {
    fromTime = today - (DEFAULT_RANGE_DAYS - 1) * DAY_MS;
    fromDate = new Date(fromTime).toISOString().slice(0, 10);
  }

  const toTime = requestedTo ? requestedTo.date.getTime() : today;
  const toDate = requestedTo ? requestedTo.text : todayText;

  if (fromTime > today || toTime > today) {
    invalid("Dashboard date ranges cannot include future calendar days.");
  }
  if (fromTime > toTime) {
    invalid("The from date must be on or before the to date.");
  }

  const dayCount = Math.floor((toTime - fromTime) / DAY_MS) + 1;
  if (dayCount > MAX_RANGE_DAYS) {
    invalid("Dashboard date ranges may include at most 366 UTC calendar days.");
  }

  return {
    from: new Date(fromTime),
    toExclusive: new Date(toTime + DAY_MS),
    fromDate,
    toDate
  };
}
