"use client";

/* eslint-disable react-hooks/immutability, react-hooks/refs */

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ComponentRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Grid, OrbitControls, TransformControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { GRID_CELL, snapXZ } from "@/lib/gridSnap";
import { publicAssetUrl } from "@/lib/publicAssetUrl";
import {
  applyTransformSnapshot,
  clampDropHoverXZ,
  clampObjectToFloorAndRoom,
  findFreeDropXZ,
  placementTransformAllowed,
  settleOntoSupportBelow,
  snapshotTransform,
  type TransformSnapshot,
} from "./collision";
import {
  collectFootprintCellCenters,
  DEFAULT_MODEL_FOOTPRINT,
  footprintFromGltfScene,
  type ModelFootprint,
} from "./footprint";
import type { FloorDropBridgeRef } from "./floorDropBridge";
import {
  childPlacements,
  computeLocalUnderParent,
  placementById,
  rootPlacements,
  wouldCreateCycle,
} from "./grouping";
import { normalizeClonedGltfRoot } from "./modelFit";
import type { Placement } from "./placement";
import {
  createFloorDetailMap,
  createWallDetailMap,
  type FloorTextureId,
  type WallTextureId,
} from "./proceduralTextures";
import type { RoomOpening, WallKey } from "./roomOpenings";

const WALL_INSET = 0.055;
const WALL_FADE_MARGIN = 0.48;

/**
 * Calculates X position along a wall (e.g., back wall).
 * Maps normalized parameter t ∈ [0,1] to world X, constrained by room width and opening width.
 * Used to position doors/windows along walls.
 */
function alongWallX(t: number, roomW: number, openingW: number): number {
  const hw = roomW / 2;
  const lo = -hw + openingW / 2 + 0.06;
  const hi = hw - openingW / 2 - 0.06;
  return lo + t * Math.max(0.01, hi - lo);
}

/**
 * Calculates Z position along a wall (e.g., side wall).
 * Maps normalized parameter t ∈ [0,1] to world Z, constrained by room length and opening width.
 * Used to position doors/windows along walls.
 */
function alongWallZ(t: number, roomL: number, openingW: number): number {
  const hl = roomL / 2;
  const lo = -hl + openingW / 2 + 0.06;
  const hi = hl - openingW / 2 - 0.06;
  return lo + t * Math.max(0.01, hi - lo);
}

/**
 * Fades walls when camera is near them (so you can see inside the room).
 * Each frame: checks if camera is within WALL_FADE_MARGIN of a wall, and if so,
 * reduces opacity and disables depthWrite so the wall becomes semi-transparent.
 * Creates the illusion of entering/exiting rooms without culling geometry.
 */
function WallAdaptiveFade({
  roomW,
  roomL,
  materials,
}: {
  roomW: number;
  roomL: number;
  materials: Record<WallKey, THREE.MeshStandardMaterial>;
}) {
  const { camera } = useThree();
  useFrame(() => {
    const hw = roomW / 2;
    const hl = roomL / 2;
    const c = camera.position;
    const setWall = (k: WallKey, hide: boolean) => {
      const m = materials[k];
      m.transparent = true;
      m.opacity = hide ? 0.06 : 1;
      m.depthWrite = !hide;
    };
    setWall("pz", c.z > hl - WALL_FADE_MARGIN);
    setWall("nz", c.z < -hl + WALL_FADE_MARGIN);
    setWall("px", c.x > hw - WALL_FADE_MARGIN);
    setWall("nx", c.x < -hw + WALL_FADE_MARGIN);
  });
  return null;
}

/**
 * Renders one opening fixture (door or window) on a wall.
 * Includes: opening void plane + trim frame, with per-wall position/rotation handling.
 */
