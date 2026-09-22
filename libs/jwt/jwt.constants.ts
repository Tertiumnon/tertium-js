import type { JwtSecretOptions, JwtSignOptions } from "./jwt.types";

export const JWT_SECRET_DEFAULTS: Required<JwtSecretOptions> = {
  envVar: "JWT_SECRET",
  minLengthProd: 32,
};

export const JWT_SIGN_DEFAULTS: Required<JwtSignOptions> = {
  alg: "HS256",
  expiresIn: "24h",
};
