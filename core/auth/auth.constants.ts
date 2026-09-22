import type { HashOptions } from "./auth.types";

export const HASH_DEFAULTS: Required<HashOptions> = {
  saltBytes: 16,
  keyLen: 64,
  encoding: "hex",
};
