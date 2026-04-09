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

function isMockModelPathname(pathname: string): boolean {
  return (
    /^\/api\/mock-models\/[a-z0-9_-]+$/i.test(pathname) ||
    /^\/mock-models\/[a-z0-9_-]+\.glb$/i.test(pathname)
  );
}

export function isRecognizedModelUrl(raw: string): boolean {
  const s = raw.trim();
  if (/\.(glb|gltf)(\?|$)/i.test(s)) return true;
  try {
    const pathname = new URL(
      s,
      typeof window !== "undefined" ? window.location.origin : "http://localhost",
    ).pathname;
    return isMockModelPathname(pathname);
  } catch {
    return isMockModelPathname(s);
  }
}
