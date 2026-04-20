/** World units: meters. Room API dimensions assumed centimeters → divide by 100. */
export const CM_TO_M = 0.01;

/** Fine snap (about 2 cm). */
export const GRID_CELL = 0.02;

/** Round world X/Z to nearest grid intersection so drag/drop "locks" to consistent cells. */
export function snapXZ(x: number, z: number, cell: number = GRID_CELL): [number, number] {
  return [Math.round(x / cell) * cell, Math.round(z / cell) * cell];
}

export function parseCoordsJson(raw: string | null): {
  x: number;
  y: number;
  z: number;
  scale?: number;
} {
  try {
    const o = JSON.parse(raw || "{}");
    return {
      x: Number(o.x) || 0,
      y: Number(o.y) || 0,
      z: Number(o.z) || 0,
      scale: o.scale != null ? Number(o.scale) : undefined,
    };
  } catch {
    return { x: 0, y: 0, z: 0 };
  }
}
