const IFAME_SRC_PATTERN = /src=['"]([^'"]+)['"]/i;

const normalizeEmbedValue = (value: string) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const htmlMatch = trimmed.match(IFAME_SRC_PATTERN);
  if (htmlMatch?.[1]) return htmlMatch[1].trim();

  return trimmed;
};

export const resolveEmbedSource = (...keys: string[]) => {
  for (const key of keys) {
    const raw = process.env[key];
    const resolved = normalizeEmbedValue(String(raw || ''));
    if (resolved) return resolved;
  }
  return '';
};

export const collectEmbedOrigins = (...keys: string[]) => {
  const origins = new Set<string>();

  for (const key of keys) {
    const raw = process.env[key];
    const resolved = normalizeEmbedValue(String(raw || ''));
    if (!resolved) continue;

    try {
      origins.add(new URL(resolved).origin);
    } catch {
      // Ignore non-URL values.
    }
  }

  return Array.from(origins);
};