function OpeningFixture({
  opening,
  roomW,
  roomL,
  frameMat,
  voidMat,
}: {
  opening: RoomOpening;
  roomW: number;
  roomL: number;
  frameMat: THREE.MeshStandardMaterial;
  voidMat: THREE.MeshBasicMaterial;
}) {
  const { kind, wall, t, widthM: w, heightM: h, sillM } = opening;
  const hh = 0.015;
  const frameT = 0.06;
  const yCenter = kind === "door" ? h / 2 : sillM + h / 2;

  const hole = (
    <mesh material={voidMat}>
      <planeGeometry args={[w, h]} />
    </mesh>
  );

  const frame = (
    <group>
      <mesh position={[0, h / 2 + frameT / 2, 0]} castShadow material={frameMat}>
        <boxGeometry args={[w + frameT * 2, frameT, hh]} />
      </mesh>
      <mesh position={[-(w / 2 + frameT / 2), 0, 0]} castShadow material={frameMat}>
        <boxGeometry args={[frameT, h, hh]} />
      </mesh>
      <mesh position={[w / 2 + frameT / 2, 0, 0]} castShadow material={frameMat}>
        <boxGeometry args={[frameT, h, hh]} />
      </mesh>
      {kind === "door" ? (
        <mesh position={[0, -(h / 2 + frameT / 2), 0]} castShadow material={frameMat}>
          <boxGeometry args={[w + frameT * 2, frameT, hh]} />
        </mesh>
      ) : null}
    </group>
  );

  if (wall === "pz") {
    const x = alongWallX(t, roomW, w);
    const z = roomL / 2 - WALL_INSET;
    return (
      <group position={[x, yCenter, z]} rotation={[0, Math.PI, 0]}>
        {hole}
        {frame}
      </group>
    );
  }
  if (wall === "nz") {
    const x = alongWallX(t, roomW, w);
    const z = -roomL / 2 + WALL_INSET;
    return (
      <group position={[x, yCenter, z]} rotation={[0, 0, 0]}>
        {hole}
        {frame}
      </group>
    );
  }
  if (wall === "px") {
    const z = alongWallZ(t, roomL, w);
    const x = roomW / 2 - WALL_INSET;
    return (
      <group position={[x, yCenter, z]} rotation={[0, -Math.PI / 2, 0]}>
        {hole}
        {frame}
      </group>
    );
  }
  const z = alongWallZ(t, roomL, w);
  const x = -roomW / 2 + WALL_INSET;
  return (
    <group position={[x, yCenter, z]} rotation={[0, Math.PI / 2, 0]}>
      {hole}
      {frame}
    </group>
  );
}

/** Renders all current room openings by mapping each `RoomOpening` into one fixture. */
function RoomOpeningsLayer({
  openings,
  roomW,
  roomL,
}: {
  openings: RoomOpening[];
  roomW: number;
  roomL: number;
}) {
  const frameMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#4a3728",
        roughness: 0.85,
        metalness: 0.04,
      }),
    [],
  );
  const voidMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#07070c",
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => {
    return () => {
      frameMat.dispose();
      voidMat.dispose();
    };
  }, [frameMat, voidMat]);

  return (
    <group>
      {openings.map((o) => (
        <OpeningFixture
          key={o.id}
          opening={o}
          roomW={roomW}
          roomL={roomL}
          frameMat={frameMat}
          voidMat={voidMat}
        />
      ))}
    </group>
  );
}

function SelectionHudUpdater({
  selectedId,
  objectMapRef,
  hudWorldRef,
  hudPxRef,
}: {
  selectedId: string | null;
  objectMapRef: MutableRefObject<Map<string, THREE.Group>>;
  hudWorldRef: MutableRefObject<HTMLSpanElement | null>;
  hudPxRef: MutableRefObject<HTMLSpanElement | null>;
}) {
  const { camera, gl } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  const vProj = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const wEl = hudWorldRef.current;
    const pEl = hudPxRef.current;
    if (!selectedId || !wEl || !pEl) {
      if (wEl) wEl.textContent = "—";
      if (pEl) pEl.textContent = "—";
      return;
    }
    const obj = objectMapRef.current.get(selectedId);
    if (!obj) {
      wEl.textContent = "—";
      pEl.textContent = "—";
      return;
    }
    obj.getWorldPosition(v);
    wEl.textContent = `${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)} m`;
    vProj.copy(v).project(camera);
    const cw = gl.domElement.clientWidth;
    const ch = gl.domElement.clientHeight;
    const px = Math.round((vProj.x * 0.5 + 0.5) * cw);
    const py = Math.round((-vProj.y * 0.5 + 0.5) * ch);
    pEl.textContent = `${px} px, ${py} px`;
  });
  return null;
}

type SelectionHighlight = "none" | "primary" | "secondary";

type MatBase =
  | { t: "basic"; color: THREE.Color }
  | { t: "std"; color: THREE.Color; emissive: THREE.Color; emissiveIntensity: number }
  | { t: "unk" };

function captureMatBase(mat: THREE.Material): MatBase {
  if (mat instanceof THREE.MeshBasicMaterial) {
    return { t: "basic", color: mat.color.clone() };
  }
  if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
    return {
      t: "std",
      color: mat.color.clone(),
      emissive: mat.emissive.clone(),
      emissiveIntensity: mat.emissiveIntensity,
    };
  }
  if (mat instanceof THREE.MeshLambertMaterial || mat instanceof THREE.MeshPhongMaterial) {
    return {
      t: "std",
      color: mat.color.clone(),
      emissive: mat.emissive.clone(),
      emissiveIntensity: mat.emissiveIntensity,
    };
  }
  return { t: "unk" };
}

function restoreMatBase(mat: THREE.Material, b: MatBase) {
  if (b.t === "basic" && mat instanceof THREE.MeshBasicMaterial) {
    mat.color.copy(b.color);
    return;
  }
  if (
    b.t === "std" &&
    (mat instanceof THREE.MeshStandardMaterial ||
      mat instanceof THREE.MeshPhysicalMaterial ||
      mat instanceof THREE.MeshLambertMaterial ||
      mat instanceof THREE.MeshPhongMaterial)
  ) {
    mat.color.copy(b.color);
    mat.emissive.copy(b.emissive);
    mat.emissiveIntensity = b.emissiveIntensity;
  }
}

