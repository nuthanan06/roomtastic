import type { MutableRefObject } from "react";

/** Filled by a component inside <Canvas>; bridge used by an HTML overlay for drag-and-drop (canvas rarely receives drop). */
export type FloorDropBridge = {
  snapFromClient: (clientX: number, clientY: number) => { x: number; z: number } | null;
  /** Vacant XZ near the snapped point using the dragged model’s footprint; null if no free cell nearby. */
  resolveDropPosition: (x: number, z: number) => { x: number; z: number } | null;
};

export type FloorDropBridgeRef = MutableRefObject<FloorDropBridge | null>;
