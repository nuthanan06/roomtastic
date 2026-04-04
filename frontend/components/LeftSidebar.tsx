"use client";

import Link from "next/link";
import { useState } from "react";

export default function LeftSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      className={`fixed left-0 top-0 h-full bg-slate-950/95 border-r border-violet-500/20 shadow-2xl shadow-violet-950/40 z-10 transition-all duration-300 backdrop-blur-md ${
        isCollapsed ? "w-12" : "w-96"
      }`}
    >
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute right-0 top-4 translate-x-full bg-slate-900 hover:bg-slate-800 text-indigo-200 p-2 rounded-r-lg border border-violet-500/25 border-l-0 transition"
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>

      {!isCollapsed && (
        <div className="h-full overflow-y-auto">
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Roomtastic</h2>
              <p className="text-indigo-200/70 text-sm mt-1">2D→3D lab (preview)</p>
            </div>

            <nav className="flex flex-col gap-1">
              <Link
                href="/"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-indigo-100 bg-violet-600/15 border border-violet-500/25 hover:bg-violet-600/25 transition"
              >
                ← Home & room editor
              </Link>
              <Link
                href="/rooms"
                className="rounded-lg px-3 py-2.5 text-sm text-indigo-200/90 hover:bg-white/5 transition"
              >
                My rooms
              </Link>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2.5 text-sm text-indigo-200/90 hover:bg-white/5 transition"
              >
                Log in
              </Link>
            </nav>

            <div className="rounded-xl border border-violet-500/20 bg-slate-900/60 p-4">
              <p className="text-xs font-medium text-violet-200/90 uppercase tracking-wide">Tip</p>
              <p className="text-sm text-indigo-100/75 mt-2 leading-relaxed">
                To place furniture on a floor with a catalog, open <span className="text-violet-200">My rooms</span>, create
                a room, then choose <span className="text-violet-200">Edit</span>.
              </p>
            </div>
          </div>
        </div>
      )}

      {isCollapsed && (
        <div className="h-full flex items-center justify-center">
          <div className="transform -rotate-90 text-indigo-200 text-xs font-medium whitespace-nowrap">Menu</div>
        </div>
      )}
    </div>
  );
}
