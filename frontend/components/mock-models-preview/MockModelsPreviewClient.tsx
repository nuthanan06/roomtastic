"use client";

import { Suspense, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { GRID_CELL } from "@/lib/gridSnap";
import { MOCK_CATALOG } from "@/lib/mockCatalog";
import { publicAssetUrl } from "@/lib/publicAssetUrl";
import { normalizeClonedGltfRoot } from "@/components/features/room-editor/modelFit";

function PreviewMesh({
  glbUrl,
  position,
}: {
  glbUrl: string;
  position: [number, number, number];
}) {
  const src = useMemo(() => publicAssetUrl(glbUrl), [glbUrl]);
  const { scene } = useGLTF(src);
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
  }, [scene, src]);

  return (
    <group position={position}>
      <primitive object={clone} />
    </group>
  );
}

export function MockModelsPreviewClient() {
  useEffect(() => {
    for (const m of MOCK_CATALOG) {
      useGLTF.preload(publicAssetUrl(m.glbUrl));
    }
  }, []);

  const half = (MOCK_CATALOG.length - 1) / 2;
  const spacing = 1.65;
  const floorW = Math.max(14, MOCK_CATALOG.length * spacing + 4);
  const floorL = 6;

  return (
    <Canvas
      className="size-full touch-none block"
      style={{ width: "100%", height: "100%" }}
      shadows
      camera={{ position: [5.5, 4, 6.5], fov: 48 }}
    >
      <color attach="background" args={["#0f0a1e"]} />
      <ambientLight intensity={0.45} color="#a5b4fc" />
      <directionalLight position={[8, 14, 6]} intensity={1.1} castShadow color="#e0e7ff" />
      <hemisphereLight args={["#312e81", "#1e1b4b", 0.35]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[floorW, floorL]} />
        <meshStandardMaterial color="#1e1b4b" metalness={0.12} roughness={0.88} />
      </mesh>

      <Grid
        position={[0, 0.002, 0]}
        args={[floorW, floorL]}
        cellSize={GRID_CELL}
        sectionSize={GRID_CELL * 10}
        cellColor="#5b21b6"
        sectionColor="#818cf8"
        cellThickness={0.85}
        sectionThickness={1.05}
        fadeDistance={Math.max(floorW, floorL)}
        fadeStrength={1}
        infiniteGrid={false}
        side={THREE.DoubleSide}
      />

      <Suspense fallback={null}>
        {MOCK_CATALOG.map((item, i) => (
          <PreviewMesh
            key={item.id}
            glbUrl={item.glbUrl}
            position={[(i - half) * spacing, 0, 0]}
          />
        ))}
      </Suspense>

      <OrbitControls
        makeDefault
        minDistance={2}
        maxDistance={28}
        target={[0, 0.35, 0]}
        maxPolarAngle={Math.PI / 2 - 0.06}
      />
    </Canvas>
  );
}
