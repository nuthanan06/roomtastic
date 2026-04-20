"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useRoomDetailQueries } from "@/hooks/useRoomQueries";
import { getToken } from "@/lib/auth";
import { getErrorMessage } from "@/utils/errors";

export default function RoomDetailPage() {
  const router = useRouter();
  const params = useParams<{ roomId: string }>();
  const roomId = useMemo(() => params.roomId, [params]);

  const token = useMemo(() => getToken(), []);
  const [placeholderNotice, setPlaceholderNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      router.push("/login");
    }
  }, [token, router]);

  const { roomQuery, shoppingQuery } = useRoomDetailQueries(roomId, token);

  const loading = !!token && (roomQuery.isLoading || shoppingQuery.isLoading);

  const room = roomQuery.data ?? null;
  const shopping = shoppingQuery.data ?? [];
  const error = roomQuery.error ?? shoppingQuery.error;

  const handlePlaceholderAction = (label: string) => {
    setPlaceholderNotice(
      `${label} is still a UI placeholder and is not wired to backend room endpoints yet.`,
    );
  };

  if (!token) {
    return (
      <div className="rt-app-shell min-h-screen p-6 text-sm text-indigo-200">
        Redirecting to login...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 p-6 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Room {roomId.slice(0, 8)}</h1>
            <p className="mt-1 text-sm text-indigo-300/80">Summary and AI job placeholders.</p>
          </div>
          <div className="flex gap-2">
            <Link
              className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium hover:bg-violet-500"
              href={`/rooms/${roomId}/edit`}
            >
              3D editor
            </Link>
            <Link
              className="rounded-lg border border-violet-500/40 bg-slate-900/70 px-3 py-2 text-sm"
              href="/rooms"
            >
              Back
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {getErrorMessage(error)}
          </div>
        )}

        {placeholderNotice && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-950/50 px-3 py-2 text-sm text-amber-100">
            {placeholderNotice}
          </div>
        )}

        {loading ? (
          <div className="mt-6 text-sm text-indigo-300">Loading...</div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-violet-500/25 bg-slate-900/70 p-4">
                <div className="font-semibold text-white">Room</div>
                <pre className="mt-2 overflow-auto text-xs text-indigo-200/80">
                  {JSON.stringify(room, null, 2)}
                </pre>
              </div>
              <div className="rounded-xl border border-violet-500/25 bg-slate-900/70 p-4">
                <div className="font-semibold text-white">Shopping list</div>
                <pre className="mt-2 overflow-auto text-xs text-indigo-200/80">
                  {JSON.stringify(shopping, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-violet-500/25 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-white">AI placeholders</div>
                <div className="text-xs text-slate-400">Jobs: workers/worker.py</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-indigo-600/70 px-3 py-2 text-sm font-semibold hover:bg-indigo-500/70"
                  onClick={() => handlePlaceholderAction("Generate layout")}
                >
                  Generate layout
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-indigo-600/70 px-3 py-2 text-sm font-semibold hover:bg-indigo-500/70"
                  onClick={() => handlePlaceholderAction("Optimize layout")}
                >
                  Optimize layout
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-indigo-600/70 px-3 py-2 text-sm font-semibold hover:bg-indigo-500/70"
                  onClick={() => handlePlaceholderAction("Furniture suggestions")}
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
