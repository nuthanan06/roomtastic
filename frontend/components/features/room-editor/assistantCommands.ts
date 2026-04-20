import type { Dispatch, SetStateAction } from "react";
import { snapXZ } from "@/lib/gridSnap";
import { DEFAULT_MODEL_FOOTPRINT } from "./footprint";
import { wouldCreateCycle } from "./grouping";
import type { Placement } from "./placement";

export type AssistantContext = {
  placements: Placement[];
  setPlacements: Dispatch<SetStateAction<Placement[]>>;
  selectedId: string | null;
};

/**
 * Primary assistant entrypoint.
 * Handles high-level room-edit commands and delegates parsing to helper functions below.
 */
export function runAssistantMessage(raw: string, ctx: AssistantContext): string {
  const t = raw.trim().toLowerCase();
  if (!t) return 'Ask me to align things, or type "help" for examples.';

  if (t === "help" || t.includes("what can you")) {
    return [
      "Try:",
      '- "Snap selection to grid" - main selection only.',
      '- "Snap all to grid" - every ungrouped root piece.',
      '- "Center selection" - X/Z to room middle.',
      '- "Straighten selection" - Y rotation -> 0 deg.',
      '- "Straighten all" - all root pieces forward.',
      '- "Place Sofa and Chair together vertically align them" - stack second on first in one column.',
      '- Same idea: "Stack lamp on table", "Vertically align rug and chair".',
    ].join("\n");
  }

  const { setPlacements, selectedId, placements } = ctx;

  if (t.includes("snap") && t.includes("all")) {
    const n = snapRootsXZ(setPlacements, () => true);
    return n ? `Snapped ${n} piece(s) to the grid.` : "Everything was already on grid corners.";
  }

  if ((t.includes("snap") && t.includes("grid")) || t.includes("align to grid")) {
    if (!selectedId) return "Select something first (click in the room).";
    const sel = placements.find((p) => p.clientId === selectedId);
    if (sel?.parentClientId) {
      return "That piece is grouped - ungroup it first, or snap the base furniture instead.";
    }
    const n = snapRootsXZ(setPlacements, (p) => p.clientId === selectedId);
    return n ? "Snapped your selection to the grid." : "That piece was already grid-aligned.";
  }

  if (t.includes("center")) {
    if (!selectedId) return "Select a piece to center.";
    const sel = placements.find((p) => p.clientId === selectedId);
    if (sel?.parentClientId) {
      return "Ungroup first - centering uses world position for base pieces only.";
    }
    setPlacements((prev) =>
      prev.map((p) =>
        p.clientId === selectedId && !p.parentClientId
          ? { ...p, position: [0, p.position[1], 0] }
          : p,
      ),
    );
    return "Moved selection to the room center (X/Z).";
  }

  if (t.includes("straighten") && t.includes("all")) {
    setPlacements((prev) => prev.map((p) => (p.parentClientId ? p : { ...p, rotationY: 0 })));
    return "Straightened all root pieces (Y rotation -> 0).";
  }

  if (t.includes("straighten") || t.includes("face forward") || t.includes("reset rotation")) {
    if (!selectedId) return "Select a piece to straighten.";
    setPlacements((prev) =>
      prev.map((p) => (p.clientId === selectedId ? { ...p, rotationY: 0 } : p)),
    );
    return "Straightened selection to 0deg.";
  }

  if (t.includes("align") && (t.includes("line") || t.includes("row"))) {
    return "Row alignment is not automated yet - use snap all to grid for a clean line.";
  }

  const stackPair = parseVerticalStackPair(raw);
  if (stackPair) {
    const { labelA, labelB } = stackPair;
    const base = findRootByLabel(placements, labelA);
    const top = findRootByLabel(placements, labelB);
    if (!base || !top) {
      return [
        "I need two ungrouped pieces whose labels match what you wrote.",
        `You said \"${labelA}\" and \"${labelB}\".`,
        "Use the exact names from the left list (for example: Sofa, Chair), or a short substring.",
      ].join(" ");
    }
    if (base.clientId === top.clientId) {
      return "Those names matched the same piece - use two different labels.";
    }
    if (wouldCreateCycle(placements, base.clientId, top.clientId)) {
      return "That pairing would create a group loop - pick a different bottom piece.";
    }
    const topKids = placements.filter((p) => p.parentClientId === top.clientId);
    if (topKids.length > 0) {
      return "The piece that goes on top cannot have attachments yet - ungroup those first.";
    }

    const cx = (base.position[0] + top.position[0]) / 2;
    const cz = (base.position[2] + top.position[2]) / 2;
    const [sx, sz] = snapXZ(cx, cz);
    const localY = approxStackHeightM(base);
    const baseScale = base.scale || 1;
    const localRot = top.rotationY - base.rotationY;
    const localScale = top.scale / baseScale;

    setPlacements((prev) =>
      prev.map((p) => {
        if (p.clientId === base.clientId) {
          return {
            ...p,
            position: [sx, 0, sz],
            parentClientId: null,
            localPosition: undefined,
            localRotationY: undefined,
            localScale: undefined,
          };
        }
        if (p.clientId === top.clientId) {
          return {
            ...p,
            parentClientId: base.clientId,
            localPosition: [0, localY, 0],
            localRotationY: localRot,
            localScale,
          };
        }
        return p;
      }),
    );

    return [
      `Stacked \"${top.label}\" on \"${base.label}\" in one column (same X/Z).`,
      "Heights use a quick estimate - nudge with the gizmo if it is slightly off.",
    ].join(" ");
  }

  return "I did not catch that - type help for a list.";
}

