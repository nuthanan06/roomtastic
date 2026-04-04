import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** /api/mock-models/foo.glb breaks App Router matching; rewrite to extensionless route. */
export function middleware(request: NextRequest) {
  const m = request.nextUrl.pathname.match(/^\/api\/mock-models\/([^/]+)\.glb$/i);
  if (!m) return NextResponse.next();
  const base = m[1];
  if (!/^[a-z0-9_-]+$/i.test(base)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/api/mock-models/${base}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: "/api/mock-models/:path*",
};
