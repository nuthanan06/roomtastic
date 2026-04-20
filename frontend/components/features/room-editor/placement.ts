import { parseCoordsJson } from "@/lib/gridSnap";
import type { FurnitureOut, InventoryOut } from "@/types/api";

export type Placement = {
  clientId: string;
  furnitureId?: string;
  inventoryId?: string | null;
  glbUrl: string;
  label: string;
  position: [number, number, number];
  rotationY: number;
  scale: number;
  /** When set, this piece is nested under another (decor on furniture). */
  parentClientId?: string | null;
  /** Transform relative to parent (required when parentClientId is set). */
  localPosition?: [number, number, number];
  localRotationY?: number;
  localScale?: number;
};

const FALLBACK_GLB = "/mock-models/chair.glb";

/**
 * Main hydration path from backend furniture rows -> in-editor placement model.
 * Keeps world transforms in meters/radians and resolves model URL via inventory fallback.
 */
export function furnitureToPlacement(
  f: FurnitureOut,
  invById: Map<string, InventoryOut>,
): Placement {
  const c = parseCoordsJson(f.coordinates);
  const inv = f.inventory_id ? invById.get(f.inventory_id) : undefined;
  return {
    clientId: f.furniture_id,
    furnitureId: f.furniture_id,
    inventoryId: f.inventory_id,
    glbUrl: inventoryToGlb(inv),
    label: f.name_of_furniture || "Item",
    position: [0, 0, 0],
    rotationY: ((f.rotation ?? 0) * Math.PI) / 180,
    scale: c.scale ?? 1,
  };
}

/**
 * Main creation path for catalog drops.
 * Spawn as root placement; scene logic later resolves free X/Z and support Y.
 */
export function newPlacementFromCatalog(opts: {
  glbUrl: string;
  label: string;
  inventoryId?: string | null;
  x: number;
  z: number;
}): Placement {
  return {
    clientId: crypto.randomUUID(),
    inventoryId: opts.inventoryId ?? null,
    glbUrl: opts.glbUrl,
    label: opts.label,
    position: [0, 0, 0],
    rotationY: 0,
    scale: 1,
  };
}

/** Resolves a backend inventory row to a loader-safe GLB URL with fallback. */
export function inventoryToGlb(inv: { model_url?: string | null } | null | undefined): string {
  const u = inv?.model_url;
  if (
    u &&
    (u.endsWith(".glb") || u.endsWith(".gltf") || u.includes("/mock-models/"))
  ) {
    return u;
  }
  return FALLBACK_GLB;
}
