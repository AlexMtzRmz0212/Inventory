import type { PlaceIndex } from "./places";
import type { Inventory, Item, LuggageEntry, Place } from "./types";

export interface PackRow {
  entry: LuggageEntry;
  item: Item | null;
  /** Where the real item is right now. */
  place: Place | null;
  /** Accessories that go with this entry. */
  children: PackRow[];
}

export interface PackGroup {
  name: string;
  /** Category of the most common linked item, used for the group icon. */
  category: string | null;
  rows: PackRow[];
  packed: number;
  total: number;
}

export interface Packing {
  groups: PackGroup[];
  packed: number;
  total: number;
}

const GROUP_ORDER = ["Electronics", "Books", "In-use Notebooks", "Tools", "Documents"];

function groupRank(name: string, firstSeen: number): number {
  const i = GROUP_ORDER.indexOf(name);
  return i === -1 ? GROUP_ORDER.length + firstSeen : i;
}

export function buildPacking(inv: Inventory, idx: PlaceIndex): Packing {
  const itemById = new Map(inv.items.map((i) => [i.id, i]));
  const ids = new Set(inv.luggage.map((e) => e.id));

  const rowOf = (entry: LuggageEntry): PackRow => {
    const item = entry.itemId ? (itemById.get(entry.itemId) ?? null) : null;
    return {
      entry,
      item,
      place: item?.locationId ? (idx.byId.get(item.locationId) ?? null) : null,
      children: [],
    };
  };

  const rows = new Map(inv.luggage.map((e) => [e.id, rowOf(e)]));
  const tops: PackRow[] = [];
  for (const row of rows.values()) {
    const parent = row.entry.parentId && ids.has(row.entry.parentId) ? rows.get(row.entry.parentId) : undefined;
    // An accessory sits under its device, whichever group it was filed in.
    if (parent && parent !== row) parent.children.push(row);
    else tops.push(row);
  }

  const byGroup = new Map<string, PackRow[]>();
  for (const row of tops) {
    const name = row.entry.group ?? "Other";
    byGroup.set(name, [...(byGroup.get(name) ?? []), row]);
  }

  const flat = (r: PackRow): PackRow[] => [r, ...r.children.flatMap(flat)];

  const groups = [...byGroup.entries()]
    .map(([name, groupRows], firstSeen) => {
      const all = groupRows.flatMap(flat);
      const counts = new Map<string | null, number>();
      for (const r of all) counts.set(r.item?.category ?? null, (counts.get(r.item?.category ?? null) ?? 0) + 1);
      const category = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return {
        name,
        category,
        rows: groupRows,
        packed: all.filter((r) => r.entry.packed).length,
        total: all.length,
        rank: groupRank(name, firstSeen),
      };
    })
    .sort((a, b) => a.rank - b.rank)
    .map(({ rank, ...g }) => {
      void rank;
      return g;
    });

  return {
    groups,
    packed: groups.reduce((n, g) => n + g.packed, 0),
    total: groups.reduce((n, g) => n + g.total, 0),
  };
}
