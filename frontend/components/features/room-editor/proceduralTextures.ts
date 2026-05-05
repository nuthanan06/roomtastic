import * as THREE from "three";

export type FloorTextureId = "matte" | "wood" | "tile" | "concrete";
export type WallTextureId = "paint" | "plaster" | "brick" | "wood_panel" | "fabric";

// ─── Public texture factories ───────────────────────────────────────────────

/**
 * Generates a canvas-based detail map for the floor material.
 * Returns null for "matte" (plain colour, no texture needed).
 */
export function createFloorDetailMap(preset: FloorTextureId): THREE.CanvasTexture | null {
  if (preset === "matte") return null;

  const tex = makeCanvasTexture((ctx, w, h) => {
    const id = ctx.createImageData(w, h);
    const d = id.data;
    let seed = preset.length * 9973;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const i = (py * w + px) * 4;
        const n = rand();
        let v = 180 + n * 75;
        if (preset === "wood") v += Math.sin(py * 0.12) * 35 + Math.sin(px * 0.03) * 15;
        if (preset === "tile") {
          const gx = Math.floor(px / 32) + Math.floor(py / 32);
          v += (gx % 2) * 28;
        }
        if (preset === "concrete") v = 110 + n * 110;
        const c = Math.min(255, Math.max(0, Math.round(v)));
        d[i] = d[i + 1] = d[i + 2] = c;
        d[i + 3] = 255;
      }
    }

    ctx.putImageData(id, 0, 0);
  });

  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/**
 * Generates a canvas-based detail map for wall materials.
 * Returns null for "paint" (plain colour, no texture needed).
 */
export function createWallDetailMap(preset: WallTextureId): THREE.CanvasTexture | null {
  if (preset === "paint") return null;

  return makeCanvasTexture((ctx, w, h) => {
    const id = ctx.createImageData(w, h);
    const d = id.data;
    let seed = preset.length * 7919;
    const rand = () => {
      seed = (seed * 48271) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const i = (py * w + px) * 4;
        let br = 220;

        if (preset === "plaster") br = 200 + rand() * 55;
        if (preset === "brick") {
          const by = Math.floor(py / 18);
          const bx = Math.floor(px / 40 + (by % 2) * 0.5);
          const mortar = px % 40 < 2 || py % 18 < 2;
          br = mortar ? 230 : 140 + ((bx + by) % 3) * 25;
        }
        if (preset === "wood_panel") {
          const stripe = Math.floor(px / 28) % 2;
          br = 160 + stripe * 40 + rand() * 30;
        }
        if (preset === "fabric") {
          br = 190 + rand() * 40 * (Math.sin(px * 0.2) * 0.3 + 0.7);
        }

        const c = Math.min(255, Math.max(0, Math.round(br)));
        d[i] = d[i + 1] = d[i + 2] = c;
        d[i + 3] = 255;
      }
    }

    ctx.putImageData(id, 0, 0);
  });
}

// ─── Private helper ─────────────────────────────────────────────────────────

/** Creates a canvas, runs the draw callback, and wraps the result in a tiled THREE.CanvasTexture. */
function makeCanvasTexture(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  w = 256,
  h = 256,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context");

  draw(ctx, w, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}
