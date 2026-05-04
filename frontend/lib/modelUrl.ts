/** Drag payload & loaders often use full origin URLs; normalize so checks and three.js cache stay consistent. */
export function canonicalModelUrlForLoader(raw: string): string {
  const s = raw.trim();
  if (typeof window === "undefined") return s;
  try {
    const u = new URL(s, window.location.origin);
    if (u.origin === window.location.origin) return `${u.pathname}${u.search}`;
  } catch {
    /* keep as-is */
  }
  return s;
}

export function isRecognizedModelUrl(raw: string): boolean {
  return /\.(glb|gltf)(\?|$)/i.test(raw.trim());
}
