import * as THREE from "three";
import type { Placement } from "./placement";

export function placementById(placements: Placement[], id: string): Placement | undefined {
  return placements.find((p) => p.clientId === id);
}

/** True if `ancestorId` appears somewhere above `nodeId` on the parent chain. */
export function isAncestorOf(
  placements: Placement[],
  ancestorId: string,
  nodeId: string,
): boolean {
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

/** Attaching `childId` under `parentId` would create a cycle (e.g. parent lies under child today). */
export function wouldCreateCycle(placements: Placement[], parentId: string, childId: string): boolean {
  if (parentId === childId) return true;
  return isAncestorOf(placements, childId, parentId);
}

/** World → parent-local decompose (Y-up, uniform scale from X). */
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

export function rootPlacements(placements: Placement[]): Placement[] {
  return placements.filter((p) => !p.parentClientId);
}

export function childPlacements(placements: Placement[], parentId: string): Placement[] {
  return placements.filter((p) => p.parentClientId === parentId);
}
