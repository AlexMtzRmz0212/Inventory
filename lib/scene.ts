import type { Container, Item } from "./types";

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

/** Evenly spaced centers for n pieces of furniture. */
export function slotsFor(n: number): { xs: number[]; width: number } {
  const width = Math.min(440, Math.max(300, 1000 / Math.max(n, 1)));
  const xs = Array.from({ length: n }, (_, i) => SCENE_W / 2 + (i - (n - 1) / 2) * width);
  return { xs, width };
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
};

export function containerColor(c: Container): string {
  if (c.color && CONTAINER_COLORS[c.color]) return CONTAINER_COLORS[c.color];
  return c.type === "Cardboard box" ? "#b59a72" : "#6b7683";
}

/** Drawn size in scene units; suitcases and bags stand up, boxes sit flat. */
export function containerSize(c: Container, scale: number): { w: number; h: number } {
  const w = c.widthCm ?? 40;
  const h = c.heightCm ?? 30;
  const l = c.lengthCm ?? 50;
  return c.type === "Cardboard box"
    ? { w: l * scale, h: h * scale }
    : { w: w * scale, h: l * scale };
}

export interface Group {
  key: string;
  label: string;
  category: string | null;
  items: Item[];
  /** True when several items are stacked into one pile. */
  pile: boolean;
}

const MAX_INDIVIDUAL = 8;

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
