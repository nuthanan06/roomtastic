import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { NextResponse } from "next/server";
import { EMBEDDED_KHRONOS_BOX_GLB_BASE64, EMBEDDED_MOCK_NAMES } from "../embeddedMockBoxGlb";

const NAME = /^[a-z0-9_-]+$/i;

function diskPathCandidates(file: string): string[] {
  const cwd = process.cwd();
  const routeDir = dirname(fileURLToPath(import.meta.url));
  // route.ts lives in app/api/mock-models/[name]/ → project root is four levels up
  const fromRouteFile = join(routeDir, "..", "..", "..", "..", "public", "mock-models", file);
  return [
    join(cwd, "public", "mock-models", file),
    join(cwd, "frontend", "public", "mock-models", file),
    join(cwd, "..", "frontend", "public", "mock-models", file),
    join(cwd, "..", "public", "mock-models", file),
    fromRouteFile,
  ];
}

function resolveMockGlbDiskPath(basenameNoExt: string): string | null {
  const file = `${basenameNoExt}.glb`;
  for (const p of diskPathCandidates(file)) {
    if (existsSync(p)) return p;
  }
  return null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!NAME.test(name)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const key = name.toLowerCase();
  let body: Buffer | undefined;

  const fp = resolveMockGlbDiskPath(name);
  if (fp) {
    try {
      body = await readFile(fp);
    } catch {
      /* fall through */
    }
  }

  if (!body && EMBEDDED_MOCK_NAMES.has(key)) {
    body = Buffer.from(EMBEDDED_KHRONOS_BOX_GLB_BASE64, "base64");
  }

  if (!body) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "model/gltf-binary",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
