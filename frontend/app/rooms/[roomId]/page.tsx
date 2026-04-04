"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useParams, useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/errors";
import type { InventoryOut, RoomOut } from "@/lib/roomApiTypes";

type JobEnqueueResponse = { job_id: string; status?: string };

export default function RoomDetailPage() {
  const router = useRouter();
  const params = useParams<{ roomId: string }>();
  const roomId = useMemo(() => params.roomId, [params]);

  const [room, setRoom] = useState<RoomOut | null>(null);
  const [shopping, setShopping] = useState<InventoryOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    setSessionToken(token);
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [r, shop] = await Promise.all([
          apiFetch<RoomOut>(`/rooms/${roomId}`, { token }),
          apiFetch<InventoryOut[]>(`/rooms/${roomId}/shopping-list`, { token }),
        ]);
        setRoom(r);
        setShopping(Array.isArray(shop) ? shop : []);
      } catch (e: unknown) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [roomId, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 text-slate-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-white">Room {roomId.slice(0, 8)}</h1>
            <p className="text-sm text-indigo-300/80 mt-1">Summary and AI job triggers.</p>
          </div>
          <div className="flex gap-2">
            <Link
              className="text-sm rounded-lg bg-violet-600 hover:bg-violet-500 px-3 py-2 font-medium"
              href={`/rooms/${roomId}/edit`}
            >
              3D editor
            </Link>
            <Link
              className="text-sm border border-violet-500/40 bg-slate-900/70 rounded-lg px-3 py-2"
              href="/rooms"
            >
              Back
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-4 text-sm bg-red-950/50 border border-red-500/40 text-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-6 text-sm text-indigo-300">Loading…</div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900/70 border border-violet-500/25 rounded-xl p-4">
                <div className="font-semibold text-white">Room</div>
                <pre className="mt-2 text-xs text-indigo-200/80 overflow-auto">
                  {JSON.stringify(room, null, 2)}
                </pre>
              </div>
              <div className="bg-slate-900/70 border border-violet-500/25 rounded-xl p-4">
                <div className="font-semibold text-white">Shopping list</div>
                <pre className="mt-2 text-xs text-indigo-200/80 overflow-auto">
                  {JSON.stringify(shopping, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-6 bg-slate-900/70 border border-violet-500/25 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-white">AI placeholders</div>
                <div className="text-xs text-slate-400">Jobs: workers/worker.py</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg px-3 py-2 font-semibold"
                  onClick={async () => {
                    if (!sessionToken) return;
                    const r = await apiFetch<JobEnqueueResponse>(
                      `/rooms/${roomId}/generate-layout`,
                      { method: "POST", token: sessionToken },
                    );
                    alert(`Enqueued job ${r.job_id}`);
                  }}
                >
                  Generate layout
                </button>
                <button
                  type="button"
                  className="text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg px-3 py-2 font-semibold"
                  onClick={async () => {
                    if (!sessionToken) return;
                    const r = await apiFetch<JobEnqueueResponse>(
                      `/rooms/${roomId}/optimize-layout`,
                      { method: "POST", token: sessionToken },
                    );
                    alert(`Enqueued job ${r.job_id}`);
                  }}
                >
                  Optimize layout
                </button>
                <button
                  type="button"
                  className="text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg px-3 py-2 font-semibold"
                  onClick={async () => {
                    if (!sessionToken) return;
                    const r = await apiFetch<JobEnqueueResponse>(
                      `/rooms/${roomId}/furniture-suggestions`,
                      { method: "POST", token: sessionToken },
                    );
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
