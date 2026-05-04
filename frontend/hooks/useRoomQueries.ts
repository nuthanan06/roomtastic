"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRoom,
  fetchInventory,
  fetchRoomOpenings,
  fetchRoom,
  fetchRoomFurniture,
  fetchRoomShoppingList,
  fetchUserRooms,
} from "@/services/rooms";
import type { CreateRoomInput, InventoryOut } from "@/types/api";

export type RoomSession = {
  token: string;
  userId: string;
};

export const queryKeys = {
  rooms: (userId: string | undefined) => ["rooms", userId ?? "missing-user"] as const,
  room: (roomId: string) => ["room", roomId] as const,
  roomShopping: (roomId: string) => ["room-shopping", roomId] as const,
  roomFurniture: (roomId: string) => ["room-furniture", roomId] as const,
  roomOpenings: (roomId: string) => ["room-openings", roomId] as const,
  inventory: (userId?: string | null) => ["inventory", userId ?? "global"] as const,
};

// Query hooks
export function useUserRoomsQuery(session: RoomSession | null) {
  return useQuery({
    queryKey: queryKeys.rooms(session?.userId),
    enabled: !!session,
    queryFn: () => fetchUserRooms(session!.userId, session!.token),
  });
}

// Mutation hooks
export function useCreateRoomMutation(
  session: RoomSession | null,
  onCreated: (roomId: string) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRoomInput) => {
      if (!session) throw new Error("Missing session");
      return createRoom(session.token, body);
    },
    onSuccess: async (room) => {
      if (session) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.rooms(session.userId) });
      }
      queryClient.setQueryData(queryKeys.room(room.room_id), room);
      onCreated(room.room_id);
    },
  });
}

// Query hooks
export function useRoomDetailQueries(roomId: string, token: string | null) {
  const [roomQuery, shoppingQuery] = useQueries({
    queries: [
      {
        queryKey: queryKeys.room(roomId),
        enabled: !!token,
        queryFn: () => fetchRoom(roomId, token!),
      },
      {
        queryKey: queryKeys.roomShopping(roomId),
        enabled: !!token,
        queryFn: () => fetchRoomShoppingList(roomId, token!),
      },
    ],
  });

  return { roomQuery, shoppingQuery };
}

// Query hooks
export function useRoomEditorQueries(roomId: string, token: string | null) {
  const [roomQuery, furnitureQuery, openingsQuery] = useQueries({
    queries: [
      {
        queryKey: queryKeys.room(roomId),
        enabled: !!token,
        queryFn: () => fetchRoom(roomId, token!),
      },
      {
        queryKey: queryKeys.roomFurniture(roomId),
        enabled: !!token,
        queryFn: () => fetchRoomFurniture(roomId, token!),
      },
      {
        queryKey: queryKeys.roomOpenings(roomId),
        enabled: !!token,
        queryFn: () => fetchRoomOpenings(roomId, token!),
      },
    ],
  });

  return { roomQuery, furnitureQuery, openingsQuery };
}

// Query hooks
export function useInventoryQuery(
  token: string | null,
  userId?: string | null,
  initialData?: InventoryOut[],
) {
  const seeded = (initialData?.length ?? 0) > 0;
  return useQuery({
    queryKey: queryKeys.inventory(userId),
    enabled: !!token,
    queryFn: () => fetchInventory(token!, userId),
    ...(seeded ? { initialData } : {}),
  });
}
