import * as THREE from "three";

/** Typical furniture target size in meters so tiny GLBs read correctly at editor scale. */
const DEFAULT_TARGET_MAX_DIM = 0.9;

// ─── Public utility ─────────────────────────────────────────────────────────

/**
 * Normalizes a cloned GLB root in-place: uniformly scales it to fit DEFAULT_TARGET_MAX_DIM
 * then lifts it so its bottom sits at y=0 in parent space.
 * Called by both the scene renderer and footprint extractor so both use the same scale.
 */
export function normalizeClonedGltfRoot(
  root: THREE.Object3D,
  targetMaxDim = DEFAULT_TARGET_MAX_DIM,
): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
  const s = targetMaxDim / maxDim;

  root.scale.setScalar(s);
  root.updateMatrixWorld(true);

  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
}
