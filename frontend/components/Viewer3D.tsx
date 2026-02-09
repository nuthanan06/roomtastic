'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

interface ViewerProps {
  originalImage?: string;
  depthMap?: string;
  backImage?: string;
  backDepthMap?: string;
  leftImage?: string;
  leftDepthMap?: string;
  rightImage?: string;
  rightDepthMap?: string;
  topImage?: string;
  topDepthMap?: string;
  bottomImage?: string;
  bottomDepthMap?: string;
  dimensions?: { width: number; depth: number; height: number };
  mergedPly?: string | null;
  // optional placement/scale: position on scene (meters) and uniform scale
  glbData?: string | null;
  position?: [number, number, number];
  modelScale?: number;
}

export const Viewer3D: React.FC<ViewerProps> = ({ originalImage, depthMap, backImage, backDepthMap, leftImage, leftDepthMap, rightImage, rightDepthMap, topImage, topDepthMap, bottomImage, bottomDepthMap, dimensions, mergedPly, glbData, position, modelScale }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const activeObjectsRef = useRef<THREE.Object3D[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      if (!containerRef.current) return;
      let mounted = true;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a1a);
      sceneRef.current = scene;

      const width = containerRef.current.clientWidth || 800;
      const height = containerRef.current.clientHeight || 600;
      const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 2000);
      camera.position.set(0, 0, 2.5);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const ambient = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambient);
      const dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.position.set(5, 5, 5);
      scene.add(dir);

      const cleanupAndFinish = () => {
        if (!mounted) return;
        setIsLoading(false);
      };

      const loadGLB = async (data: string) => {
        try {
          const loader = new GLTFLoader();
          const uri = data.startsWith('data:') ? data : `data:application/octet-stream;base64,${data}`;
          const resp = await fetch(uri);
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          const gltf = await loader.loadAsync(url);
          scene.add(gltf.scene);
          activeObjectsRef.current.push(gltf.scene);

          // center & scale
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const size = new THREE.Vector3();
          box.getSize(size);
          const center = new THREE.Vector3();
          box.getCenter(center);
          gltf.scene.position.sub(center);

          if (modelScale) {
            gltf.scene.scale.setScalar(modelScale);
          } else {
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            const s = 1.0 / maxDim;
            gltf.scene.scale.setScalar(s);
          }

          if (position) gltf.scene.position.set(position[0], position[1], position[2]);

          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const camZ = Math.max(1.5, maxDim * 2.0);
          camera.position.set(0, Math.max(size.y * 0.5, 0.5), camZ);
          camera.lookAt(0, 0, 0);
          camera.updateProjectionMatrix();

          cleanupAndFinish();
        } catch (e: any) {
          console.warn('GLB load failed', e);
          if (mounted) setError(String(e.message || e));
          cleanupAndFinish();
        }
      };

      const createDisplacedMeshFromTextures = async (colorUrl: string, depthUrl: string) => {
        try {
          const texLoader = new THREE.TextureLoader();
          const [color, depth] = await Promise.all([texLoader.loadAsync(colorUrl), texLoader.loadAsync(depthUrl)]);

          const geom = new THREE.PlaneGeometry(4, 3, 128, 128);
          const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;

          const canvas = document.createElement('canvas');
          canvas.width = (depth.image as HTMLImageElement).width || 256;
          canvas.height = (depth.image as HTMLImageElement).height || 256;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas 2D not available');
          ctx.drawImage(depth.image as CanvasImageSource, 0, 0);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

          for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i);
            const y = posAttr.getY(i);
            const u = (x + 2) / 4;
            const v = 1 - (y + 1.5) / 3;
            const px = Math.floor(u * (canvas.width - 1));
            const py = Math.floor(v * (canvas.height - 1));
            const idx = (py * canvas.width + px) * 4;
            const depthVal = imgData[idx] / 255;
            const newZ = (depthVal - 0.5) * 1.0;
            posAttr.setXYZ(i, x, y, newZ);
          }
          posAttr.needsUpdate = true;
          geom.computeVertexNormals();

          const mat = new THREE.MeshPhongMaterial({ map: color, side: THREE.DoubleSide });
          const mesh = new THREE.Mesh(geom, mat);
          scene.add(mesh);
          activeObjectsRef.current.push(mesh);

          if (mergedPly) {
            try {
              const pure = mergedPly.startsWith('data:') ? mergedPly.split(',')[1] : mergedPly;
              const ply = atob(pure);
              const lines = ply.split(/\r?\n/);
              let headerEnd = 0;
              let vertexCount = 0;
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('element vertex')) {
                  const toks = lines[i].split(/\s+/);
                  vertexCount = parseInt(toks[2], 10);
                }
                if (lines[i].trim() === 'end_header') {
                  headerEnd = i;
                  break;
                }
              }
              if (vertexCount > 0) {
                const positions = new Float32Array(vertexCount * 3);
                const colors = new Float32Array(vertexCount * 3);
                for (let i = 0; i < vertexCount; i++) {
                  const line = lines[headerEnd + 1 + i];
                  if (!line) break;
                  const toks = line.trim().split(/\s+/);
                  positions[i * 3 + 0] = parseFloat(toks[0]);
                  positions[i * 3 + 1] = parseFloat(toks[1]);
                  positions[i * 3 + 2] = parseFloat(toks[2]);
                  if (toks.length >= 6) {
                    colors[i * 3 + 0] = parseFloat(toks[3]) / 255;
                    colors[i * 3 + 1] = parseFloat(toks[4]) / 255;
                    colors[i * 3 + 2] = parseFloat(toks[5]) / 255;
                  } else {
                    colors[i * 3 + 0] = 1;
                    colors[i * 3 + 1] = 1;
                    colors[i * 3 + 2] = 1;
                  }
                }
                const pgeom = new THREE.BufferGeometry();
                pgeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                pgeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                const pmat = new THREE.PointsMaterial({ size: 0.01, vertexColors: true });
                const points = new THREE.Points(pgeom, pmat);
                scene.add(points);
                activeObjectsRef.current.push(points);
              }
            } catch (e) {
              console.warn('Failed to parse merged PLY:', e);
            }
          }

          if (position && activeObjectsRef.current.length > 0) {
            activeObjectsRef.current.forEach((o) => o.position.set(position[0], position[1], position[2]));
          }

          if (modelScale && activeObjectsRef.current.length > 0) {
            activeObjectsRef.current.forEach((o) => o.scale.setScalar(modelScale));
          }

          cleanupAndFinish();
        } catch (err: any) {
          console.warn('Texture mesh failed', err);
          if (mounted) setError(String(err.message || err));
          cleanupAndFinish();
        }
      };

      (async () => {
        setIsLoading(true);
        if (glbData) {
          await loadGLB(glbData);
        } else if (originalImage && depthMap) {
          await createDisplacedMeshFromTextures(originalImage, depthMap);
        } else {
          setIsLoading(false);
        }
      })();

      let raf = 0;
      const animate = () => {
        raf = requestAnimationFrame(animate);
        activeObjectsRef.current.forEach((o) => (o.rotation.y += 0.002));
        renderer.render(scene, camera);
      };
      animate();

      const handleResize = () => {
        if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        rendererRef.current.setSize(w, h);
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
      };
      window.addEventListener('resize', handleResize);

      return () => {
        mounted = false;
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(raf);
        activeObjectsRef.current.forEach((o) => {
          try {
            if (o.parent) o.parent.remove(o);
          } catch {}
        });
        activeObjectsRef.current = [];
        if (rendererRef.current) {
          const canvas = rendererRef.current.domElement;
          if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
          rendererRef.current.dispose();
          rendererRef.current = null;
        }
        sceneRef.current = null;
        cameraRef.current = null;
      };
    }, [originalImage, depthMap, backImage, backDepthMap, leftImage, leftDepthMap, rightImage, rightDepthMap, topImage, topDepthMap, bottomImage, bottomDepthMap, mergedPly, glbData, position, modelScale]);

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
            <div className="text-red-400 text-sm p-4 bg-red-900/50 rounded max-w-md text-center">{error}</div>
          </div>
        )}
      </div>
    );
};
