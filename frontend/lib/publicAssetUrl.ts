/** Absolute URL for /public assets so GLTFLoader always hits the Next host (avoids HTML fallbacks). */
export function publicAssetUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (typeof window === "undefined") return path;
  if (path.startsWith("/")) return new URL(path, window.location.origin).href;
  return path;
}
