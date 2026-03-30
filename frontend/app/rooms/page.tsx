"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { clearAuth, getStoredUser, getToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/errors";

type Room = {
  room_id: string;
  width: number;
  length: number;
  height: number;
  wall_color: string;
  is_natural_light: boolean;
  last_edited: string;
};

type RoomCreateResponse = Room;

export default function RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
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
        const resp = await apiFetch<{ rooms: Room[] }>(`/users/${user.user_id}/rooms`, { token });
        setRooms(resp.rooms);
      } catch (e: unknown) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Your rooms</h1>
            <p className="text-sm text-gray-400 mt-1">Create a room, then place furniture and generate a shopping list.</p>
          </div>
          <button
            className="text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg px-3 py-2"
            onClick={() => {
              clearAuth();
              router.push("/login");
            }}
          >
            Log out
          </button>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            disabled={creating}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg px-3 py-2 font-semibold"
            onClick={async () => {
              const token = getToken();
              if (!token) return router.push("/login");
              setCreating(true);
              setError(null);
              try {
                const r = await apiFetch<RoomCreateResponse>("/rooms", {
                  method: "POST",
                  token,
                  body: JSON.stringify({ width: 400, length: 500, height: 250, wall_color: "white", is_natural_light: true }),
                });
                router.push(`/rooms/${r.room_id}`);
              } catch (e: unknown) {
                setError(getErrorMessage(e));
              } finally {
                setCreating(false);
              }
            }}
          >
            {creating ? "Creating..." : "Create room"}
          </button>
          <Link className="text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg px-3 py-2" href="/">
            2D to 3D demo
          </Link>
        </div>

        {error && (
          <div className="mt-4 text-sm bg-red-950/40 border border-red-800 text-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="mt-6">
          {loading ? (
            <div className="text-sm text-gray-400">Loading...</div>
          ) : rooms.length === 0 ? (
            <div className="text-sm text-gray-400">No rooms yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rooms.map((r) => (
                <Link
                  key={r.room_id}
                  href={`/rooms/${r.room_id}`}
                  className="block bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">Room {r.room_id.slice(0, 8)}</div>
                    <div className="text-xs text-gray-400">Edited {new Date(r.last_edited).toLocaleString()}</div>
                  </div>
                  <div className="mt-2 text-sm text-gray-300">
                    {r.width} x {r.length} x {r.height} | walls: {r.wall_color}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
