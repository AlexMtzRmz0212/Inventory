import { artKind, isTransitCard } from "./item-art";
import type { Item } from "./types";

/** Things of one kind that an open container shows stacked in one pile instead of one slot each. */
export interface Pile {
  /** Starts with "pile:", so it can stand in for the pile as an item. */
  id: string;
  label: string;
  kind: "books" | "cards" | "transit" | "library" | "health" | "licences" | "ine" | "passports";
  items: Item[];
}

export const isPileId = (id: string) => id.startsWith("pile:");

const RULES: { kind: Pile["kind"]; label: string; test: (i: Item) => boolean }[] = [
  // Books with no cover picture (a set of manuals, say); ones with a cover stay on their own.
  { kind: "books", label: "Books", test: (i) => artKind(i) === "book" && !i.cover },
  { kind: "cards", label: "Credit and debit cards", test: (i) => artKind(i) === "card" && /credit|debit/i.test(i.name) },
  { kind: "transit", label: "Bus cards", test: isTransitCard },
  { kind: "library", label: "Library and student cards", test: (i) => artKind(i) === "card" && /library|student/i.test(i.name) },
  { kind: "health", label: "Health and dental cards", test: (i) => artKind(i) === "card" && /health|dental/i.test(i.name) },
  { kind: "licences", label: "Driver's licences", test: (i) => artKind(i) === "card" && /driver|licen[cs]e/i.test(i.name) },
  { kind: "ine", label: "INE cards", test: (i) => /\bine\b/i.test(i.name) },
  { kind: "passports", label: "Passports", test: (i) => artKind(i) === "passport" },
];

/** Splits a container's contents into piles (two or more alike) and everything else. */
export function splitPiles(items: Item[]): { piles: Pile[]; others: Item[] } {
  const piles: Pile[] = [];
  const taken = new Set<Item>();
  for (const rule of RULES) {
    const members = items.filter((i) => !taken.has(i) && rule.test(i));
    if (members.length < 2) continue;
    members.forEach((m) => taken.add(m));
    piles.push({ id: `pile:${rule.kind}`, label: rule.label, kind: rule.kind, items: members });
  }
  return { piles, others: items.filter((i) => !taken.has(i)) };
}

/** A stand-in item for a pile, so it takes a slot in the open container like anything else. */
export function pileStub(p: Pile, boxId: string): Item {
  return {
    id: p.id,
    name: p.label,
    category: p.items[0]?.category ?? null,
    status: null,
    fragile: false,
    notes: "",
    locationId: null,
    boxId,
    clothesType: null,
    color: null,
    cover: null,
    tableX: null,
    tableY: null,
    closetSpot: null,
    favorite: false,
  };
}
