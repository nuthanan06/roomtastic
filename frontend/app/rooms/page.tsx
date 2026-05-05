"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { clearAuth, useClientToken, useClientUser } from "@/lib/auth";
import { useCreateRoomMutation, useUserRoomsQuery } from "@/hooks/useRoomQueries";
import { getErrorMessage } from "@/utils/errors";
import type { CreateRoomInput } from "@/types/api";

const DEFAULT_ROOM_PAYLOAD = {
  width: 400,
  length: 500,
  height: 250,
  wall_colour: "white",
  is_natural_light: true,
};

export default function RoomsPage() {
  const router = useRouter();
  const [createError, setCreateError] = useState<string | null>(null);

  const token = useClientToken();
  const user = useClientUser();
  const auth = token && user ? { token, user } : null;

  useEffect(() => {
    if (!auth) router.push("/login");
  }, [auth, router]);

  const session = useMemo(
    () => (auth ? { token: auth.token, userId: auth.user.user_id } : null),
    [auth],
  );

  const roomsQuery = useUserRoomsQuery(session);

  const createRoomMutation = useCreateRoomMutation(session, (roomId) => {
    setCreateError(null);
    router.push(`/rooms/${roomId}/edit`);
  });

  const loading = !!auth && roomsQuery.isLoading;
  const rooms = roomsQuery.data ?? [];
  const error = createError ?? (roomsQuery.error ? getErrorMessage(roomsQuery.error) : null);

  if (!auth) {
    return (
      <div className="rt-app-shell min-h-screen p-6 text-sm text-indigo-200">
        Redirecting to login...
      </div>
    );
  }

  const handleCreateRoom = () => {
    if (!session) {
      router.push("/login");
      return;
    }
    setCreateError(null);
    const body: CreateRoomInput = {
      user_id: session.userId,
      ...DEFAULT_ROOM_PAYLOAD,
    };
    createRoomMutation.mutate(body, {
      onError: (e) => setCreateError(getErrorMessage(e)),
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 p-6 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Your rooms</h1>
            <p className="mt-1 text-sm text-indigo-300/80">
              Create a room, open the 3D editor, then save your layout.
            </p>
          </div>
          <button
            className="rounded-lg border border-violet-500/40 bg-slate-900/80 px-3 py-2 text-sm hover:bg-slate-800"
            onClick={() => {
              clearAuth();
              router.push("/login");
            }}
          >
            Log out
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            disabled={createRoomMutation.isPending}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 font-semibold shadow-lg shadow-violet-900/30 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
            onClick={handleCreateRoom}
          >
            {createRoomMutation.isPending ? "Creating..." : "Create room"}
          </button>
          <Link
            className="rounded-lg border border-violet-500/40 bg-slate-900/70 px-3 py-2 text-sm hover:bg-slate-800"
            href="/"
          >
            Back home
          </Link>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="mt-6">
          {loading ? (
            <div className="text-sm text-indigo-300">Loading...</div>
          ) : rooms.length === 0 ? (
            <div className="text-sm text-slate-400">No rooms yet.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {rooms.map((r) => (
                <div
                  key={r.room_id}
                  className="rounded-xl border border-violet-500/25 bg-slate-900/70 p-4 shadow-lg shadow-indigo-950/40 transition hover:border-violet-400/40"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-white">Room {r.room_id.slice(0, 8)}</div>
                    <div className="text-xs text-slate-400">
                      {r.last_edited ? new Date(r.last_edited).toLocaleString() : "-"}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-indigo-200/90">
                    {r.width} x {r.length} x {r.height} | walls: {r.wall_colour ?? "-"}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/rooms/${r.room_id}/edit`}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium hover:bg-violet-500"
                    >
                      Open 3D editor
                    </Link>
                    <Link
                      href={`/rooms/${r.room_id}`}
                      className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs hover:bg-slate-800"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
