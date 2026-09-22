export interface JwtSecretOptions {
  /** Env var to read the signing secret from. Default: "JWT_SECRET". */
  envVar?: string;
  /** Minimum secret length required when NODE_ENV=production. Default: 32. */
  minLengthProd?: number;
}

export interface JwtSignOptions {
  /** Passed to jose's setExpirationTime — a span string ("24h", "7d") or a Unix timestamp. Default: "24h". */
  expiresIn?: string | number;
  /** Signing algorithm. Default: "HS256". */
  alg?: string;
}
