export type MockCatalogItem = {
  id: string;
  label: string;
  glbUrl: string;
  accent: string;
};

/**
 * GLB files live in /public/mock-models/<name>.glb. Served as static assets at /mock-models/…
 * (more reliable in Docker/Turbopack than a dynamic App Router API route).
 */
export const MOCK_CATALOG: MockCatalogItem[] = [
  { id: "mock-sofa", label: "Sofa", glbUrl: "/mock-models/sofa.glb", accent: "bg-indigo-500/30" },
  { id: "mock-table", label: "Table", glbUrl: "/mock-models/table.glb", accent: "bg-sky-500/30" },
  {
    id: "mock-chair",
    label: "Chair",
    glbUrl: "/mock-models/chair.glb",
    accent: "bg-violet-500/30",
  },
  { id: "mock-lamp", label: "Lamp", glbUrl: "/mock-models/lamp.glb", accent: "bg-fuchsia-500/30" },
  { id: "mock-rug", label: "Rug", glbUrl: "/mock-models/rug.glb", accent: "bg-indigo-600/30" },
];

export const DRAG_MIME = "application/x-roomtastic-model";
