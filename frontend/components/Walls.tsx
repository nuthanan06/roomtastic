'use client';

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

interface WallsProps {
  width: number;
  length: number;
  height?: number;
  thickness?: number;
  color?: string;
}

export default function Walls({
  width,
  length,
  height = 5,
  thickness = 0.2,
  color = '#cccccc',
}: WallsProps) {
  const halfW = width / 2;
  const halfL = length / 2;
  const halfH = height / 2;

  const frontRef = useRef<THREE.Mesh>(null);
  const backRef = useRef<THREE.Mesh>(null);
  const leftRef = useRef<THREE.Mesh>(null);
  const rightRef = useRef<THREE.Mesh>(null);

  const { camera } = useThree();

  useFrame(() => {
    const pos = camera.position;
    // Treat view as from a corner: hide the two walls that meet at that corner.
    // Front-left (x<0,z<0): hide front, left. Front-right (x>0,z<0): hide front, right.
    // Back-left (x<0,z>0): hide back, left.  Back-right (x>0,z>0): hide back, right.
    if (frontRef.current) frontRef.current.visible = pos.z >= 0; // hide when we're in front
    if (backRef.current) backRef.current.visible = pos.z <= 0;   // hide when we're at back
    if (leftRef.current) leftRef.current.visible = pos.x >= 0;   // hide when we're on left
    if (rightRef.current) rightRef.current.visible = pos.x <= 0; // hide when we're on right
  });

  return (
    <group>
      {/* Front (Z = -length/2) */}
      <mesh ref={frontRef} position={[0, halfH, -halfL]} castShadow receiveShadow>
        <boxGeometry args={[width, height, thickness]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
      {/* Back (Z = +length/2) */}
      <mesh ref={backRef} position={[0, halfH, halfL]} castShadow receiveShadow>
        <boxGeometry args={[width, height, thickness]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
      {/* Left (X = -width/2) */}
      <mesh ref={leftRef} position={[-halfW, halfH, 0]} castShadow receiveShadow>
        <boxGeometry args={[thickness, height, length]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
      {/* Right (X = +width/2) */}
      <mesh ref={rightRef} position={[halfW, halfH, 0]} castShadow receiveShadow>
        <boxGeometry args={[thickness, height, length]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
