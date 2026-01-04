export interface HashOptions {
  saltBytes?: number;
  keyLen?: number;
  encoding?: 'hex' | 'base64';
}

export function hashPassword(password: string, opts?: HashOptions): Promise<string>;
export function getPasswordHash(password: string, opts?: HashOptions): string;
export function verifyPassword(password: string, stored: string, opts?: HashOptions): Promise<boolean>;
export function isBcryptHash(stored?: string): boolean;
export function rehashIfBcrypt(
  password: string,
  stored: string,
  onRehash?: (newHash: string) => Promise<void>,
  bcryptCompare?: (password: string, stored: string) => Promise<boolean>
): Promise<boolean>;