/** Snap only root pieces so attachments keep local offsets under parents. */
function snapRootsXZ(
  setPlacements: AssistantContext["setPlacements"],
  filter: (p: Placement) => boolean,
): number {
  let n = 0;
  setPlacements((prev) =>
    prev.map((p) => {
      if (p.parentClientId || !filter(p)) return p;
      const [sx, sz] = snapXZ(p.position[0], p.position[2]);
      if (sx !== p.position[0] || sz !== p.position[2]) n++;
      return { ...p, position: [sx, p.position[1], sz] };
    }),
  );
  return n;
}

/** Rough stacked height for a root piece (matches default collision footprint). */
function approxStackHeightM(p: Placement): number {
  return DEFAULT_MODEL_FOOTPRINT.yTop * p.scale + 0.02;
}

function findRootByLabel(placements: Placement[], query: string): Placement | undefined {
  const q = cleanLabelPhrase(query).toLowerCase();
  if (!q) return undefined;
  const roots = placements.filter((p) => !p.parentClientId);
  const exact = roots.find((p) => p.label.trim().toLowerCase() === q);
  if (exact) return exact;
  return roots.find((p) => p.label.toLowerCase().includes(q));
}

/**
 * Parse "place A and B together ... vertically" / stack / align variants.
 * First name = bottom/base, second = piece stacked on top.
 */
function parseVerticalStackPair(raw: string): { labelA: string; labelB: string } | null {
  const t = raw.trim();
  const patterns: RegExp[] = [
    /place\s+(.+?)\s+and\s+(.+?)\s+together/i,
    /put\s+(.+?)\s+and\s+(.+?)\s+together/i,
    /stack\s+(.+?)\s+on\s+top\s+of\s+(.+)/i,
    /stack\s+(.+?)\s+on\s+(.+)/i,
    /stack\s+(.+?)\s+and\s+(.+?)(?:\s+vertically|\s+together|\s*$)/i,
    /(?:group|attach|combine)\s+(.+?)\s+and\s+(.+?)(?:\s+together|\s+vertically|$)/i,
    /vertically\s+align\s+(.+?)\s+and\s+(.+)/i,
    /(?:align|place)\s+(.+?)\s+and\s+(.+?)\s+(?:vertically|in\s+the\s+same\s+column)/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const labelA = cleanLabelPhrase(m[1]);
      const labelB = cleanLabelPhrase(m[2]);
      if (labelA && labelB) return { labelA, labelB };
    }
  }
  return null;
}

/** Trim trailing conversational fluff from captured name phrases. */
function cleanLabelPhrase(s: string): string {
  return stripWrappingQuotes(
    s
      .replace(/\s+(vertically align them|vertically aligned|vertically|please|thanks)\.?$/i, "")
      .trim(),
  );
}

function stripWrappingQuotes(s: string): string {
  return s
    .trim()
    .replace(/^\{+|\}+$/g, "")
    .replace(/^[\"']+|[\"']+$/g, "")
    .trim();
}
