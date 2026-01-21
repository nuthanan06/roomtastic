'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface ViewerProps {
  originalImage: string;
  depthMap: string;
}

export const Viewer3D: React.FC<ViewerProps> = ({ originalImage, depthMap }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;
    let animationId: number;

    try {
      // Scene setup
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a1a);
      sceneRef.current = scene;

      // Camera setup
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.set(0, 0, 2.5);
      cameraRef.current = camera;

      // Renderer setup
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width * 0.5, height * 0.5);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.domElement.style.margin = '0 auto';
      renderer.domElement.style.display = 'block';
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(5, 5, 5);
      scene.add(directionalLight);

      // Load textures
      const textureLoader = new THREE.TextureLoader();

      Promise.all([
        textureLoader.loadAsync(originalImage),
        textureLoader.loadAsync(depthMap),
      ])
        .then(([color, depth]) => {
          if (!isMounted) return;

          console.log('✓ Textures loaded');

          // Create geometry
          const geometry = new THREE.PlaneGeometry(4, 3, 128, 128);
          const positionAttribute = geometry.getAttribute('position') as THREE.BufferAttribute;

          // Get depth texture data
          const canvas = document.createElement('canvas');
          canvas.width = depth.image.width;
          canvas.height = depth.image.height;
          const ctx = canvas.getContext('2d');

          if (ctx) {
            ctx.drawImage(depth.image, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixelData = imageData.data;

            // Displace vertices
            for (let i = 0; i < positionAttribute.count; i++) {
              const x = positionAttribute.getX(i);
              const y = positionAttribute.getY(i);

              // Map to texture coords
              const u = (x + 2) / 4;
              const v = 1 - (y + 1.5) / 3;

              const clampedU = Math.max(0, Math.min(1, u));
              const clampedV = Math.max(0, Math.min(1, v));

              const pixelX = Math.floor(clampedU * (canvas.width - 1));
              const pixelY = Math.floor(clampedV * (canvas.height - 1));
              const pixelIndex = (pixelY * canvas.width + pixelX) * 4;

              const depthValue = pixelData[pixelIndex] / 255;

              if (!isNaN(depthValue) && isFinite(depthValue)) {
                const newZ = (depthValue - 0.5) * 1.0;
                positionAttribute.setXYZ(i, x, y, newZ);
              }
            }

            positionAttribute.needsUpdate = true;
            geometry.computeBoundingBox();
            geometry.computeVertexNormals();
          }

          // Create material
          const material = new THREE.MeshPhongMaterial({
            map: color,
            shininess: 100,
            side: THREE.DoubleSide,
          });

          // Create mesh
          const mesh = new THREE.Mesh(geometry, material);
          meshRef.current = mesh;
          scene.add(mesh);

          console.log('✓ 3D model created');
          if (isMounted) {
            setIsLoading(false);
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          console.error('Texture error:', err);
          setError(`Failed to load textures: ${err.message}`);
          setIsLoading(false);
        });

      // Animation loop
      const animate = () => {
        animationId = requestAnimationFrame(animate);

        if (meshRef.current) {
          meshRef.current.rotation.x += 0.002;
          meshRef.current.rotation.y += 0.004;
        }

        renderer.render(scene, camera);
      };
      animate();

      // Handle resize
      const handleResize = () => {
        if (containerRef.current && rendererRef.current && cameraRef.current) {
          const newWidth = containerRef.current.clientWidth;
          const newHeight = containerRef.current.clientHeight;
          cameraRef.current.aspect = newWidth / newHeight;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(newWidth, newHeight);
        }
      };
      window.addEventListener('resize', handleResize);

      return () => {
        isMounted = false;
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationId);
        if (containerRef.current && rendererRef.current && containerRef.current.contains(rendererRef.current.domElement)) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
        renderer.dispose();
      };
    } catch (err) {
      if (!isMounted) return;
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Setup error:', errorMsg);
      // Update state only if still mounted
      setTimeout(() => {
        if (isMounted) {
          setError(errorMsg);
          setIsLoading(false);
        }
      }, 0);
    }
  }, [originalImage, depthMap]);

  return (
    <div className="relative w-full h-full bg-gray-900">
      <div ref={containerRef} className="w-full h-full" />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white text-xl">Loading 3D model...</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-red-400 text-sm p-4 bg-red-900/50 rounded max-w-md text-center">
            {error}
          </div>
        </div>
      )}
    </div>
  );
};
