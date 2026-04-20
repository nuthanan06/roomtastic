export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "") ?? "http://localhost:8000/api";

export async function apiFetch<T>(
  path: string,
  opts: RequestInit & { token?: string } = {},
): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers = new Headers(opts.headers);
  headers.set("Content-Type", "application/json");
  if (opts.token) headers.set("Authorization", `Bearer ${opts.token}`);

  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = (j?.detail as string) || msg;
    } catch {
      // Keep fallback status text.
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}
