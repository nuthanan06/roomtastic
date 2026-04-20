"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLoginMutation } from "@/hooks/useAuthMutations";
import { setAuth } from "@/lib/auth";
import type { AuthSessionResponse } from "@/types/api";
import { getErrorMessage } from "@/utils/errors";

export default function LoginPage() {
  const router = useRouter();
  const loginMutation = useLoginMutation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 p-6 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-violet-500/25 bg-slate-900/70 p-8 shadow-2xl shadow-violet-950/50 backdrop-blur-md">
        <Link href="/" className="text-sm text-indigo-300 hover:text-indigo-200">
          ← Back home
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-white">Log in</h1>
        <p className="mt-1 text-sm text-indigo-200/70">
          No account?{" "}
          <Link
            className="text-violet-300 underline-offset-2 hover:text-violet-200 hover:underline"
            href="/register"
          >
            Register
          </Link>
        </p>

        <form
          className="mt-6 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            try {
              const resp: AuthSessionResponse = await loginMutation.mutateAsync({
                email,
                password,
              });
              setAuth(resp.access_token, resp.user);
              router.push("/rooms");
            } catch (e: unknown) {
              setError(getErrorMessage(e));
            }
          }}
        >
          <input
            className="w-full rounded-xl border border-violet-500/20 bg-slate-950/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-400 focus:outline-none"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded-xl border border-violet-500/20 bg-slate-950/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-400 focus:outline-none"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
          <button
            disabled={loginMutation.isPending}
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 font-semibold shadow-lg shadow-violet-900/30 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
          >
            {loginMutation.isPending ? "Logging in..." : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
