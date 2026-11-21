import type { Container, Inventory, Item, LuggageEntry, Place } from "./types";

/**
 * The world visitors see: invented places and generic things, same shape as the
 * real inventory. Nothing here comes from Notion, and nothing here describes
 * the owner's real belongings or where they are. Also the dev fallback when
 * NOTION_TOKEN is not set.
 */
const places: Place[] = [
  { id: "europe", name: "Europe", level: "Continent", lat: 50, lng: 12, scene: "generic", parentId: null },
  { id: "asia", name: "Asia", level: "Continent", lat: 36, lng: 95, scene: "generic", parentId: null },
  { id: "portugal", name: "Portugal", level: "Country", lat: 39.6, lng: -8, scene: "generic", parentId: "europe" },
  { id: "japan", name: "Japan", level: "Country", lat: 36.2, lng: 138.2, scene: "generic", parentId: "asia" },
  { id: "lisbon", name: "Lisbon", level: "City", lat: 38.72, lng: -9.14, scene: "generic", parentId: "portugal" },
  { id: "osaka", name: "Osaka", level: "City", lat: 34.69, lng: 135.5, scene: "generic", parentId: "japan" },
  { id: "apartment", name: "Apartment", level: "Site", lat: null, lng: null, scene: "apartment", parentId: "lisbon" },
  { id: "storage", name: "Storage unit", level: "Site", lat: null, lng: null, scene: "storage-unit", parentId: "lisbon" },
  { id: "studio", name: "Studio", level: "Site", lat: null, lng: null, scene: "apartment", parentId: "osaka" },
  { id: "desk", name: "Desk", level: "Spot", lat: null, lng: null, scene: "apartment", parentId: "apartment" },
  { id: "closet", name: "Closet", level: "Spot", lat: null, lng: null, scene: "apartment", parentId: "apartment" },
  { id: "shelf", name: "Shelf", level: "Spot", lat: null, lng: null, scene: "storage-unit", parentId: "storage" },
  { id: "crate", name: "Crate", level: "Spot", lat: null, lng: null, scene: "storage-unit", parentId: "storage" },
  { id: "studio-desk", name: "Desk", level: "Spot", lat: null, lng: null, scene: "apartment", parentId: "studio" },
  { id: "studio-shelf", name: "Shelf", level: "Spot", lat: null, lng: null, scene: "apartment", parentId: "studio" },
];

const item = (
  id: string,
  name: string,
  category: string,
  locationId: string,
  extra: Partial<Item> = {},
): Item => ({
  id,
  name,
  category,
  status: "Packed",
  fragile: false,
  notes: "",
  locationId,
  boxId: null,
  ...extra,
});

