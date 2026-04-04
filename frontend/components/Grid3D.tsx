'use client';

import * as THREE from 'three';
import { Grid } from '@react-three/drei';
import Walls from '@/components/Walls';

interface Grid3DProps {
  width?: number;
  length?: number;
  /** If width/length are omitted, both axes use this (default 10). */
  size?: number;
  cellSize?: number;
  floorColor?: string;
  gridColor?: string;
}

export default function Grid3D({ 
  width,
  length,
  size = 10, 
  cellSize = 1,
  floorColor = '#FFFFFF',
  gridColor = '#000000'
}: Grid3DProps) {
  const gridWidth = width ?? size;
  const gridDepth = length ?? size;

  return (
    <group>
      <Walls width={gridWidth} length={gridDepth} />
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[gridWidth, gridDepth]} />
        <meshStandardMaterial 
          color={floorColor} 
          opacity={0.8} 
          transparent 
          side={THREE.DoubleSide}
        />
      </mesh>

      <Grid
        args={[gridWidth, gridDepth]}
        cellSize={cellSize}
        cellThickness={0.5}
        cellColor={gridColor}
        sectionSize={cellSize}
        sectionThickness={1}
        sectionColor={gridColor}
        fadeDistance={Math.max(gridWidth, gridDepth)}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
        position={[0, 0.01, 0]}
      />
    </group>
  );
}
