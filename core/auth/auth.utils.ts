import {
  scrypt as _scrypt,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import type { HashOptions } from "./auth.types";

const scrypt = promisify(_scrypt);

const DEFAULTS: Required<HashOptions> = {
  saltBytes: 16,
  keyLen: 64,
  encoding: "hex",
};

export const hashPassword = async (
  password: string,
  opts?: HashOptions,
): Promise<string> => {
  if (!password) throw new Error("Password is required for hashing");
  const cfg = { ...DEFAULTS, ...(opts || {}) };
  const salt = randomBytes(cfg.saltBytes).toString("hex");
  const derived = (await scrypt(password, salt, cfg.keyLen)) as Buffer;
  return `${salt}:${derived.toString(cfg.encoding)}`;
};

export const getPasswordHash = (
  password: string,
  opts?: HashOptions,
): string => {
  if (!password) throw new Error("Password is required for hashing");
  const cfg = { ...DEFAULTS, ...(opts || {}) };
  const salt = randomBytes(cfg.saltBytes).toString("hex");
  const derived = scryptSync(password, salt, cfg.keyLen) as Buffer;
  return `${salt}:${derived.toString(cfg.encoding)}`;
};

export const verifyPassword = async (
  password: string,
  stored: string,
  opts?: HashOptions,
): Promise<boolean> => {
  if (!password || !stored) return false;
  const cfg = { ...DEFAULTS, ...(opts || {}) };
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

export const isBcryptHash = (stored?: string): boolean => {
  if (!stored) return false;
  return (
    stored.startsWith("$2a$") ||
    stored.startsWith("$2b$") ||
    stored.startsWith("$2y$")
  );
};

export const rehashIfBcrypt = async (
  password: string,
  stored: string,
  onRehash?: (newHash: string) => Promise<void>,
  bcryptCompare?: (password: string, stored: string) => Promise<boolean>,
): Promise<boolean> => {
  if (!stored) return false;
  if (isBcryptHash(stored)) {
    if (!bcryptCompare)
      throw new Error(
        "bcryptCompare function is required to migrate bcrypt hashes",
      );
    const valid = await bcryptCompare(password, stored);
    if (!valid) return false;
    const newHash = await hashPassword(password);
    if (onRehash) await onRehash(newHash);
    return true;
  }
  return verifyPassword(password, stored);
};