const items: Item[] = [
  // Apartment (floor)
  item("armchair", "Armchair", "Furniture", "apartment"),
  item("floor-lamp", "Floor lamp", "Furniture", "apartment", { fragile: true }),
  // Apartment desk
  item("laptop", "Laptop", "Electronics", "desk", { fragile: true }),
  item("laptop-charger", "Laptop charger", "Electronics", "desk"),
  item("headphones", "Headphones", "Electronics", "desk"),
  item("notebook", "Notebook", "Misc", "desk"),
  item("puzzle-cube", "Puzzle cube", "Misc", "desk"),
  item("pen-set", "Pen set", "Misc", "desk"),
  // Apartment closet
  item("winter-coat", "Winter coat", "Clothes", "closet"),
  item("jeans", "Jeans (x3)", "Clothes", "closet"),
  item("sneakers", "Sneakers", "Clothes", "closet"),
  item("dress-shirt", "Dress shirt", "Clothes", "closet"),
  item("rain-jacket", "Rain jacket", "Clothes", "closet"),
  item("scarf", "Scarf", "Clothes", "closet"),
  item("sweaters", "Sweaters (x4)", "Clothes", "closet"),
  item("hat", "Hat", "Clothes", "closet"),
  item("boots", "Boots", "Clothes", "closet"),
  item("blanket", "Spare blanket", "Misc", "closet"),
  // Storage unit (floor)
  item("folding-table", "Folding table", "Furniture", "storage"),
  item("kitchenware", "Boxed kitchenware", "Kitchen", "storage", { fragile: true }),
  item("coffee-maker", "Coffee maker", "Kitchen", "storage"),
  item("old-monitor", "Old monitor", "Electronics", "storage", { fragile: true }),
  // Storage shelf
  item("novel", "Detective novel", "Books", "shelf"),
  item("scifi", "Sci-fi paperback", "Books", "shelf"),
  item("cookbook", "Cookbook", "Books", "shelf"),
  item("history", "History book", "Books", "shelf"),
  item("poetry", "Poetry collection", "Books", "shelf"),
  item("travel-guide", "Travel guide", "Books", "shelf"),
  item("comic", "Comic book", "Books", "shelf"),
  item("dictionary", "Dictionary", "Books", "shelf"),
  item("art-book", "Art book", "Books", "shelf"),
  item("biography", "Biography", "Books", "shelf"),
  item("board-game", "Board game", "Misc", "shelf"),
  // Storage crate
  item("camp-stove", "Camping stove", "Kitchen", "crate"),
  item("tent", "Tent", "Misc", "crate"),
  item("sleeping-bag", "Sleeping bag", "Misc", "crate"),
  // Studio (floor)
  item("futon", "Futon", "Furniture", "studio"),
  item("folding-bike", "Folding bike", "Misc", "studio"),
  // Studio desk
  item("tablet", "Tablet", "Electronics", "studio-desk", { fragile: true }),
  item("camera", "Camera", "Electronics", "studio-desk", { fragile: true }),
  item("charger", "Charger", "Electronics", "studio-desk"),
  item("documents", "Folder of documents", "Documents", "studio-desk"),
  item("sketchbook", "Sketchbook", "Misc", "studio-desk"),
  // Studio shelf
  item("tea-set", "Tea set", "Kitchen", "studio-shelf", { fragile: true }),
  item("toiletry-bag", "Toiletry bag", "Toiletries", "studio-shelf"),
  item("towels", "Towels (x3)", "Toiletries", "studio-shelf"),
  item("mug", "Mug", "Kitchen", "studio-shelf", { fragile: true }),
];

const box = (
  id: string,
  name: string,
  type: string,
  color: string | null,
  w: number,
  h: number,
  l: number,
  locationId: string,
): Container => ({
  id,
  name,
  type,
  color,
  owner: "Me",
  widthCm: w,
  heightCm: h,
  lengthCm: l,
  volumeL: Math.round((w * h * l) / 100) / 10,
  locationId,
});

const containers: Container[] = [
  box("suitcase-teal", "Suitcase", "Suitcase", "Teal", 44, 28, 62, "storage"),
  box("suitcase-black", "Large suitcase", "Suitcase", "Black", 45, 30, 68, "storage"),
  box("box-closet", "Cardboard box", "Cardboard box", null, 45, 13, 44, "closet"),
  box("box-storage", "Cardboard box", "Cardboard box", null, 39, 24, 48, "storage"),
  box("carry-on", "Carry-on", "Suitcase", "Brown", 36, 23, 55, "studio"),
];

const entry = (
  id: string,
  name: string,
  group: string,
  itemId: string,
  packed = false,
  parentId: string | null = null,
): LuggageEntry => ({ id, name, group, packed, itemId, parentId });

const luggage: LuggageEntry[] = [
  entry("l-laptop", "Laptop", "Electronics", "laptop", true),
  entry("l-laptop-charger", "Laptop charger", "Electronics", "laptop-charger", true, "l-laptop"),
  entry("l-headphones", "Headphones", "Electronics", "headphones", true),
  entry("l-tablet", "Tablet", "Electronics", "tablet", true),
  entry("l-camera", "Camera", "Electronics", "camera", true),
  entry("l-novel", "Detective novel", "Books", "novel"),
  entry("l-cookbook", "Cookbook", "Books", "cookbook"),
  entry("l-coat", "Winter coat", "Clothes", "winter-coat"),
  entry("l-documents", "Folder of documents", "Documents", "documents"),
];

export const demoInventory: Inventory = { places, items, containers, luggage };
