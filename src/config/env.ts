export type NodeEnvironment = "development" | "test" | "production";

export interface AppConfig {
  nodeEnv: NodeEnvironment;
  port: number;
  mongoUri: string;
  frontendOrigins: string[];
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return 4000;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return port;
}

function parseFrontendOrigins(value: string | undefined, requireHttps = false): string[] {
  if (!value?.trim()) {
    throw new Error("Missing required environment variable: FRONTEND_ORIGINS.");
  }
  const origins = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (origins.length === 0) {
    throw new Error("FRONTEND_ORIGINS must contain at least one HTTP(S) origin.");
  }

  return [...new Set(origins.map((origin) => {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error("FRONTEND_ORIGINS must contain valid HTTP(S) origins.");
    }
    if (requireHttps && parsed.protocol !== "https:") {
      throw new Error("Production FRONTEND_ORIGINS entries must use HTTPS.");
    }
    const normalizedInput = origin.endsWith("/") ? origin.slice(0, -1) : origin;
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.origin !== normalizedInput ||
      parsed.username.length > 0 ||
      parsed.password.length > 0
    ) {
      throw new Error("FRONTEND_ORIGINS entries must be origins only (no paths or credentials).");
    }
    return parsed.origin;
  }))];
}

function assertProductionMongoTls(uri: string): void {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error("Production MONGODB_URI must be a valid MongoDB connection string.");
  }

  const tlsOptions = [
    ...parsed.searchParams.getAll("tls"),
    ...parsed.searchParams.getAll("ssl")
  ].map((value) => value.toLowerCase());

  if (tlsOptions.some((value) => value !== "true")) {
    throw new Error("Production MONGODB_URI must not disable TLS; any TLS option must be true.");
  }

  if (uri.toLowerCase().startsWith("mongodb+srv://")) {
    return;
  }

  if (tlsOptions.length === 0) {
    throw new Error("Production MONGODB_URI must enable TLS with tls=true (or ssl=true), or use mongodb+srv://.");
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const rawNodeEnv = env.NODE_ENV ?? "development";
  if (!["development", "test", "production"].includes(rawNodeEnv)) {
    throw new Error("NODE_ENV must be development, test, or production.");
  }

  const mongoUri = env.MONGODB_URI?.trim();
  if (!mongoUri) {
    throw new Error("Missing required environment variable: MONGODB_URI.");
  }
  if (!/^mongodb(?:\+srv)?:\/\//i.test(mongoUri)) {
    throw new Error("MONGODB_URI must use the mongodb:// or mongodb+srv:// scheme.");
  }

  if (rawNodeEnv === "production") {
    assertProductionMongoTls(mongoUri);
  }

  return {
    nodeEnv: rawNodeEnv as NodeEnvironment,
    port: parsePort(env.PORT),
    mongoUri,
    frontendOrigins: parseFrontendOrigins(env.FRONTEND_ORIGINS, rawNodeEnv === "production")
  };
}
