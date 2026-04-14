"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useParams, useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/errors";

type RoomStateResponse = {
  room: {
    room_id: string;
    user_id: string;
    width: number;
    length: number;
    height: number;
    wall_color: string;
    is_natural_light: boolean;
    last_edited: string;
  };
  furniture: unknown[];
  windows: unknown[];
  doors: unknown[];
  lights: unknown[];
};

type ShoppingListResponse = {
  room_id: string;
  items: unknown[];
};

type JobEnqueueResponse = { job_id: string; status: string };

export default function RoomDetailPage() {
  const router = useRouter();
  const params = useParams<{ roomId: string }>();
  const roomId = useMemo(() => params.roomId, [params]);

  const [data, setData] = useState<RoomStateResponse | null>(null);
  const [shopping, setShopping] = useState<ShoppingListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await apiFetch<RoomStateResponse>(`/rooms/${roomId}`, { token });
        setData(resp);
        const shop = await apiFetch<ShoppingListResponse>(`/rooms/${roomId}/shopping-list`, { token });
        setShopping(shop);
      } catch (e: unknown) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [roomId, router]);

  const token = typeof window !== "undefined" ? getToken() : null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Room {roomId.slice(0, 8)}</h1>
            <p className="text-sm text-gray-400 mt-1">This page shows the backend room state (3D editor wiring next).</p>
          </div>
          <Link className="text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg px-3 py-2" href="/rooms">
            Back
          </Link>
        </div>

        {error && (
          <div className="mt-4 text-sm bg-red-950/40 border border-red-800 text-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-6 text-sm text-gray-400">Loading...</div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="font-semibold">Room</div>
                <pre className="mt-2 text-xs text-gray-300 overflow-auto">{JSON.stringify(data?.room, null, 2)}</pre>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="font-semibold">Shopping list</div>
                <pre className="mt-2 text-xs text-gray-300 overflow-auto">{JSON.stringify(shopping?.items ?? [], null, 2)}</pre>
              </div>
            </div>

            <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">AI placeholders</div>
                <div className="text-xs text-gray-400">Jobs are processed by `workers/worker.py`</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="text-sm bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-2 font-semibold"
                  onClick={async () => {
                    if (!token) return;
                    const r = await apiFetch<JobEnqueueResponse>(`/rooms/${roomId}/generate-layout`, { method: "POST", token });
                    alert(`Enqueued job ${r.job_id}`);
                  }}
                >
                  Generate layout
                </button>
                <button
                  className="text-sm bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-2 font-semibold"
                  onClick={async () => {
                    if (!token) return;
                    const r = await apiFetch<JobEnqueueResponse>(`/rooms/${roomId}/optimize-layout`, { method: "POST", token });
                    alert(`Enqueued job ${r.job_id}`);
                  }}
                >
                  Optimize layout
                </button>
                <button
                  className="text-sm bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-2 font-semibold"
                  onClick={async () => {
                    if (!token) return;
                    const r = await apiFetch<JobEnqueueResponse>(`/rooms/${roomId}/furniture-suggestions`, { method: "POST", token });
                    alert(`Enqueued job ${r.job_id}`);
                  }}
                >
                  Furniture suggestions
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
