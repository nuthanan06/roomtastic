'use client';

import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Grid3D from '@/components/Grid3D';
import ImageUploadSidebar from '@/components/RightSidebar';
import LeftSidebar from '@/components/LeftSidebar';

interface ProcessedData {
  originalImage: string;
  depthMap: string;
}

export default function Scene3D() {
    const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
    const [gridWidth, setGridWidth] = useState(10);
    const [gridLength, setGridLength] = useState(10);

    const handleProcessed = (data: ProcessedData | null) => {
        setProcessedData(data);
    };

    const handleDimensionsChange = (width: number, length: number) => {
        setGridWidth(width);
        setGridLength(length);
    };

    return (
        <div className="w-screen h-screen relative">
            <div className="w-full h-full">
                <Canvas
                    camera={{ position: [15, 15, 15], fov: 50 }}
                    shadows
                >
                    {/* Lighting */}
                    <ambientLight intensity={0.6} />
                    <directionalLight 
                        position={[10, 10, 5]} 
                        intensity={0.8}
                        castShadow
                        shadow-mapSize-width={2048}
                        shadow-mapSize-height={2048}
                    />
                    <pointLight position={[-10, 10, -10]} intensity={0.3} />

                    {/* Grid */}
                    <Grid3D width={gridWidth} length={gridLength} cellSize={1} />

                    {/* TODO: Add processed 3D model here when processedData is available */}
                    {processedData && (
                        <group>
                            {/* DepthModel3D component will go here */}
                        </group>
                    )}

                    {/* Camera Controls */}
                    <OrbitControls 
                        enablePan={true}
                        enableZoom={true}
                        enableRotate={true}
                        minDistance={5}
                        maxDistance={50}
                        target={[0, 0, 0]}
                    />

                </Canvas>
            </div>

            {/* Left Sidebar */}
            <LeftSidebar onDimensionsChange={handleDimensionsChange} />

            {/* Right Sidebar */}
            <ImageUploadSidebar onProcessed={handleProcessed} />
        </div>
    );
}
