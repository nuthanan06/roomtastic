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

// ─── Public entry points ────────────────────────────────────────────────────

/**
 * Hydrates a backend FurnitureOut row into an in-editor Placement.
 * Keeps world transforms in meters/radians and resolves the model URL via inventory.
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
 * Creates a new root Placement for a catalog or inventory drop.
 * Position is left at origin; scene logic resolves the free X/Z and support Y.
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

// ─── Support utility ────────────────────────────────────────────────────────

/** Resolves an inventory row to a loader-safe GLB URL. Returns empty string if no valid URL. */
export function inventoryToGlb(inv: { model_url?: string | null } | null | undefined): string {
  const u = inv?.model_url;
  return u && (u.endsWith(".glb") || u.endsWith(".gltf")) ? u : "";
}
