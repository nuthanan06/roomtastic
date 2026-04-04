"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";

export default function LandingHome() {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    setHasSession(!!getToken());
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.25),transparent)] pointer-events-none" />
      <header className="relative border-b border-white/10 backdrop-blur-sm bg-slate-950/40">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight text-white">Roomtastic</span>
          <nav className="flex items-center gap-3 text-sm">
            {hasSession ? (
              <Link
                href="/rooms"
                className="rounded-lg px-4 py-2 font-medium bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-violet-900/30"
              >
                My rooms
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-indigo-200/90 hover:text-white px-3 py-2"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg px-4 py-2 font-medium bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-violet-900/30"
                >
                  Sign up
                </Link>
              </>
            )}
            <Link
              href="/mock-models-preview"
              className="hidden sm:inline-block text-slate-400 hover:text-indigo-200 px-2 py-2"
            >
              GLB preview
            </Link>
            <Link
              href="/lab"
              className="hidden sm:inline-block text-slate-400 hover:text-indigo-200 px-2 py-2"
            >
              2D→3D lab
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative max-w-5xl mx-auto px-6 py-16 md:py-24">
        <p className="text-indigo-300/90 text-sm font-medium uppercase tracking-widest mb-4">
          Room layout
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight max-w-2xl leading-tight">
          Furnish rooms in 3D, then save to your account
        </h1>
        <p className="mt-5 text-lg text-indigo-100/80 max-w-xl leading-relaxed">
          Log in, create a room, open the editor, then drag catalog items onto the floor, transform
          them, and hit Complete to sync with the backend.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          {hasSession ? (
            <Link
              href="/rooms"
              className="inline-flex items-center justify-center rounded-xl px-6 py-3.5 font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-xl shadow-violet-900/40"
            >
              Go to my rooms
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl px-6 py-3.5 font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-xl shadow-violet-900/40"
            >
              Log in to start
            </Link>
          )}
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-xl px-6 py-3.5 font-semibold border border-violet-400/40 bg-slate-900/60 hover:bg-slate-800/80 text-indigo-100"
          >
            Create an account
          </Link>
        </div>

        <div className="mt-20 grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-violet-500/25 bg-slate-900/50 p-6 backdrop-blur-sm">
            <h2 className="text-xl font-semibold text-white">3D room editor</h2>
            <p className="mt-2 text-sm text-indigo-200/75 leading-relaxed">
              Grid snap, catalog, and transforms. Each room has an <span className="text-violet-200">Edit</span>{" "}
              entry from the room list.
            </p>
            <Link
              href={hasSession ? "/rooms" : "/login"}
              className="mt-4 inline-block text-sm font-medium text-violet-300 hover:text-violet-200"
            >
              {hasSession ? "Open rooms →" : "Log in to open rooms →"}
            </Link>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-6 backdrop-blur-sm">
            <h2 className="text-xl font-semibold text-white">2D→3D lab</h2>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Experimental depth preview from a single image. Separate from saved room layouts.
            </p>
            <Link href="/lab" className="mt-4 inline-block text-sm font-medium text-indigo-300 hover:text-indigo-200">
              Open the lab →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
