import type { RefObject } from "react";

/**
 * Interface filled by a component inside <Canvas> and read by the HTML drag-and-drop overlay.
 * The bridge is needed because the canvas element rarely receives native drop events reliably.
 */
export type FloorDropBridge = {
  /** Projects client (screen) X/Y onto the floor plane and returns the nearest grid-snapped world X/Z. */
  snapFromClient: (clientX: number, clientY: number) => { x: number; z: number } | null;
  /** Finds a vacant X/Z near the snapped point using the dragged model's footprint; null if no free cell nearby. */
  resolveDropPosition: (x: number, z: number) => { x: number; z: number } | null;
};

/** Ref type used by RoomEditorClient to pass the bridge into EditorScene. */
export type FloorDropBridgeRef = RefObject<FloorDropBridge | null>;
