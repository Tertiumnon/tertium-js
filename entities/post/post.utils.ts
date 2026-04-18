// Utility helpers for `Post` entity.

export const excerpt = (text?: string, len = 140): string => {
  if (!text) return "";
  return text.length <= len ? text : `${text.slice(0, len).trimEnd()}...`;
};
