import type { FurnitureOut, InventoryOut } from "@/lib/roomApiTypes";
import { parseCoordsJson } from "@/lib/gridSnap";

export type Placement = {
  clientId: string;
  furnitureId?: string;
  inventoryId?: string | null;
  glbUrl: string;
  label: string;
  position: [number, number, number];
  rotationY: number;
  scale: number;
};

const FALLBACK_GLB = "/mock-models/chair.glb";

export function inventoryToGlb(inv: { model_url?: string | null } | null | undefined): string {
  const u = inv?.model_url;
  if (
    u &&
    (u.endsWith(".glb") ||
      u.endsWith(".gltf") ||
      u.includes("/api/mock-models/") ||
      u.includes("/mock-models/"))
  ) {
    return u;
  }
  return FALLBACK_GLB;
}

export function furnitureToPlacement(f: FurnitureOut, invById: Map<string, InventoryOut>): Placement {
  const c = parseCoordsJson(f.coordinates);
  const inv = f.inventory_id ? invById.get(f.inventory_id) : undefined;
  return {
    clientId: f.furniture_id,
    furnitureId: f.furniture_id,
    inventoryId: f.inventory_id,
    glbUrl: inventoryToGlb(inv),
    label: f.name_of_furniture || "Item",
    position: [c.x, c.y, c.z],
    rotationY: ((f.rotation ?? 0) * Math.PI) / 180,
    scale: c.scale ?? 1,
  };
}

export function newPlacementFromCatalog(opts: {
  glbUrl: string;
  label: string;
  inventoryId?: string | null;
  x: number;
  z: number;
}): Placement {
  /** y=0: PlacedModel normalizes GLB so its bottom sits on the floor */
  const y = 0;
  return {
    clientId: crypto.randomUUID(),
    inventoryId: opts.inventoryId ?? null,
    glbUrl: opts.glbUrl,
    label: opts.label,
    position: [opts.x, y, opts.z],
    rotationY: 0,
    scale: 1,
  };
}
