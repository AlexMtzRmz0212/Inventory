import type { Inventory, Item, Place } from "./types";

export interface PlaceIndex {
  byId: Map<string, Place>;
  children: Map<string, Place[]>;
  roots: Place[];
}

export function indexPlaces(places: Place[]): PlaceIndex {
  const byId = new Map(places.map((p) => [p.id, p]));
  const children = new Map<string, Place[]>();
  const roots: Place[] = [];
  for (const p of places) {
    if (p.parentId && byId.has(p.parentId)) {
      const list = children.get(p.parentId) ?? [];
      list.push(p);
      children.set(p.parentId, list);
    } else {
      roots.push(p);
    }
  }
  for (const list of children.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  roots.sort((a, b) => a.name.localeCompare(b.name));
  return { byId, children, roots };
}

/** Stable position of a country among all countries, used to pick its fallback color. */
export function countryOrder(places: Place[], countryId: string): number {
  const ids = places
    .filter((p) => p.level === "Country")
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => p.id);
  return Math.max(ids.indexOf(countryId), 0);
}

/** Root-first chain ending at the place itself. */
export function chainTo(idx: PlaceIndex, id: string | null): Place[] {
  const out: Place[] = [];
  let cur = id ? idx.byId.get(id) : undefined;
  while (cur) {
    out.unshift(cur);
    cur = cur.parentId ? idx.byId.get(cur.parentId) : undefined;
  }
  return out;
}

export function countryOf(idx: PlaceIndex, id: string | null): Place | null {
  return chainTo(idx, id)[0] ?? null;
}

/** The place and every place below it. */
export function subtreeIds(idx: PlaceIndex, id: string): Set<string> {
  const out = new Set<string>();
  const walk = (pid: string) => {
    out.add(pid);
    for (const c of idx.children.get(pid) ?? []) walk(c.id);
  };
  walk(id);
  return out;
}

export function itemsIn(inv: Inventory, idx: PlaceIndex, id: string | null): Item[] {
  if (id === null) return inv.items;
  const ids = subtreeIds(idx, id);
  return inv.items.filter((i) => i.locationId && ids.has(i.locationId));
}

export function countByCategory(items: Item[]): { category: string | null; count: number }[] {
  const m = new Map<string | null, number>();
  for (const i of items) m.set(i.category, (m.get(i.category) ?? 0) + 1);
  return [...m.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}
