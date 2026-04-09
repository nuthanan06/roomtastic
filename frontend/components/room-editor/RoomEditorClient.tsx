"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { MOCK_CATALOG } from "@/lib/mockCatalog";
import { CM_TO_M } from "@/lib/gridSnap";
import { canonicalModelUrlForLoader, isRecognizedModelUrl } from "@/lib/modelUrl";
import { publicAssetUrl } from "@/lib/publicAssetUrl";
import type { FurnitureOut, InventoryOut, RoomOut } from "@/lib/roomApiTypes";
import { runAssistantMessage } from "./assistantCommands";
import type { FloorDropBridge } from "./floorDropBridge";
import { EditorScene, type RoomEditorSceneActions } from "./EditorScene";
import { furnitureToPlacement, newPlacementFromCatalog, type Placement } from "./placement";
import type { FloorTextureId, WallTextureId } from "./proceduralTextures";
import {
  DEFAULT_DOOR,
  DEFAULT_WINDOW,
  type RoomOpening,
  type WallKey,
} from "./roomOpenings";
import { useGLTF } from "@react-three/drei";

function newOpeningId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `o_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function cssColorToHex(input: string): string {
  const s = input.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(s)) return s.length === 4 ? `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}` : s;
  const map: Record<string, string> = {
    white: "#f5f5f5",
    black: "#1a1a1a",
    gray: "#9ca3af",
    grey: "#9ca3af",
    red: "#b91c1c",
    blue: "#1d4ed8",
    green: "#15803d",
    yellow: "#ca8a04",
  };
  return map[s.toLowerCase()] ?? "#e8e4dc";
}

type SidebarTab = "catalog" | "room" | "assistant";

function mockCatalogMatchForUrl(glbUrl: string): (typeof MOCK_CATALOG)[number] | undefined {
  const canon = canonicalModelUrlForLoader(glbUrl);
  return MOCK_CATALOG.find((m) => canonicalModelUrlForLoader(publicAssetUrl(m.glbUrl)) === canon);
}

function SelectionDetailsPanel({
  placement,
  inventoryRow,
  parentLabel,
  secondarySelectionId,
  secondarySelectionLabel,
}: {
  placement: Placement | null;
  inventoryRow: InventoryOut | undefined;
  parentLabel: string | null;
  secondarySelectionId: string | null;
  secondarySelectionLabel: string | null;
}) {
  if (!placement) {
    return (
      <div className="p-4 text-sm text-slate-500 leading-relaxed">
        Click a piece in the room to see its name, model source, transform, and grouping here.
      </div>
    );
  }

  const mockMatch = mockCatalogMatchForUrl(placement.glbUrl);
  const rotDeg = Math.round((placement.rotationY * 180) / Math.PI);
  const [px, py, pz] = placement.position;

  return (
    <div className="p-4 space-y-5 text-sm">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-white leading-tight">{placement.label}</h2>
        {secondarySelectionLabel && secondarySelectionId && secondarySelectionId !== placement.clientId ? (
          <p className="mt-1 text-[11px] text-teal-300/90">
            Also selected for grouping: <span className="text-teal-100">{secondarySelectionLabel}</span>
          </p>
        ) : null}
      </div>

      <section className="space-y-2">
        <h3 className="rt-editor-heading text-violet-400/90">Source</h3>
        {inventoryRow ? (
          <dl className="space-y-1.5 text-xs">
            {inventoryRow.thumbnail_url ? (
              <div className="mb-2 rounded-lg overflow-hidden border border-white/10 bg-slate-900/50">
                <img
                  src={inventoryRow.thumbnail_url}
                  alt=""
                  className="w-full h-28 object-cover"
                />
              </div>
            ) : null}
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 shrink-0">Inventory</dt>
              <dd className="text-slate-200 text-right">{inventoryRow.name}</dd>
            </div>
            {inventoryRow.category ? (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500 shrink-0">Category</dt>
                <dd className="text-slate-200 text-right">{inventoryRow.category}</dd>
              </div>
            ) : null}
            {inventoryRow.model_url ? (
              <div>
                <dt className="text-slate-500">Model URL</dt>
                <dd className="mt-0.5 font-mono text-[10px] font-medium text-slate-400 break-all leading-relaxed">
                  {inventoryRow.model_url}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : mockMatch ? (
          <p className="text-xs text-slate-300">
            Mock catalog: <span className="text-violet-200">{mockMatch.label}</span>
            <span className="text-slate-500 ml-1">({mockMatch.id})</span>
          </p>
        ) : (
          <p className="text-xs text-slate-300">Custom model (not from current inventory row)</p>
        )}
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">GLB in scene</p>
          <p className="font-mono text-[10px] font-medium text-slate-400 break-all leading-relaxed">{placement.glbUrl}</p>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="rt-editor-heading text-violet-400/90">Transform</h3>
        <dl className="space-y-1.5 text-xs text-slate-300">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500 font-medium">Position (m)</dt>
            <dd className="font-mono tabular-nums text-slate-200/95">
              {px.toFixed(2)}, {py.toFixed(2)}, {pz.toFixed(2)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500 font-medium">Rotation Y</dt>
            <dd className="font-mono tabular-nums text-slate-200/95">{rotDeg}°</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500 font-medium">Scale</dt>
            <dd className="font-mono tabular-nums text-slate-200/95">{placement.scale.toFixed(2)}</dd>
          </div>
          {placement.localPosition ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 font-medium">Local pos (m)</dt>
              <dd className="font-mono tabular-nums text-slate-200/95">
                {placement.localPosition[0].toFixed(2)}, {placement.localPosition[1].toFixed(2)},{" "}
                {placement.localPosition[2].toFixed(2)}
              </dd>
            </div>
          ) : null}
          {placement.localRotationY != null ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 font-medium">Local rot Y</dt>
              <dd className="font-mono tabular-nums text-slate-200/95">
                {Math.round((placement.localRotationY * 180) / Math.PI)}°
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="space-y-2">
        <h3 className="rt-editor-heading text-violet-400/90">Grouping & IDs</h3>
        <dl className="space-y-1.5 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">On base</dt>
            <dd className="text-slate-200 text-right">
              {parentLabel ? (
                <span title={placement.parentClientId ?? ""}>{parentLabel}</span>
              ) : (
                <span className="text-slate-500">Floor (root)</span>
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Client id</dt>
            <dd className="font-mono text-[10px] font-medium text-slate-400 text-right break-all">
              {placement.clientId}
            </dd>
          </div>
          {placement.furnitureId ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Saved as</dt>
              <dd className="font-mono text-[10px] text-slate-400 text-right break-all">{placement.furnitureId}</dd>
            </div>
          ) : (
            <p className="text-[11px] text-amber-200/80">Not saved yet — will be created on Complete.</p>
          )}
          {placement.inventoryId ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Inventory id</dt>
              <dd className="font-mono text-[10px] text-slate-400 text-right break-all">{placement.inventoryId}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    </div>
  );
}

export default function RoomEditorClient({
  roomId,
  token,
  room,
  initialFurniture,
  inventory,
}: {
  roomId: string;
  token: string;
  room: RoomOut;
  initialFurniture: FurnitureOut[];
  inventory: InventoryOut[];
}) {
  const invById = useMemo(() => {
    const m = new Map<string, InventoryOut>();
    inventory.forEach((i) => m.set(i.inventory_id, i));
    return m;
  }, [inventory]);

  const [placements, setPlacements] = useState<Placement[]>(() =>
    initialFurniture.map((f) => furnitureToPlacement(f, invById)),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [secondarySelectedId, setSecondarySelectedId] = useState<string | null>(null);
  const [interferenceNotice, setInterferenceNotice] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("catalog");
  const [floorColorHex, setFloorColorHex] = useState("#2e1f4a");
  const [wallColorHex, setWallColorHex] = useState(() => cssColorToHex(room.wall_colour ?? "white"));
  const [floorTexturePreset, setFloorTexturePreset] = useState<FloorTextureId>("matte");
  const [wallTexturePreset, setWallTexturePreset] = useState<WallTextureId>("paint");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "bot"; text: string }>>(() => [
    {
      role: "bot",
      text: "Hi — Layout and wall colour auto-save to the server. I can also snap, center, straighten, or stack two items (e.g. “Place Sofa and Chair together vertically”). Type “help” for more.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [mode, setMode] = useState<"translate" | "rotate" | "scale">("translate");
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [catalogDragging, setCatalogDragging] = useState(false);
  const [dragModelUrl, setDragModelUrl] = useState<string | null>(null);
  const [dropHover, setDropHover] = useState<{ x: number; z: number } | null>(null);
  const floorDropBridgeRef = useRef<FloorDropBridge | null>(null);
  const sceneActionsRef = useRef<RoomEditorSceneActions | null>(null);
  const hudWorldRef = useRef<HTMLSpanElement | null>(null);
  const hudPxRef = useRef<HTMLSpanElement | null>(null);
  const [openings, setOpenings] = useState<RoomOpening[]>([]);

  const placementsRef = useRef<Placement[]>(placements);
  placementsRef.current = placements;

  const lastPersistedFurnitureIdsRef = useRef<Set<string>>(new Set());
  useLayoutEffect(() => {
    lastPersistedFurnitureIdsRef.current = new Set(initialFurniture.map((f) => f.furniture_id));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot server IDs once on editor open
  }, []);

  const persistGenRef = useRef(0);
  const isFirstAutosaveScheduleRef = useRef(true);
  const saveBusyRef = useRef(false);
  const saveQueuedRef = useRef(false);

  const widthM = (room.width ?? 400) * CM_TO_M;
  const lengthM = (room.length ?? 500) * CM_TO_M;
  const heightM = (room.height ?? 250) * CM_TO_M;

  const selectedPlacement = useMemo(
    () => (selectedId ? placements.find((p) => p.clientId === selectedId) ?? null : null),
    [placements, selectedId],
  );

  const parentLabelForSelected = useMemo(() => {
    if (!selectedPlacement?.parentClientId) return null;
    return placements.find((p) => p.clientId === selectedPlacement.parentClientId)?.label ?? null;
  }, [placements, selectedPlacement]);

  const secondarySelectionLabel = useMemo(() => {
    if (!secondarySelectedId) return null;
    return placements.find((p) => p.clientId === secondarySelectedId)?.label ?? null;
  }, [placements, secondarySelectedId]);

  const selectedInventoryRow = useMemo(() => {
    if (!selectedPlacement?.inventoryId) return undefined;
    return invById.get(selectedPlacement.inventoryId);
  }, [invById, selectedPlacement]);

  useEffect(() => {
    MOCK_CATALOG.forEach((m) => {
      useGLTF.preload(publicAssetUrl(m.glbUrl));
    });
  }, []);

  useEffect(() => {
    const end = () => {
      setCatalogDragging(false);
      setDropHover(null);
      setDragModelUrl(null);
    };
    window.addEventListener("dragend", end);
    return () => window.removeEventListener("dragend", end);
  }, []);

  const onEditorInterference = useCallback((msg: string | null) => {
    setInterferenceNotice(msg);
  }, []);

  const sendAssistant = useCallback(() => {
    const t = chatInput.trim();
    if (!t) return;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text: t }]);
    const reply = runAssistantMessage(t, { placements, setPlacements, selectedId });
    setChatMessages((prev) => [...prev, { role: "bot", text: reply }]);
  }, [chatInput, placements, selectedId]);

  const onDropItem = useCallback(
    (url: string, label: string, inventoryId: string | null, x: number, z: number) => {
      const glbUrl = canonicalModelUrlForLoader(url);
      const p = newPlacementFromCatalog({ glbUrl, label, inventoryId, x, z });
      setPlacements((prev) => [...prev, p]);
      setSelectedId(p.clientId);
    },
    [],
  );

  const addMockClick = (glbUrlAbs: string, label: string) => {
    const p = newPlacementFromCatalog({ glbUrl: glbUrlAbs, label, inventoryId: null, x: 0, z: 0 });
    setPlacements((prev) => [...prev, p]);
    setSelectedId(p.clientId);
  };

  const persistLayoutToServer = useCallback(async () => {
    if (saveBusyRef.current) {
      saveQueuedRef.current = true;
      return;
    }
    saveBusyRef.current = true;
    saveQueuedRef.current = false;

    const gen = ++persistGenRef.current;
    setSaveStatus("saving");
    setError(null);
    try {
      const current = placementsRef.current;
      const world = sceneActionsRef.current?.getExportTransforms() ?? null;
      const nextIds = new Map<string, string>();

      for (const p of current) {
        const w = world?.find((t) => t.clientId === p.clientId);
        const pos = w?.position ?? p.position;
        const rotY = w?.rotationY ?? p.rotationY;
        const sc = w?.scale ?? p.scale;
        const coords = JSON.stringify({
          x: pos[0],
          y: pos[1],
          z: pos[2],
          scale: sc,
        });
        const rotDeg = Math.round((rotY * 180) / Math.PI) % 360;
        if (p.furnitureId) {
          await apiFetch<FurnitureOut>(`/furniture/${p.furnitureId}`, {
            method: "PATCH",
            token,
            body: JSON.stringify({
              coordinates: coords,
              rotation: rotDeg,
              name_of_furniture: p.label,
            }),
          });
        } else {
          const created = await apiFetch<FurnitureOut>(`/rooms/${roomId}/furniture`, {
            method: "POST",
            token,
            body: JSON.stringify({
              name_of_furniture: p.label,
              inventory_id: p.inventoryId || null,
              coordinates: coords,
              rotation: rotDeg,
            }),
          });
          nextIds.set(p.clientId, created.furniture_id);
        }
      }

      if (nextIds.size > 0) {
        setPlacements((prev) =>
          prev.map((pl) => {
            const fid = nextIds.get(pl.clientId);
            if (!fid) return pl;
            return { ...pl, furnitureId: fid };
          }),
        );
      }

      const finalIds = new Set<string>();
      for (const p of current) {
        const fid = p.furnitureId ?? nextIds.get(p.clientId);
        if (fid) finalIds.add(fid);
      }

      for (const oldId of lastPersistedFurnitureIdsRef.current) {
        if (!finalIds.has(oldId)) {
          await apiFetch<{ ok: boolean }>(`/furniture/${oldId}`, { method: "DELETE", token });
        }
      }
      lastPersistedFurnitureIdsRef.current = finalIds;

      await apiFetch<RoomOut>(`/rooms/${roomId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ wall_colour: wallColorHex }),
      });

      if (gen === persistGenRef.current) {
        setSaveStatus("saved");
        window.setTimeout(() => {
          setSaveStatus((s) => (s === "saved" ? "idle" : s));
        }, 2200);
      }
    } catch (e: unknown) {
      if (gen === persistGenRef.current) {
        setSaveStatus("idle");
        setError(e instanceof Error ? e.message : "Save failed");
      }
    } finally {
      saveBusyRef.current = false;
      if (saveQueuedRef.current) {
        saveQueuedRef.current = false;
        void persistLayoutToServer();
      }
    }
  }, [token, roomId, wallColorHex, setPlacements]);

  useEffect(() => {
    if (isFirstAutosaveScheduleRef.current) {
      isFirstAutosaveScheduleRef.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      void persistLayoutToServer();
    }, 1100);
    return () => window.clearTimeout(t);
  }, [placements, wallColorHex, persistLayoutToServer]);

  const addInventoryClick = (item: InventoryOut) => {
    const raw =
      item.model_url && (item.model_url.endsWith(".glb") || item.model_url.endsWith(".gltf"))
        ? item.model_url
        : "/mock-models/table.glb";
    const p = newPlacementFromCatalog({
      glbUrl: publicAssetUrl(raw),
      label: item.name,
      inventoryId: item.inventory_id,
      x: 0,
      z: 0,
    });
    setPlacements((prev) => [...prev, p]);
    setSelectedId(p.clientId);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-100 selection:bg-violet-500/25 selection:text-white bg-[radial-gradient(ellipse_100%_70%_at_50%_-15%,rgba(124,58,237,0.2),transparent_55%),radial-gradient(ellipse_70%_50%_at_100%_0%,rgba(99,102,241,0.14),transparent_50%),linear-gradient(165deg,#07050f_0%,#12102a_42%,#0b1224_100%)]">
      <aside className="w-80 shrink-0 flex flex-col border-r border-white/[0.06] bg-slate-950/50 backdrop-blur-xl shadow-[4px_0_32px_-12px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-white/[0.04]">
        <div className="p-4 border-b border-white/[0.06]">
          <Link
            href={`/rooms/${roomId}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-300/90 hover:text-white transition-colors tracking-wide"
          >
            <span aria-hidden className="opacity-70">
              ←
            </span>
            Back to room
          </Link>
          <div className="mt-4 flex rounded-xl bg-slate-900/70 p-1 ring-1 ring-white/[0.06]">
            {(
              [
                ["catalog", "Catalog"],
                ["room", "Room look"],
                ["assistant", "Assistant"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSidebarTab(id)}
                className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-all ${
                  sidebarTab === id
                    ? "bg-gradient-to-b from-violet-600 to-violet-700 text-white shadow-lg shadow-violet-950/50 ring-1 ring-white/10"
                    : "text-slate-500 hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {interferenceNotice ? (
          <div className="mx-3 mt-2 rounded-xl border border-amber-500/35 bg-amber-950/40 px-3 py-2.5 text-xs font-medium text-amber-100/95 leading-snug flex gap-2 items-start backdrop-blur-sm">
            <span className="flex-1 leading-snug">{interferenceNotice}</span>
            <button
              type="button"
              onClick={() => setInterferenceNotice(null)}
              className="shrink-0 text-amber-300/90 hover:text-white text-[11px] underline"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {sidebarTab === "catalog" ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            <p className="text-xs text-indigo-300/80">Drag into the room or click to add at center.</p>
            <div>
            <h3 className="rt-editor-heading text-violet-400/90 mb-2">Mock GLBs</h3>
            <div className="space-y-2">
              {MOCK_CATALOG.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    const url = publicAssetUrl(m.glbUrl);
                    e.dataTransfer.setData("modelUrl", url);
                    e.dataTransfer.setData("text/plain", url);
                    e.dataTransfer.setData("label", m.label);
                    e.dataTransfer.effectAllowed = "copy";
                    setCatalogDragging(true);
                    setDragModelUrl(url);
                  }}
                  onClick={() => addMockClick(publicAssetUrl(m.glbUrl), m.label)}
                  className={`w-full text-left rounded-xl px-3 py-3 border border-white/10 ${m.accent} hover:border-violet-400/50 hover:bg-white/5 transition flex items-center gap-3`}
                >
                  <span className="h-10 w-10 rounded-lg bg-slate-900/80 border border-violet-500/30" />
                  <span className="font-medium text-sm text-white">{m.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="rt-editor-heading text-sky-400/90 mb-2">Inventory</h3>
            {inventory.length === 0 ? (
              <p className="text-xs text-slate-500">No inventory rows yet.</p>
            ) : (
              <div className="space-y-2">
                {inventory.slice(0, 40).map((item) => (
                  <button
                    key={item.inventory_id}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      const raw =
                        item.model_url &&
                        (item.model_url.endsWith(".glb") || item.model_url.endsWith(".gltf"))
                          ? item.model_url
                          : "/mock-models/table.glb";
                      const url = publicAssetUrl(raw);
                      e.dataTransfer.setData("modelUrl", url);
                      e.dataTransfer.setData("text/plain", url);
                      e.dataTransfer.setData("label", item.name);
                      e.dataTransfer.setData("inventoryId", item.inventory_id);
                      e.dataTransfer.effectAllowed = "copy";
                      setCatalogDragging(true);
                      setDragModelUrl(url);
                    }}
                    onClick={() => addInventoryClick(item)}
                    className="w-full text-left rounded-xl px-3 py-2 border border-white/10 bg-sky-950/20 hover:border-sky-400/40 transition"
                  >
                    <div className="text-sm font-medium text-white">{item.name}</div>
                    <div className="text-xs text-slate-400">{item.category ?? "—"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          </div>
        ) : null}

        {sidebarTab === "room" ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-5 text-sm">
            <div>
              <h3 className="rt-editor-heading text-indigo-400/90 mb-2">Floor</h3>
              <label className="flex items-center gap-2 text-xs text-slate-300 mb-2">
                <span className="w-16 shrink-0">Colour</span>
                <input
                  type="color"
                  value={floorColorHex}
                  onChange={(e) => setFloorColorHex(e.target.value)}
                  className="h-8 w-14 cursor-pointer rounded border border-white/20 bg-transparent"
                />
              </label>
              <label className="block text-xs text-slate-400 mb-1">Texture style</label>
              <select
                value={floorTexturePreset}
                onChange={(e) => setFloorTexturePreset(e.target.value as FloorTextureId)}
                className="w-full rounded-lg border border-white/15 bg-slate-900/80 px-2 py-2 text-xs text-white"
              >
                <option value="matte">Matte (flat)</option>
                <option value="wood">Wood grain</option>
                <option value="tile">Tile pattern</option>
                <option value="concrete">Concrete / stone</option>
              </select>
            </div>
            <div>
              <h3 className="rt-editor-heading text-indigo-400/90 mb-2">Walls</h3>
              <label className="flex items-center gap-2 text-xs text-slate-300 mb-2">
                <span className="w-16 shrink-0">Colour</span>
                <input
                  type="color"
                  value={wallColorHex}
                  onChange={(e) => setWallColorHex(e.target.value)}
                  className="h-8 w-14 cursor-pointer rounded border border-white/20 bg-transparent"
                />
              </label>
              <label className="block text-xs text-slate-400 mb-1">Texture style</label>
              <select
                value={wallTexturePreset}
                onChange={(e) => setWallTexturePreset(e.target.value as WallTextureId)}
                className="w-full rounded-lg border border-white/15 bg-slate-900/80 px-2 py-2 text-xs text-white"
              >
                <option value="paint">Paint (smooth)</option>
                <option value="plaster">Plaster</option>
                <option value="brick">Brick</option>
                <option value="wood_panel">Wood panels</option>
                <option value="fabric">Fabric / linen</option>
              </select>
              <p className="mt-2 text-[10px] text-slate-500 leading-relaxed">
                Wall colour syncs with the room in the database (auto-save). Floor texture is preview-only for now.
              </p>
            </div>
            <div>
              <h3 className="rt-editor-heading text-indigo-400/90 mb-2">Windows & doors</h3>
              <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
                Preview-only cutouts on walls. Drag along each row to slide the opening.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  onClick={() =>
                    setOpenings((prev) => [
                      ...prev,
                      {
                        id: newOpeningId(),
                        kind: "window",
                        wall: "pz",
                        t: 0.5,
                        ...DEFAULT_WINDOW,
                      },
                    ])
                  }
                  className="rounded-lg border border-cyan-500/35 bg-cyan-950/35 px-2.5 py-1.5 text-xs text-cyan-100 hover:bg-cyan-900/40"
                >
                  Add window
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setOpenings((prev) => [
                      ...prev,
                      {
                        id: newOpeningId(),
                        kind: "door",
                        wall: "pz",
                        t: 0.5,
                        ...DEFAULT_DOOR,
                      },
                    ])
                  }
                  className="rounded-lg border border-amber-500/35 bg-amber-950/35 px-2.5 py-1.5 text-xs text-amber-100 hover:bg-amber-900/40"
                >
                  Add door
                </button>
              </div>
              {openings.length === 0 ? (
                <p className="text-xs text-slate-500">No openings yet.</p>
              ) : (
                <ul className="space-y-3">
                  {openings.map((op) => (
                    <li
                      key={op.id}
                      className="rounded-lg border border-white/10 bg-slate-900/50 p-2.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-white capitalize">{op.kind}</span>
                        <button
                          type="button"
                          onClick={() => setOpenings((prev) => prev.filter((x) => x.id !== op.id))}
                          className="text-[11px] text-red-300/90 hover:text-red-200 underline"
                        >
                          Remove
                        </button>
                      </div>
                      <label className="block text-[10px] text-slate-400">
                        Wall
                        <select
                          value={op.wall}
                          onChange={(e) =>
                            setOpenings((prev) =>
                              prev.map((x) =>
                                x.id === op.id ? { ...x, wall: e.target.value as WallKey } : x,
                              ),
                            )
                          }
                          className="mt-1 w-full rounded-md border border-white/15 bg-slate-950/80 px-2 py-1.5 text-xs text-white"
                        >
                          <option value="pz">+Z (front)</option>
                          <option value="nz">−Z (back)</option>
                          <option value="px">+X (right)</option>
                          <option value="nx">−X (left)</option>
                        </select>
                      </label>
                      <label className="block text-[10px] text-slate-400">
                        Along wall ({Math.round(op.t * 100)}%)
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.02}
                          value={op.t}
                          onChange={(e) =>
                            setOpenings((prev) =>
                              prev.map((x) =>
                                x.id === op.id ? { ...x, t: Number(e.target.value) } : x,
                              ),
                            )
                          }
                          className="mt-1 w-full accent-violet-400"
                        />
                      </label>
                      {op.kind === "window" ? (
                        <label className="block text-[10px] text-slate-400">
                          Sill height (m)
                          <input
                            type="number"
                            min={0}
                            max={heightM - 0.2}
                            step={0.05}
                            value={op.sillM}
                            onChange={(e) =>
                              setOpenings((prev) =>
                                prev.map((x) =>
                                  x.id === op.id ? { ...x, sillM: Number(e.target.value) } : x,
                                ),
                              )
                            }
                            className="mt-1 w-full rounded-md border border-white/15 bg-slate-950/80 px-2 py-1.5 text-xs text-white"
                          />
                        </label>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        {sidebarTab === "assistant" ? (
          <div className="flex-1 flex flex-col min-h-0 p-3">
            <div className="flex-1 overflow-y-auto space-y-2 rounded-lg border border-violet-500/20 bg-slate-950/50 p-2 mb-2">
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  className={`text-xs leading-relaxed rounded-md px-2 py-1.5 ${
                    m.role === "user"
                      ? "bg-violet-600/25 text-violet-100 ml-4"
                      : "bg-slate-800/80 text-slate-200 mr-4 whitespace-pre-wrap"
                  }`}
                >
                  {m.text}
                </div>
              ))}
            </div>
            <div className="flex gap-2 shrink-0">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendAssistant();
                  }
                }}
                placeholder="e.g. snap all to grid"
                className="flex-1 rounded-lg border border-white/15 bg-slate-900/80 px-2 py-2 text-xs text-white placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => sendAssistant()}
                className="rounded-lg bg-violet-600 hover:bg-violet-500 px-3 py-2 text-xs font-medium text-white"
              >
                Send
              </button>
            </div>
          </div>
        ) : null}
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="shrink-0 flex flex-wrap items-center gap-2 px-5 py-3.5 border-b border-white/[0.06] bg-slate-950/25 backdrop-blur-md ring-1 ring-inset ring-white/[0.03]">
          <span className="text-sm font-medium text-indigo-200/95 mr-1 tracking-tight">
            Room <span className="font-mono text-[13px] text-violet-200/95 tabular-nums">{roomId.slice(0, 8)}</span>
            <span className="text-slate-500 mx-2">|</span>
            {room.width}×{room.length}×{room.height} cm
          </span>
          <div className="flex rounded-xl p-0.5 bg-slate-900/60 ring-1 ring-white/[0.07] overflow-hidden">
            {(["translate", "rotate", "scale"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3.5 py-2 text-xs font-semibold capitalize tracking-wide transition-colors ${
                  mode === m
                    ? "rounded-[10px] bg-violet-600 text-white shadow-md shadow-violet-950/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={
                !selectedId ||
                !secondarySelectedId ||
                selectedId === secondarySelectedId
              }
              title="Main selection = base furniture, Shift+click = decor to attach"
              onClick={() => {
                if (!selectedId || !secondarySelectedId || selectedId === secondarySelectedId) return;
                const ok = sceneActionsRef.current?.attachAsChild(selectedId, secondarySelectedId);
                if (ok) {
                  setSecondarySelectedId(null);
                  setInterferenceNotice(null);
                } else {
                  setInterferenceNotice("Can’t group those pieces (cycle or missing objects).");
                }
              }}
              className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-2.5 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-900/50 disabled:opacity-40 disabled:pointer-events-none"
            >
              Group
            </button>
            <button
              type="button"
              disabled={!placements.some((p) => p.clientId === selectedId && p.parentClientId)}
              onClick={() => {
                if (!selectedId) return;
                const ok = sceneActionsRef.current?.detachToWorld(selectedId);
                if (!ok) {
                  setInterferenceNotice("Select a grouped item to remove it from the base.");
                } else {
                  setInterferenceNotice(null);
                }
              }}
              className="rounded-lg border border-slate-500/40 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none"
            >
              Ungroup
            </button>
            <span className="text-[10px] text-slate-500 max-w-[140px] leading-tight hidden lg:inline">
              Shift+click second piece · green = main · teal = add to group
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span
              className={`text-[11px] font-medium tabular-nums ${
                saveStatus === "saving"
                  ? "text-amber-200/90"
                  : saveStatus === "saved"
                    ? "text-emerald-300/90"
                    : "text-slate-500"
              }`}
              aria-live="polite"
            >
              {saveStatus === "saving"
                ? "Saving…"
                : saveStatus === "saved"
                  ? "Saved"
                  : "Auto-save on"}
            </span>
            <Link
              href={`/rooms/${roomId}`}
              className={`rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 px-5 py-2.5 text-sm font-semibold tracking-tight shadow-lg shadow-violet-950/35 ring-1 ring-white/10 ${
                saveStatus === "saving" ? "pointer-events-none opacity-60" : ""
              }`}
            >
              Back to room
            </Link>
          </div>
        </header>
        {error && (
          <div className="mx-4 mt-2 rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}
        <div className="relative flex-1 min-h-0">
          <EditorScene
            roomW={widthM}
            roomL={lengthM}
            roomH={heightM}
            floorColorHex={floorColorHex}
            wallColorHex={wallColorHex}
            floorTexturePreset={floorTexturePreset}
            wallTexturePreset={wallTexturePreset}
            floorDropBridgeRef={floorDropBridgeRef}
            sceneActionsRef={sceneActionsRef}
            dragModelUrl={catalogDragging ? dragModelUrl : null}
            dropHover={dropHover}
            placements={placements}
            setPlacements={setPlacements}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            secondarySelectedId={secondarySelectedId}
            setSecondarySelectedId={setSecondarySelectedId}
            transformMode={mode}
            onInterference={onEditorInterference}
            openings={openings}
            hudWorldRef={hudWorldRef}
            hudPxRef={hudPxRef}
          />
          <div className="pointer-events-none absolute bottom-3 left-3 z-[100] rounded-xl border border-white/[0.08] bg-slate-950/80 px-3 py-2 text-[10px] font-medium text-slate-300 shadow-xl shadow-black/40 backdrop-blur-md max-w-[min(42vw,240px)] ring-1 ring-white/[0.05]">
            <span className="text-slate-500 font-sans">World </span>
            <span ref={hudWorldRef} className="font-mono tabular-nums text-violet-200/95">
              —
            </span>
          </div>
          <div className="pointer-events-none absolute bottom-3 right-3 z-[100] rounded-xl border border-white/[0.08] bg-slate-950/80 px-3 py-2 text-[10px] font-medium text-slate-300 shadow-xl shadow-black/40 backdrop-blur-md ring-1 ring-white/[0.05]">
            <span className="text-slate-500 font-sans">Screen </span>
            <span ref={hudPxRef} className="font-mono tabular-nums text-cyan-200/95">
              —
            </span>
          </div>
          {catalogDragging ? (
            <div
              className="absolute inset-0 z-[200] bg-transparent cursor-copy"
              onDragEnter={(e) => e.preventDefault()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "copy";
                const hit = floorDropBridgeRef.current?.snapFromClient(e.clientX, e.clientY);
                setDropHover(hit ?? null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDropHover(null);
                setCatalogDragging(false);
                setDragModelUrl(null);
                const url =
                  e.dataTransfer.getData("modelUrl") ||
                  e.dataTransfer.getData("text/uri-list") ||
                  e.dataTransfer.getData("text/plain");
                const label = e.dataTransfer.getData("label") || "Item";
                const invRaw = e.dataTransfer.getData("inventoryId");
                const inventoryId = invRaw && invRaw.length > 0 ? invRaw : null;
                const hit = floorDropBridgeRef.current?.snapFromClient(e.clientX, e.clientY);
                if (!url?.trim() || !hit) return;
                const placed = floorDropBridgeRef.current?.resolveDropPosition(hit.x, hit.z);
                if (!placed) {
                  setInterferenceNotice("No clear floor space there — try elsewhere or group onto furniture.");
                  return;
                }
                const u = url.trim();
                if (!isRecognizedModelUrl(u)) return;
                onDropItem(u, label, inventoryId, placed.x, placed.z);
              }}
            />
          ) : null}
        </div>
      </div>

      <aside className="w-80 shrink-0 flex flex-col border-l border-white/[0.06] bg-slate-950/50 backdrop-blur-xl shadow-[-4px_0_32px_-12px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-white/[0.04]">
        <div className="p-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold tracking-tight text-white">Selection</h2>
          <p className="mt-1 text-[11px] font-medium text-slate-500 leading-relaxed">
            Details for the highlighted piece
          </p>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <SelectionDetailsPanel
            placement={selectedPlacement}
            inventoryRow={selectedInventoryRow}
            parentLabel={parentLabelForSelected}
            secondarySelectionId={secondarySelectedId}
            secondarySelectionLabel={secondarySelectionLabel}
          />
        </div>
      </aside>
    </div>
  );
}
