import * as THREE from "three";
import { GRID_CELL } from "@/lib/gridSnap";
import { normalizeClonedGltfRoot } from "./modelFit";

export type ModelFootprint = { hx: number; hz: number; yTop: number };

export const DEFAULT_MODEL_FOOTPRINT: ModelFootprint = { hx: 0.45, hz: 0.45, yTop: 0.9 };

/**
 * Primary footprint extractor.
 * Matches the same normalize step used when rendering, so collision math stays consistent.
 */
export function footprintFromGltfScene(scene: THREE.Object3D): ModelFootprint {
  const root = scene.clone(true);
  normalizeClonedGltfRoot(root);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  return { hx: size.x / 2, hz: size.z / 2, yTop: Math.max(box.max.y, 1e-3) };
}

/**
 * Primary grid-preview helper.
 * Returns snapped cell centers that intersect the footprint rectangle in X/Z.
 */
export function collectFootprintCellCenters(
  cx: number,
  cz: number,
  hx: number,
  hz: number,
  roomHalfW: number,
  roomHalfL: number,
  cell: number = GRID_CELL,
): Array<[number, number]> {
  const half = cell / 2;
  const fx0 = cx - hx;
  const fx1 = cx + hx;
  const fz0 = cz - hz;
  const fz1 = cz + hz;
  const nMin = Math.floor(Math.min(fx0, fx1) / cell);
  const nMax = Math.ceil(Math.max(fx0, fx1) / cell);
  const mMin = Math.floor(Math.min(fz0, fz1) / cell);
  const mMax = Math.ceil(Math.max(fz0, fz1) / cell);
  const out: Array<[number, number]> = [];

  for (let n = nMin; n <= nMax; n++) {
    const x = n * cell;
    if (x < -roomHalfW - half || x > roomHalfW + half) continue;
    const cellMinX = x - half;
    const cellMaxX = x + half;
    if (cellMaxX < fx0 - 1e-6 || cellMinX > fx1 + 1e-6) continue;

    for (let m = mMin; m <= mMax; m++) {
      const z = m * cell;
      if (z < -roomHalfL - half || z > roomHalfL + half) continue;
      const cellMinZ = z - half;
      const cellMaxZ = z + half;
      if (cellMaxZ < fz0 - 1e-6 || cellMinZ > fz1 + 1e-6) continue;
      out.push([x, z]);
    }
  }

  return out;
}
