'use client';

import * as THREE from 'three';
import { Grid } from '@react-three/drei';
import Walls from '@/components/Walls';

interface Grid3DProps {
  width?: number;        // Grid width (X dimension)
  length?: number;       // Grid length (Z dimension)
  cellSize?: number;    
  floorColor?: string;  
  gridColor?: string;  
}

export default function Grid3D({ 
  width = 10, 
  length = 10,
  cellSize = 1,
  floorColor = '#FFFFFF',
  gridColor = '#000000'
}: Grid3DProps) {
  const gridWidth = width;
  const gridDepth = length;

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
