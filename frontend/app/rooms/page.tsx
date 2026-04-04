"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { clearAuth, getStoredUser, getToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/errors";
import type { RoomOut } from "@/lib/roomApiTypes";

export default function RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const token = getToken();
    const user = getStoredUser();
    if (!token || !user) {
      router.push("/login");
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await apiFetch<RoomOut[]>(`/users/${user.user_id}/rooms`, { token });
        setRooms(Array.isArray(resp) ? resp : []);
      } catch (e: unknown) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 text-slate-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Your rooms</h1>
            <p className="text-sm text-indigo-300/80 mt-1">
              Create a room, open the 3D editor, then save your layout.
            </p>
          </div>
          <button
            className="text-sm border border-violet-500/40 bg-slate-900/80 hover:bg-slate-800 rounded-lg px-3 py-2"
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
            disabled={creating}
            className="rounded-lg px-4 py-2 font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 shadow-lg shadow-violet-900/30"
            onClick={async () => {
              const token = getToken();
              const user = getStoredUser();
              if (!token || !user) return router.push("/login");
              setCreating(true);
              setError(null);
              try {
                const r = await apiFetch<RoomOut>("/rooms", {
                  method: "POST",
                  token,
                  body: JSON.stringify({
                    user_id: user.user_id,
                    width: 400,
                    length: 500,
                    height: 250,
                    wall_colour: "white",
                    is_natural_light: true,
                  }),
                });
                router.push(`/rooms/${r.room_id}/edit`);
              } catch (e: unknown) {
                setError(getErrorMessage(e));
              } finally {
                setCreating(false);
              }
            }}
          >
            {creating ? "Creating…" : "Create room"}
          </button>
          <Link
            className="text-sm border border-violet-500/40 bg-slate-900/70 hover:bg-slate-800 rounded-lg px-3 py-2"
            href="/"
          >
            2D→3D demo
          </Link>
        </div>

        {error && (
          <div className="mt-4 text-sm bg-red-950/50 border border-red-500/40 text-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="mt-6">
          {loading ? (
            <div className="text-sm text-indigo-300">Loading…</div>
          ) : rooms.length === 0 ? (
            <div className="text-sm text-slate-400">No rooms yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rooms.map((r) => (
                <div
                  key={r.room_id}
                  className="bg-slate-900/70 border border-violet-500/25 rounded-xl p-4 hover:border-violet-400/40 transition shadow-lg shadow-indigo-950/40"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-white">Room {r.room_id.slice(0, 8)}</div>
                    <div className="text-xs text-slate-400">
                      {r.last_edited ? new Date(r.last_edited).toLocaleString() : "—"}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-indigo-200/90">
                    {r.width} × {r.length} × {r.height} | walls: {r.wall_colour ?? "—"}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/rooms/${r.room_id}/edit`}
                      className="text-xs rounded-lg bg-violet-600 hover:bg-violet-500 px-3 py-1.5 font-medium"
                    >
                      Open 3D editor
                    </Link>
                    <Link
                      href={`/rooms/${r.room_id}`}
                      className="text-xs rounded-lg border border-slate-600 hover:bg-slate-800 px-3 py-1.5"
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
