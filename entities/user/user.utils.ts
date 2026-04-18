// Utility helpers for `User` entity.
// Add shared helper functions here as needed.

export const normalizePhone = (
  v?: number | string | null,
): number | undefined => {
  if (v == null) return undefined;
  if (typeof v === "number") return v;
  const digits = String(v).replace(/[^0-9]/g, "");
  return digits ? Number(digits) : undefined;
};