function paintHighlight(
  mat: THREE.Material,
  highlight: SelectionHighlight,
  b: MatBase,
  green: THREE.Color,
  teal: THREE.Color,
) {
  restoreMatBase(mat, b);
  if (highlight === "none") return;
  const tint = highlight === "primary" ? green : teal;
  if (b.t === "basic" && mat instanceof THREE.MeshBasicMaterial) {
    mat.color.copy(b.color).lerp(tint, 0.75);
    return;
  }
  if (
    b.t === "std" &&
    (mat instanceof THREE.MeshStandardMaterial ||
      mat instanceof THREE.MeshPhysicalMaterial ||
      mat instanceof THREE.MeshLambertMaterial ||
      mat instanceof THREE.MeshPhongMaterial)
  ) {
    mat.emissive.copy(tint);
    mat.emissiveIntensity = 0.72;
    return;
  }
  if ("color" in mat && (mat as THREE.MeshStandardMaterial).color) {
    (mat as THREE.MeshStandardMaterial).color?.lerp(tint, 0.55);
  }
}

export type RoomEditorExportTransform = {
  clientId: string;
  position: [number, number, number];
  rotationY: number;
  scale: number;
};

export type RoomEditorSceneActions = {
  getExportTransforms: () => RoomEditorExportTransform[];
  attachAsChild: (parentId: string, childId: string) => boolean;
  detachToWorld: (childId: string) => boolean;
};

function DropModelFootprint({
  url,
  onMeasured,
}: {
  url: string;
  onMeasured: (fp: ModelFootprint) => void;
}) {
  const { scene } = useGLTF(url);
  useLayoutEffect(() => {
    onMeasured(footprintFromGltfScene(scene));
  }, [scene, url, onMeasured]);
  return null;
}

