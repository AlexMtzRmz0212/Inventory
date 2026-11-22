import { categoryColor } from "./palette";
import type { Item } from "./types";

export type ArtKind =
  | "tee"
  | "teeLong"
  | "polo"
  | "poloLong"
  | "dress"
  | "dressLong"
  | "sweater"
  | "jersey"
  | "vest"
  | "blazer"
  | "jacket"
  | "scarf"
  | "pants"
  | "shorts"
  | "sportShorts"
  | "swim"
  | "cleats"
  | "glove"
  | "batting"
  | "tablet"
  | "sock"
  | "shoe"
  | "boot"
  | "slipper"
  | "sandal"
  | "cap"
  | "book"
  | "spiral"
  | "notebook"
  | "laptop"
  | "coolbase"
  | "watch"
  | "headset"
  | "mask"
  | "strips"
  | "keyboard"
  | "mouse"
  | "controller"
  | "console"
  | "device"
  | "camera"
  | "drive"
  | "hub"
  | "charger"
  | "laptopcharger"
  | "phone"
  | "tv"
  | "monitor"
  | "kindle"
  | "earbuds"
  | "thermometer"
  | "lamp"
  | "scratcher"
  | "cube"
  | "megaminx"
  | "mug"
  | "bottle"
  | "folder"
  | "stool"
  | "deskparts"
  | "box";

type ItemLike = Pick<Item, "name" | "category"> & Partial<Pick<Item, "clothesType" | "color" | "cover" | "notes">>;

/** Name hints, checked in order: the most specific first ("Laptop charger" is a charger, not a laptop). */
const BY_NAME: [RegExp, ArtKind][] = [
  [/controller|gamepad|joystick/i, "controller"],
  [/keyboard/i, "keyboard"],
  [/\bmouse\b/i, "mouse"],
  [/\bps[2-5]\b|playstation|xbox|console/i, "console"],
  [/camera/i, "camera"],
  [/hard drive|\bdrive\b|\bssd\b|\bhdd\b/i, "drive"],
  [/\bhub\b/i, "hub"],
  [/headset|headphone/i, "headset"],
  [/earbud|earphone|airpod/i, "earbuds"],
  [/\bwatch\b(?!.*charger)/i, "watch"],
  [/eye mask|sleep mask/i, "mask"],
  [/nose strip/i, "strips"],
  [/kindle|e-?reader/i, "kindle"],
  [/thermometer/i, "thermometer"],
  [/\blamp\b|\b(desk|clamp|floor|reading) light\b/i, "lamp"],
  [/scratcher/i, "scratcher"],
  [/(laptop|victus).*charger/i, "laptopcharger"],
  [/charger|cable|adapter|power cord/i, "charger"],
  [/\btv\b|television/i, "tv"],
  [/monitor|display/i, "monitor"],
  [/cooling base|laptop cooler/i, "coolbase"],
  [/tablet|\btab a\d/i, "tablet"],
  [/laptop|\bscreen\b/i, "laptop"],
  [/megaminx|dodecahedron/i, "megaminx"],
  [/\bcube\b/i, "cube"],
  [/\b(phone|iphone|poco|pixel|redmi)\b/i, "phone"],
  [/batting glove/i, "batting"],
  [/glove|mitt/i, "glove"],
  [/notebook|journal/i, "notebook"],
  [/slipper|pantufla/i, "slipper"],
  [/teva|sandal|flip.?flop/i, "sandal"],
  [/\bboots?\b/i, "boot"],
  [/cleats?/i, "cleats"],
  [/shoe|sneaker|\bvans\b/i, "shoe"],
  [/\b(cap|caps|hat|beanie)\b/i, "cap"],
  [/\bsocks?\b/i, "sock"],
  [/trunks|swim/i, "swim"],
  [/\bshorts\b/i, "shorts"],
  [/pants|jeans|trousers|chino|sweatpants|leggings/i, "pants"],
  [/\bvest\b/i, "vest"],
  [/blazer|sport coat/i, "blazer"],
  [/coat|jacket|hoodie|parka/i, "jacket"],
  [/scarf/i, "scarf"],
  [/jersey/i, "jersey"],
  [/sweater|sweatshirt/i, "sweater"],
  [/\bpolo\b/i, "polo"],
  [/dress shirt/i, "dress"],
  [/mug|cup|teapot|tea set|coffee/i, "mug"],
  [/bottle|toiletr|shampoo|lotion|sunscreen/i, "bottle"],
  [/folder|document|passport|ticket|boarding/i, "folder"],
];

const BY_CATEGORY: Record<string, ArtKind> = {
  Clothes: "tee",
  Electronics: "device",
  Books: "book",
  Documents: "folder",
  Furniture: "stool",
  Kitchen: "mug",
  Toiletries: "bottle",
  Misc: "box",
};

const isLong = (item: ItemLike) =>
  /long[- ]sleeve/i.test(item.name) || /long sleeves/i.test(item.clothesType ?? "");

/** The shirt-family kinds come in a short- and a long-sleeved drawing. */
function sleeved(kind: ArtKind, long: boolean): ArtKind {
  if (kind === "tee") return long ? "teeLong" : "tee";
  if (kind === "polo") return long ? "poloLong" : "polo";
  if (kind === "dress") return long ? "dressLong" : "dress";
  return kind;
}

