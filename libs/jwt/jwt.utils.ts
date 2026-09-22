import {
  type JWTPayload,
  type JWTVerifyOptions,
  jwtVerify,
  type KeyInput,
  SignJWT,
} from "jose";
import { JWT_SECRET_DEFAULTS, JWT_SIGN_DEFAULTS } from "./jwt.constants";
import type { JwtSecretOptions, JwtSignOptions } from "./jwt.types";

// Node/Bun/Deno-style runtimes only (reads `process.env`) - unlike the rest of
// this module, which is pure jose/Web Crypto and runs anywhere JS does. A
// browser or edge worker should get its key some other way and skip this.
//
// No dev-only fallback: a missing secret is always a hard error, not a
// silently-generated weak default, so a misconfigured environment fails at
// startup instead of quietly issuing tokens no other instance can verify.
export const resolveJwtSecret = (opts?: JwtSecretOptions): Uint8Array => {
  const cfg = { ...JWT_SECRET_DEFAULTS, ...(opts || {}) };
  const secret = process.env[cfg.envVar];

  if (!secret) {
    throw new Error(`${cfg.envVar} environment variable is required`);
  }

  const isProduction = process.env["NODE_ENV"] === "production";
  if (isProduction && secret.length < cfg.minLengthProd) {
    throw new Error(
      `${cfg.envVar} must be at least ${cfg.minLengthProd} characters in production`,
    );
  }

  return new TextEncoder().encode(secret);
};

// Payload shape is caller-defined (a userId+role admin token looks nothing like
// a refresh token) - just include iss/sub/aud/nbf/jti directly in `payload`
// if you need them, jose reads those straight off the object. `iat`/`exp` are
// controlled here instead, so every token gets them consistently.
// `key` accepts anything jose's SignJWT does: a raw shared secret (from
// `resolveJwtSecret`) for HS256, or a CryptoKey/KeyObject/JWK private key for
// an asymmetric algorithm (set `opts.alg` to match, e.g. "RS256"/"ES256").
export const generateToken = async <T extends Record<string, unknown>>(
  payload: T,
  key: KeyInput,
  opts?: JwtSignOptions,
): Promise<string> => {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: opts?.alg ?? JWT_SIGN_DEFAULTS.alg })
    .setIssuedAt()
    .setExpirationTime(opts?.expiresIn ?? JWT_SIGN_DEFAULTS.expiresIn)
    .sign(key);
};

// Verifies a raw token and hands the decoded payload to `isValidPayload` -
// callers own their own payload shape and narrow it themselves, since a
// generic library has no way to know which claims a given token must carry.
// `verifyOptions` is jose's own JWTVerifyOptions (issuer/audience/subject/
// clockTolerance/maxTokenAge/requiredClaims/algorithms) forwarded as-is,
// rather than reinventing claim checks this library already does correctly.
// Never throws: an expired/malformed/wrong-shape/claim-mismatched token is
// just `null`.
export const verifyToken = async <T>(
  token: string,
  key: KeyInput,
  isValidPayload: (payload: JWTPayload) => payload is JWTPayload & T,
  verifyOptions?: JWTVerifyOptions,
): Promise<T | null> => {
  try {
    const { payload } = await jwtVerify(token, key, verifyOptions);
    return isValidPayload(payload) ? payload : null;
  } catch {
    return null;
  }
};

// Convenience wrapper for the near-universal "Authorization: Bearer <token>"
// case - strips the prefix and delegates to verifyToken, returning null for
// a missing/malformed header instead of making every caller check it first.
export const verifyAuthHeader = <T>(
  authHeader: string | undefined,
  key: KeyInput,
  isValidPayload: (payload: JWTPayload) => payload is JWTPayload & T,
  verifyOptions?: JWTVerifyOptions,
): Promise<T | null> => {
  if (!authHeader?.startsWith("Bearer ")) return Promise.resolve(null);
  return verifyToken(authHeader.slice(7), key, isValidPayload, verifyOptions);
};
