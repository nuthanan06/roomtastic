/** Normalize unknown payloads to arrays for safer UI rendering. */
export function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
