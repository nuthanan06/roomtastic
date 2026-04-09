/** Mirrors backend RoomOut / FurnitureOut (snake_case JSON) */
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
  windows?: string[];
  doors?: string[];
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
};

export type InventoryOut = {
  inventory_id: string;
  name: string;
  category: string | null;
  model_url: string | null;
  thumbnail_url: string | null;
};
