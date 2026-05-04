import * as THREE from "three";
import type { Placement } from "./placement";

// ─── Public read paths ──────────────────────────────────────────────────────

/** Returns all floor-level pieces (no parent) used to drive scene root rendering. */
export function rootPlacements(placements: Placement[]): Placement[] {
  return placements.filter((p) => !p.parentClientId);
}

/** Returns all pieces attached under a specific parent; used to render child decor. */
export function childPlacements(placements: Placement[], parentId: string): Placement[] {
  return placements.filter((p) => p.parentClientId === parentId);
}

// ─── Group mutation guards ──────────────────────────────────────────────────

/**
 * Guards before assigning a new parent.
 * Returns true when making childId a child of parentId would create a loop in the hierarchy.
 */
export function wouldCreateCycle(
  placements: Placement[],
  parentId: string,
  childId: string,
): boolean {
  if (parentId === childId) return true;
  return isAncestorOf(placements, childId, parentId);
}

/**
 * Computes the child's transform expressed in parent-local space.
 * Called when attaching a piece to a base so it stays in the same world position.
 */
export function computeLocalUnderParent(
  parentObj: THREE.Object3D,
  childObj: THREE.Object3D,
): { localPosition: [number, number, number]; localRotationY: number; localScale: number } {
  parentObj.updateMatrixWorld(true);
  childObj.updateMatrixWorld(true);
  const invParent = new THREE.Matrix4().copy(parentObj.matrixWorld).invert();
  const rel = new THREE.Matrix4().multiplyMatrices(invParent, childObj.matrixWorld);
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  rel.decompose(pos, quat, scale);
  const euler = new THREE.Euler().setFromQuaternion(quat, "YXZ");
  const s = (scale.x + scale.y + scale.z) / 3 || 1;
  return {
    localPosition: [pos.x, pos.y, pos.z],
    localRotationY: euler.y,
    localScale: s,
  };
}

// ─── Support utilities ──────────────────────────────────────────────────────

/** Walks the parent chain to check whether ancestorId appears above nodeId. */
export function isAncestorOf(placements: Placement[], ancestorId: string, nodeId: string): boolean {
  let cur: string | null | undefined = placementById(placements, nodeId)?.parentClientId ?? null;
  const seen = new Set<string>();
  while (cur) {
    if (cur === ancestorId) return true;
    if (seen.has(cur)) break;
    seen.add(cur);
    cur = placementById(placements, cur)?.parentClientId ?? null;
  }
  return false;
}

/** Primitive O(n) lookup used by isAncestorOf and collision skip logic. */
export function placementById(placements: Placement[], id: string): Placement | undefined {
  return placements.find((p) => p.clientId === id);
}
