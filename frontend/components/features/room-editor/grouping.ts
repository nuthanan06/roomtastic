import * as THREE from "three";
import type { Placement } from "./placement";

/** Fast lookup helper used across selection/grouping flows. */
export function placementById(placements: Placement[], id: string): Placement | undefined {
  return placements.find((p) => p.clientId === id);
}

/** Primary grouping read path: roots are floor-level pieces with no parent. */
export function rootPlacements(placements: Placement[]): Placement[] {
  return placements.filter((p) => !p.parentClientId);
}

/** Primary grouping read path: children attached under a specific parent id. */
export function childPlacements(placements: Placement[], parentId: string): Placement[] {
  return placements.filter((p) => p.parentClientId === parentId);
}

/**
 * Prevents invalid parent assignment.
 * Returns true when parent <- child would create a loop in the hierarchy.
 */
export function wouldCreateCycle(
  placements: Placement[],
  parentId: string,
  childId: string,
): boolean {
  if (parentId === childId) return true;
  return isAncestorOf(placements, childId, parentId);
}

/** True when `ancestorId` appears anywhere above `nodeId` in the parent chain. */
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

/**
 * Converts child world transform into parent-local transform.
 * Keeps Y-up rotation convention and writes uniform local scale.
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
