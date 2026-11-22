import "server-only";
import { Client } from "@notionhq/client";
import { cacheLife, cacheTag } from "next/cache";
import { demoInventory } from "./demo-data";
import type {
  Container,
  Inventory,
  Item,
  Level,
  Place,
  SceneKey,
} from "./types";

/** Cache tag a write must expire so the owner sees their own change. */
export const INVENTORY_TAG = "inventory";

interface RawProp {
  type: string;
  title?: { plain_text: string }[];
  rich_text?: { plain_text: string }[];
  select?: { name: string } | null;
  status?: { name: string } | null;
  number?: number | null;
  checkbox?: boolean;
  relation?: { id: string }[];
  url?: string | null;
  formula?: { type: string; number?: number | null };
}

interface RawPage {
  id: string;
  properties: Record<string, RawProp | undefined>;
}

const text = (p?: RawProp): string =>
  (p?.title ?? p?.rich_text ?? []).map((t) => t.plain_text).join("");
const select = (p?: RawProp): string | null =>
  p?.select?.name ?? p?.status?.name ?? null;
const num = (p?: RawProp): number | null => p?.number ?? null;
const firstRelation = (p?: RawProp): string | null => p?.relation?.[0]?.id ?? null;

async function queryAll(dataSourceId: string): Promise<RawPage[]> {
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const pages: RawPage[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const r of res.results) {
      if (r.object === "page" && "properties" in r) {
        pages.push({
          id: r.id,
          properties: r.properties as unknown as RawPage["properties"],
        });
      }
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return pages;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

/**
 * Full inventory (public + private). Never send the result of this to the
 * browser directly: go through `getViewerInventory` in lib/inventory.ts.
 */
export async function getInventory(): Promise<Inventory> {
  "use cache";
  cacheLife("minutes");
  cacheTag(INVENTORY_TAG);

  if (!process.env.NOTION_TOKEN) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NOTION_TOKEN is not set");
    }
    return demoInventory;
  }

  const [locationPages, itemPages, boxPages] = await Promise.all([
    queryAll(requireEnv("NOTION_LOCATIONS_DS")),
    queryAll(requireEnv("NOTION_ITEMS_DS")),
    queryAll(requireEnv("NOTION_BOXES_DS")),
  ]);

  const places: Place[] = locationPages.map((p) => ({
    id: p.id,
    name: text(p.properties.Name),
    level: (select(p.properties.Level) ?? "Spot") as Level,
    lat: num(p.properties.Lat),
    lng: num(p.properties.Lng),
    scene: (select(p.properties.Scene) ?? "generic") as SceneKey,
    parentId: firstRelation(p.properties.Parent),
  }));

  const items: Item[] = itemPages.map((p) => ({
    id: p.id,
    name: text(p.properties.Item),
    category: select(p.properties.Category),
    status: select(p.properties.Status),
    fragile: p.properties.Fragile?.checkbox ?? false,
    notes: text(p.properties.Notes),
    locationId: firstRelation(p.properties.Location),
    boxId: firstRelation(p.properties.Box),
    clothesType: select(p.properties["Clothes type"]),
    color: text(p.properties.Color).trim() || null,
    cover: p.properties.Cover?.url || null,
  }));

  const containers: Container[] = boxPages.map((p) => ({
    id: p.id,
    name: text(p.properties.Name),
    type: select(p.properties.Type),
    color: select(p.properties.Color),
    owner: select(p.properties.Owner),
    widthCm: num(p.properties["Width (cm)"]),
    heightCm: num(p.properties["Height (cm)"]),
    lengthCm: num(p.properties["Length (cm)"]),
    volumeL: p.properties["Volume (L)"]?.formula?.number ?? null,
    filled: p.properties["Has contents"]?.checkbox ?? false,
    locationId: firstRelation(p.properties.Location),
  }));

  return { places, items, containers };
}
