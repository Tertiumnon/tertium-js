export const ENV_FILE_SUGGESTIONS = [
  ".env",
  ".env.dev",
  ".env.prod",
  ".env.staging",
];

// Marks a local env file as written by `sync` rather than hand-edited, so `push` can
// warn before re-uploading a synced copy (with its header) back over the real source.
export const SYNC_HEADER_PREFIX = "# auto-synced from AWS SSM";
