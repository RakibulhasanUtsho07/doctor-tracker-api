import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { AppConfig } from "../src/config/env.js";
import { loadConfig } from "../src/config/env.js";
import { createApp } from "../src/app.js";

const testConfig: AppConfig = {
  nodeEnv: "test",
  port: 4000,
  mongoUri: "mongodb://127.0.0.1:27017/doctor_tracker_test",
  frontendOrigins: ["http://localhost:3000"]
};

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = createApp(testConfig).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Test HTTP server did not bind to a TCP port.");
  }
  try {
    await run(`http://127.0.0.1:${(address as AddressInfo).port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test("configuration rejects a missing MongoDB URI", () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: "test", FRONTEND_ORIGINS: "http://localhost:3000" }),
    /MONGODB_URI/
  );
});

test("configuration rejects invalid ports and non-origin frontend URLs", () => {
  assert.throws(() => loadConfig({
    NODE_ENV: "test",
    PORT: "70000",
    MONGODB_URI: "mongodb://localhost:27017/test",
    FRONTEND_ORIGINS: "http://localhost:3000"
  }), /PORT/);
  assert.throws(() => loadConfig({
    NODE_ENV: "test",
    MONGODB_URI: "mongodb://localhost:27017/test",
    FRONTEND_ORIGINS: "https://example.com/app"
  }), /origins only/);
});

test("production configuration requires HTTPS frontend origins while development permits localhost HTTP", () => {
  const base = {
    MONGODB_URI: "mongodb+srv://cluster.example.com/doctor_tracker_test"
  };

  assert.throws(
    () => loadConfig({
      ...base,
      NODE_ENV: "production",
      FRONTEND_ORIGINS: "http://app.example.com"
    }),
    /Production FRONTEND_ORIGINS entries must use HTTPS/
  );

  assert.throws(
    () => loadConfig({
      ...base,
      NODE_ENV: "production",
      FRONTEND_ORIGINS: "https://app.example.com,http://localhost:3000"
    }),
    /Production FRONTEND_ORIGINS entries must use HTTPS/
  );

  const production = loadConfig({
    ...base,
    NODE_ENV: "production",
    FRONTEND_ORIGINS: "https://app.example.com"
  });
  assert.deepEqual(production.frontendOrigins, ["https://app.example.com"]);

  const development = loadConfig({
    ...base,
    NODE_ENV: "development",
    FRONTEND_ORIGINS: "http://localhost:3000"
  });
  assert.deepEqual(development.frontendOrigins, ["http://localhost:3000"]);
});

test("production MongoDB connections require TLS and reject explicit TLS disablement", () => {
  const frontend = { FRONTEND_ORIGINS: "https://app.example.com" };

  assert.throws(
    () => loadConfig({
      NODE_ENV: "production",
      MONGODB_URI: "mongodb://db.example.com/doctor_tracker",
      ...frontend
    }),
    /must enable TLS/
  );

  assert.throws(
    () => loadConfig({
      NODE_ENV: "production",
      MONGODB_URI: "mongodb+srv://cluster.example.com/doctor_tracker?tls=false",
      ...frontend
    }),
    /must not disable TLS/
  );

  assert.throws(
    () => loadConfig({
      NODE_ENV: "production",
      MONGODB_URI: "mongodb+srv://cluster.example.com/doctor_tracker?TLS=false",
      ...frontend
    }),
    /must not disable TLS/
  );

  assert.throws(
    () => loadConfig({
      NODE_ENV: "production",
      MONGODB_URI: "mongodb://db.example.com/doctor_tracker?tls=true&ssl=false",
      ...frontend
    }),
    /must not disable TLS/
  );

  const directTls = loadConfig({
    NODE_ENV: "production",
    MONGODB_URI: "mongodb://db.example.com/doctor_tracker?tls=true",
    ...frontend
  });
  assert.equal(directTls.mongoUri, "mongodb://db.example.com/doctor_tracker?tls=true");

  const legacySslAlias = loadConfig({
    NODE_ENV: "production",
    MONGODB_URI: "mongodb://db.example.com/doctor_tracker?ssl=true",
    ...frontend
  });
  assert.equal(legacySslAlias.mongoUri, "mongodb://db.example.com/doctor_tracker?ssl=true");

  const srvDefault = loadConfig({
    NODE_ENV: "production",
    MONGODB_URI: "mongodb+srv://cluster.example.com/doctor_tracker",
    ...frontend
  });
  assert.equal(srvDefault.mongoUri, "mongodb+srv://cluster.example.com/doctor_tracker");

  const localDevelopment = loadConfig({
    NODE_ENV: "development",
    MONGODB_URI: "mongodb://127.0.0.1:27017/doctor_tracker_dev",
    FRONTEND_ORIGINS: "http://localhost:3000"
  });
  assert.equal(localDevelopment.mongoUri, "mongodb://127.0.0.1:27017/doctor_tracker_dev");
});

test("public signup endpoints are not exposed", async () => {
  await withServer(async (baseUrl) => {
    const status = await fetch(`${baseUrl}/api/v1/auth/registration-status`);
    assert.equal(status.status, 404);
    assert.equal((await status.json() as { error: { code: string } }).error.code, "NOT_FOUND");

    const register = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "unauthorized@example.test", password: "This account should not be created 2026!" })
    });
    assert.equal(register.status, 404);
    assert.equal((await register.json() as { error: { code: string } }).error.code, "NOT_FOUND");
  });
});

test("health endpoint returns liveness data and a request ID", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    const body = await response.json() as {
      data: { status: string; service: string; timestamp: string };
      meta: { requestId: string };
    };
    assert.equal(response.status, 200);
    assert.equal(body.data.status, "ok");
    assert.equal(body.data.service, "doctor-tracker-api");
    assert.equal(Number.isNaN(Date.parse(body.data.timestamp)), false);
    assert.equal(response.headers.get("x-request-id"), body.meta.requestId);
  });
});

test("security headers are present", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.ok(response.headers.get("content-security-policy"));
  });
});

test("unknown routes use a stable 404 error envelope", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/not-a-route`);
    const body = await response.json() as { error: { code: string; requestId: string } };
    assert.equal(response.status, 404);
    assert.equal(body.error.code, "NOT_FOUND");
    assert.ok(body.error.requestId);
  });
});

test("unknown browser origins are rejected", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      headers: { Origin: "https://untrusted.example" }
    });
    const body = await response.json() as { error: { code: string } };
    assert.equal(response.status, 403);
    assert.equal(body.error.code, "ORIGIN_NOT_ALLOWED");
  });
});

test("allowed browser origin receives CORS permission", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      headers: { Origin: "http://localhost:3000" }
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:3000");
  });
});

test("malformed JSON returns a safe 400 response", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/unknown`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json"
    });
    const body = await response.json() as { error: { code: string; message: string } };
    assert.equal(response.status, 400);
    assert.equal(body.error.code, "INVALID_JSON");
    assert.match(body.error.message, /valid JSON/);
  });
});

test("oversized JSON body returns 413", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/unknown`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: "x".repeat(110_000) })
    });
    const body = await response.json() as { error: { code: string } };
    assert.equal(response.status, 413);
    assert.equal(body.error.code, "PAYLOAD_TOO_LARGE");
  });
});
