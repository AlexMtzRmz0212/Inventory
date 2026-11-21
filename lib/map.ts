import { geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import { atlasName, countryColor } from "./country-colors";
import type { Frame } from "./camera";
import { chainTo, countryOrder, indexPlaces } from "./places";
import type { Place } from "./types";

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 500;
/** Distance (map units) between a city pin and the site pins around it. */
const SITE_RING = 5;

export interface MapCountry {
  name: string;
  d: string;
  /** Set when there is inventory in this country. */
  color: string | null;
}

export interface MapData {
  sphere: string;
  graticule: string;
  countries: MapCountry[];
  /** Pin position per place id, in map units. */
  positions: Record<string, [number, number]>;
  /** Box the camera should fit for each continent and country, in map units. */
  frames: Record<string, Frame>;
  /** Room color per place id: the color of the country it is in. */
  tints: Record<string, string>;
}

const projection = geoNaturalEarth1().fitSize([MAP_WIDTH, MAP_HEIGHT], {
  type: "Sphere",
});
const toPath = geoPath(projection).digits(1);

const topology = world as unknown as Topology;
const countryFeatures = feature(
  topology,
  topology.objects.countries as GeometryCollection<{ name: string }>,
).features;

export function project(lat: number, lng: number): [number, number] {
  return projection([lng, lat]) ?? [MAP_WIDTH / 2, MAP_HEIGHT / 2];
}

function computePositions(places: Place[]): Record<string, [number, number]> {
  const idx = indexPlaces(places);
  const pos: Record<string, [number, number]> = {};

  for (const p of places) {
    if (p.lat !== null && p.lng !== null) pos[p.id] = project(p.lat, p.lng);
  }

  const place = (parent: Place) => {
    const origin = pos[parent.id];
    const kids = idx.children.get(parent.id) ?? [];
    const unplaced = kids.filter((k) => !pos[k.id]);
    const rooms = unplaced.filter((k) => k.level !== "Spot");
    rooms.forEach((k, i) => {
      if (!origin) return;
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / rooms.length;
      pos[k.id] = [
        origin[0] + Math.cos(angle) * SITE_RING,
        origin[1] + Math.sin(angle) * SITE_RING,
      ];
    });
    for (const k of unplaced) if (k.level === "Spot" && origin) pos[k.id] = origin;
    for (const k of kids) place(k);
  };
  for (const r of idx.roots) place(r);

  return pos;
}

type Box = [number, number, number, number];

const unionBox = (a: Box | null, b: Box | null): Box | null =>
  !a ? b : !b ? a : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];

const pointBox = (p: [number, number]): Box => [p[0], p[1], p[0], p[1]];

/**
 * Land box of a country: its main landmass plus any sizeable islands, so
 * Alaska-sized pieces count but a far-off speck does not stretch the view.
 */
function landBox(name: string): Box | null {
  const f = countryFeatures.find((c) => c.properties.name === name);
  if (!f) return null;
  const g = f.geometry;
  const parts =
    g.type === "MultiPolygon"
      ? g.coordinates.map((coordinates) => ({ type: "Polygon" as const, coordinates }))
      : g.type === "Polygon"
        ? [g]
        : [];
  const measured = parts.map((part) => {
    const [[x0, y0], [x1, y1]] = toPath.bounds(part);
    return { area: toPath.area(part), box: [x0, y0, x1, y1] as Box };
  });
  const biggest = Math.max(0, ...measured.map((m) => m.area));
  return measured
    .filter((m) => m.area >= biggest * 0.15)
    .reduce<Box | null>((acc, m) => unionBox(acc, m.box), null);
}

/** What each continent and country needs the camera to show, in map units. */
function computeFrames(places: Place[], pos: Record<string, [number, number]>): Record<string, Frame> {
  const idx = indexPlaces(places);
  const boxes = new Map<string, Box>();

  const boxOf = (p: Place): Box | null => {
    let box: Box | null = pos[p.id] ? pointBox(pos[p.id]) : null;
    if (p.level === "Country") box = unionBox(box, landBox(atlasName(p.name)));
    for (const k of idx.children.get(p.id) ?? []) box = unionBox(box, boxOf(k));
    if (box && (p.level === "Continent" || p.level === "Country")) boxes.set(p.id, box);
    return box;
  };
  for (const r of idx.roots) boxOf(r);

  const frames: Record<string, Frame> = {};
  for (const [id, [x0, y0, x1, y1]] of boxes) {
    frames[id] = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
  }
  return frames;
}

function computeTints(places: Place[]): Record<string, string> {
  const idx = indexPlaces(places);
  const tints: Record<string, string> = {};
  for (const p of places) {
    const country = chainTo(idx, p.id).find((c) => c.level === "Country");
    if (country) tints[p.id] = countryColor(countryOrder(places, country.id));
  }
  return tints;
}

export function buildMapData(places: Place[]): MapData {
  const positions = computePositions(places);
  const colorByAtlasName = new Map<string, string>();
  for (const c of places.filter((p) => p.level === "Country")) {
    colorByAtlasName.set(atlasName(c.name), countryColor(countryOrder(places, c.id)));
  }

  return {
    sphere: toPath({ type: "Sphere" }) ?? "",
    graticule: toPath(geoGraticule10()) ?? "",
    countries: countryFeatures.map((f) => ({
      name: f.properties.name,
      d: toPath(f) ?? "",
      color: colorByAtlasName.get(f.properties.name) ?? null,
    })),
    positions,
    frames: computeFrames(places, positions),
    tints: computeTints(places),
  };
}
