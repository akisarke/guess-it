export type OriginDecision =
  | { allowed: true; origin: string }
  | { allowed: false; reason: 'missing' | 'malformed' | 'disallowed' };

export function parseExactOrigin(value: string): URL {
  const parsed = new URL(value);
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.origin !== value) {
    throw new TypeError('Origin must be an exact origin');
  }
  return parsed;
}

export function decideOrigin(origin: string | undefined, allowedOrigins: readonly string[]): OriginDecision {
  if (!origin) return { allowed: false, reason: 'missing' };
  let parsed: URL;
  try {
    parsed = parseExactOrigin(origin);
  } catch {
    return { allowed: false, reason: 'malformed' };
  }
  return allowedOrigins.includes(parsed.origin)
    ? { allowed: true, origin: parsed.origin }
    : { allowed: false, reason: 'disallowed' };
}

export function decideWebSocketOrigin(origin: string | undefined, allowedOrigins: readonly string[]): boolean {
  return decideOrigin(origin, allowedOrigins).allowed;
}

