"use server";

import { updateTag } from "next/cache";
import { isOwner } from "@/lib/auth";
import { INVENTORY_TAG } from "@/lib/notion";

/** Owner only: drop the cached copy of the Notion data so the next load reads what is there now. */
export async function refreshInventory(): Promise<{ ok: boolean }> {
  if (!(await isOwner())) return { ok: false };
  updateTag(INVENTORY_TAG);
  return { ok: true };
}
