"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { setAuth, type StoredUser } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";

type AuthResponse = { access_token: string; user: StoredUser };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-violet-500/25 bg-slate-900/70 backdrop-blur-md p-8 shadow-2xl shadow-violet-950/50">
        <Link href="/" className="text-sm text-indigo-300 hover:text-indigo-200">
          ← Back home
        </Link>
        <h1 className="text-2xl font-semibold text-white mt-4">Log in</h1>
        <p className="text-sm text-indigo-200/70 mt-1">
          No account?{" "}
          <Link className="text-violet-300 hover:text-violet-200 underline-offset-2 hover:underline" href="/register">
            Register
          </Link>
        </p>

        <form
          className="mt-6 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            setError(null);
            try {
              const resp = await apiFetch<AuthResponse>("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password }),
              });
              setAuth(resp.access_token, resp.user);
              router.push("/rooms");
            } catch (e: unknown) {
              setError(getErrorMessage(e));
            } finally {
              setLoading(false);
            }
          }}
        >
          <input
            className="w-full bg-slate-950/80 border border-violet-500/20 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-400 focus:outline-none"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full bg-slate-950/80 border border-violet-500/20 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-400 focus:outline-none"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <div className="text-sm bg-red-950/40 border border-red-500/40 text-red-200 rounded-xl px-3 py-2">
              {error}
            </div>
          )}
          <button
            disabled={loading}
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 rounded-xl px-3 py-2.5 font-semibold shadow-lg shadow-violet-900/30"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
