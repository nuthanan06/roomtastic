"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { MOCK_CATALOG } from "@/lib/mockCatalog";
import { CM_TO_M } from "@/lib/gridSnap";
import { canonicalModelUrlForLoader, isRecognizedModelUrl } from "@/lib/modelUrl";
import { publicAssetUrl } from "@/lib/publicAssetUrl";
import type { FurnitureOut, InventoryOut, RoomOut } from "@/lib/roomApiTypes";
import type { FloorDropBridge } from "./floorDropBridge";
import { EditorScene } from "./EditorScene";
import { furnitureToPlacement, newPlacementFromCatalog, type Placement } from "./placement";
import { useGLTF } from "@react-three/drei";

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
  const router = useRouter();
  const invById = useMemo(() => {
    const m = new Map<string, InventoryOut>();
    inventory.forEach((i) => m.set(i.inventory_id, i));
    return m;
  }, [inventory]);

  const [placements, setPlacements] = useState<Placement[]>(() =>
    initialFurniture.map((f) => furnitureToPlacement(f, invById)),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"translate" | "rotate" | "scale">("translate");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogDragging, setCatalogDragging] = useState(false);
  const [dropHover, setDropHover] = useState<{ x: number; z: number } | null>(null);
  const floorDropBridgeRef = useRef<FloorDropBridge | null>(null);

  const widthM = (room.width ?? 400) * CM_TO_M;
  const lengthM = (room.length ?? 500) * CM_TO_M;
  const heightM = (room.height ?? 250) * CM_TO_M;

  useEffect(() => {
    MOCK_CATALOG.forEach((m) => {
      useGLTF.preload(publicAssetUrl(m.glbUrl));
    });
  }, []);

  useEffect(() => {
    const end = () => {
      setCatalogDragging(false);
      setDropHover(null);
    };
    window.addEventListener("dragend", end);
    return () => window.removeEventListener("dragend", end);
  }, []);

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

  const complete = async () => {
    setSaving(true);
    setError(null);
    try {
      const nextIds = new Map<string, string>();
      for (const p of placements) {
        const coords = JSON.stringify({
          x: p.position[0],
          y: p.position[1],
          z: p.position[2],
          scale: p.scale,
        });
        const rotDeg = Math.round((p.rotationY * 180) / Math.PI) % 360;
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
      router.push(`/rooms/${roomId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 text-slate-100">
      <aside className="w-80 shrink-0 flex flex-col border-r border-violet-500/20 bg-slate-950/70 backdrop-blur-md shadow-xl shadow-indigo-950/50">
        <div className="p-4 border-b border-violet-500/20">
          <Link
            href={`/rooms/${roomId}`}
            className="text-xs text-violet-300/90 hover:text-white transition"
          >
            ← Back to room
          </Link>
          <h2 className="mt-2 text-lg font-semibold text-white tracking-tight">Catalog</h2>
          <p className="text-xs text-indigo-300/80 mt-1">Drag into the room or click to add at center.</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-400/90 mb-2">
              Mock GLBs
            </h3>
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
            <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-400/90 mb-2">
              Inventory
            </h3>
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
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-3 border-b border-violet-500/20 bg-slate-950/40 backdrop-blur">
          <span className="text-sm text-indigo-200/90 mr-2">
            Room <span className="font-mono text-violet-200">{roomId.slice(0, 8)}</span>
            <span className="text-slate-500 mx-2">|</span>
            {room.width}×{room.length}×{room.height} cm
          </span>
          <div className="flex rounded-lg border border-violet-500/30 overflow-hidden">
            {(["translate", "rotate", "scale"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 text-xs font-medium capitalize ${
                  mode === m
                    ? "bg-violet-600 text-white"
                    : "bg-slate-900/80 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void complete()}
            className="ml-auto rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 px-4 py-2 text-sm font-semibold shadow-lg shadow-violet-900/40"
          >
            {saving ? "Saving…" : "Complete"}
          </button>
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
            wallColour={room.wall_colour ?? "white"}
            floorDropBridgeRef={floorDropBridgeRef}
            dropHover={dropHover}
            placements={placements}
            setPlacements={setPlacements}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            transformMode={mode}
          />
          {catalogDragging ? (
            <div
              className="absolute inset-0 z-[200] bg-transparent cursor-copy"
              onDragEnter={(e) => e.preventDefault()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "copy";
                const hit = floorDropBridgeRef.current?.snapFromClient(e.clientX, e.clientY);
                setDropHover(hit);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDropHover(null);
                setCatalogDragging(false);
                const url =
                  e.dataTransfer.getData("modelUrl") ||
                  e.dataTransfer.getData("text/uri-list") ||
                  e.dataTransfer.getData("text/plain");
                const label = e.dataTransfer.getData("label") || "Item";
                const invRaw = e.dataTransfer.getData("inventoryId");
                const inventoryId = invRaw && invRaw.length > 0 ? invRaw : null;
                const hit = floorDropBridgeRef.current?.snapFromClient(e.clientX, e.clientY);
                if (!url?.trim() || !hit) return;
                const u = url.trim();
                if (!isRecognizedModelUrl(u)) return;
                onDropItem(u, label, inventoryId, hit.x, hit.z);
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
