import { billSpec } from "@/lib/item-art";
import { money, symbolAmount, type Bill, type CashGroup } from "@/lib/cash";
import { ItemArt } from "./ItemArt";

/** Most notes drawn in one handful; more would only be a thicker pile of the same look. */
const LAYERS = 7;

/** The bills, one per note, ordered by currency and size so the fan shows a mix of colors. */
function expanded(groups: CashGroup[]): Bill[] {
  const out: Bill[] = [];
  for (const g of groups) {
    for (const l of [...g.lines].reverse()) {
      for (let k = 0; k < Math.min(l.count, 40); k++) out.push({ currency: g.currency, denom: l.denom, count: 1 });
    }
  }
  return out;
}

/** All the cash of a container as one fanned handful of notes held together by a band. Centered on (0, 0). */
export function Handful({ groups, size }: { groups: CashGroup[]; size: number }) {
  const all = expanded(groups);
  const n = Math.min(LAYERS, all.length);
  if (n === 0) return null;
  // Spread the picks along the whole list, so a handful of mostly twenties still shows the fives and hundreds.
  const picks = Array.from({ length: n }, (_, i) => all[n === 1 ? 0 : Math.round((i * (all.length - 1)) / (n - 1))]);
  const s = size / 48;
  return (
    <g>
      {picks.map((b, i) => {
        const t = n === 1 ? 0 : i / (n - 1) - 0.5;
        return (
          <g key={i} transform={`translate(${t * size * 0.15} ${-t * size * 0.06}) rotate(${t * 36} 0 ${size * 0.16})`}>
            <ItemArt spec={billSpec(b)} size={size} />
          </g>
        );
      })}
      {/* The band around the middle. */}
      <rect x={-4.2 * s} y={-8 * s} width={8.4 * s} height={16 * s} rx={1.6 * s} fill="#e8c547" stroke="#0a1a2a" strokeWidth={1.6 * s} />
    </g>
  );
}

/**
 * What the cash adds up to, beside the handful: the amount with its currency under it, one block
 * per currency. Starts left of (0, 0), which is the middle of the slot next to the handful,
 * and sized to stay inside that slot.
 */
export function CashTotals({ groups }: { groups: CashGroup[] }) {
  const amounts = groups.map((g) => symbolAmount(g.total, g.currency));
  const size = Math.min(14, 62 / (Math.max(...amounts.map((a) => a.length)) * 0.78));
  const block = size + 11;
  const top = -(groups.length * block) / 2;
  return (
    <g className="cash__sum">
      {groups.map((g, i) => (
        <g key={g.currency}>
          <text x={-26} y={top + i * block + size} style={{ fontSize: size }}>
            {amounts[i]}
          </text>
          <text className="cash__code" x={-26} y={top + i * block + size + 10}>
            {g.currency}
          </text>
        </g>
      ))}
    </g>
  );
}

/** A note, small, for a row in the breakdown. */
function Note({ b }: { b: Pick<Bill, "currency" | "denom"> }) {
  return (
    <svg className="cash__note" viewBox="-24 -14 48 28" aria-hidden="true">
      <ItemArt spec={billSpec(b)} size={48} />
    </svg>
  );
}

/** The cash broken down: each denomination with how many, what they make, and the total per currency. */
export function CashBreakdown({ groups }: { groups: CashGroup[] }) {
  return (
    <div className="cash">
      {groups.map((g) => (
        <section key={g.currency} className="cash__group">
          <header>
            <span>{g.currency}</span>
            <strong>{money(g.total, g.currency)}</strong>
          </header>
          <ul>
            {g.lines.map((l) => (
              <li key={l.denom}>
                <Note b={{ currency: g.currency, denom: l.denom }} />
                <span className="cash__n">×{l.count}</span>
                <span className="cash__amt">{symbolAmount(l.denom * l.count, g.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
