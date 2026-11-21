"use client";

import type { CSSProperties } from "react";
import type { Packing, PackRow } from "@/lib/packing";
import { categoryColor } from "@/lib/palette";
import { CategoryIcon } from "./CategoryIcon";

interface Props {
  packing: Packing;
  onClose: () => void;
  /** Fly to where the real item is. */
  onGo: (placeId: string) => void;
}

/** Progress ring: how much of the list is already in the bags. */
export function PackingRing({ packed, total, size = 56 }: { packed: number; total: number; size?: number }) {
  const pct = total ? (packed / total) * 100 : 0;
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true" className="ring">
      <circle cx="18" cy="18" r="15" className="ring__track" />
      <circle
        cx="18"
        cy="18"
        r="15"
        className="ring__bar"
        pathLength={100}
        strokeDasharray={`${pct} ${100 - pct}`}
        transform="rotate(-90 18 18)"
      />
      <text x="18" y="21.5" className="ring__text">
        {packed}/{total}
      </text>
    </svg>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className={`check${on ? " is-on" : ""}`}>
      <circle cx="10" cy="10" r="8.5" className="check__ring" />
      {on && <path d="m6 10.4 2.6 2.6L14 7.6" className="check__tick" />}
    </svg>
  );
}

function Row({ row, onGo, nested }: { row: PackRow; onGo: Props["onGo"]; nested: boolean }) {
  const { entry, place, item } = row;
  const label = `${entry.name}, ${entry.packed ? "packed" : "not packed yet"}${place ? `, at ${place.name}` : ""}`;
  return (
    <li className={nested ? "pack__row pack__row--nested" : "pack__row"}>
      <div className="pack__line" style={{ "--c": categoryColor(item?.category ?? null) } as CSSProperties}>
        <Check on={entry.packed} />
        <span className="pack__icon">
          <CategoryIcon category={item?.category ?? null} size={18} />
        </span>
        <span className="pack__name" aria-label={label}>
          {entry.name}
        </span>
        {place && (
          <button type="button" className="pack__where" onClick={() => onGo(place.id)} aria-label={`Fly to ${place.name}`}>
            {place.name}
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="m3 1 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      {row.children.length > 0 && (
        <ul className="pack__list">
          {row.children.map((c) => (
            <Row key={c.entry.id} row={c} onGo={onGo} nested />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function PackingPanel({ packing, onClose, onGo }: Props) {
  return (
    <aside className="pack" aria-label="Luggage list">
      <header className="pack__head">
        <PackingRing packed={packing.packed} total={packing.total} />
        <div>
          <h2>Luggage list</h2>
          <p>
            {packing.packed === packing.total
              ? "Everything is packed"
              : `${packing.total - packing.packed} still to pack`}
          </p>
        </div>
        <button type="button" className="pack__close" onClick={onClose} aria-label="Close luggage list">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="m2 2 10 10M12 2 2 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <div className="pack__body">
        {packing.groups.map((g) => (
          <section key={g.name} className="pack__group" style={{ "--c": categoryColor(g.category) } as CSSProperties}>
            <h3>
              <span className="pack__icon">
                <CategoryIcon category={g.category} size={18} />
              </span>
              {g.name}
              <span className="pack__count">
                {g.packed}/{g.total}
              </span>
            </h3>
            <i className="pack__bar" style={{ "--w": `${g.total ? (g.packed / g.total) * 100 : 0}%` } as CSSProperties} />
            <ul className="pack__list">
              {g.rows.map((r) => (
                <Row key={r.entry.id} row={r} onGo={onGo} nested={false} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
