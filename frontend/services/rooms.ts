import { apiFetch } from "@/lib/apiClient";
import { ensureArray } from "@/lib/utils";
import type {
  CreateRoomInput,
  FurnitureOut,
  HunyuanGenerateJobInput,
  InventoryOut,
  JobOut,
  OpeningOut,
  RoomLayoutSyncBody,
  RoomLayoutSyncOut,
  RoomOut,
} from "@/types/api";

export function fetchUserRooms(userId: string, token: string): Promise<RoomOut[]> {
  return apiFetch<RoomOut[]>(`/users/${userId}/rooms`, { token }).then((rows) =>
    ensureArray<RoomOut>(rows),
  );
}

export function fetchRoom(roomId: string, token: string): Promise<RoomOut> {
  return apiFetch<RoomOut>(`/rooms/${roomId}`, { token });
}

export function fetchRoomShoppingList(roomId: string, token: string): Promise<InventoryOut[]> {
  return apiFetch<InventoryOut[]>(`/rooms/${roomId}/shopping-list`, { token }).then((rows) =>
    ensureArray<InventoryOut>(rows),
  );
}

export function fetchRoomFurniture(roomId: string, token: string): Promise<FurnitureOut[]> {
  return apiFetch<FurnitureOut[]>(`/rooms/${roomId}/furniture`, { token }).then((rows) =>
    ensureArray<FurnitureOut>(rows),
  );
}

export function fetchRoomOpenings(roomId: string, token: string): Promise<OpeningOut[]> {
  return apiFetch<OpeningOut[]>(`/rooms/${roomId}/openings`, { token }).then((rows) =>
    ensureArray<OpeningOut>(rows),
  );
}

export function fetchInventory(token: string): Promise<InventoryOut[]> {
  return apiFetch<InventoryOut[]>("/inventory", { token }).then((rows) =>
    ensureArray<InventoryOut>(rows),
  );
}

export function createHunyuanGenerateJob(
  token: string,
  body: HunyuanGenerateJobInput,
): Promise<JobOut> {
  return apiFetch<JobOut>("/jobs/hunyuan/generate", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function fetchJob(jobId: string, token: string): Promise<JobOut> {
  return apiFetch<JobOut>(`/jobs/${jobId}`, { token });
}

export function createRoom(token: string, body: CreateRoomInput): Promise<RoomOut> {
  return apiFetch<RoomOut>("/rooms", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

type FurniturePatchInput = {
  coordinates: string;
  rotation: number;
  name_of_furniture: string;
};

type CreateFurnitureInput = {
  name_of_furniture: string;
  inventory_id: string | null;
  coordinates: string;
  rotation: number;
};

type RoomPatchInput = {
  wall_colour: string;
};

export function patchFurniture(
  furnitureId: string,
  token: string,
  body: FurniturePatchInput,
): Promise<FurnitureOut> {
  return apiFetch<FurnitureOut>(`/furniture/${furnitureId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function createRoomFurniture(
  roomId: string,
  token: string,
  body: CreateFurnitureInput,
): Promise<FurnitureOut> {
  return apiFetch<FurnitureOut>(`/rooms/${roomId}/furniture`, {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function deleteFurniture(furnitureId: string, token: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/furniture/${furnitureId}`, {
    method: "DELETE",
    token,
  });
}

export function patchRoom(roomId: string, token: string, body: RoomPatchInput): Promise<RoomOut> {
  return apiFetch<RoomOut>(`/rooms/${roomId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function syncRoomLayout(
  roomId: string,
  token: string,
  body: RoomLayoutSyncBody,
): Promise<RoomLayoutSyncOut> {
  return apiFetch<RoomLayoutSyncOut>(`/rooms/${roomId}/layout`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}
