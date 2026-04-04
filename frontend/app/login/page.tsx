"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { setAuth, type StoredUser } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";

type AuthResponse = { token: string; user: StoredUser };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl">
        <h1 className="text-2xl font-semibold">Log in</h1>
        <p className="text-sm text-gray-400 mt-1">
          No account?{" "}
          <Link className="text-blue-400 hover:underline" href="/register">
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
              setAuth(resp.token, resp.user);
              router.push("/rooms");
            } catch (e: unknown) {
              setError(getErrorMessage(e));
            } finally {
              setLoading(false);
            }
          }}
        >
          <input
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <div className="text-sm bg-red-950/40 border border-red-800 text-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <button
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg px-3 py-2 font-semibold"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
