import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const SCRYPT_COST = 32_768;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELISM = 1;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      KEY_BYTES,
      {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELISM,
        maxmem: SCRYPT_MAX_MEMORY
      },
      (error, derivedKey) => error ? reject(error) : resolve(derivedKey as Buffer)
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 14 || password.length > 128) {
    throw new Error("Administrator passwords must be between 14 and 128 characters.");
  }
  if (Buffer.byteLength(password, "utf8") > 1024) {
    throw new Error("Password is too long.");
  }

  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, salt);
  return [
    "scrypt",
    String(SCRYPT_COST),
    String(SCRYPT_BLOCK_SIZE),
    String(SCRYPT_PARALLELISM),
    salt.toString("base64url"),
    key.toString("base64url")
  ].join("$");
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$");
  if (
    parts.length !== 6 ||
    parts[0] !== "scrypt" ||
    parts[1] !== String(SCRYPT_COST) ||
    parts[2] !== String(SCRYPT_BLOCK_SIZE) ||
    parts[3] !== String(SCRYPT_PARALLELISM)
  ) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4] ?? "", "base64url");
    expected = Buffer.from(parts[5] ?? "", "base64url");
  } catch {
    return false;
  }
  if (salt.length !== SALT_BYTES || expected.length !== KEY_BYTES) return false;
  if (Buffer.byteLength(password, "utf8") > 1024) return false;

  const actual = await deriveKey(password, salt);
  return timingSafeEqual(actual, expected);
}

// A random dummy hash makes unknown-account login attempts perform the same KDF.
export const DUMMY_PASSWORD_HASH = await hashPassword(
  randomBytes(32).toString("base64url") + "Aa9!"
);
