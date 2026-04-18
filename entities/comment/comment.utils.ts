// Utility helpers for `Comment` entity.

export const truncate = (text?: string, len = 200): string => {
  if (!text) return "";
  return text.length <= len ? text : `${text.slice(0, len).trimEnd()}...`;
};
