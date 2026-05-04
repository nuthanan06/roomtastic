"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MOCK_CATALOG } from "@/lib/mockCatalog";
import { CM_TO_M } from "@/lib/gridSnap";
import { canonicalModelUrlForLoader, isRecognizedModelUrl } from "@/lib/modelUrl";
import { publicAssetUrl } from "@/lib/publicAssetUrl";
import { queryKeys, useInventoryQuery } from "@/hooks/useRoomQueries";
import { createHunyuanGenerateJob, fetchJob, syncRoomLayout } from "@/services/rooms";
import type { FurnitureOut, InventoryOut, JobOut, RoomOut } from "@/types/api";
import { getErrorMessage } from "@/utils/errors";
import { runAssistantMessage } from "./assistantCommands";
import type { FloorDropBridge } from "./floorDropBridge";
import { EditorScene, type RoomEditorSceneActions } from "./EditorScene";
import {
  furnitureToPlacement,
  inventoryToGlb,
  newPlacementFromCatalog,
  type Placement,
} from "./placement";
import type { FloorTextureId, WallTextureId } from "./proceduralTextures";
import { DEFAULT_DOOR, DEFAULT_WINDOW, type RoomOpening, type WallKey } from "./roomOpenings";
import { useGLTF } from "@react-three/drei";

/**
 * Generates a unique ID for a new door or window opening.
 * Uses crypto.randomUUID() if available, otherwise falls back to timestamp + random.
 */
