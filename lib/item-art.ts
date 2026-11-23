import { billColor, billOf, type Bill } from "./cash";
import { categoryColor } from "./palette";
import type { Item } from "./types";

export type ArtKind =
  | "bill"
  | "card"
  | "keychain"
  | "hdmi"
  | "usbcable"
  | "knife"
  | "hammer"
  | "piano"
  | "lego"
  | "streamer"
  | "bedding"
  | "pillow"
  | "passport"
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
  [/^\s*\d+\s*(cad|usd|mxn|eur)\s*bills?\b/i, "bill"],
  [/key ?chain|key ?ring/i, "keychain"],
  [/hdmi/i, "hdmi"],
  // Any other cable (USB, HDD, ...) is drawn as its two ends, not as a charger.
  [/\bcable\b/i, "usbcable"],
  [/knife/i, "knife"],
  [/hammer/i, "hammer"],
  [/piano/i, "piano"],
  [/lego/i, "lego"],
  [/roku|chromecast|fire ?stick/i, "streamer"],
  [/duvet|blanket|bedsheet|comforter|quilt/i, "bedding"],
  [/pillow/i, "pillow"],
  [/passport/i, "passport"],
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
  // Bank, transit and ID cards and licences. Not the kind that goes in a reader.
  [/\bcard\b(?!\s*reader)|licen[cs]e|\bine\b|\bus visa\b/i, "card"],
  [/folder|document|passport|ticket|boarding/i, "folder"],
];

/** Cards with a photo and lines of text (IDs, licences, visas, health and library cards) versus bank and transit cards with a chip. */
const ID_CARD = /licen[cs]e|\bine\b|\bvisa\b|health|student|dental|library|\bid\b/i;

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
  ["light green", "#9fe0b0"],
  ["lime green", "#a6e22e"],
  ["lime", "#a6e22e"],
  ["dark green", "#1f7a4d"],
  ["light blue", "#bfe3fa"],
  ["dark blue", "#2f56b0"],
  ["fluorescent green", "#39f06a"],
  ["dark yellow", "#c79a1e"],
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
  let lower = text.toLowerCase().replace(/old navy/g, "");
  const found: { at: number; hex: string }[] = [];
  // Longest names first, blanking each match, so "light green" is not also read as "green".
  for (const [word, hex] of [...COLOR_WORDS].sort((a, b) => b[0].length - a[0].length)) {
    const at = lower.search(new RegExp(`\\b${word}\\b`));
    if (at < 0) continue;
    found.push({ at, hex });
    lower = lower.slice(0, at) + " ".repeat(word.length) + lower.slice(at + word.length);
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
  card: "#8a96a6",
  keychain: "#d9b45a",
  hdmi: "#3f4857",
  usbcable: "#4b5568",
  knife: "#3b4351",
  hammer: "#3b4351",
  piano: "#3b4351",
  lego: "#e0584d",
  streamer: "#7a4fd1",
  bedding: "#9aa7b5",
  pillow: "#eef2f5",
  passport: "#1e5b3a",
};

/** The color field wins, then a color word in the name, then what that kind of thing usually is. Bills are the color of the real note. */
export function itemTint(item: ItemLike): string {
  const bill = billOf(item);
  if (bill) return billColor(bill);
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
  /** Bills: which note this is, for its color and the number on it. */
  bill: Bill | null;
  /** Cards: with a photo (ID) or with a chip (bank, transit). */
  card: "id" | "bank" | null;
  /** Cables: both ends USB-C ("cc") or a USB-A end and a USB-C end ("ac"). */
  cable: "ac" | "cc" | null;
  /** Cables: the color inside the USB-A plug, from "(blue port)" in the name. */
  port: string | null;
  /** Pillows: a pair, from "(x2)" in the name. */
  pair: boolean;
}

const PORT_COLORS: Record<string, string> = {
  white: "#eef2f5",
  blue: "#3f7fe0",
  orange: "#f58e4b",
  black: "#3b4351",
  red: "#e0584d",
  green: "#3fae6a",
};

/** The drawing of one bill of this denomination. */
export function billSpec(b: Pick<Bill, "currency" | "denom">): ArtSpec {
  return {
    kind: "bill",
    fill: billColor(b),
    grid: 3,
    scheme: "classic",
    cover: null,
    accent: null,
    pattern: null,
    bill: { ...b, count: 1 },
    card: null,
    cable: null,
    port: null,
    pair: false,
  };
}

export function artOf(item: ItemLike): ArtSpec {
  const n = /(\d)\s*x\s*\d/i.exec(item.name);
  const fields = colorsIn(item.color ?? "");
  const kind = artKind(item);
  return {
    kind,
    bill: kind === "bill" ? billOf(item) : null,
    card: kind === "card" ? (ID_CARD.test(item.name) ? "id" : "bank") : null,
    pair: kind === "pillow" && /x2|two|pair/i.test(item.name),
    cable: kind === "usbcable" ? (/\bc[- ]?(to|-)[- ]?c\b/i.test(item.name) ? "cc" : "ac") : null,
    port: PORT_COLORS[/\b(\w+) port\b/i.exec(item.name)?.[1]?.toLowerCase() ?? ""] ?? null,
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
  const sorted = [...items].sort(
    (a, b) =>
      (a.category ?? "").localeCompare(b.category ?? "") ||
      artKind(a).localeCompare(artKind(b)) ||
      a.name.localeCompare(b.name),
  );
  // What belongs to something goes right after it: "HDD cable" next to "HDD".
  const out: T[] = [];
  const used = new Set<T>();
  for (const it of sorted) {
    if (used.has(it)) continue;
    out.push(it);
    used.add(it);
    for (const other of sorted) {
      if (!used.has(other) && other.name.startsWith(`${it.name} `)) {
        out.push(other);
        used.add(other);
      }
    }
  }
  return out;
}
