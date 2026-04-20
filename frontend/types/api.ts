export type AuthUser = {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
};

export type AuthSessionResponse = {
  access_token: string;
  user: AuthUser;
};

/** Mirrors backend RoomOut / FurnitureOut / InventoryOut (snake_case JSON). */
export type RoomOut = {
  room_id: string;
  user_id: string;
  wall_colour: string | null;
  is_natural_light: boolean | null;
  width: number | null;
  length: number | null;
  height: number | null;
  last_edited: string | null;
  furniture?: string[];
  openings?: string[];
};

export type FurnitureOut = {
  furniture_id: string;
  room_id: string;
  name_of_furniture: string | null;
  coordinates: string | null;
  rotation: number | null;
  width: number | null;
  height: number | null;
  inventory_id: string | null;
  tags?: string[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type InventoryOut = {
  inventory_id: string;
  name: string;
  category: string | null;
  width?: number | null;
  length?: number | null;
  height?: number | null;
  model_url: string | null;
  thumbnail_url: string | null;
  colour_options?: string | null;
  price?: string | null;
  description?: string | null;
  url_link?: string | null;
  source?: string | null;
  source_id?: string | null;
  tags?: string[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type OpeningOut = {
  opening_id: string;
  room_id: string;
  kind: "door" | "window";
  wall: "pz" | "nz" | "px" | "nx";
  t: number;
  width_m: number;
  height_m: number;
  sill_m: number;
};

export type LayoutFurnitureSyncItem = {
  client_id?: string;
  furniture_id?: string;
  inventory_id?: string | null;
  name_of_furniture?: string | null;
  coordinates?: string | null;
  rotation?: number | null;
  tags?: string[];
};

export type LayoutOpeningSyncItem = {
  client_id?: string;
  opening_id?: string;
  kind: "door" | "window";
  wall: "pz" | "nz" | "px" | "nx";
  t: number;
  width_m: number;
  height_m: number;
  sill_m: number;
};

export type RoomLayoutSyncBody = {
  room_patch?: {
    wall_colour?: string;
    is_natural_light?: boolean;
    width?: number;
    length?: number;
    height?: number;
  };
  furniture: LayoutFurnitureSyncItem[];
  openings: LayoutOpeningSyncItem[];
};

export type RoomLayoutSyncOut = {
  room_id: string;
  furniture: Array<{ client_id?: string | null; furniture_id: string }>;
  openings: Array<{ client_id?: string | null; opening_id: string; kind: "door" | "window" }>;
};

export type CreateRoomInput = {
  user_id: string;
  width: number;
  length: number;
  height: number;
  wall_colour: string;
  is_natural_light: boolean;
};
