import type { ErrorRequestHandler } from "express";
import { HttpError } from "../lib/http-error.js";

interface ErrorWithType {
  type?: unknown;
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const requestId = typeof res.locals.requestId === "string"
    ? res.locals.requestId
    : "unavailable";

  let statusCode = 500;
  let code = "INTERNAL_ERROR";
  let message = "An unexpected error occurred.";

  if (error instanceof HttpError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
  } else {
    const candidate: ErrorWithType = (typeof error === "object" && error !== null)
      ? error as ErrorWithType
      : {};
    if (candidate.type === "entity.parse.failed") {
      statusCode = 400;
      code = "INVALID_JSON";
      message = "Request body must contain valid JSON.";
    } else if (candidate.type === "entity.too.large") {
      statusCode = 413;
      code = "PAYLOAD_TOO_LARGE";
      message = "Request body exceeds the allowed size.";
    }
  }

  if (statusCode >= 500) {
    // Deliberately omit raw error text, request bodies and credentials from logs.
    process.stderr.write(JSON.stringify({
      level: "error",
      event: "request_failed",
      requestId,
      statusCode,
      code
    }) + "\n");
  }

  res.status(statusCode).json({ error: { code, message, requestId } });
};
