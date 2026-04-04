/**
 * Placeholder GLBs (colored boxes). Run from frontend/: npm run generate-mock-glbs
 */
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/mock-models");
fs.mkdirSync(outDir, { recursive: true });

const exporter = new GLTFExporter();

function exportMesh(name, color, w, h, d) {
  return new Promise((resolve, reject) => {
    const scene = new THREE.Scene();
    const geom = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = name;
    scene.add(mesh);
    exporter.parse(
      scene,
      (gltf) => {
        const out = path.join(outDir, `${name}.glb`);
        fs.writeFileSync(out, Buffer.from(gltf));
        resolve();
      },
      (err) => reject(err),
      { binary: true },
    );
  });
}

await exportMesh("sofa", 0x6366f1, 2.0, 0.75, 0.9);
await exportMesh("table", 0x38bdf8, 1.2, 0.05, 0.8);
await exportMesh("chair", 0xa78bfa, 0.5, 0.95, 0.5);
await exportMesh("lamp", 0xf472b6, 0.25, 1.4, 0.25);
await exportMesh("rug", 0x4f46e5, 1.8, 0.02, 1.2);

console.log("Wrote GLBs to", outDir);
