import type { Metadata } from "next";
import Link from "next/link";
import { MockModelsPreviewClient } from "@/components/mock-models-preview/MockModelsPreviewClient";
import { MOCK_CATALOG } from "@/lib/mockCatalog";

export const metadata: Metadata = {
  title: "Mock GLB preview — Roomtastic",
  description: "Quick check that catalog GLBs load and render in the WebGL viewer.",
};

export default function MockModelsPreviewPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-800 px-4 py-3">
        <div>
          <h1 className="text-base font-semibold text-white">Mock GLB preview</h1>
          <p className="text-xs text-zinc-500">Orbit with mouse · same loader &amp; scale as the room editor</p>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/" className="text-indigo-400 hover:text-indigo-300">
            Home
          </Link>
        </nav>
      </header>

      <div className="min-h-[min(70vh,560px)] flex-1">
        <MockModelsPreviewClient />
      </div>

      <footer className="shrink-0 border-t border-zinc-800 px-4 py-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Catalog (left → right)</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-400">
          {MOCK_CATALOG.map((item) => (
            <li key={item.id}>
              <span className="text-zinc-200">{item.label}</span>
              <code className="ml-1.5 text-xs text-zinc-500">{item.glbUrl}</code>
            </li>
          ))}
        </ul>
      </footer>
    </div>
  );
}
