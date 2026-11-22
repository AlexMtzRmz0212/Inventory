import { groupedItems } from "./item-art";
import type { Container, Inventory, Item } from "./types";

/** Scene coordinates: a flat front-on room, 1200 wide. */
export const SCENE_W = 1200;
export const SCENE_H = 700;
export const FLOOR_Y = 520;
/** Where furniture stands. */
export const BASE_Y = 570;
/** Front row of the floor, for luggage and loose items at the site level. */
export const FLOOR_BOX_Y = 640;
export const FLOOR_ITEMS_Y = 676;

export type Furniture = "desk" | "closet" | "shelf" | "crate";

export function furnitureKind(name: string): Furniture {
  const n = name.toLowerCase();
  if (/desk|table/.test(n)) return "desk";
  if (/closet|wardrobe|cabinet/.test(n)) return "closet";
  if (/shelf|shelves|rack/.test(n)) return "shelf";
  return "crate";
}

export const FURNITURE_WIDTH: Record<Furniture, number> = {
  desk: 400,
  closet: 260,
  shelf: 300,
  crate: 220,
};

/**
 * Centers for pieces of furniture standing side by side, each given its own width plus a gap, so
 * a wide desk never runs into the closet beside it. `span` is how wide the whole row is.
 */
export function slotsFor(kinds: Furniture[]): { xs: number[]; span: number } {
  const GAP = 90;
  const widths = kinds.map((k) => FURNITURE_WIDTH[k]);
  const span = widths.reduce((a, b) => a + b, 0) + GAP * Math.max(kinds.length - 1, 0);
  let left = SCENE_W / 2 - span / 2;
  const xs = widths.map((w) => {
    const x = left + w / 2;
    left += w + GAP;
    return x;
  });
  return { xs, span };
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const c = (x: number, y: number) =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`;
}

const CONTAINER_COLORS: Record<string, string> = {
  Teal: "#2fbfb0",
  Black: "#2c323c",
  Brown: "#9a6b43",
  "Navy & gold": "#1f3a73",
  Red: "#c0392b",
  Olive: "#6b7a3a",
};

export function containerColor(c: Container): string {
  if (c.color && CONTAINER_COLORS[c.color]) return CONTAINER_COLORS[c.color];
  return c.type === "Cardboard box" ? "#b59a72" : "#6b7683";
}

/** Trim color, for containers whose color has a second tone. */
export function containerAccent(c: Container): string | null {
  return c.color === "Navy & gold" ? "#e0b13c" : null;
}

/** Bags and boxes lie flat; suitcases stand up. */
export const liesFlat = (c: Container) => c.type === "Cardboard box" || c.type === "Bag";

/** Drawn size in scene units; suitcases stand up, bags and boxes sit flat (and so does any case laid down). */
export function containerSize(c: Container, scale: number, lying = false): { w: number; h: number } {
  const w = c.widthCm ?? 40;
  const h = c.heightCm ?? 30;
  const l = c.lengthCm ?? 50;
  return liesFlat(c) || lying ? { w: l * scale, h: h * scale } : { w: w * scale, h: l * scale };
}

export interface Group {
  key: string;
  label: string;
  category: string | null;
  items: Item[];
  /** True when several items are stacked into one pile. */
  pile: boolean;
}

export const MAX_INDIVIDUAL = 8;

/** Few items are drawn one by one; many collapse into one pile per category. */
export function groupItems(items: Item[]): Group[] {
  if (items.length <= MAX_INDIVIDUAL) {
    return items.map((i) => ({
      key: i.id,
      label: i.name,
      category: i.category,
      items: [i],
      pile: false,
    }));
  }
  const by = new Map<string | null, Item[]>();
  for (const i of items) by.set(i.category, [...(by.get(i.category) ?? []), i]);
  return [...by.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([category, list]) => ({
      key: `pile-${category ?? "none"}`,
      label: category ?? "Other",
      category,
      items: list,
      pile: true,
    }));
}

/** A row on a piece of furniture where things stand: y of what they stand on, how wide, how big things look there. */
export interface Level {
  y: number;
  width: number;
  scale: number;
}

export interface PlacedItem {
  item: Item;
  x: number;
  /** Center of the drawing. */
  y: number;
  size: number;
}

/**
 * Stands items on the levels of a piece of furniture, front level first, as big as will fit.
 * Items go by category so like things sit together.
 */
export function placeOnLevels(items: Item[], levels: Level[], cx: number): PlacedItem[] {
  if (items.length === 0 || levels.length === 0) return [];
  const sorted = groupedItems(items);
  const caps = (size: number) => levels.map((l) => Math.max(1, Math.floor(l.width / (size * l.scale + 6))));
  let size = 54;
  while (size > 22 && caps(size).reduce((a, b) => a + b, 0) < sorted.length) size -= 2;
  const per = caps(size);
  const out: PlacedItem[] = [];
  let next = 0;
  levels.forEach((l, li) => {
    // The last level takes whatever is left, however many.
    const take = li === levels.length - 1 ? sorted.length - next : Math.min(per[li], sorted.length - next);
    const s = size * l.scale;
    const step = Math.min(s + 6, l.width / Math.max(take, 1));
    for (let j = 0; j < take; j++) {
      out.push({ item: sorted[next++], x: cx + (j - (take - 1) / 2) * step, y: l.y - s / 2, size: s });
    }
  });
  return out;
}

export interface PlacedBox {
  c: Container;
  left: number;
  w: number;
  h: number;
  /** Y of the bottom edge. */
  base: number;
  /** A suitcase laid on its back, as when it is stacked. */
  lying?: boolean;
  /** The containers stacked together with this one, bottom first; absent when it stands alone. */
  column?: string[];
}

/** Most containers in one stack. */
const STACK_MAX = 3;
/** Tallest a stack may get, in scene units. */
const STACK_H = 280;

/**
 * A row of luggage and boxes centered on `cx`, scaled down together to fit `availW`.
 * Boxes and cases with nothing in them are stacked (cases laid on their backs) instead of
 * standing in the row, so that what is in the row is what has something to show.
 */
export function layoutBoxes(
  boxes: Container[],
  cx: number,
  base: number,
  availW: number,
  hasItems: (c: Container) => boolean = () => true,
  /** How much bigger than life size things may be drawn; small things on a desk get more. */
  maxScale = 2.6,
): PlacedBox[] {
  if (boxes.length === 0) return [];
  const gap = 18;
  const stackable = (c: Container) => !hasItems(c) && !c.filled && (c.type === "Cardboard box" || c.type === "Suitcase");
  type Column = { items: Container[]; lying: boolean };
  const stacks = (list: Container[], lying: boolean): Column[] => {
    // Widest at the bottom, so a stack never has a big one on a small one.
    const sorted = [...list].sort((a, b) => containerSize(b, 1, lying).w - containerSize(a, 1, lying).w);
    const out: Column[] = [];
    for (let i = 0; i < sorted.length; i += STACK_MAX) out.push({ items: sorted.slice(i, i + STACK_MAX), lying });
    return out;
  };
  const columns: Column[] = [
    ...boxes.filter((c) => !stackable(c)).map((c) => ({ items: [c], lying: false })),
    ...stacks(boxes.filter((c) => stackable(c) && c.type === "Cardboard box"), false),
    ...stacks(boxes.filter((c) => stackable(c) && c.type !== "Cardboard box"), true),
  ];
  const widthOf = (col: Column) => Math.max(...col.items.map((c) => containerSize(c, 1, col.lying).w));
  const heightOf = (col: Column) => col.items.reduce((s, c) => s + containerSize(c, 1, col.lying).h, 0);
  const unit = columns.reduce((sum, col) => sum + widthOf(col), 0);
  const tallest = Math.max(...columns.map(heightOf));
  const scale = Math.min(maxScale, (availW - gap * (columns.length - 1)) / unit, STACK_H / tallest);
  let left = cx - (unit * scale + gap * (columns.length - 1)) / 2;
  const out: PlacedBox[] = [];
  for (const col of columns) {
    const colW = widthOf(col) * scale;
    let y = base;
    for (const c of col.items) {
      const { w, h } = containerSize(c, scale, col.lying);
      out.push({
        c,
        left: left + (colW - w) / 2,
        w,
        h,
        base: y,
        lying: col.lying,
        column: col.items.length > 1 ? col.items.map((i) => i.id) : undefined,
      });
      y -= h;
    }
    left += colW + gap;
  }
  return out;
}

/** Items by the container they are in. Items pointing at a container that does not exist are left out. */
export function itemsByContainer(inv: Pick<Inventory, "items" | "containers">): Map<string, Item[]> {
  const known = new Set(inv.containers.map((c) => c.id));
  const out = new Map<string, Item[]>();
  for (const i of inv.items) {
    if (!i.boxId || !known.has(i.boxId)) continue;
    out.set(i.boxId, [...(out.get(i.boxId) ?? []), i]);
  }
  for (const [id, list] of out) out.set(id, groupedItems(list));
  return out;
}

/** The items that stick out of a closed container: one per category first, so the peek shows a mix. */
export function peekPicks(items: Item[], n: number): Item[] {
  const byCategory = new Map<string | null, Item[]>();
  for (const i of items) byCategory.set(i.category, [...(byCategory.get(i.category) ?? []), i]);
  const lanes = [...byCategory.values()];
  const out: Item[] = [];
  for (let round = 0; out.length < n && out.length < items.length; round++) {
    for (const lane of lanes) {
      if (lane[round] && out.length < n) out.push(lane[round]);
    }
  }
  return out;
}

export interface PeekSlot {
  x: number;
  /** How far the item's center sits above the container's top edge. */
  rise: number;
  rot: number;
}

const PEEK_RISE = [8, 20, 12, 24];
const PEEK_ROT = [-14, 7, -6, 13];

/** Where each peeking item sits along the top of a container. */
export function peekSlots(n: number, left: number, w: number): PeekSlot[] {
  return Array.from({ length: n }, (_, i) => ({
    x: left + w * (n === 1 ? 0.5 : 0.22 + (0.56 * i) / (n - 1)),
    rise: PEEK_RISE[i % PEEK_RISE.length],
    rot: PEEK_ROT[i % PEEK_ROT.length],
  }));
}

/** How many items fit in a container's peek: wider things show more. */
export function peekCount(w: number, total: number): number {
  return Math.min(total, Math.max(2, Math.min(4, Math.floor(w / 44))));
}

/** Drawn size of one item when its container is open, and the distance between neighbors. */
export const BURST_ITEM = 60;
export const BURST_STEP = 72;
export const BURST_MAX_COLS = 20;

export interface BurstSlot {
  /** Offsets from the container's top center. */
  x: number;
  y: number;
  rot: number;
  /** Seconds before this one pops. */
  delay: number;
}

/** Rows of items stacked upward from the container, each row centered on it. */
export function burstLayout(n: number, cols: number): BurstSlot[] {
  if (n <= 0) return [];
  const slots: BurstSlot[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    const col = i - row * cols;
    slots.push({
      x: (col - (inRow - 1) / 2) * BURST_STEP,
      y: -(row + 0.7) * BURST_STEP + (col % 2 ? 7 : 0),
      rot: ((i * 53) % 17) - 8,
      delay: Math.min(i * 0.03, 0.6),
    });
  }
  return slots;
}

export interface BurstPlan {
  /** One slot per item, in the same order. */
  slots: BurstSlot[];
  /** The container's top center, which the slot offsets are relative to. */
  anchorX: number;
  anchorY: number;
  /** Camera that fits the whole grid in the visible room. */
  frame: { cx: number; cy: number; w: number };
}

/** Never zoom in past this width, so one or two items do not fill the screen. */
const MIN_FRAME_W = 220;

/** The top bar covers the top of the room; the close button sits over the container's rim below the items. */
const FREE_TOP = 0.12;
const FREE_BOTTOM = 0.02;
/** How much of that free space the items take. */
const FILL = 0.96;

/** The camera that fits these slots into the free part of a screen of this aspect. */
function frameFor(slots: BurstSlot[], anchorX: number, anchorY: number, aspect: number) {
  const half = BURST_ITEM / 2 + 6;
  const xs = slots.map((s) => anchorX + s.x);
  const ys = slots.map((s) => anchorY + s.y);
  const left = Math.min(...xs) - half;
  const right = Math.max(...xs) + half;
  const top = Math.min(...ys) - half;
  // Just the rim of the container stays in view, so the items read as coming out of it.
  const bottom = anchorY + 14;
  const free = 1 - FREE_TOP - FREE_BOTTOM;
  const w = Math.max(MIN_FRAME_W, (right - left) / FILL, (bottom - top) / (free * FILL) * aspect);
  const h = w / aspect;
  // Center the items in the free band: it starts FREE_TOP down and ends FREE_BOTTOM up.
  const bandCenter = (FREE_TOP + 1 - FREE_BOTTOM) / 2;
  return { cx: (left + right) / 2, cy: (top + bottom) / 2 + (0.5 - bandCenter) * h, w };
}

/**
 * Lays out all of an open container's items and the camera that frames them. The number of
 * columns is whichever lets the camera zoom in the most for this screen, so the items fill it
 * however many there are.
 */
export function burstPlan(box: PlacedBox, n: number, aspect: number): BurstPlan {
  const anchorX = box.left + box.w / 2;
  // Above the handle on suitcases, which stands 12 above the top edge.
  const anchorY = box.base - box.h - (box.c.type === "Cardboard box" ? 10 : box.c.type === "Bag" ? 20 : box.c.type === "Backpack" ? 16 : box.c.type === "Suitcase" ? 22 : 0);

  let best: { slots: BurstSlot[]; frame: BurstPlan["frame"] } | null = null;
  for (let cols = 1; cols <= Math.min(BURST_MAX_COLS, Math.max(n, 1)); cols++) {
    const slots = burstLayout(n, cols);
    const frame = frameFor(slots, anchorX, anchorY, aspect);
    if (!best || frame.w < best.frame.w) best = { slots, frame };
  }
  return { slots: best?.slots ?? [], anchorX, anchorY, frame: best?.frame ?? { cx: anchorX, cy: anchorY, w: 1100 } };
}

export interface LineupPlan {
  /** The stacked containers, now standing side by side. */
  boxes: PlacedBox[];
  /** Camera that frames the row and the names under it. */
  frame: { cx: number; cy: number; w: number };
}

/** Stands the containers of a stack up in a row, to be told apart, and frames them to fill the screen. */
export function lineupPlan(cs: Container[], cx: number, base: number, aspect: number): LineupPlan {
  const gap = 34;
  const scale = 2.4;
  const sizes = cs.map((c) => containerSize(c, scale, false));
  const total = sizes.reduce((a, z) => a + z.w, 0) + gap * Math.max(cs.length - 1, 0);
  let left = cx - total / 2;
  const boxes = cs.map((c, i) => {
    const placed: PlacedBox = { c, left, w: sizes[i].w, h: sizes[i].h, base };
    left += sizes[i].w + gap;
    return placed;
  });
  const tallest = Math.max(...sizes.map((z) => z.h), 1);
  const L = cx - total / 2 - 50;
  const R = cx + total / 2 + 50;
  const T = base - tallest - 40;
  const B = base + 120;
  // Same free band as an open container: below the top bar, above the close button.
  const w = Math.max(300, (R - L) / 0.96, ((B - T) / (0.86 * 0.96)) * aspect);
  const h = w / aspect;
  return { boxes, frame: { cx: (L + R) / 2, cy: (T + B) / 2 + (0.5 - 0.55) * h, w } };
}
