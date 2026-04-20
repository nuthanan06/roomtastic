import type { OpeningOut } from "@/types/api";

export type WallKey = "pz" | "nz" | "px" | "nx";

/** Door/window definition used by EditorScene opening fixtures. */
export type RoomOpening = {
  id: string;
  kind: "window" | "door";
  wall: WallKey;
  /** Position along wall: 0 at min (-X or -Z), 1 at max (+X or +Z). */
  t: number;
  widthM: number;
  heightM: number;
  /** Windows only - bottom of opening from floor (m). */
  sillM: number;
};

/** Shared defaults used when user adds new openings from room settings panel. */
export const DEFAULT_DOOR: Pick<RoomOpening, "widthM" | "heightM" | "sillM"> = {
  widthM: 0.92,
  heightM: 2.05,
  sillM: 0,
};

export const DEFAULT_WINDOW: Pick<RoomOpening, "widthM" | "heightM" | "sillM"> = {
  widthM: 1.15,
  heightM: 1.05,
  sillM: 1.0,
};

function isWallKey(value: string | null | undefined): value is WallKey {
  return value === "pz" || value === "nz" || value === "px" || value === "nx";
}

export function openingOutToOpening(row: OpeningOut): RoomOpening | null {
  if (!isWallKey(row.wall)) return null;
  return {
    id: row.opening_id,
    kind: row.kind,
    wall: row.wall,
    t: row.t,
    widthM: row.width_m,
    heightM: row.height_m,
    sillM: row.sill_m,
  };
}
