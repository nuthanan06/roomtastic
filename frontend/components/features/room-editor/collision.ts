import * as THREE from "three";
import { GRID_CELL, snapXZ } from "@/lib/gridSnap";
import type { ModelFootprint } from "./footprint";
import { isAncestorOf } from "./grouping";
import type { Placement } from "./placement";

/** Numeric slack for room bounds and floor checks. */
const EPS = 1e-4;

/**
 * AABBs that only touch on one face can still report intersection in three.js.
 * Keep a small contact slab so resting/adjacent furniture is not treated as blocked.
 */
const CONTACT_EPS = 0.032;

export type TransformSnapshot = {
  px: number;
  py: number;
  pz: number;
  ry: number;
  scale: number;
};

/** Core transform snapshot API used by drag/rotate/scale rollback paths. */
export function snapshotTransform(object: THREE.Object3D): TransformSnapshot {
  return {
    px: object.position.x,
    py: object.position.y,
    pz: object.position.z,
    ry: object.rotation.y,
    scale: object.scale.x,
  };
}

/** Restores the exact snapshot after a failed transform attempt. */
export function applyTransformSnapshot(object: THREE.Object3D, s: TransformSnapshot): void {
  object.position.set(s.px, s.py, s.pz);
  object.rotation.set(0, s.ry, 0);
  object.scale.setScalar(s.scale);
}

/**
 * Main drag-hover helper.
 * Room coordinates are centered at world origin, so valid X/Z are symmetric around 0.
 */
export function clampDropHoverXZ(
  x: number,
  z: number,
  fp: ModelFootprint,
  scale: number,
  roomHalfW: number,
  roomHalfL: number,
): { x: number; z: number } {
  return scaleFootprintCenterIfDegenerate(
    clampFootprintCenterToRoom(x, z, fp, scale, roomHalfW, roomHalfL),
    fp,
    scale,
    roomHalfW,
    roomHalfL,
  );
}

/**
 * Main free-cell search used when dropping from catalog.
 * Finds nearest snapped X/Z that fits in room bounds and does not overlap blocking geometry.
 */
export function findFreeDropXZ(
  x0: number,
  z0: number,
  fp: ModelFootprint,
  scale: number,
  objectMap: Map<string, THREE.Object3D>,
  roomHalfW: number,
  roomHalfL: number,
): { x: number; z: number } | null {
  const { x: cx, z: cz } = scaleFootprintCenterIfDegenerate(
    clampFootprintCenterToRoom(x0, z0, fp, scale, roomHalfW, roomHalfL),
    fp,
    scale,
    roomHalfW,
    roomHalfL,
  );
  const xStart = cx;
  const zStart = cz;
  const cell = GRID_CELL;
  const maxRing =
    Math.max(
      Math.ceil((roomHalfW * 2) / cell),
      Math.ceil((roomHalfL * 2) / cell),
      Math.ceil((fp.hx + fp.hz) / cell),
    ) + 24;

  const fitsAt = (x: number, z: number): boolean => {
    const baseY = supportSurfaceYAt(x, z, objectMap, undefined, undefined);
    const b = syntheticPlacementBoxOnSurface(x, z, baseY, fp, scale);
    if (!boxInsideRoomXZ(b, roomHalfW, roomHalfL)) return false;
    for (const other of objectMap.values()) {
      if (aabbBlockingOverlap(b, worldBox3(other))) return false;
    }
    return true;
  };

  for (let ring = 0; ring < maxRing; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dz = -ring; dz <= ring; dz++) {
        if (ring > 0 && Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
        const x = xStart + dx * cell;
        const z = zStart + dz * cell;
        if (fitsAt(x, z)) return { x, z };
      }
    }
  }
  return null;
}

/**
 * Main transform guard.
 * Ensures object sits on/above floor, stays in room bounds, and does not overlap unrelated objects.
 */
