import { scrypt as _scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { HASH_DEFAULTS } from "./auth.constants";
import type { HashOptions } from "./auth.types";

const scrypt = promisify(_scrypt);

export const hashPassword = async (
  password: string,
  opts?: HashOptions,
): Promise<string> => {
  if (!password) throw new Error("Password is required for hashing");
  const cfg = { ...HASH_DEFAULTS, ...(opts || {}) };
  const salt = randomBytes(cfg.saltBytes).toString("hex");
  const derived = (await scrypt(password, salt, cfg.keyLen)) as Buffer;
  return `${salt}:${derived.toString(cfg.encoding)}`;
};

export const verifyPassword = async (
  password: string,
  stored: string,
  opts?: HashOptions,
): Promise<boolean> => {
  if (!password || !stored) return false;
  const cfg = { ...HASH_DEFAULTS, ...(opts || {}) };
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  // biome-ignore lint/style/noNonNullAssertion: length check above guarantees these exist
  const salt = parts[0]!;
  // biome-ignore lint/style/noNonNullAssertion: length check above guarantees these exist
  const key = parts[1]!;
  const derived = (await scrypt(password, salt, cfg.keyLen)) as Buffer;
  const storedKey = Buffer.from(key, cfg.encoding);
  if (storedKey.length !== derived.length) return false;
  return timingSafeEqual(derived, storedKey);
};
