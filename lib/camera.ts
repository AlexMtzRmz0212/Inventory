import { chainTo, type PlaceIndex } from "./places";
import type { Level, Place } from "./types";

/** Camera over the map: center point and visible width, in map units. */
export interface Cam {
  cx: number;
  cy: number;
  w: number;
}

export const WORLD_CAM: Cam = { cx: 500, cy: 250, w: 1000 };

const WIDTH_BY_LEVEL: Record<Level, number> = {
  Continent: 560,
  Country: 300,
  City: 60,
  Site: 14,
  Spot: 14,
};

/**
 * Continents and countries fit what is inside them, within a range. The ranges
 * must stay clear of the zoom thresholds in Stage (continent 280, country 100),
 * so the right pins show: continents 300+, countries 120 to 250.
 */
const FIT_RANGE: Partial<Record<Level, [number, number]>> = {
  Continent: [300, 700],
  Country: [120, 250],
};

/** What a continent or country covers on the map, in map units. */
export interface Frame {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export type Pos = [number, number];

export function camFor(
  place: Place | null,
  positions: Record<string, Pos>,
  frames: Record<string, Frame> = {},
): Cam {
  if (!place) return WORLD_CAM;
  const p = positions[place.id];
  if (!p) return WORLD_CAM;
  const frame = frames[place.id];
  const range = FIT_RANGE[place.level];
  if (frame && range) {
    // The screen is wider than tall, so height counts for more than its raw size.
    const fit = Math.max(frame.w, frame.h * 1.8) * 1.4 + 16;
    return { cx: frame.cx, cy: frame.cy, w: clamp(fit, range[0], range[1]) };
  }
  return { cx: p[0], cy: p[1], w: WIDTH_BY_LEVEL[place.level] };
}

/**
 * How far apart two places are in the hierarchy decides the kind of trip:
 * - zoom: one contains the other (or one is the whole world)
 * - spot: same site, different spot
 * - site: same city, different site
 * - city: same country, different city
 * - country: different countries, same continent
 * - continent: different continents (the longest trip)
 */
export type Tier = "zoom" | "spot" | "site" | "city" | "country" | "continent";

export function travelTier(idx: PlaceIndex, fromId: string | null, toId: string | null): Tier {
  if (fromId === null || toId === null) return "zoom";
  const a = chainTo(idx, fromId);
  const b = chainTo(idx, toId);
  let k = 0;
  while (k < a.length && k < b.length && a[k].id === b[k].id) k++;
  if (k === a.length || k === b.length) return "zoom";
  switch (a[k].level) {
    case "Continent":
      return "continent";
    case "Country":
      return "country";
    case "City":
      return "city";
    case "Site":
      return "site";
    default:
      return "spot";
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Longer trips take longer; the distance term makes a faraway city feel farther than a near one. */
export function flightSeconds(tier: Tier, from: Cam, to: Cam, distance: number): number {
  const far = clamp(distance / 120, 0, 1);
  switch (tier) {
    case "spot":
      return 0.7;
    case "site":
      return 1.5;
    case "city":
      return 2.6 + 1.2 * far;
    case "country":
      return 3.2 + 1.6 * far;
    case "continent":
      return 4.2 + 1.8 * far;
    default:
      return clamp(0.8 + 0.45 * Math.abs(Math.log(from.w / to.w)), 0.8, 3.2);
  }
}

/** How wide the view gets at the middle of a hop, so the move reads as travel. */
export function peakWidth(distance: number, from: Cam, to: Cam): number {
  return clamp(distance * 2.6, Math.max(from.w, to.w) * 1.6, 1000);
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function arcControl(a: Pos, b: Pos): Pos {
  const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
  // Bow the route upward (negative y) so it reads as a flight path.
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - dist * 0.3];
}

export function arcPoint(a: Pos, b: Pos, t: number): Pos {
  const c = arcControl(a, b);
  const u = 1 - t;
  return [
    u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
    u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
  ];
}

export function arcPath(a: Pos, b: Pos): string {
  const c = arcControl(a, b);
  return `M${a[0]} ${a[1]} Q${c[0]} ${c[1]} ${b[0]} ${b[1]}`;
}
