"use client";

import Link from "next/link";
import { useClientToken } from "@/lib/auth";

export default function LandingHome() {
  const hasSession = !!useClientToken();

  return (
    <div className="rt-app-shell min-h-screen">
      <div className="rt-app-shell-glow" />

      <header className="relative border-b border-white/10 bg-slate-950/40 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight text-white">Roomtastic</span>
          <nav className="flex items-center gap-3 text-sm">
            {hasSession ? (
              <Link
                href="/rooms"
                className="rounded-lg bg-linear-to-r from-indigo-600 to-violet-600 px-4 py-2 font-medium shadow-lg shadow-violet-900/30 hover:from-indigo-500 hover:to-violet-500"
              >
                My rooms
              </Link>
            ) : (
              <>
                <Link href="/login" className="px-3 py-2 text-indigo-200/90 hover:text-white">
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-linear-to-r from-indigo-600 to-violet-600 px-4 py-2 font-medium shadow-lg shadow-violet-900/30 hover:from-indigo-500 hover:to-violet-500"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl px-6 py-16 md:py-24">
        <p className="mb-4 text-sm font-medium tracking-widest text-indigo-300/90 uppercase">
          Room layout
        </p>
        <h1 className="max-w-2xl text-4xl leading-tight font-bold tracking-tight text-white md:text-5xl">
          Furnish rooms in 3D, then save to your account
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-indigo-100/80">
          Log in, create a room, open the editor, then drag catalog items onto the floor, transform
          them, and hit Complete to sync with the backend.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href={hasSession ? "/rooms" : "/login"}
            className="inline-flex items-center justify-center rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 px-6 py-3.5 font-semibold shadow-xl shadow-violet-900/40 hover:from-indigo-500 hover:to-violet-500"
          >
            {hasSession ? "Go to my rooms" : "Log in to start"}
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-xl border border-violet-400/40 bg-slate-900/60 px-6 py-3.5 font-semibold text-indigo-100 hover:bg-slate-800/80"
          >
            Create an account
          </Link>
        </div>

        <div className="mt-20">
          <div className="rounded-2xl border border-violet-500/25 bg-slate-900/50 p-6 backdrop-blur-sm">
            <h2 className="text-xl font-semibold text-white">3D room editor</h2>
            <p className="mt-2 text-sm leading-relaxed text-indigo-200/75">
              Grid snap, catalog, and transforms. Each room has an{" "}
              <span className="text-violet-200">Edit</span> entry from the room list.
            </p>
            <Link
              href={hasSession ? "/rooms" : "/login"}
              className="mt-4 inline-block text-sm font-medium text-violet-300 hover:text-violet-200"
            >
              {hasSession ? "Open rooms →" : "Log in to open rooms →"}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