export function placementTransformAllowed(
  self: THREE.Object3D,
  selfId: string,
  objectMap: Map<string, THREE.Object3D>,
  placements: Placement[],
  roomHalfW: number,
  roomHalfL: number,
): boolean {
  clampObjectToFloorAndRoom(self, roomHalfW, roomHalfL);
  const box = worldBox3(self);
  if (box.min.y < -EPS) return false;
  if (!boxInsideRoomXZ(box, roomHalfW, roomHalfL)) return false;
  return !placementOverlapsAnyOther(self, selfId, objectMap, placements);
}

/**
 * Settles an object down onto its support surface.
 * Used after stack/attach operations to remove tiny air gaps.
 */
export function settleOntoSupportBelow(
  object: THREE.Object3D,
  selfId: string,
  objectMap: Map<string, THREE.Object3D>,
  placements: Placement[],
  roomHalfW: number,
  roomHalfL: number,
): void {
  object.updateMatrixWorld(true);
  const box = worldBox3(object);
  const targetBase = supportBaseUnderFootprint(box, objectMap, selfId, placements);
  const dy = targetBase - box.min.y;
  if (dy < -0.0005 && dy > -0.45) {
    object.position.y += dy;
    object.updateMatrixWorld(true);
    clampObjectToFloorAndRoom(object, roomHalfW, roomHalfL);
  }
}

/** Recompute current world AABB after forcing fresh world matrices. */
export function worldBox3(object: THREE.Object3D): THREE.Box3 {
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object);
}

/**
 * True only when overlap has interior volume.
 * If intersection thickness on any axis is <= 0, the boxes only touch, so this returns false.
 */
export function aabbBlockingOverlap(a: THREE.Box3, b: THREE.Box3): boolean {
  if (!a.intersectsBox(b)) return false;
  const ix = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
  const iy = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y);
  const iz = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
  if (ix <= 0 || iy <= 0 || iz <= 0) return false;

  // One thin overlap axis means a face-touch (resting or adjacency), not a blocking collision.
  if (iy <= CONTACT_EPS && ix > CONTACT_EPS && iz > CONTACT_EPS) return false;
  if (ix <= CONTACT_EPS && iy > CONTACT_EPS && iz > CONTACT_EPS) return false;
  if (iz <= CONTACT_EPS && iy > CONTACT_EPS && ix > CONTACT_EPS) return false;

  return true;
}

/** Room is centered at origin; box must stay within [-half, +half] in X and Z. */
export function boxInsideRoomXZ(box: THREE.Box3, roomHalfW: number, roomHalfL: number): boolean {
  return (
    box.min.x >= -roomHalfW - EPS &&
    box.max.x <= roomHalfW + EPS &&
    box.min.z >= -roomHalfL - EPS &&
    box.max.z <= roomHalfL + EPS
  );
}

/** Checks self against all other objects, skipping parent/child pairs. */
export function placementOverlapsAnyOther(
  self: THREE.Object3D,
  selfId: string,
  objectMap: Map<string, THREE.Object3D>,
  placements: Placement[],
): boolean {
  const box = worldBox3(self);
  for (const [id, other] of objectMap) {
    if (id === selfId) continue;
    if (skipCollisionPair(placements, selfId, id)) continue;
    if (aabbBlockingOverlap(box, worldBox3(other))) return true;
  }
  return false;
}

/**
 * Highest support surface under a sample point.
 * Returns room floor (0) or the highest object top under that X/Z.
 */
export function supportSurfaceYAt(
  x: number,
  z: number,
  objectMap: Map<string, THREE.Object3D>,
  excludeId?: string,
  placements?: Placement[],
): number {
  let maxY = 0;
  for (const [id, obj] of objectMap) {
    if (id === excludeId) continue;
    if (excludeId && placements && skipCollisionPair(placements, excludeId, id)) continue;
    const box = worldBox3(obj);
    if (x < box.min.x - EPS || x > box.max.x + EPS || z < box.min.z - EPS || z > box.max.z + EPS) {
      continue;
    }
    maxY = Math.max(maxY, box.max.y);
  }
  return maxY;
}

/**
 * Highest support needed under an entire footprint.
 * Samples corners + center, then picks max so the full footprint can rest safely.
 */