/** What Notion's own "Clothes type" says, for clothes whose name gives no hint. */
function byClothesType(type: string): ArtKind | null {
  if (/shorts|bathing/i.test(type)) return "shorts";
  if (/pants|denim|chino|cargo/i.test(type)) return "pants";
  if (/elegant casual/i.test(type)) return "dress";
  if (/sleeves/i.test(type)) return "tee";
  return null;
}

/** Gym and sweat shorts versus everyday ones. */
const isSport = (item: ItemLike) => /sport|athletic|sweat|active|running/i.test(`${item.name} ${item.clothesType ?? ""}`);

export function artKind(item: ItemLike): ArtKind {
  if (item.category === "Furniture" && /desk|table/i.test(item.name) && /disassembled/i.test(item.notes ?? "")) {
    return "deskparts";
  }
  if (/spiral|comb[- ]bound/i.test(item.notes ?? "")) return "spiral";
  for (const [re, kind] of BY_NAME) {
    if (re.test(item.name)) return kind === "shorts" && isSport(item) ? "sportShorts" : sleeved(kind, isLong(item));
  }
  if (item.category === "Clothes" && item.clothesType) {
    const kind = byClothesType(item.clothesType);
    if (kind) return kind === "shorts" && isSport(item) ? "sportShorts" : sleeved(kind, isLong(item));
  }
  const kind = (item.category && BY_CATEGORY[item.category]) || "box";
  return sleeved(kind, isLong(item));
}

/** Colors that read on the dark room and backdrop; "black" is a mid gray so it and its outline both show. */
const COLOR_WORDS: [string, string][] = [
  ["black", "#6b7683"],
  ["light brown", "#b98a5a"],
  ["taupe", "#6f655c"],
  ["white", "#eef2f5"],
  ["gray", "#9aa7b5"],
  ["grey", "#9aa7b5"],
  ["navy", "#2f4f8f"],
  ["blue", "#3f7fe0"],
  ["red", "#e0584d"],
  ["green", "#3fae6a"],
  ["olive", "#8a8f3c"],
  ["teal", "#2fbfb0"],
  ["pink", "#ef8fc0"],
  ["yellow", "#e8c547"],
  ["brown", "#9a6b43"],
  ["beige", "#d8c3a0"],
  ["orange", "#f58e4b"],
  ["purple", "#a47cf5"],
];

/** The color words in the text, in the order they appear ("Blue and black vest" is blue, then black). */
function colorsIn(text: string): string[] {
  // "Old Navy" is a brand, not a color.
  const lower = text.toLowerCase().replace(/old navy/g, "");
  const found: { at: number; hex: string }[] = [];
  for (const [word, hex] of COLOR_WORDS) {
    const at = lower.search(new RegExp(`\\b${word}\\b`));
    if (at >= 0) found.push({ at, hex });
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.hex);
}

const firstColor = (text: string): string | null => colorsIn(text)[0] ?? null;

/** Consoles are dark unless a color says otherwise. */
const KIND_DEFAULT: Partial<Record<ArtKind, string>> = {
  console: "#4b5568",
  tv: "#4b5568",
  monitor: "#4b5568",
  laptop: "#8a96a6",
  controller: "#4b5568",
  camera: "#4b5568",
  cleats: "#4b5568",
  coolbase: "#8fa3b8",
  tablet: "#4b5568",
  mouse: "#6b7683",
  keyboard: "#4b5568",
};

/** The color field wins, then a color word in the name, then what that kind of thing usually is. */
export function itemTint(item: ItemLike): string {
  const kind = artKind(item);
  return (
    (item.color && firstColor(item.color)) ||
    firstColor(item.name) ||
    KIND_DEFAULT[kind] ||
    categoryColor(item.category)
  );
}

export interface ArtSpec {
  kind: ArtKind;
  fill: string;
  /** Cubes: how many stickers along an edge. */
  grid: number;
  /** Cubes: the sticker scheme. */
  scheme: "classic" | "phantom" | "mirror";
  /** A book's cover image, if it has one. */
  cover: string | null;
  /** A second color, when the color field names two ("white and red"). */
  accent: string | null;
  /** A printed pattern for a cover that has no image. */
  pattern: "sudoku" | "palm" | null;
}

export function artOf(item: ItemLike): ArtSpec {
  const n = /(\d)\s*x\s*\d/i.exec(item.name);
  const fields = colorsIn(item.color ?? "");
  return {
    kind: artKind(item),
    fill: itemTint(item),
    accent: fields[1] ?? null,
    pattern: /sudoku/i.test(item.name) ? "sudoku" : /palm/i.test(`${item.name} ${item.notes ?? ""}`) ? "palm" : null,
    grid: n ? Math.min(5, Math.max(2, Number(n[1]))) : 3,
    scheme: /phantom/i.test(item.name) ? "phantom" : /mirror/i.test(item.name) ? "mirror" : "classic",
    cover: item.cover ?? null,
  };
}

/** Items in an order that groups like things: by category, then by what kind of thing they are, then by name. */
export function groupedItems<T extends ItemLike>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      (a.category ?? "").localeCompare(b.category ?? "") ||
      artKind(a).localeCompare(artKind(b)) ||
      a.name.localeCompare(b.name),
  );
}
