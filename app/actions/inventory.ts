"use server";

import { updateTag } from "next/cache";
import { isOwner } from "@/lib/auth";
import { INVENTORY_TAG, getInventory, setTableSpot } from "@/lib/notion";
import { furnitureKind, underDesk } from "@/lib/scene";
import type { Inventory } from "@/lib/types";

/** Owner only: drop the cached copy of the Notion data so the next load reads what is there now. */
export async function refreshInventory(): Promise<{ ok: boolean }> {
  if (!(await isOwner())) return { ok: false };
  updateTag(INVENTORY_TAG);
  return { ok: true };
}

const spot = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;

/** Both numbers (a pin) or both null (let it go); nothing else makes sense. */
function validSpot(x: unknown, y: unknown): boolean {
  if (x === null || y === null) return x === null && y === null;
  return typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y);
}

/**
 * Whether a thing is loose on the top of a desk, the only place it may be pinned. Inside a box, or
 * under the desk, is a different level from the desk top, and so is any other piece of furniture.
 */
function onDeskTop(inv: Inventory, kind: "item" | "container", id: string): boolean {
  if ((kind !== "item" && kind !== "container") || typeof id !== "string") return false;
  const thing = kind === "item" ? inv.items.find((i) => i.id === id) : inv.containers.find((c) => c.id === id);
  if (!thing || !thing.locationId) return false;
  const place = inv.places.find((p) => p.id === thing.locationId);
  if (!place || place.level !== "Spot" || furnitureKind(place.name) !== "desk") return false;
  if ("boxId" in thing && thing.boxId) return false;
  return !underDesk(thing);
}

/**
 * Owner only: pin a thing to a spot on the desk it is on (x, y in 0 to 100), or unpin it with
 * null, null so it goes back to being placed automatically.
 *
 * This only ever changes where it sits on that desk. There is no location or box to give, so a
 * thing cannot be moved up or down a level (into a box, to another piece of furniture, or onto
 * the floor), and one that is not loose on a desk top is refused.
 */
export async function setDeskSpot(
  kind: "item" | "container",
  id: string,
  x: number | null,
  y: number | null,
): Promise<{ ok: boolean; persisted: boolean }> {
  const no = { ok: false, persisted: false };
  if (!(await isOwner())) return no;
  if (!validSpot(x, y)) return no;
  if (!onDeskTop(await getInventory(), kind, id)) return no;

  const pin = x !== null && y !== null;
  const persisted = await setTableSpot(id, pin ? spot(x) : null, pin ? spot(y) : null);
  updateTag(INVENTORY_TAG);
  return { ok: true, persisted };
}

/** Most things changed in one go: far more than fits on a desk, and a bound on the writes one call can make. */
const MAX_BATCH = 60;

/**
 * Owner only: pin or unpin several things on desks at once (the same rules as `setDeskSpot` for
 * each). They are written one after another to stay under what Notion allows, and the ones that
 * were refused or failed are named so the page can put them back.
 */
export async function setDeskSpots(
  edits: { kind: "item" | "container"; id: string; x: number | null; y: number | null }[],
): Promise<{ ok: boolean; failed: string[] }> {
  if (!(await isOwner()) || !Array.isArray(edits) || edits.length > MAX_BATCH) {
    return { ok: false, failed: Array.isArray(edits) ? edits.map((e) => e?.id).filter((id) => typeof id === "string") : [] };
  }
  const inv = await getInventory();
  const failed: string[] = [];
  const seen = new Set<string>();
  for (const e of edits) {
    const id = e?.id;
    if (typeof id !== "string") continue;
    // A thing is written once; a repeat is skipped.
    if (seen.has(id)) continue;
    seen.add(id);
    if (!validSpot(e.x, e.y) || !onDeskTop(inv, e.kind, id)) {
      failed.push(id);
      continue;
    }
    const pin = e.x !== null && e.y !== null;
    try {
      await setTableSpot(id, pin ? spot(e.x as number) : null, pin ? spot(e.y as number) : null);
    } catch {
      failed.push(id);
    }
  }
  updateTag(INVENTORY_TAG);
  return { ok: failed.length === 0, failed };
}
