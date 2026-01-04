import { randomBytes, scrypt as _scrypt, scryptSync, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(_scrypt);

export interface HashOptions {
  saltBytes?: number;
  keyLen?: number;
  encoding?: 'hex' | 'base64';
}

const DEFAULTS: Required<HashOptions> = {
  saltBytes: 16,
  keyLen: 64,
  encoding: 'hex',
};

export async function hashPassword(password: string, opts?: HashOptions): Promise<string> {
  if (!password) throw new Error('Password is required for hashing');
  const cfg = { ...DEFAULTS, ...(opts || {}) };
  const salt = randomBytes(cfg.saltBytes).toString('hex');
  const derived = (await scrypt(password, salt, cfg.keyLen)) as Buffer;
  return `${salt}:${derived.toString(cfg.encoding)}`;
}

export function getPasswordHash(password: string, opts?: HashOptions): string {
  if (!password) throw new Error('Password is required for hashing');
  const cfg = { ...DEFAULTS, ...(opts || {}) };
  const salt = randomBytes(cfg.saltBytes).toString('hex');
  const derived = scryptSync(password, salt, cfg.keyLen) as Buffer;
  return `${salt}:${derived.toString(cfg.encoding)}`;
}

export async function verifyPassword(password: string, stored: string, opts?: HashOptions): Promise<boolean> {
  if (!password || !stored) return false;
  const cfg = { ...DEFAULTS, ...(opts || {}) };
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  const derived = (await scrypt(password, salt, cfg.keyLen)) as Buffer;
  const storedKey = Buffer.from(key, cfg.encoding);
  if (storedKey.length !== derived.length) return false;
  return timingSafeEqual(derived, storedKey);
}

export function isBcryptHash(stored?: string): boolean {
  if (!stored) return false;
  return stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$');
}

export async function rehashIfBcrypt(
  password: string,
  stored: string,
  onRehash?: (newHash: string) => Promise<void>,
  bcryptCompare?: (password: string, stored: string) => Promise<boolean>
): Promise<boolean> {
  if (!stored) return false;
  if (isBcryptHash(stored)) {
    if (!bcryptCompare) throw new Error('bcryptCompare function is required to migrate bcrypt hashes');
    const valid = await bcryptCompare(password, stored);
    if (!valid) return false;
    const newHash = await hashPassword(password);
    if (onRehash) await onRehash(newHash);
    return true;
  }
  return verifyPassword(password, stored);
}
