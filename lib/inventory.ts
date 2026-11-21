import "server-only";
import { isOwner } from "./auth";
import { demoInventory } from "./demo-data";
import { getInventory } from "./notion";
import type { Inventory } from "./types";

export interface ViewerInventory {
  inventory: Inventory;
  isPrivate: boolean;
}

/**
 * The only function UI code should call. The owner (valid session cookie) gets
 * the real inventory from Notion. Everyone else gets the invented demo world,
 * so real data is never fetched, filtered or serialized for a visitor.
 */
export async function getViewerInventory(): Promise<ViewerInventory> {
  if (await isOwner()) return { inventory: await getInventory(), isPrivate: true };
  return { inventory: demoInventory, isPrivate: false };
}
