import { artOf } from "@/lib/item-art";
import type { Pile } from "@/lib/pile";
import { mix } from "@/lib/scene";
import { ItemArt } from "./ItemArt";

const OUTLINE = "#0a1a2a";
const MAX_SHOWN = 8;

/** A pile of things stacked up in the open container, with how many there are. Centered on (0, 0). */
export function PileArt({ pile, size }: { pile: Pile; size: number }) {
  const n = pile.items.length;
  const badge = Math.max(8, size * 0.17);

  if (pile.kind === "books") {
    // Books lying flat in one stack, each a little off from the one below.
    const shown = pile.items.slice(0, MAX_SHOWN);
    const w = size * 0.82;
    const h = size * 0.17;
    const total = shown.length * h;
    return (
      <g>
        {shown.map((b, i) => {
          const fill = artOf(b).fill;
          const x = -w / 2 + (i % 2 ? 2.5 : -2) + ((i * 7) % 5) - 2;
          const y = total / 2 - (i + 1) * h;
          return (
            <g key={b.id} stroke={OUTLINE} strokeWidth="2" strokeLinejoin="round">
              <rect x={x} y={y} width={w} height={h} rx={1.6} fill={fill} />
              <rect x={x + w * 0.8} y={y + h * 0.22} width={w * 0.17} height={h * 0.56} fill="#eef2f5" strokeWidth="0.8" />
              <rect x={x} y={y} width={w * 0.1} height={h} rx={1.2} fill={mix(fill, "#0a1a2a", 0.3)} />
            </g>
          );
        })}
        <circle className="tile__badge" cx={w / 2 + 4} cy={-total / 2 - 2} r={badge} />
        <text className="tile__count" x={w / 2 + 4} y={-total / 2 - 2 + size * 0.06} style={{ fontSize: size * 0.17 }}>
          {n}
        </text>
      </g>
    );
  }

  // Cards and passports: each shown whole, the next one set a little up and to the right.
  const shown = pile.items.slice(0, 4);
  const step = size * 0.09;
  const art = size * 0.78;
  const shift = ((shown.length - 1) * step) / 2;
  return (
    <g>
      {shown.map((it, i) => (
        <g key={it.id} transform={`translate(${i * step - shift} ${-i * step + shift})`}>
          <ItemArt spec={artOf(it)} size={art} />
        </g>
      ))}
      <circle className="tile__badge" cx={size * 0.4} cy={-size * 0.36} r={badge} />
      <text className="tile__count" x={size * 0.4} y={-size * 0.36 + size * 0.06} style={{ fontSize: size * 0.17 }}>
        {n}
      </text>
    </g>
  );
}