function newOpeningId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `o_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Converts CSS color names (e.g., 'white', 'red', 'gray') or hex strings to hex format.
 * Expands short hex (#RGB) to long form (#RRGGBB). Defaults to beige (#e8e4dc) on unknown input.
 */
function cssColorToHex(input: string): string {
  const s = input.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(s))
    return s.length === 4 ? `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}` : s;
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
type GenerationStatus = "idle" | "submitting" | "running" | "succeeded" | "failed";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function fileToBase64Data(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.onload = () => {
      const raw = String(reader.result ?? "");
      const payload = raw.includes(",") ? raw.split(",", 2)[1] : raw;
      if (!payload) {
        reject(new Error("Could not parse image data."));
        return;
      }
      resolve(payload);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Finds the matching mock catalog item for a given GLB URL.
 * Normalizes URLs before comparison to handle path variations.
 */
function mockCatalogMatchForUrl(glbUrl: string): (typeof MOCK_CATALOG)[number] | undefined {
  const canon = canonicalModelUrlForLoader(glbUrl);
  return MOCK_CATALOG.find((m) => canonicalModelUrlForLoader(publicAssetUrl(m.glbUrl)) === canon);
}

function InventoryListThumb({ item }: { item: InventoryOut }) {
  if (item.thumbnail_url) {
    return (
      <Image
        src={item.thumbnail_url}
        alt={`${item.name} preview`}
        width={56}
        height={56}
        unoptimized
        sizes="56px"
        className="h-14 w-14 shrink-0 rounded-lg border border-white/10 object-cover"
      />
    );
  }

  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-900/80 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
      3D
    </div>
  );
}

/**
 * Renders the right-sidebar panel showing details of the selected furniture piece.
 * Displays: name, inventory source, thumbnail, model URL, transform (position/rotation/scale),
 * grouping info (what it's parented to), and IDs (client ID, furniture ID, inventory ID).
 * Shows a placeholder message if nothing is selected.
 */
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
      <div className="p-4 text-sm leading-relaxed text-slate-500">
        Click a piece in the room to see its name, model source, transform, and grouping here.
      </div>
    );
  }

  const mockMatch = mockCatalogMatchForUrl(placement.glbUrl);
  const rotDeg = Math.round((placement.rotationY * 180) / Math.PI);
  const [px, py, pz] = placement.position;

  return (
    <div className="space-y-5 p-4 text-sm">
      <div>
        <h2 className="text-lg leading-tight font-semibold tracking-tight text-white">
          {placement.label}
        </h2>
        {secondarySelectionLabel &&
        secondarySelectionId &&
        secondarySelectionId !== placement.clientId ? (
          <p className="mt-1 text-[11px] text-teal-300/90">
            Also selected for grouping:{" "}
            <span className="text-teal-100">{secondarySelectionLabel}</span>
          </p>
        ) : null}
      </div>

      <section className="space-y-2">
        <h3 className="rt-editor-heading text-violet-400/90">Source</h3>
        {inventoryRow ? (
          <dl className="space-y-1.5 text-xs">
            {inventoryRow.thumbnail_url ? (
              <div className="mb-2 overflow-hidden rounded-lg border border-white/10 bg-slate-900/50">
                <Image
                  src={inventoryRow.thumbnail_url}
                  alt={`${inventoryRow.name} thumbnail`}
                  width={512}
                  height={112}
                  unoptimized
                  sizes="(max-width: 768px) 100vw, 320px"
                  className="h-28 w-full object-cover"
                />
              </div>
            ) : null}
            <div className="flex justify-between gap-2">
              <dt className="shrink-0 text-slate-500">Inventory</dt>
              <dd className="text-right text-slate-200">{inventoryRow.name}</dd>
            </div>
            {inventoryRow.category ? (
              <div className="flex justify-between gap-2">
                <dt className="shrink-0 text-slate-500">Category</dt>
                <dd className="text-right text-slate-200">{inventoryRow.category}</dd>
              </div>
            ) : null}
            {inventoryRow.model_url ? (
              <div>
                <dt className="text-slate-500">Model URL</dt>
                <dd className="mt-0.5 font-mono text-[10px] leading-relaxed font-medium break-all text-slate-400">
                  {inventoryRow.model_url}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : mockMatch ? (
          <p className="text-xs text-slate-300">
            Mock catalog: <span className="text-violet-200">{mockMatch.label}</span>
            <span className="ml-1 text-slate-500">({mockMatch.id})</span>
          </p>
        ) : (
          <p className="text-xs text-slate-300">Custom model (not from current inventory row)</p>
        )}
        <div>
          <p className="mb-0.5 text-[10px] tracking-wide text-slate-500 uppercase">GLB in scene</p>
          <p className="font-mono text-[10px] leading-relaxed font-medium break-all text-slate-400">
            {placement.glbUrl}
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="rt-editor-heading text-violet-400/90">Transform</h3>
        <dl className="space-y-1.5 text-xs text-slate-300">
          <div className="flex justify-between gap-2">
            <dt className="font-medium text-slate-500">Position (m)</dt>
            <dd className="font-mono text-slate-200/95 tabular-nums">
              {px.toFixed(2)}, {py.toFixed(2)}, {pz.toFixed(2)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="font-medium text-slate-500">Rotation Y</dt>
            <dd className="font-mono text-slate-200/95 tabular-nums">{rotDeg}°</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="font-medium text-slate-500">Scale</dt>
            <dd className="font-mono text-slate-200/95 tabular-nums">
              {placement.scale.toFixed(2)}
            </dd>
          </div>
          {placement.localPosition ? (
            <div className="flex justify-between gap-2">
              <dt className="font-medium text-slate-500">Local pos (m)</dt>
              <dd className="font-mono text-slate-200/95 tabular-nums">
                {placement.localPosition[0].toFixed(2)}, {placement.localPosition[1].toFixed(2)},{" "}
                {placement.localPosition[2].toFixed(2)}
              </dd>
            </div>
          ) : null}
          {placement.localRotationY != null ? (
            <div className="flex justify-between gap-2">
              <dt className="font-medium text-slate-500">Local rot Y</dt>
              <dd className="font-mono text-slate-200/95 tabular-nums">
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
            <dd className="text-right text-slate-200">
              {parentLabel ? (
                <span title={placement.parentClientId ?? ""}>{parentLabel}</span>
              ) : (
                <span className="text-slate-500">Floor (root)</span>
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Client id</dt>
            <dd className="text-right font-mono text-[10px] font-medium break-all text-slate-400">
              {placement.clientId}
            </dd>
          </div>
          {placement.furnitureId ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Saved as</dt>
              <dd className="text-right font-mono text-[10px] break-all text-slate-400">
                {placement.furnitureId}
              </dd>
            </div>
          ) : (
            <p className="text-[11px] text-amber-200/80">
              Not saved yet — will be created on Complete.
            </p>
          )}
          {placement.inventoryId ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Inventory id</dt>
              <dd className="text-right font-mono text-[10px] break-all text-slate-400">
                {placement.inventoryId}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>
    </div>
  );
}

/**
 * MAIN ROOM EDITOR STATE ORCHESTRATOR
 * Manages all editor state: furniture placements, selections, UI tabs, colors, textures, doors/windows,
 * chat messages, transformation modes, and auto-save to server.
 *
 * Responsibilities:
 * - Initialize placements from backend furniture records and inventory
 * - Handle drag/drop from catalog → new placements at (0,0) then ring-search for free spot
 * - Sync selected/secondary selected furniture for grouping operations
 * - Render 3D scene (EditorScene) + left/right sidebars with catalog, room settings, assistant chat
 * - Auto-save layout every ~1.1s (debounced) with conflict resolution
 * - Preload mock GLB models for instant drag/drop feedback
 * - Bridge between HTML UI and 3D canvas via refs (FloorDropBridge, SceneActions)
 * - Support doors/windows preview (not yet persisted to backend)
 *
 * State: placements, selectedId, mode (translate/rotate/scale), colors, textures, openings, chat
 */
export default function RoomEditorClient({
  roomId,
  token,
  room,
  initialFurniture,
  initialOpenings = [],
  initialInventory = [],
}: {
  roomId: string;
  token: string;
  room: RoomOut;
  initialFurniture: FurnitureOut[];
  initialOpenings?: RoomOpening[];
  initialInventory?: InventoryOut[];
}) {
  const queryClient = useQueryClient();
  const userId = room.user_id;
  const inventoryQuery = useInventoryQuery(token, userId, initialInventory);

  const inventory = useMemo(() => inventoryQuery.data ?? [], [inventoryQuery.data]);
  const inventoryLoading = inventoryQuery.isLoading && inventory.length === 0;
  const inventoryError = inventoryQuery.error ? getErrorMessage(inventoryQuery.error) : null;
  const [sessionUploadInventoryIds, setSessionUploadInventoryIds] = useState<string[]>([]);

  const invById = useMemo(() => {
    const m = new Map<string, InventoryOut>();
    inventory.forEach((i) => m.set(i.inventory_id, i));
    return m;
  }, [inventory]);

  const sessionUploadSet = useMemo(
    () => new Set(sessionUploadInventoryIds),
    [sessionUploadInventoryIds],
  );

  const orderedInventory = useMemo(() => {
    const list = [...inventory];
    list.sort((a, b) => {
      const aUpload = sessionUploadSet.has(a.inventory_id) ? 1 : 0;
      const bUpload = sessionUploadSet.has(b.inventory_id) ? 1 : 0;
      if (aUpload !== bUpload) return bUpload - aUpload;

      const aTs = Date.parse(a.updated_at ?? a.created_at ?? "");
      const bTs = Date.parse(b.updated_at ?? b.created_at ?? "");
      return (Number.isFinite(bTs) ? bTs : 0) - (Number.isFinite(aTs) ? aTs : 0);
    });
    return list;
  }, [inventory, sessionUploadSet]);

  const userInventory = useMemo(
    () =>
      orderedInventory.filter(
        (item) =>
          (!!item.user_id && item.user_id.toLowerCase() === userId.toLowerCase()) ||
          sessionUploadSet.has(item.inventory_id),
      ),
    [orderedInventory, userId, sessionUploadSet],
  );

  const sharedInventory = useMemo(
    () => orderedInventory,
    [orderedInventory],
  );

  const [placements, setPlacements] = useState<Placement[]>(() =>
    initialFurniture.map((f) => furnitureToPlacement(f, invById)),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [secondarySelectedId, setSecondarySelectedId] = useState<string | null>(null);
  const [interferenceNotice, setInterferenceNotice] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("catalog");
  const [floorColorHex, setFloorColorHex] = useState("#2e1f4a");
  const [wallColorHex, setWallColorHex] = useState(() =>
    cssColorToHex(room.wall_colour ?? "white"),
  );
  const [floorTexturePreset, setFloorTexturePreset] = useState<FloorTextureId>("matte");
  const [wallTexturePreset, setWallTexturePreset] = useState<WallTextureId>("paint");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "bot"; text: string }>>(
    () => [
      {
        role: "bot",
        text: "Hi — Layout and wall colour auto-save to the server. I can also snap, center, straighten, or stack two items (e.g. “Place Sofa and Chair together vertically”). Type “help” for more.",
      },
    ],
  );
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
  const [sceneReady, setSceneReady] = useState(false);
  const [openings, setOpenings] = useState<RoomOpening[]>(initialOpenings);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generateName, setGenerateName] = useState("Generated Item");
  const [generateCategory, setGenerateCategory] = useState("custom");
  const [generateDescription, setGenerateDescription] = useState("");
  const [generateIncludeTexture, setGenerateIncludeTexture] = useState(true);
  const [generateImageFile, setGenerateImageFile] = useState<File | null>(null);
  const [generateImagePreviewUrl, setGenerateImagePreviewUrl] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>("idle");
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const placementsRef = useRef<Placement[]>(placements);
  placementsRef.current = placements;
  const openingsRef = useRef<RoomOpening[]>(openings);
  openingsRef.current = openings;

  useEffect(() => {
    return () => {
      if (generateImagePreviewUrl) URL.revokeObjectURL(generateImagePreviewUrl);
    };
  }, [generateImagePreviewUrl]);

  useEffect(() => {
    setSceneReady(true);
  }, []);

  // Inventory rows can load after editor mount; hydrate model URLs for inventory-backed pieces.
  useEffect(() => {
    if (inventory.length === 0) return;
    setPlacements((prev) =>
      prev.map((p) => {
        if (!p.inventoryId) return p;
        const inv = invById.get(p.inventoryId);
        if (!inv) return p;
        const nextGlb = inventoryToGlb(inv);
        if (p.glbUrl === nextGlb) return p;
        return {
          ...p,
          glbUrl: nextGlb,
          label: p.label === "Item" ? inv.name : p.label,
        };
      }),
    );
  }, [invById, inventory.length]);

  const persistGenRef = useRef(0);
  const isFirstAutosaveScheduleRef = useRef(true);
  const saveBusyRef = useRef(false);
  const saveQueuedRef = useRef(false);

  const widthM = (room.width ?? 400) * CM_TO_M;
  const lengthM = (room.length ?? 500) * CM_TO_M;
  const heightM = (room.height ?? 250) * CM_TO_M;

  const selectedPlacement = useMemo(
    () => (selectedId ? (placements.find((p) => p.clientId === selectedId) ?? null) : null),
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

  const saveLayoutMutation = useMutation({
    mutationFn: async () => {
      const current = placementsRef.current;
      const currentOpenings = openingsRef.current;
      const world = sceneActionsRef.current?.getExportTransforms() ?? null;

      const furniturePayload = current.map((p) => {
        const w = world?.find((t) => t.clientId === p.clientId);
        const pos = w?.position ?? p.position;
        const rotY = w?.rotationY ?? p.rotationY;
        const sc = w?.scale ?? p.scale;
        return {
          client_id: p.clientId,
          furniture_id: p.furnitureId,
          inventory_id: p.inventoryId || null,
          name_of_furniture: p.label,
          coordinates: JSON.stringify({
            x: pos[0],
            y: pos[1],
            z: pos[2],
            scale: sc,
          }),
          rotation: Math.round((rotY * 180) / Math.PI) % 360,
          tags: [],
        };
      });

      const openingsPayload = currentOpenings.map((o) => ({
        client_id: o.id,
        opening_id:
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(o.id)
            ? o.id
            : undefined,
        kind: o.kind,
        wall: o.wall,
        t: o.t,
        width_m: o.widthM,
        height_m: o.heightM,
        sill_m: o.sillM,
      }));

      const res = await syncRoomLayout(roomId, token, {
        room_patch: { wall_colour: wallColorHex },
        furniture: furniturePayload,
        openings: openingsPayload,
      });

      const furnitureMap = new Map<string, string>();
      for (const row of res.furniture) {
        if (row.client_id) furnitureMap.set(row.client_id, row.furniture_id);
      }
      const openingMap = new Map<string, string>();
      for (const row of res.openings) {
        if (row.client_id) openingMap.set(row.client_id, row.opening_id);
      }

      setPlacements((prev) =>
        prev.map((pl) => {
          const fid = furnitureMap.get(pl.clientId);
          if (!fid) return pl;
          return { ...pl, furnitureId: fid };
        }),
      );
      setOpenings((prev) =>
        prev.map((op) => {
          const oid = openingMap.get(op.id);
          if (!oid) return op;
          return { ...op, id: oid };
        }),
      );
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.roomFurniture(roomId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.roomOpenings(roomId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.roomShopping(roomId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.rooms(room.user_id) }),
      ]);
    },
  });

  const submitGenerationMutation = useMutation({
    mutationFn: async () => {
      if (!generateImageFile) {
        throw new Error("Please choose an image first.");
      }

      setGenerationError(null);
      setGenerationStatus("submitting");
      setGenerationJobId(null);

      const imageBase64 = await fileToBase64Data(generateImageFile);
      const createRes = await createHunyuanGenerateJob(token, {
        image_base64: imageBase64,
        image_mime: generateImageFile.type || null,
        inventory_name: generateName.trim() || "Generated Item",
        inventory_category: generateCategory.trim() || "custom",
        inventory_description: generateDescription.trim() || null,
        include_texture: generateIncludeTexture,
        tags: ["upload", "hunyuan"],
        user_id: userId,
      });

      setGenerationJobId(createRes.job_id);
      setGenerationStatus(
        createRes.status === "failed"
          ? "failed"
          : createRes.status === "succeeded"
            ? "succeeded"
            : "running",
      );

      let latest: JobOut = createRes;
      const deadline = Date.now() + 1000 * 60 * 25;
      while (latest.status === "pending" || latest.status === "running") {
        if (Date.now() > deadline) {
          throw new Error("Generation timed out. Please try again.");
        }
        await sleep(2500);
        latest = await fetchJob(createRes.job_id, token);
        setGenerationStatus(
          latest.status === "failed"
            ? "failed"
            : latest.status === "succeeded"
              ? "succeeded"
              : "running",
        );
      }

      if (latest.status !== "succeeded") {
        throw new Error(latest.error || "Generation failed.");
      }
      return latest;
    },
    onSuccess: async (job) => {
      const inventoryIdRaw = job.result?.inventory_id;
      if (typeof inventoryIdRaw === "string" && inventoryIdRaw.length > 0) {
        setSessionUploadInventoryIds((prev) => [
          inventoryIdRaw,
          ...prev.filter((id) => id !== inventoryIdRaw),
        ]);
      }
      setGenerationStatus("succeeded");
      setGenerationError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.inventory(userId) });
      setIsGenerateModalOpen(false);
      onPickGenerationImage(null);
    },
    onError: (err: unknown) => {
      setGenerationStatus("failed");
      setGenerationError(getErrorMessage(err));
    },
  });

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
      await saveLayoutMutation.mutateAsync();
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
  }, [saveLayoutMutation]);

  useEffect(() => {
    if (isFirstAutosaveScheduleRef.current) {
      isFirstAutosaveScheduleRef.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      void persistLayoutToServer();
    }, 1100);
    return () => window.clearTimeout(t);
  }, [placements, openings, wallColorHex, persistLayoutToServer]);

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

  const onPickGenerationImage = (file: File | null) => {
    if (generateImagePreviewUrl) {
      URL.revokeObjectURL(generateImagePreviewUrl);
    }
    setGenerateImageFile(file);
    if (!file) {
      setGenerateImagePreviewUrl(null);
      return;
    }
    setGenerateImagePreviewUrl(URL.createObjectURL(file));
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[radial-gradient(ellipse_100%_70%_at_50%_-15%,rgba(124,58,237,0.2),transparent_55%),radial-gradient(ellipse_70%_50%_at_100%_0%,rgba(99,102,241,0.14),transparent_50%),linear-gradient(165deg,#07050f_0%,#12102a_42%,#0b1224_100%)] text-slate-100 selection:bg-violet-500/25 selection:text-white">
      <aside className="flex w-80 shrink-0 flex-col border-r border-white/[0.06] bg-slate-950/50 shadow-[4px_0_32px_-12px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.04] backdrop-blur-xl ring-inset">
        <div className="border-b border-white/[0.06] p-4">
          <Link
            href={`/rooms/${roomId}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-violet-300/90 transition-colors hover:text-white"
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
                    ? "bg-gradient-to-b from-violet-600 to-violet-700 text-white shadow-lg ring-1 shadow-violet-950/50 ring-white/10"
                    : "text-slate-500 hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {interferenceNotice ? (
          <div className="mx-3 mt-2 flex items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-950/40 px-3 py-2.5 text-xs leading-snug font-medium text-amber-100/95 backdrop-blur-sm">
            <span className="flex-1 leading-snug">{interferenceNotice}</span>
            <button
              type="button"
              onClick={() => setInterferenceNotice(null)}
              className="shrink-0 text-[11px] text-amber-300/90 underline hover:text-white"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {sidebarTab === "catalog" ? (
          <div className="flex-1 space-y-4 overflow-y-auto p-3">
            <p className="text-xs text-indigo-300/80">
              Drag into the room or click to add at center.
            </p>
            <div className="rounded-xl border border-violet-500/30 bg-violet-950/35 p-3">
              <button
                type="button"
                onClick={() => setIsGenerateModalOpen(true)}
                className="w-full rounded-lg border border-violet-300/30 bg-violet-600/90 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-500"
              >
                Generate 3D From Image
              </button>
              <p className="mt-2 text-[11px] leading-relaxed text-violet-200/90">
                Creates a GLB and adds it to inventory. It will appear first once ready.
              </p>
              {generationStatus !== "idle" ? (
                <div className="mt-2 rounded-md border border-white/10 bg-slate-950/45 px-2.5 py-2 text-[11px]">
                  <p className="font-medium text-slate-100">
                    Status:{" "}
                    <span className="capitalize">
                      {generationStatus === "running"
                        ? "running"
                        : generationStatus === "submitting"
                          ? "submitting"
                          : generationStatus}
                    </span>
                  </p>
                  {generationJobId ? (
                    <p className="mt-0.5 font-mono text-[10px] text-slate-400">Job {generationJobId}</p>
                  ) : null}
                  {generationError ? (
                    <p className="mt-1 text-red-300/90">{generationError}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div>
              <h3 className="rt-editor-heading mb-2 text-violet-400/90">Mock GLBs</h3>
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
                    className={`w-full rounded-xl border border-white/10 px-3 py-3 text-left ${m.accent} flex items-center gap-3 transition hover:border-violet-400/50 hover:bg-white/5`}
                  >
                    <span className="h-10 w-10 rounded-lg border border-violet-500/30 bg-slate-900/80" />
                    <span className="text-sm font-medium text-white">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="rt-editor-heading mb-2 text-emerald-400/90">User Inventory</h3>
              {inventoryLoading ? (
                <p className="text-xs text-slate-500">Loading inventory...</p>
              ) : inventoryError ? (
                <p className="text-xs text-red-300/90">{inventoryError}</p>
              ) : userInventory.length === 0 ? (
                <p className="text-xs text-slate-500">No uploaded inventory yet.</p>
              ) : (
                <div className="space-y-2">
                  {userInventory.slice(0, 40).map((item) => (
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
                      className="flex w-full items-center gap-3 rounded-xl border border-emerald-500/35 bg-emerald-950/25 px-3 py-2 text-left transition hover:border-emerald-300/50"
                    >
                      <InventoryListThumb item={item} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-sm font-medium text-white">{item.name}</div>
                          {sessionUploadSet.has(item.inventory_id) ? (
                            <span className="rounded-full border border-emerald-300/30 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-100 uppercase">
                              New
                            </span>
                          ) : null}
                        </div>
                        <div className="truncate text-xs text-slate-300">
                          {item.category ?? "uploaded"}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="rt-editor-heading mb-2 text-sky-400/90">Shared Catalog Inventory</h3>
              {inventoryLoading ? (
                <p className="text-xs text-slate-500">Loading inventory...</p>
              ) : inventoryError ? (
                <p className="text-xs text-red-300/90">{inventoryError}</p>
              ) : sharedInventory.length === 0 ? (
                <p className="text-xs text-slate-500">No shared inventory rows yet.</p>
              ) : (
                <div className="space-y-2">
                  {sharedInventory.slice(0, 40).map((item) => (
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
                      className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-sky-950/20 px-3 py-2 text-left transition hover:border-sky-400/40"
                    >
                      <InventoryListThumb item={item} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white">{item.name}</div>
                        <div className="truncate text-xs text-slate-400">{item.category ?? "—"}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {sidebarTab === "room" ? (
          <div className="flex-1 space-y-5 overflow-y-auto p-3 text-sm">
            <div>
              <h3 className="rt-editor-heading mb-2 text-indigo-400/90">Floor</h3>
              <label className="mb-2 flex items-center gap-2 text-xs text-slate-300">
                <span className="w-16 shrink-0">Colour</span>
                <input
                  type="color"
                  value={floorColorHex}
                  onChange={(e) => setFloorColorHex(e.target.value)}
                  className="h-8 w-14 cursor-pointer rounded border border-white/20 bg-transparent"
                />
              </label>
              <label className="mb-1 block text-xs text-slate-400">Texture style</label>
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
              <h3 className="rt-editor-heading mb-2 text-indigo-400/90">Walls</h3>
              <label className="mb-2 flex items-center gap-2 text-xs text-slate-300">
                <span className="w-16 shrink-0">Colour</span>
                <input
                  type="color"
                  value={wallColorHex}
                  onChange={(e) => setWallColorHex(e.target.value)}
                  className="h-8 w-14 cursor-pointer rounded border border-white/20 bg-transparent"
                />
              </label>
              <label className="mb-1 block text-xs text-slate-400">Texture style</label>
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
              <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                Wall colour syncs with the room in the database (auto-save). Floor texture is
                preview-only for now.
              </p>
            </div>
            <div>
              <h3 className="rt-editor-heading mb-2 text-indigo-400/90">Windows & doors</h3>
              <p className="mb-3 text-[10px] leading-relaxed text-slate-500">
                Preview-only cutouts on walls. Drag along each row to slide the opening.
              </p>
              <div className="mb-3 flex flex-wrap gap-2">
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
                      className="space-y-2 rounded-lg border border-white/10 bg-slate-900/50 p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-white capitalize">{op.kind}</span>
                        <button
                          type="button"
                          onClick={() => setOpenings((prev) => prev.filter((x) => x.id !== op.id))}
                          className="text-[11px] text-red-300/90 underline hover:text-red-200"
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
          <div className="flex min-h-0 flex-1 flex-col p-3">
            <div className="mb-2 flex-1 space-y-2 overflow-y-auto rounded-lg border border-violet-500/20 bg-slate-950/50 p-2">
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-md px-2 py-1.5 text-xs leading-relaxed ${
                    m.role === "user"
                      ? "ml-4 bg-violet-600/25 text-violet-100"
                      : "mr-4 bg-slate-800/80 whitespace-pre-wrap text-slate-200"
                  }`}
                >
                  {m.text}
                </div>
              ))}
            </div>
            <div className="flex shrink-0 gap-2">
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
                className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500"
              >
                Send
              </button>
            </div>
          </div>
        ) : null}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.06] bg-slate-950/25 px-5 py-3.5 ring-1 ring-white/[0.03] backdrop-blur-md ring-inset">
          <span className="mr-1 text-sm font-medium tracking-tight text-indigo-200/95">
            Room{" "}
            <span className="font-mono text-[13px] text-violet-200/95 tabular-nums">
              {roomId.slice(0, 8)}
            </span>
            <span className="mx-2 text-slate-500">|</span>
            {room.width}×{room.length}×{room.height} cm
          </span>
          <div className="flex overflow-hidden rounded-xl bg-slate-900/60 p-0.5 ring-1 ring-white/[0.07]">
            {(["translate", "rotate", "scale"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3.5 py-2 text-xs font-semibold tracking-wide capitalize transition-colors ${
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
              disabled={!selectedId || !secondarySelectedId || selectedId === secondarySelectedId}
              title="Main selection = base furniture, Shift+click = decor to attach"
              onClick={() => {
                if (!selectedId || !secondarySelectedId || selectedId === secondarySelectedId)
                  return;
                const ok = sceneActionsRef.current?.attachAsChild(selectedId, secondarySelectedId);
                if (ok) {
                  setSecondarySelectedId(null);
                  setInterferenceNotice(null);
                } else {
                  setInterferenceNotice("Can’t group those pieces (cycle or missing objects).");
                }
              }}
              className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-2.5 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-900/50 disabled:pointer-events-none disabled:opacity-40"
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
              className="rounded-lg border border-slate-500/40 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-40"
            >
              Ungroup
            </button>
            <span className="hidden max-w-[140px] text-[10px] leading-tight text-slate-500 lg:inline">
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
              className={`rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold tracking-tight shadow-lg ring-1 shadow-violet-950/35 ring-white/10 hover:from-indigo-500 hover:to-violet-500 ${
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
        <div className="relative min-h-0 flex-1">
          {sceneReady ? (
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
          ) : null}
          <div className="pointer-events-none absolute bottom-3 left-3 z-[100] max-w-[min(42vw,240px)] rounded-xl border border-white/[0.08] bg-slate-950/80 px-3 py-2 text-[10px] font-medium text-slate-300 shadow-xl ring-1 shadow-black/40 ring-white/[0.05] backdrop-blur-md">
            <span className="font-sans text-slate-500">World </span>
            <span ref={hudWorldRef} className="font-mono text-violet-200/95 tabular-nums">
              —
            </span>
          </div>
          <div className="pointer-events-none absolute right-3 bottom-3 z-[100] rounded-xl border border-white/[0.08] bg-slate-950/80 px-3 py-2 text-[10px] font-medium text-slate-300 shadow-xl ring-1 shadow-black/40 ring-white/[0.05] backdrop-blur-md">
            <span className="font-sans text-slate-500">Screen </span>
            <span ref={hudPxRef} className="font-mono text-cyan-200/95 tabular-nums">
              —
            </span>
          </div>
          {catalogDragging ? (
            <div
              className="absolute inset-0 z-[200] cursor-copy bg-transparent"
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
                  setInterferenceNotice(
                    "No clear floor space there — try elsewhere or group onto furniture.",
                  );
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

      <aside className="flex w-80 shrink-0 flex-col border-l border-white/[0.06] bg-slate-950/50 shadow-[-4px_0_32px_-12px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.04] backdrop-blur-xl ring-inset">
        <div className="border-b border-white/[0.06] p-4">
          <h2 className="text-sm font-semibold tracking-tight text-white">Selection</h2>
          <p className="mt-1 text-[11px] leading-relaxed font-medium text-slate-500">
            Details for the highlighted piece
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SelectionDetailsPanel
            placement={selectedPlacement}
            inventoryRow={selectedInventoryRow}
            parentLabel={parentLabelForSelected}
            secondarySelectionId={secondarySelectedId}
            secondarySelectionLabel={secondarySelectionLabel}
          />
        </div>
      </aside>

      {isGenerateModalOpen ? (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-900/95 p-4 shadow-2xl ring-1 ring-white/10">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-white">
                  Generate 3D Upload
                </h2>
                <p className="mt-1 text-xs text-slate-300">
                  Upload one image. We will run Hunyuan and add the result to inventory.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsGenerateModalOpen(false)}
                className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs text-slate-300">
                Name
                <input
                  value={generateName}
                  onChange={(e) => setGenerateName(e.target.value)}
                  placeholder="Generated Item"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950/70 px-2.5 py-2 text-sm text-white placeholder:text-slate-500"
                />
              </label>

              <label className="block text-xs text-slate-300">
                Category
                <input
                  value={generateCategory}
                  onChange={(e) => setGenerateCategory(e.target.value)}
                  placeholder="custom"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950/70 px-2.5 py-2 text-sm text-white placeholder:text-slate-500"
                />
              </label>

              <label className="block text-xs text-slate-300">
                Description (optional)
                <textarea
                  value={generateDescription}
                  onChange={(e) => setGenerateDescription(e.target.value)}
                  rows={3}
                  placeholder="What is this item?"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950/70 px-2.5 py-2 text-sm text-white placeholder:text-slate-500"
                />
              </label>

              <label className="block text-xs text-slate-300">
                Image
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => onPickGenerationImage(e.target.files?.[0] ?? null)}
                  className="mt-1 block w-full cursor-pointer rounded-lg border border-white/15 bg-slate-950/70 px-2 py-2 text-xs text-slate-200 file:mr-2 file:rounded-md file:border-0 file:bg-violet-600 file:px-2 file:py-1 file:text-white hover:file:bg-violet-500"
                />
              </label>

              {generateImagePreviewUrl ? (
                <Image
                  src={generateImagePreviewUrl}
                  alt="Selected upload preview"
                  width={640}
                  height={320}
                  unoptimized
                  className="h-36 w-full rounded-lg border border-white/10 object-cover"
                />
              ) : null}

              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={generateIncludeTexture}
                  onChange={(e) => setGenerateIncludeTexture(e.target.checked)}
                  className="h-4 w-4 accent-violet-500"
                />
                Include texture generation
              </label>

              {generationError ? (
                <p className="rounded-md border border-red-500/40 bg-red-950/35 px-2.5 py-2 text-xs text-red-200">
                  {generationError}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsGenerateModalOpen(false)}
                  className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitGenerationMutation.isPending}
                  onClick={() => {
                    void submitGenerationMutation.mutateAsync();
                  }}
                  className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 hover:bg-violet-500"
                >
                  {submitGenerationMutation.isPending ? "Generating..." : "Start Generation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
