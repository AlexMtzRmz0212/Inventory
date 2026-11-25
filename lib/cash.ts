import type { Item } from "./types";

export type Currency = "CAD" | "USD" | "MXN" | "EUR";

/** One line of cash as filed in Notion, e.g. "5 CAD bills (x2)": a denomination and how many of it. */
export interface Bill {
  currency: Currency;
  denom: number;
  count: number;
}

export interface CashLine {
  denom: number;
  count: number;
}

/** All the bills of one currency, with what they add up to. */
export interface CashGroup {
  currency: Currency;
  /** Biggest denomination first. */
  lines: CashLine[];
  total: number;
}

const BILL_NAME = /^\s*(\d+)\s*(CAD|USD|MXN|EUR)\s*bills?\b(?:\s*\(\s*x\s*(\d+)\s*\))?/i;

/** "5 CAD bills (x2)" is two five-dollar Canadian bills; "10 CAD bill" is one ten. Anything else is not cash. */
export function billOf(item: Pick<Item, "name">): Bill | null {
  const m = BILL_NAME.exec(item.name);
  if (!m) return null;
  return { currency: m[2].toUpperCase() as Currency, denom: Number(m[1]), count: m[3] ? Number(m[3]) : 1 };
}

const USD_GREEN = "#8fc097";
const NEUTRAL = "#9aa7b5";

/** The color of the real note, so a 20 reads as a 20 at a glance. */
const NOTE_COLORS: Record<Currency, Record<number, string>> = {
  CAD: { 5: "#4a86d8", 10: "#9a72d6", 20: "#4caf6a", 50: "#e0584d", 100: "#c49a62" },
  USD: {},
  MXN: { 20: "#4f9bd9", 50: "#e8799a", 100: "#e0584d", 200: "#58b36a", 500: "#4f78c8", 1000: "#a77aa0" },
  EUR: { 5: "#9aa7b5", 10: "#e0584d", 20: "#4f9bd9", 50: "#f58e4b", 100: "#58b36a", 200: "#e8c547" },
};

export function billColor(b: Pick<Bill, "currency" | "denom">): string {
  if (b.currency === "USD") return USD_GREEN;
  return NOTE_COLORS[b.currency][b.denom] ?? NEUTRAL;
}

const ORDER: Currency[] = ["CAD", "USD", "MXN", "EUR"];

/** Bills added up by currency and denomination, currencies in a fixed order. */
export function cashGroups(bills: Bill[]): CashGroup[] {
  const by = new Map<Currency, Map<number, number>>();
  for (const b of bills) {
    const m = by.get(b.currency) ?? new Map<number, number>();
    m.set(b.denom, (m.get(b.denom) ?? 0) + b.count);
    by.set(b.currency, m);
  }
  return ORDER.filter((c) => by.has(c)).map((currency) => {
    const lines = [...(by.get(currency) ?? new Map<number, number>())]
      .map(([denom, count]) => ({ denom, count }))
      .sort((a, b) => b.denom - a.denom);
    return { currency, lines, total: lines.reduce((s, l) => s + l.denom * l.count, 0) };
  });
}

/** "$20 CAD", "€45". */
export function money(amount: number, currency: Currency): string {
  const n = amount.toLocaleString("en-US");
  return currency === "EUR" ? `€${n}` : `$${n} ${currency}`;
}

/** Just the number with its symbol, for a denomination inside a currency that is already named. */
export function symbolAmount(amount: number, currency: Currency): string {
  const n = amount.toLocaleString("en-US");
  return currency === "EUR" ? `€${n}` : `$${n}`;
}

/** Splits a container's contents into the cash (to be drawn as one handful) and everything else. */
export function splitCash(items: Item[]): { bills: Bill[]; others: Item[] } {
  const bills: Bill[] = [];
  const others: Item[] = [];
  for (const i of items) {
    const b = billOf(i);
    if (b) bills.push(b);
    else others.push(i);
  }
  return { bills, others };
}

/** Ids of the two stand-ins an open container shows for its cash: the handful, and its total beside it. */
export const CASH_ART = "cash:art";
export const CASH_SUM = "cash:sum";

export const isCashStub = (id: string) => id === CASH_ART || id === CASH_SUM;

/** Stand-in items, so the handful and its total take slots in the open container like anything else. */
export function cashStubs(boxId: string): Item[] {
  const stub = (id: string, name: string): Item => ({
    id,
    name,
    category: "Misc",
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
  });
  return [stub(CASH_ART, "Cash"), stub(CASH_SUM, "Cash total")];
}

/** Key of the picked group that means "show the cash breakdown of this container". */
export const CASH_PICK = "cash-of:";
