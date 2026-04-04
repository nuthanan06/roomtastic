"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ComponentRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Grid, OrbitControls, TransformControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { GRID_CELL, snapXZ } from "@/lib/gridSnap";
import { publicAssetUrl } from "@/lib/publicAssetUrl";
import type { FloorDropBridgeRef } from "./floorDropBridge";
import { normalizeClonedGltfRoot } from "./modelFit";
import type { Placement } from "./placement";

/** Registers raycast-to-floor for the parent HTML drop overlay (WebGL canvas often never fires drop). */
function RegisterFloorDropBridge({ bridgeRef }: { bridgeRef: FloorDropBridgeRef }) {
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
      return { x: sx, z: sz };
    };
    bridgeRef.current = { snapFromClient };
    return () => {
      bridgeRef.current = null;
    };
  }, [bridgeRef, camera, gl]);
  return null;
}

function PlacedModel({
  p,
  isSelected,
  onSelect,
  registerRef,
}: {
  p: Placement;
  isSelected: boolean;
  onSelect: (id: string) => void;
  registerRef: (id: string, obj: THREE.Group | null) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const glbSrc = useMemo(() => publicAssetUrl(p.glbUrl), [p.glbUrl]);
  const { scene } = useGLTF(glbSrc);
  const clone = useMemo(() => {
    const c = scene.clone(true);
    normalizeClonedGltfRoot(c);
    c.traverse((ch) => {
      const m = ch as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return c;
  }, [scene, glbSrc]);

  useEffect(() => {
    const g = group.current;
    registerRef(p.clientId, g);
    return () => registerRef(p.clientId, null);
  }, [p.clientId, registerRef]);

  return (
    <group
      ref={group}
      position={p.position}
      rotation={[0, p.rotationY, 0]}
      scale={p.scale}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(p.clientId);
      }}
    >
      <primitive object={clone} />
    </group>
  );
}

function RoomShell({
  roomW,
  roomL,
  roomH,
  wallColour,
}: {
  roomW: number;
  roomL: number;
  roomH: number;
  wallColour: string;
}) {
  const wallColor = useMemo(() => {
    try {
      return new THREE.Color(wallColour);
    } catch {
      return new THREE.Color("#e8e4dc");
    }
  }, [wallColour]);
  const t = 0.04;
  const hw = roomW / 2;
  const hl = roomL / 2;
  const hh = roomH / 2;
  return (
    <group>
      <mesh position={[0, hh, hl + t / 2]} castShadow receiveShadow>
        <boxGeometry args={[roomW, roomH, t]} />
        <meshStandardMaterial color={wallColor} metalness={0.06} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, hh, -hl - t / 2]} castShadow receiveShadow>
        <boxGeometry args={[roomW, roomH, t]} />
        <meshStandardMaterial color={wallColor} metalness={0.06} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[hw + t / 2, hh, 0]} castShadow receiveShadow>
        <boxGeometry args={[t, roomH, roomL]} />
        <meshStandardMaterial color={wallColor} metalness={0.06} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-hw - t / 2, hh, 0]} castShadow receiveShadow>
        <boxGeometry args={[t, roomH, roomL]} />
        <meshStandardMaterial color={wallColor} metalness={0.06} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function SceneInner({
  roomW,
  roomL,
  roomH,
  wallColour,
  floorDropBridgeRef,
  dropHover,
  placements,
  setPlacements,
  selectedId,
  setSelectedId,
  transformMode,
}: {
  roomW: number;
  roomL: number;
  roomH: number;
  wallColour: string;
  floorDropBridgeRef: FloorDropBridgeRef;
  dropHover: { x: number; z: number } | null;
  placements: Placement[];
  setPlacements: Dispatch<SetStateAction<Placement[]>>;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  transformMode: "translate" | "rotate" | "scale";
}) {
  const transformRef = useRef<ComponentRef<typeof TransformControls>>(null);
  const objectMap = useRef<Map<string, THREE.Group>>(new Map());
  const [, forceRerender] = useReducer((n: number) => n + 1, 0);

  const registerRef = useCallback(
    (id: string, obj: THREE.Group | null) => {
      if (obj) objectMap.current.set(id, obj);
      else objectMap.current.delete(id);
      if (id === selectedId) forceRerender();
    },
    [selectedId],
  );

  useEffect(() => {
    forceRerender();
  }, [selectedId]);

  const selectedObject = selectedId ? objectMap.current.get(selectedId) : undefined;

  const onObjectChange = useCallback(() => {
    if (!selectedId) return;
    const obj = objectMap.current.get(selectedId);
    if (!obj) return;
    setPlacements((prev) =>
      prev.map((pl) => {
        if (pl.clientId !== selectedId) return pl;
        return {
          ...pl,
          position: [obj.position.x, obj.position.y, obj.position.z],
          rotationY: obj.rotation.y,
          scale: transformMode === "scale" ? obj.scale.x : pl.scale,
        };
      }),
    );
  }, [selectedId, setPlacements, transformMode]);

  const onTransformMouseUp = useCallback(() => {
    if (!selectedId) return;
    const obj = objectMap.current.get(selectedId);
    if (!obj) return;
    const [sx, sz] = snapXZ(obj.position.x, obj.position.z);
    obj.position.x = sx;
    obj.position.z = sz;
    setPlacements((prev) =>
      prev.map((pl) =>
        pl.clientId === selectedId ? { ...pl, position: [sx, obj.position.y, sz] } : pl,
      ),
    );
  }, [selectedId, setPlacements]);

  return (
    <>
      <color attach="background" args={["#0f0a1e"]} />
      <ambientLight intensity={0.45} color="#a5b4fc" />
      <directionalLight position={[8, 14, 6]} intensity={1.1} castShadow color="#e0e7ff" />
      <hemisphereLight args={["#312e81", "#1e1b4b", 0.35]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[roomW, roomL]} />
        <meshStandardMaterial color="#1e1b4b" metalness={0.12} roughness={0.88} />
      </mesh>

      <RoomShell roomW={roomW} roomL={roomL} roomH={roomH} wallColour={wallColour} />

      {/* drei Grid shader maps the plane to XZ; do NOT apply -90° X like a raw PlaneGeometry or it becomes a vertical wall */}
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

      <RegisterFloorDropBridge bridgeRef={floorDropBridgeRef} />

      {dropHover ? (
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
        {placements.map((p) => (
          <PlacedModel
            key={p.clientId}
            p={p}
            isSelected={p.clientId === selectedId}
            onSelect={setSelectedId}
            registerRef={registerRef}
          />
        ))}
      </Suspense>

      {selectedObject ? (
        <TransformControls
          key={selectedId!}
          ref={transformRef}
          object={selectedObject}
          mode={transformMode}
          onObjectChange={onObjectChange}
          onMouseUp={onTransformMouseUp}
          size={0.7}
        />
      ) : null}

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

export function EditorScene({
  roomW,
  roomL,
  roomH,
  wallColour,
  floorDropBridgeRef,
  dropHover,
  placements,
  setPlacements,
  selectedId,
  setSelectedId,
  transformMode,
}: {
  roomW: number;
  roomL: number;
  roomH: number;
  wallColour: string;
  floorDropBridgeRef: FloorDropBridgeRef;
  dropHover: { x: number; z: number } | null;
  placements: Placement[];
  setPlacements: Dispatch<SetStateAction<Placement[]>>;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  transformMode: "translate" | "rotate" | "scale";
}) {
  return (
    <Canvas
      className="size-full touch-none"
      style={{ width: "100%", height: "100%", display: "block" }}
      shadows
      camera={{ position: [6, 5, 6], fov: 50 }}
      onPointerMissed={() => setSelectedId(null)}
    >
      <SceneInner
        roomW={roomW}
        roomL={roomL}
        roomH={roomH}
        wallColour={wallColour}
        floorDropBridgeRef={floorDropBridgeRef}
        dropHover={dropHover}
        placements={placements}
        setPlacements={setPlacements}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        transformMode={transformMode}
      />
    </Canvas>
  );
}