export function supportBaseUnderFootprint(
  foot: THREE.Box3,
  objectMap: Map<string, THREE.Object3D>,
  excludeId: string,
  placements: Placement[],
): number {
  const samples: Array<[number, number]> = [
    [foot.min.x, foot.min.z],
    [foot.max.x, foot.min.z],
    [foot.min.x, foot.max.z],
    [foot.max.x, foot.max.z],
    [(foot.min.x + foot.max.x) / 2, (foot.min.z + foot.max.z) / 2],
  ];
  let base = 0;
  for (const [sx, sz] of samples) {
    base = Math.max(base, supportSurfaceYAt(sx, sz, objectMap, excludeId, placements));
  }
  return base;
}

/** Synthetic AABB on floor for quick fit checks before placing. */
export function syntheticPlacementBox(
  x: number,
  z: number,
  fp: ModelFootprint,
  scale: number,
): THREE.Box3 {
  return syntheticPlacementBoxOnSurface(x, z, 0, fp, scale);
}

/** Synthetic AABB on an arbitrary support height (used for stacking checks). */
export function syntheticPlacementBoxOnSurface(
  x: number,
  z: number,
  baseY: number,
  fp: ModelFootprint,
  scale: number,
): THREE.Box3 {
  const sx = fp.hx * scale;
  const sz = fp.hz * scale;
  const top = fp.yTop * scale;
  return new THREE.Box3(
    new THREE.Vector3(x - sx, baseY, z - sz),
    new THREE.Vector3(x + sx, baseY + top, z + sz),
  );
}

/** Keep object center in room bounds and snap to grid. */
function clampFootprintCenterToRoom(
  x: number,
  z: number,
  fp: ModelFootprint,
  scale: number,
  roomHalfW: number,
  roomHalfL: number,
): { x: number; z: number } {
  const sx = fp.hx * scale;
  const sz = fp.hz * scale;
  const minCx = -roomHalfW + sx;
  const maxCx = roomHalfW - sx;
  const minCz = -roomHalfL + sz;
  const maxCz = roomHalfL - sz;
  let cx = x;
  let cz = z;

  if (minCx <= maxCx) cx = Math.min(maxCx, Math.max(minCx, x));
  else cx = 0;
  if (minCz <= maxCz) cz = Math.min(maxCz, Math.max(minCz, z));
  else cz = 0;

  const [qx, qz] = snapXZ(cx, cz);
  return { x: qx, z: qz };
}

/** If footprint is wider than room on one axis, lock that axis to center (0). */
function scaleFootprintCenterIfDegenerate(
  center: { x: number; z: number },
  fp: ModelFootprint,
  scale: number,
  roomHalfW: number,
  roomHalfL: number,
): { x: number; z: number } {
  const sx = fp.hx * scale;
  const sz = fp.hz * scale;
  let x = center.x;
  let z = center.z;
  if (sx > roomHalfW + EPS) x = 0;
  if (sz > roomHalfL + EPS) z = 0;
  const [qx, qz] = snapXZ(x, z);
  return { x: qx, z: qz };
}

/** Skip collisions between parent and descendant since they are intentionally attached. */
function skipCollisionPair(placements: Placement[], idA: string, idB: string): boolean {
  return isAncestorOf(placements, idA, idB) || isAncestorOf(placements, idB, idA);
}

/** Clamp world transform so AABB stays in room and above floor. */
export function clampObjectToFloorAndRoom(
  object: THREE.Object3D,
  roomHalfW: number,
  roomHalfL: number,
): void {
  const maxIters = 12;
  for (let i = 0; i < maxIters; i++) {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    if (box.min.y < 0) {
      object.position.y -= box.min.y;
      continue;
    }
    if (box.min.x < -roomHalfW) {
      object.position.x += -roomHalfW - box.min.x;
      continue;
    }
    if (box.max.x > roomHalfW) {
      object.position.x += roomHalfW - box.max.x;
      continue;
    }
    if (box.min.z < -roomHalfL) {
      object.position.z += -roomHalfL - box.min.z;
      continue;
    }
    if (box.max.z > roomHalfL) {
      object.position.z += roomHalfL - box.max.z;
      continue;
    }
    break;
  }
  object.updateMatrixWorld(true);
}
