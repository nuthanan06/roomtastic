"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import RoomEditorClient from "@/components/features/room-editor/RoomEditorClient";
import {
  openingOutToOpening,
  type RoomOpening,
} from "@/components/features/room-editor/roomOpenings";
import { useRoomEditorQueries } from "@/hooks/useRoomQueries";
import { getToken } from "@/lib/auth";
import { getErrorMessage } from "@/utils/errors";

function LoadingEditor({ message, error }: { message: string; error: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-indigo-200">
      <div className="text-center">
        <p>{message}</p>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <Link href="/rooms" className="mt-4 inline-block text-violet-400 underline">
          Back to rooms
        </Link>
      </div>
    </div>
  );
}

function isRoomOpening(value: RoomOpening | null): value is RoomOpening {
  return value !== null;
}

export default function EditRoomPage() {
  const router = useRouter();
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;

  const sessionToken = useMemo(() => getToken(), []);

  useEffect(() => {
    if (!sessionToken) {
      router.replace("/login");
    }
  }, [router, sessionToken]);

  const { roomQuery, furnitureQuery, openingsQuery } = useRoomEditorQueries(roomId, sessionToken);

  const loading =
    !!sessionToken &&
    (roomQuery.isLoading || furnitureQuery.isLoading || openingsQuery.isLoading);

  const room = roomQuery.data ?? null;
  const furniture = furnitureQuery.data ?? [];
  const openings = (openingsQuery.data ?? []).map(openingOutToOpening).filter(isRoomOpening);

  const error = roomQuery.error ?? furnitureQuery.error ?? openingsQuery.error;
  const errorMessage = error ? getErrorMessage(error) : null;

  if (!sessionToken) {
    return <LoadingEditor message="Redirecting to login..." error={null} />;
  }

  if (loading || !room) {
    return (
      <LoadingEditor
        message={loading ? "Loading editor..." : "Room not found."}
        error={errorMessage}
      />
    );
  }

  return (
    <RoomEditorClient
      roomId={roomId}
      token={sessionToken}
      room={room}
      initialFurniture={furniture}
      initialOpenings={openings}
    />
  );
}
