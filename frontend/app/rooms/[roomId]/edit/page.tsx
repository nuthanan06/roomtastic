"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";
import type { FurnitureOut, InventoryOut, RoomOut } from "@/lib/roomApiTypes";
import RoomEditorClient from "@/components/features/room-editor/RoomEditorClient";

function LoadingEditor({ message, error }: { message: string; error: string | null }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-indigo-200">
      <div className="text-center">
        <p>{message}</p>
        {error && <p className="mt-2 text-red-400 text-sm">{error}</p>}
        <Link href="/rooms" className="mt-4 inline-block text-violet-400 underline">
          Back to rooms
        </Link>
      </div>
    </div>
  );
}

export default function EditRoomPage() {
  const router = useRouter();
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;

  const [bootstrapped, setBootstrapped] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomOut | null>(null);
  const [furniture, setFurniture] = useState<FurnitureOut[]>([]);
  const [inventory, setInventory] = useState<InventoryOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace("/login");
      return;
    }
    setSessionToken(t);
    setBootstrapped(true);
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [r, furn, inv] = await Promise.all([
          apiFetch<RoomOut>(`/rooms/${roomId}`, { token: t }),
          apiFetch<FurnitureOut[]>(`/rooms/${roomId}/furniture`, { token: t }),
          apiFetch<InventoryOut[]>(`/inventory`, { token: t }),
        ]);
        setRoom(r);
        setFurniture(furn);
        setInventory(inv);
      } catch (e: unknown) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [roomId, router]);

  if (!bootstrapped) {
    return <LoadingEditor message="Loading editor…" error={null} />;
  }

  if (loading || !room) {
    return (
      <LoadingEditor message={loading ? "Loading editor…" : "Room not found."} error={error} />
    );
  }

  return (
    <RoomEditorClient
      roomId={roomId}
      token={sessionToken!}
      room={room}
      initialFurniture={furniture}
      inventory={inventory}
    />
  );
}