/** Snapped floor cells for drag preview; depthTest off so tint reads on top of placed GLBs. */
function FootprintCellHighlight({
  cx,
  cz,
  fp,
  roomHalfW,
  roomHalfL,
}: {
  cx: number;
  cz: number;
  fp: ModelFootprint;
  roomHalfW: number;
  roomHalfL: number;
}) {
  const cells = useMemo(
    () => collectFootprintCellCenters(cx, cz, fp.hx, fp.hz, roomHalfW, roomHalfL),
    [cx, cz, fp.hx, fp.hz, roomHalfW, roomHalfL],
  );
  const half = GRID_CELL * 0.46;
  return (
    <group>
      {cells.map(([x, z]) => (
        <mesh
          key={`${x.toFixed(4)},${z.toFixed(4)}`}
          position={[x, 0.035, z]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={1000}
        >
          <planeGeometry args={[half * 2, half * 2]} />
          <meshBasicMaterial
            color="#22c55e"
            transparent
            opacity={0.55}
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function FloorDropBridgeSetup({
  bridgeRef,
  objectMapRef,
  roomHalfW,
  roomHalfL,
  dragFootprint,
}: {
  bridgeRef: FloorDropBridgeRef;
  objectMapRef: MutableRefObject<Map<string, THREE.Group>>;
  roomHalfW: number;
  roomHalfL: number;
  dragFootprint: ModelFootprint;
}) {
  const { camera, gl } = useThree();
  useEffect(() => {
    const snapFromClient = (clientX: number, clientY: number) => {
      const el = gl.domElement;
      const rect = el.getBoundingClientRect();
      const margin = 2;
      if (
        clientX < rect.left - margin ||
        clientX > rect.right + margin ||
        clientY < rect.top - margin ||
        clientY > rect.bottom + margin
      ) {
        return null;
      }
      const mx = ((clientX - rect.left) / rect.width) * 2 - 1;
      const my = -((clientY - rect.top) / rect.height) * 2 + 1;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const pt = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plane, pt)) return null;
      const [sx, sz] = snapXZ(pt.x, pt.z);
      return clampDropHoverXZ(sx, sz, dragFootprint, 1, roomHalfW, roomHalfL);
    };
    bridgeRef.current = {
      snapFromClient,
      resolveDropPosition: (x0, z0) =>
        findFreeDropXZ(x0, z0, dragFootprint, 1, objectMapRef.current, roomHalfW, roomHalfL),
    };
    return () => {
      bridgeRef.current = null;
    };
  }, [bridgeRef, camera, gl, dragFootprint, objectMapRef, roomHalfW, roomHalfL]);
  return null;
}

/** GLTF mesh.clone() shares materials across instances — highlights would tint all copies. */
function deepCloneMaterialsForMeshes(root: THREE.Object3D): void {
  root.traverse((ch) => {
    const m = ch as THREE.Mesh;
    if (!m.isMesh || !m.material) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const copies = mats.map((mat) => {
      const copy = mat.clone();
      copy.userData._rtBase = captureMatBase(copy);
      return copy;
    });
    m.material = Array.isArray(m.material) ? copies : copies[0];
  });
}

function placementEmitsWarmGlow(p: Placement): boolean {
  return (
    /lamp|light|bulb|chandelier|sconce|lantern|torchiere/i.test(p.label) ||
    /lamp|\/light\./i.test(p.glbUrl)
  );
}

/** Point light + additive halo so “lamp”-style pieces read as emitting light. */
function PlacementWarmGlow({ yBulb = 0.82 }: { yBulb?: number }) {
  return (
    <group>
      <pointLight
        position={[0, yBulb, 0]}
        color="#fff2d6"
        intensity={1.35}
        distance={8}
        decay={2}
      />
      <mesh position={[0, yBulb, 0]} renderOrder={50}>
        <sphereGeometry args={[0.1, 18, 18]} />
        <meshBasicMaterial
          color="#fffaf0"
          transparent
          opacity={0.5}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh position={[0, yBulb, 0]} scale={1.75} renderOrder={49}>
        <sphereGeometry args={[0.1, 14, 14]} />
        <meshBasicMaterial
          color="#fbbf24"
          transparent
          opacity={0.14}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/**
 * Renders a single placed furniture model in 3D space.
 * Responsibilities:
 * - Load and clone the GLB model, normalize it (scale + position on floor)
 * - Deep clone materials to allow per-instance colors (selected/highlighted states)
 * - Apply highlight overlays (green tint for selected, teal tint for secondary selected)
 * - Handle parenting: if p.parentClientId is set, position relative to parent; else use world position
 * - Wrap in TransformControls for drag/rotate/scale interactions
 * - Track selection state: swap materials on select/deselect
 */
function PlacedModelContent({ p, highlight }: { p: Placement; highlight: SelectionHighlight }) {
  const glbSrc = useMemo(() => publicAssetUrl(p.glbUrl), [p.glbUrl]);
  const { scene } = useGLTF(glbSrc);
  const clone = useMemo(() => {
    const c = scene.clone(true);
    normalizeClonedGltfRoot(c);
    deepCloneMaterialsForMeshes(c);
    return c;
  }, [scene]);

  useLayoutEffect(() => {
    const green = new THREE.Color("#22c55e");
    const teal = new THREE.Color("#2dd4bf");
    clone.traverse((ch) => {
      const m = ch as THREE.Mesh;
      if (!m.isMesh || !m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const b = mat.userData._rtBase as MatBase | undefined;
        if (b) paintHighlight(mat, highlight, b, green, teal);
        mat.needsUpdate = true;
      }
      m.renderOrder = highlight === "none" ? 0 : 200;
    });
  }, [clone, highlight]);

  return <primitive object={clone} />;
}

function PlacementBranch({
  p,
  placements,
  selectedId,
  secondarySelectedId,
  onSelect,
  registerRef,
}: {
  p: Placement;
  placements: Placement[];
  selectedId: string | null;
  secondarySelectedId: string | null;
  onSelect: (id: string, event: ThreeEvent<MouseEvent>) => void;
  registerRef: (id: string, obj: THREE.Group | null) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const children = useMemo(() => childPlacements(placements, p.clientId), [placements, p.clientId]);
  const highlight: SelectionHighlight =
    p.clientId === selectedId
      ? "primary"
      : p.clientId === secondarySelectedId
        ? "secondary"
        : "none";

  const isRootTree = !p.parentClientId;
  const pos: [number, number, number] = isRootTree ? p.position : (p.localPosition ?? [0, 0, 0]);
  const rotY = isRootTree ? p.rotationY : (p.localRotationY ?? 0);
  const sc = isRootTree ? p.scale : (p.localScale ?? 1);

  useEffect(() => {
    const g = group.current;
    registerRef(p.clientId, g);
    return () => registerRef(p.clientId, null);
  }, [p.clientId, registerRef]);

  return (
    <group
      ref={group}
      position={pos}
      rotation={[0, rotY, 0]}
      scale={sc}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(p.clientId, e);
      }}
    >
      <Suspense fallback={null}>
        <PlacedModelContent p={p} highlight={highlight} />
      </Suspense>
      {placementEmitsWarmGlow(p) ? <PlacementWarmGlow /> : null}
      {children.map((c) => (
        <PlacementBranch
          key={c.clientId}
          p={c}
          placements={placements}
          selectedId={selectedId}
          secondarySelectedId={secondarySelectedId}
          onSelect={onSelect}
          registerRef={registerRef}
        />
      ))}
    </group>
  );
}

function EditorFloor({
  roomW,
  roomL,
  floorColorHex,
  floorPreset,
}: {
  roomW: number;
  roomL: number;
  floorColorHex: string;
  floorPreset: FloorTextureId;
}) {
  const color = useMemo(() => {
    try {
      return new THREE.Color(floorColorHex);
    } catch {
      return new THREE.Color("#1e1b4b");
    }
  }, [floorColorHex]);

  const roughMap = useMemo(() => createFloorDetailMap(floorPreset), [floorPreset]);
  useEffect(() => {
    return () => roughMap?.dispose();
  }, [roughMap]);

  useEffect(() => {
    if (roughMap) {
      roughMap.repeat.set(Math.max(1, roomW * 0.45), Math.max(1, roomL * 0.45));
      roughMap.needsUpdate = true;
    }
  }, [roughMap, roomW, roomL]);

  const roughness = floorPreset === "matte" ? 0.93 : 0.62;
  const metalness = floorPreset === "matte" ? 0.02 : 0.08;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[roomW, roomL]} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        roughnessMap={roughMap ?? undefined}
      />
    </mesh>
  );
}

function RoomShell({
  roomW,
  roomL,
  roomH,
  wallColorHex,
  wallTexturePreset,
}: {
  roomW: number;
  roomL: number;
  roomH: number;
  wallColorHex: string;
  wallTexturePreset: WallTextureId;
}) {
  const wallColor = useMemo(() => {
    try {
      return new THREE.Color(wallColorHex);
    } catch {
      return new THREE.Color("#e8e4dc");
    }
  }, [wallColorHex]);

  const wallMap = useMemo(() => createWallDetailMap(wallTexturePreset), [wallTexturePreset]);
  useEffect(() => {
    return () => {
      wallMap?.dispose();
    };
  }, [wallMap]);

  useEffect(() => {
    if (wallMap) {
      wallMap.repeat.set(3, 3);
      wallMap.needsUpdate = true;
    }
  }, [wallMap]);

  const wallMats = useMemo(() => {
    const metalness = wallTexturePreset === "paint" ? 0.06 : 0.05;
    const roughness = wallTexturePreset === "paint" ? 0.9 : 0.82;
    const keys: WallKey[] = ["pz", "nz", "px", "nx"];
    const out = {} as Record<WallKey, THREE.MeshStandardMaterial>;
    for (const k of keys) {
      out[k] = new THREE.MeshStandardMaterial({
        color: wallColor.clone(),
        map: wallMap ?? undefined,
        metalness,
        roughness,
        side: THREE.DoubleSide,
      });
    }
    return out;
  }, [wallColor, wallMap, wallTexturePreset]);

  useEffect(() => {
    return () => {
      for (const m of Object.values(wallMats)) {
        m.map = null;
        m.dispose();
      }
    };
  }, [wallMats]);

  const t = 0.04;
  const hw = roomW / 2;
  const hl = roomL / 2;
  const hh = roomH / 2;
  return (
    <group>
      <WallAdaptiveFade roomW={roomW} roomL={roomL} materials={wallMats} />
      <mesh
        position={[0, hh, hl + t / 2]}
        castShadow
        receiveShadow
        userData={{ roomWall: "pz" as const }}
        material={wallMats.pz}
      >
        <boxGeometry args={[roomW, roomH, t]} />
      </mesh>
      <mesh
        position={[0, hh, -hl - t / 2]}
        castShadow
        receiveShadow
        userData={{ roomWall: "nz" as const }}
        material={wallMats.nz}
      >
        <boxGeometry args={[roomW, roomH, t]} />
      </mesh>
      <mesh
        position={[hw + t / 2, hh, 0]}
        castShadow
        receiveShadow
        userData={{ roomWall: "px" as const }}
        material={wallMats.px}
      >
        <boxGeometry args={[t, roomH, roomL]} />
      </mesh>
      <mesh
        position={[-hw - t / 2, hh, 0]}
        castShadow
        receiveShadow
        userData={{ roomWall: "nx" as const }}
        material={wallMats.nx}
      >
        <boxGeometry args={[t, roomH, roomL]} />
      </mesh>
    </group>
  );
}

function SceneInner({
  roomW,
  roomL,
  roomH,
  floorColorHex,
  wallColorHex,
  floorTexturePreset,
  wallTexturePreset,
  floorDropBridgeRef,
  sceneActionsRef,
  dragModelUrl,
  dropHover,
  placements,
  setPlacements,
  selectedId,
  setSelectedId,
  secondarySelectedId,
  setSecondarySelectedId,
  transformMode,
  onInterference,
  openings,
  hudWorldRef,
  hudPxRef,
}: {
  roomW: number;
  roomL: number;
  roomH: number;
  floorColorHex: string;
  wallColorHex: string;
  floorTexturePreset: FloorTextureId;
  wallTexturePreset: WallTextureId;
  floorDropBridgeRef: FloorDropBridgeRef;
  sceneActionsRef: MutableRefObject<RoomEditorSceneActions | null>;
  dragModelUrl: string | null;
  dropHover: { x: number; z: number } | null;
  placements: Placement[];
  setPlacements: Dispatch<SetStateAction<Placement[]>>;
  selectedId: string | null;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  secondarySelectedId: string | null;
  setSecondarySelectedId: Dispatch<SetStateAction<string | null>>;
  transformMode: "translate" | "rotate" | "scale";
  onInterference?: (message: string | null) => void;
  openings: RoomOpening[];
  hudWorldRef: MutableRefObject<HTMLSpanElement | null>;
  hudPxRef: MutableRefObject<HTMLSpanElement | null>;
}) {
  const transformRef = useRef<ComponentRef<typeof TransformControls>>(null);
  const objectMap = useRef<Map<string, THREE.Group>>(new Map());
  const transformGoodRef = useRef<TransformSnapshot | null>(null);
  const placementsRef = useRef<Placement[]>(placements);
  placementsRef.current = placements;

  const [, forceRerender] = useReducer((n: number) => n + 1, 0);
  const [dragMeasuredFootprint, setDragMeasuredFootprint] =
    useState<ModelFootprint>(DEFAULT_MODEL_FOOTPRINT);

  const roomHalfW = roomW / 2;
  const roomHalfL = roomL / 2;

  useEffect(() => {
    if (!dragModelUrl) setDragMeasuredFootprint(DEFAULT_MODEL_FOOTPRINT);
  }, [dragModelUrl]);

  const onMeasuredFootprint = useCallback((fp: ModelFootprint) => {
    setDragMeasuredFootprint(fp);
  }, []);

  const registerRef = useCallback(
    (id: string, obj: THREE.Group | null) => {
      if (obj) objectMap.current.set(id, obj);
      else objectMap.current.delete(id);
      if (id === selectedId && obj) transformGoodRef.current = snapshotTransform(obj);
      if (id === selectedId) forceRerender();
    },
    [selectedId],
  );

  useEffect(() => {
    forceRerender();
  }, [selectedId]);

  const onPlacementSelect = useCallback(
    (id: string, e: ThreeEvent<MouseEvent>) => {
      if (e.nativeEvent.shiftKey) {
        setSecondarySelectedId((prev) => (prev === id ? null : id));
      } else {
        setSelectedId(id);
        setSecondarySelectedId(null);
      }
    },
    [setSelectedId, setSecondarySelectedId],
  );

  useEffect(() => {
    const actions: RoomEditorSceneActions = {
      getExportTransforms: () => {
        const out: RoomEditorExportTransform[] = [];
        for (const p of placementsRef.current) {
          const o = objectMap.current.get(p.clientId);
          if (!o) continue;
          o.updateMatrixWorld(true);
          const pos = new THREE.Vector3();
          const quat = new THREE.Quaternion();
          const scl = new THREE.Vector3();
          o.matrixWorld.decompose(pos, quat, scl);
          const euler = new THREE.Euler().setFromQuaternion(quat, "YXZ");
          const su = (scl.x + scl.y + scl.z) / 3 || 1;
          out.push({
            clientId: p.clientId,
            position: [pos.x, pos.y, pos.z],
            rotationY: euler.y,
            scale: su,
          });
        }
        return out;
      },
      attachAsChild: (parentId: string, childId: string) => {
        const prev = placementsRef.current;
        if (wouldCreateCycle(prev, parentId, childId)) return false;
        const pObj = objectMap.current.get(parentId);
        const cObj = objectMap.current.get(childId);
        if (!pObj || !cObj) return false;
        const local = computeLocalUnderParent(pObj, cObj);
        setPlacements((p) =>
          p.map((pl) =>
            pl.clientId === childId
              ? {
                  ...pl,
                  parentClientId: parentId,
                  localPosition: local.localPosition,
                  localRotationY: local.localRotationY,
                  localScale: local.localScale,
                }
              : pl,
          ),
        );
        return true;
      },
      detachToWorld: (childId: string) => {
        const obj = objectMap.current.get(childId);
        if (!obj) return false;
        const pl = placementById(placementsRef.current, childId);
        if (!pl?.parentClientId) return false;
        obj.updateMatrixWorld(true);
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scl = new THREE.Vector3();
        obj.matrixWorld.decompose(pos, quat, scl);
        const euler = new THREE.Euler().setFromQuaternion(quat, "YXZ");
        const su = (scl.x + scl.y + scl.z) / 3 || 1;
        setPlacements((p) =>
          p.map((q) =>
            q.clientId === childId
              ? {
                  ...q,
                  parentClientId: null,
                  localPosition: undefined,
                  localRotationY: undefined,
                  localScale: undefined,
                  position: [pos.x, pos.y, pos.z],
                  rotationY: euler.y,
                  scale: su,
                }
              : q,
          ),
        );
        return true;
      },
    };
    sceneActionsRef.current = actions;
    return () => {
      sceneActionsRef.current = null;
    };
  }, [setPlacements, sceneActionsRef]);

  const selectedPlacement = useMemo(
    () => placements.find((p) => p.clientId === selectedId),
    [placements, selectedId],
  );
  const selectedObject = selectedId ? objectMap.current.get(selectedId) : undefined;
  const canTransformSelection = Boolean(selectedPlacement && !selectedPlacement.parentClientId);

  const onObjectChange = useCallback(() => {
    if (!selectedId || !canTransformSelection) return;
    const obj = objectMap.current.get(selectedId);
    if (!obj) return;
    const good = transformGoodRef.current;
    if (
      !placementTransformAllowed(
        obj,
        selectedId,
        objectMap.current,
        placements,
        roomHalfW,
        roomHalfL,
      )
    ) {
      if (good) applyTransformSnapshot(obj, good);
      onInterference?.(
        "Can’t move there — it would overlap another piece or stick through the walls.",
      );
    } else {
      transformGoodRef.current = snapshotTransform(obj);
      onInterference?.(null);
    }
    // Avoid syncing React placement state every frame — it fights TransformControls and glues grouped trees.
    // Final pose is written in onTransformMouseUp.
  }, [selectedId, canTransformSelection, roomHalfW, roomHalfL, placements, onInterference]);

  const onTransformMouseUp = useCallback(() => {
    if (!selectedId || !canTransformSelection) return;
    const obj = objectMap.current.get(selectedId);
    if (!obj) return;
    const [sx, sz] = snapXZ(obj.position.x, obj.position.z);
    obj.position.x = sx;
    obj.position.z = sz;
    clampObjectToFloorAndRoom(obj, roomHalfW, roomHalfL);
    if (
      !placementTransformAllowed(
        obj,
        selectedId,
        objectMap.current,
        placements,
        roomHalfW,
        roomHalfL,
      )
    ) {
      const g = transformGoodRef.current;
      if (g) applyTransformSnapshot(obj, g);
      onInterference?.("Can’t place there — overlaps another object or the room edge.");
    } else {
      settleOntoSupportBelow(obj, selectedId, objectMap.current, placements, roomHalfW, roomHalfL);
      if (
        !placementTransformAllowed(
          obj,
          selectedId,
          objectMap.current,
          placements,
          roomHalfW,
          roomHalfL,
        )
      ) {
        const g = transformGoodRef.current;
        if (g) applyTransformSnapshot(obj, g);
        onInterference?.("Can’t settle that stack without overlapping something else.");
      } else {
        transformGoodRef.current = snapshotTransform(obj);
        onInterference?.(null);
      }
    }
    setPlacements((prev) =>
      prev.map((pl) =>
        pl.clientId === selectedId
          ? {
              ...pl,
              position: [obj.position.x, obj.position.y, obj.position.z],
              rotationY: obj.rotation.y,
              scale: transformMode === "scale" ? obj.scale.x : pl.scale,
            }
          : pl,
      ),
    );
  }, [
    selectedId,
    canTransformSelection,
    setPlacements,
    transformMode,
    roomHalfW,
    roomHalfL,
    placements,
    onInterference,
  ]);

  const roots = useMemo(() => rootPlacements(placements), [placements]);

  return (
    <>
      <color attach="background" args={["#0f0a1e"]} />
      <ambientLight intensity={0.5} color="#99a5e8" />
      <directionalLight position={[8, 14, 6]} intensity={1.05} castShadow color="#e8ecff" />
      <hemisphereLight args={["#3730a3", "#1e1b4b", 0.38]} />
      <pointLight
        position={[0, roomH * 0.92, 0]}
        intensity={0.35}
        distance={Math.max(roomW, roomL) * 1.4}
        color="#c4b5fd"
        decay={2}
      />

      <EditorFloor
        roomW={roomW}
        roomL={roomL}
        floorColorHex={floorColorHex}
        floorPreset={floorTexturePreset}
      />

      <RoomShell
        roomW={roomW}
        roomL={roomL}
        roomH={roomH}
        wallColorHex={wallColorHex}
        wallTexturePreset={wallTexturePreset}
      />

      <RoomOpeningsLayer openings={openings} roomW={roomW} roomL={roomL} />

      <Grid
        position={[0, 0.002, 0]}
        args={[roomW, roomL]}
        cellSize={GRID_CELL}
        sectionSize={GRID_CELL * 10}
        cellColor="#5b21b6"
        sectionColor="#818cf8"
        cellThickness={0.85}
        sectionThickness={1.05}
        fadeDistance={Math.max(roomW, roomL) * 1.5}
        fadeStrength={1}
        infiniteGrid={false}
        side={THREE.DoubleSide}
      />

      <FloorDropBridgeSetup
        bridgeRef={floorDropBridgeRef}
        objectMapRef={objectMap}
        roomHalfW={roomHalfW}
        roomHalfL={roomHalfL}
        dragFootprint={dragMeasuredFootprint}
      />

      {dragModelUrl ? (
        <Suspense fallback={null}>
          <DropModelFootprint url={dragModelUrl} onMeasured={onMeasuredFootprint} />
        </Suspense>
      ) : null}

      {dragModelUrl && dropHover ? (
        <FootprintCellHighlight
          cx={dropHover.x}
          cz={dropHover.z}
          fp={dragMeasuredFootprint}
          roomHalfW={roomHalfW}
          roomHalfL={roomHalfL}
        />
      ) : null}

      {dropHover && !dragModelUrl ? (
        <group position={[dropHover.x, 0.04, dropHover.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.14, 0.22, 40]} />
            <meshBasicMaterial
              color="#c4b5fd"
              transparent
              opacity={0.9}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </group>
      ) : null}

      <Suspense fallback={null}>
        {roots.map((p) => (
          <PlacementBranch
            key={p.clientId}
            p={p}
            placements={placements}
            selectedId={selectedId}
            secondarySelectedId={secondarySelectedId}
            onSelect={onPlacementSelect}
            registerRef={registerRef}
          />
        ))}
      </Suspense>

      {canTransformSelection && selectedObject ? (
        <TransformControls
          key={selectedId!}
          ref={transformRef}
          object={selectedObject}
          mode={transformMode}
          onMouseDown={() => {
            const obj = objectMap.current.get(selectedId!);
            if (obj) transformGoodRef.current = snapshotTransform(obj);
          }}
          onObjectChange={onObjectChange}
          onMouseUp={onTransformMouseUp}
          size={0.7}
        />
      ) : null}

      <SelectionHudUpdater
        selectedId={selectedId}
        objectMapRef={objectMap}
        hudWorldRef={hudWorldRef}
        hudPxRef={hudPxRef}
      />

      <OrbitControls
        makeDefault
        minDistance={1.2}
        maxDistance={50}
        target={[0, 0.2, 0]}
        maxPolarAngle={Math.PI / 2 - 0.08}
      />
    </>
  );
}

/**
 * MAIN 3D CANVAS SCENE COMPONENT
 * Renders the interactive 3D room editor using Three.js + React Three Fiber.
 *
 * Responsibilities:
 * - Render floor grid, walls, doors/windows, furniture models
 * - Handle mouse interactions: ray-casting for selection, drag-to-place, transform mode controls
 * - Manage drag/drop drop preview (visual footprint cells + hover ring at drop position)
 * - Sync 3D transforms back to parent via RoomEditorSceneActions (position/rotation/scale)
 * - Validate placements via collision detection (clamp to bounds, check overlaps, settle on support)
 * - Support parent-child grouping (local transforms when piece sits on another)
 * - Provide HUD overlay (world coords + screen coords of selected object)
 * - Fade walls when camera gets close (inward-facing fade)
 * - Bridge canvas ↔ HTML overlay via mutable ref (for drag/drop from catalog)
 *
 * Inputs: room dimensions, colors, textures, placements, selections, drag state, doors/windows, transform mode
 * Outputs: modified placements (via setPlacements callback), selection changes, export transforms via ref
 */
export function EditorScene({
  roomW,
  roomL,
  roomH,
  floorColorHex,
  wallColorHex,
  floorTexturePreset,
  wallTexturePreset,
  floorDropBridgeRef,
  sceneActionsRef,
  dragModelUrl,
  dropHover,
  placements,
  setPlacements,
  selectedId,
  setSelectedId,
  secondarySelectedId,
  setSecondarySelectedId,
  transformMode,
  onInterference,
  openings,
  hudWorldRef,
  hudPxRef,
}: {
  roomW: number;
  roomL: number;
  roomH: number;
  floorColorHex: string;
  wallColorHex: string;
  floorTexturePreset: FloorTextureId;
  wallTexturePreset: WallTextureId;
  floorDropBridgeRef: FloorDropBridgeRef;
  sceneActionsRef: MutableRefObject<RoomEditorSceneActions | null>;
  dragModelUrl: string | null;
  dropHover: { x: number; z: number } | null;
  placements: Placement[];
  setPlacements: Dispatch<SetStateAction<Placement[]>>;
  selectedId: string | null;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  secondarySelectedId: string | null;
  setSecondarySelectedId: Dispatch<SetStateAction<string | null>>;
  transformMode: "translate" | "rotate" | "scale";
  onInterference?: (message: string | null) => void;
  openings: RoomOpening[];
  hudWorldRef: MutableRefObject<HTMLSpanElement | null>;
  hudPxRef: MutableRefObject<HTMLSpanElement | null>;
}) {
  return (
    <Canvas
      className="size-full touch-none"
      style={{ width: "100%", height: "100%", display: "block" }}
      shadows
      camera={{ position: [6, 5, 6], fov: 50 }}
      onPointerMissed={() => {
        setSelectedId(null);
        setSecondarySelectedId(null);
      }}
    >
      <SceneInner
        roomW={roomW}
        roomL={roomL}
        roomH={roomH}
        floorColorHex={floorColorHex}
        wallColorHex={wallColorHex}
        floorTexturePreset={floorTexturePreset}
        wallTexturePreset={wallTexturePreset}
        floorDropBridgeRef={floorDropBridgeRef}
        sceneActionsRef={sceneActionsRef}
        dragModelUrl={dragModelUrl}
        dropHover={dropHover}
        placements={placements}
        setPlacements={setPlacements}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        secondarySelectedId={secondarySelectedId}
        setSecondarySelectedId={setSecondarySelectedId}
        transformMode={transformMode}
        onInterference={onInterference}
        openings={openings}
        hudWorldRef={hudWorldRef}
        hudPxRef={hudPxRef}
      />
    </Canvas>
  );
}
