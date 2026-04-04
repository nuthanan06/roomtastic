"use client";

import "@react-three/fiber";
import * as THREE from "three";
import { Grid } from '@react-three/drei';
import Walls from '@/components/Walls';

interface Grid3DProps {
  size?: number;        // Grid size (20x20 by default)
  cellSize?: number;    // Size of each cell (1 unit by default)
  floorColor?: string;  // Floor plane color
  gridColor?: string;  // Grid line color
}

export default function Grid3D({ 
  size = 10, 
  cellSize = 1,
  floorColor = '#FFFFFF',
  gridColor = '#000000'
}: Grid3DProps) {
  // Calculate grid dimensions
  const gridWidth = size;
  const gridDepth = size;

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
        fadeDistance={size}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
        position={[0, 0.01, 0]}
      />
    </group>
  );
}
