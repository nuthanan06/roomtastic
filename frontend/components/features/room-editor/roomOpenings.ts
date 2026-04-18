export type WallKey = "pz" | "nz" | "px" | "nx";

export type RoomOpening = {
  id: string;
  kind: "window" | "door";
  wall: WallKey;
  /** Position along wall: 0 at min (–X or –Z), 1 at max (+X or +Z). */
  t: number;
  widthM: number;
  heightM: number;
  /** Windows only — bottom of opening from floor (m). */
  sillM: number;
};

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
