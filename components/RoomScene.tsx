"use client";

import { animate } from "framer-motion";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { lerp } from "@/lib/camera";
import { categoryColor } from "@/lib/palette";
import type { PlaceIndex } from "@/lib/places";
import {
  BASE_Y,
  FLOOR_BOX_Y,
  FLOOR_ITEMS_Y,
  FLOOR_Y,
  FURNITURE_WIDTH,
  SCENE_H,
  SCENE_W,
  containerColor,
  containerSize,
  furnitureKind,
  groupItems,
  mix,
  slotsFor,
  type Furniture,
  type Group,
} from "@/lib/scene";
import type { Container, Inventory, Place } from "@/lib/types";
import { CategoryGlyph } from "./CategoryIcon";

interface Props {
  site: Place;
  idx: PlaceIndex;
  inventory: Inventory;
  /** The country color this room wears. */
  tint: string;
  /** Spot the camera is looking at, or null for the whole room. */
  focusId: string | null;
  visible: boolean;
  onFocus: (id: string) => void;
}

const EASE = [0.65, 0, 0.35, 1] as const;
const TILE = 54;

/** Where items rest on each kind of furniture, and how wide that surface is. */
const SURFACE: Record<Furniture, { y: number; width: number }> = {
  desk: { y: 372, width: 370 },
  closet: { y: 336, width: 210 },
  shelf: { y: 476, width: 270 },
  crate: { y: 420, width: 190 },
};

function onKey(e: KeyboardEvent, fn: () => void) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
}

export default function RoomScene({ site, idx, inventory, tint, focusId, visible, onFocus }: Props) {
  const patternId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const aspectRef = useRef(16 / 9);
  const camRef = useRef<{ cx: number; cy: number; w: number } | null>(null);
  const firstRef = useRef(true);
  const [picked, setPicked] = useState<{ group: Group; at: string | null } | null>(null);

  const spots = useMemo(
    () => (idx.children.get(site.id) ?? []).filter((p) => p.level === "Spot"),
    [idx, site.id],
  );
  const { xs } = useMemo(() => slotsFor(spots.length), [spots.length]);
  const spotIndex = spots.findIndex((s) => s.id === focusId);

  const wall = mix(tint, "#0a1a2a", 0.78);
  const wallDeep = mix(tint, "#0a1a2a", 0.88);
  const floor = mix(tint, "#0a1a2a", 0.92);
  const light = mix(tint, "#eaf0f4", 0.62);
  const mid = mix(tint, "#eaf0f4", 0.3);
  const dark = mix(tint, "#0a1a2a", 0.5);

  const apply = (c: { cx: number; cy: number; w: number }) => {
    camRef.current = c;
    const svg = svgRef.current;
    if (!svg) return;
    const h = c.w / aspectRef.current;
    svg.setAttribute("viewBox", `${c.cx - c.w / 2} ${c.cy - h / 2} ${c.w} ${h}`);
  };

  // Frame by height first (furniture stands between y=190 and y=700), then widen to fit.
  const targetCam = () => {
    const a = aspectRef.current;
    return spotIndex >= 0
      ? { cx: xs[spotIndex], cy: 400, w: Math.max(520, 420 * a) }
      : { cx: SCENE_W / 2, cy: 440, w: Math.max(1100, 620 * a) };
  };

  useEffect(() => {
    // The svg stops above the tray, so its own size is the visible room.
    const el = svgRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      aspectRef.current = r.width / r.height;
      apply(camRef.current ?? targetCam());
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const target = targetCam();
    if (firstRef.current || !camRef.current) {
      firstRef.current = false;
      apply(target);
      return;
    }
    const from = camRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      apply(target);
      return;
    }
    const ctrl = animate(0, 1, {
      duration: 0.7,
      ease: EASE,
      onUpdate: (t) =>
        apply({
          cx: lerp(from.cx, target.cx, t),
          cy: lerp(from.cy, target.cy, t),
          w: Math.exp(lerp(Math.log(from.w), Math.log(target.w), t)),
        }),
    });
    return () => ctrl.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotIndex, spots.length]);

  const itemsAt = (id: string) => inventory.items.filter((i) => i.locationId === id);
  const boxesAt = (id: string) => inventory.containers.filter((c) => c.locationId === id);
  const pick = (group: Group) => setPicked({ group, at: focusId });

  // A desk that is also a place is already drawn as furniture, so skip its item row.
  const furnitureNames = new Set(spots.map((s) => s.name.trim().toLowerCase()));
  const floorItems = groupItems(
    itemsAt(site.id).filter((i) => !furnitureNames.has(i.name.trim().toLowerCase())),
  );
  const floorBoxes = boxesAt(site.id);
  const isEmpty =
    spots.length === 0 &&
    floorItems.length === 0 &&
    floorBoxes.length === 0;

  const showPicked = visible && picked && picked.at === focusId ? picked.group : null;

  return (
    <div
      ref={wrapRef}
      className={`scene${visible ? " is-on" : ""}`}
      style={{ background: floor }}
      inert={!visible}
    >
      <svg
        ref={svgRef}
        className="scene__svg"
        viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
        role="group"
        aria-label={`Inside ${site.name}`}
        onClick={() => setPicked(null)}
      >
        <defs>
          <pattern id={patternId} width="26" height="12" patternUnits="userSpaceOnUse">
            <path d="M13 0v12" stroke={wallDeep} strokeWidth="5" />
          </pattern>
        </defs>

        {/* Room shell */}
        <rect x={-4000} y={-4000} width={9200} height={4000 + FLOOR_Y} fill={wall} />
        <rect x={-4000} y={FLOOR_Y} width={9200} height={4000} fill={floor} />
        {site.scene === "storage-unit" && (
          <rect x={-4000} y={-4000} width={9200} height={4000 + FLOOR_Y} fill={`url(#${patternId})`} opacity={0.7} />
        )}
        {site.scene === "apartment" && (
          <g>
            <rect x={70} y={120} width={200} height={240} rx={6} fill={mix(tint, "#eaf0f4", 0.8)} opacity={0.22} />
            <path d="M170 120v240M70 240h200" stroke={wallDeep} strokeWidth="8" />
            <rect x={70} y={120} width={200} height={240} rx={6} fill="none" stroke={wallDeep} strokeWidth="10" />
          </g>
        )}
        <rect x={-4000} y={FLOOR_Y - 8} width={9200} height={16} fill={wallDeep} />

        {spots.map((spot, i) => {
          const kind = furnitureKind(spot.name);
          const x = xs[i];
          const dim = focusId !== null && focusId !== spot.id;
          const groups = groupItems(itemsAt(spot.id));
          const boxes = boxesAt(spot.id);
          const surface = SURFACE[kind];
          return (
            <g key={spot.id} className={dim ? "scene__spot is-dim" : "scene__spot"}>
              <ellipse cx={x} cy={BASE_Y + 6} rx={FURNITURE_WIDTH[kind] * 0.55} ry={12} fill="#000" opacity={0.22} />
              <g
                className="furn"
                role="button"
                tabIndex={visible ? 0 : -1}
                aria-label={focusId === spot.id ? `Back to ${site.name}` : `Look at ${spot.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onFocus(focusId === spot.id ? site.id : spot.id);
                }}
                onKeyDown={(e) => onKey(e, () => onFocus(focusId === spot.id ? site.id : spot.id))}
              >
                {kind === "desk" && <Desk x={x} light={light} mid={mid} dark={dark} />}
                {kind === "closet" && <Closet x={x} light={light} mid={mid} dark={dark} deep={wallDeep} />}
                {kind === "shelf" && <Shelf x={x} light={light} mid={mid} dark={dark} deep={wallDeep} />}
                {kind === "crate" && <Crate x={x} light={light} mid={mid} dark={dark} />}
                <text className="scene__label" x={x} y={BASE_Y + 40}>
                  {spot.name}
                </text>
              </g>
              <Boxes boxes={boxes} cx={x} base={BASE_Y - 6} availW={FURNITURE_WIDTH[kind] - 50} />
              <Tiles groups={groups} cx={x} y={surface.y} maxW={surface.width} visible={visible} onPick={pick} />
            </g>
          );
        })}

        <Boxes boxes={floorBoxes} cx={SCENE_W / 2} base={FLOOR_BOX_Y} availW={1100} />
        <Tiles groups={floorItems} cx={SCENE_W / 2} y={FLOOR_ITEMS_Y} maxW={1100} visible={visible} onPick={pick} />

        {isEmpty && (
          <text className="scene__empty" x={SCENE_W / 2} y={380}>
            Nothing recorded here yet.
          </text>
        )}
      </svg>

      {showPicked && (
        <aside className="scene__pop" role="dialog" aria-label={showPicked.label}>
          <h2>{showPicked.label}</h2>
          {showPicked.pile ? (
            <ul>
              {showPicked.items.map((i) => (
                <li key={i.id}>
                  {i.name}
                  {i.fragile && <small>Fragile</small>}
                </li>
              ))}
            </ul>
          ) : (
            <ul>
              <li>
                {showPicked.items[0].category ?? "Other"}
                {showPicked.items[0].fragile && <small>Fragile</small>}
                {showPicked.items[0].notes && <small>{showPicked.items[0].notes}</small>}
              </li>
            </ul>
          )}
          <button type="button" className="btn btn--ghost" onClick={() => setPicked(null)}>
            Close
          </button>
        </aside>
      )}
    </div>
  );
}

function Tiles({
  groups,
  cx,
  y,
  maxW,
  visible,
  onPick,
}: {
  groups: Group[];
  cx: number;
  y: number;
  maxW: number;
  visible: boolean;
  onPick: (g: Group) => void;
}) {
  const perRow = Math.max(1, Math.floor(maxW / TILE));
  const rows: Group[][] = [];
  for (let i = 0; i < groups.length; i += perRow) rows.push(groups.slice(i, i + perRow));
  return (
    <g>
      {rows.map((row, r) =>
        row.map((g, i) => {
          const tx = cx - (row.length * TILE) / 2 + TILE / 2 + i * TILE;
          const ty = y - r * TILE;
          const color = categoryColor(g.category);
          const open = () => onPick(g);
          return (
            <g
              key={g.key}
              className="tile"
              role="button"
              tabIndex={visible ? 0 : -1}
              aria-label={g.pile ? `${g.label}, ${g.items.length} items` : g.label}
              onClick={(e) => {
                e.stopPropagation();
                open();
              }}
              onKeyDown={(e) => onKey(e, open)}
            >
              <title>{g.pile ? `${g.label} (${g.items.length})` : g.label}</title>
              <circle className="tile__bg" cx={tx} cy={ty} r={g.pile ? 25 : 22} stroke={color} />
              <CategoryGlyph category={g.category} x={tx - 11} y={ty - 11} size={22} color={color} />
              {g.pile && (
                <>
                  <circle className="tile__badge" cx={tx + 18} cy={ty - 18} r={11} />
                  <text className="tile__count" x={tx + 18} y={ty - 14}>
                    {g.items.length}
                  </text>
                </>
              )}
            </g>
          );
        }),
      )}
    </g>
  );
}

/** Luggage and boxes, drawn to scale from their real dimensions. */
function Boxes({ boxes, cx, base, availW }: { boxes: Container[]; cx: number; base: number; availW: number }) {
  if (boxes.length === 0) return null;
  const gap = 18;
  const unit = boxes.reduce((sum, c) => sum + containerSize(c, 1).w, 0);
  const scale = Math.min(2.6, (availW - gap * (boxes.length - 1)) / unit);
  const start = cx - (unit * scale + gap * (boxes.length - 1)) / 2;
  const placed = boxes.reduce<{ c: Container; left: number; w: number; h: number }[]>((acc, c) => {
    const { w, h } = containerSize(c, scale);
    const prev = acc[acc.length - 1];
    const left = prev ? prev.left + prev.w + gap : start;
    return [...acc, { c, left, w, h }];
  }, []);
  return (
    <g>
      {placed.map(({ c, left, w, h }) => (
        <Luggage key={c.id} c={c} left={left} base={base} w={w} h={h} />
      ))}
    </g>
  );
}

function Luggage({ c, left, base, w, h }: { c: Container; left: number; base: number; w: number; h: number }) {
  const color = containerColor(c);
  const top = base - h;
  const card = c.type === "Cardboard box";
  return (
    <g>
      <title>{c.name}</title>
      <rect x={left} y={top} width={w} height={h} rx={card ? 4 : 12} fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
      {card ? (
        <>
          <rect x={left + w / 2 - 10} y={top} width={20} height={h * 0.38} fill="rgba(255,255,255,0.28)" />
          <path d={`M${left} ${top + 8}h${w}`} stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
        </>
      ) : (
        <>
          <path d={`M${left + w / 2 - 14} ${top}v-12h28v12`} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="5" strokeLinecap="round" />
          <path d={`M${left + w * 0.3} ${top + 14}v${h - 28}M${left + w * 0.7} ${top + 14}v${h - 28}`} stroke="rgba(255,255,255,0.22)" strokeWidth="5" strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

interface Tones {
  x: number;
  light: string;
  mid: string;
  dark: string;
}

function Desk({ x, light, mid, dark }: Tones): ReactNode {
  return (
    <g>
      <rect x={x - 190} y={400} width={16} height={BASE_Y - 400} fill={dark} />
      <rect x={x + 174} y={400} width={16} height={BASE_Y - 400} fill={dark} />
      <rect x={x + 30} y={420} width={144} height={78} fill={mid} />
      <path d={`M${x + 80} ${459}h44`} stroke={dark} strokeWidth="6" strokeLinecap="round" />
      <rect x={x - 200} y={398} width={400} height={22} rx={5} fill={light} />
    </g>
  );
}

function Closet({ x, light, mid, dark, deep }: Tones & { deep: string }): ReactNode {
  return (
    <g>
      <rect x={x - 130} y={190} width={260} height={BASE_Y - 190} rx={6} fill={mid} />
      <rect x={x - 114} y={206} width={228} height={BASE_Y - 206 - 10} fill={deep} />
      <rect x={x - 114} y={360} width={228} height={10} fill={light} />
      <path d={`M${x - 114} 240h228`} stroke={dark} strokeWidth="5" />
      <path d={`M${x - 130} 190 ${x - 188} 214V${BASE_Y - 30}L${x - 130} ${BASE_Y}Z`} fill={light} />
      <path d={`M${x + 130} 190 ${x + 188} 214V${BASE_Y - 30}L${x + 130} ${BASE_Y}Z`} fill={light} />
    </g>
  );
}

function Shelf({ x, light, mid, dark, deep }: Tones & { deep: string }): ReactNode {
  return (
    <g>
      <rect x={x - 150} y={300} width={300} height={BASE_Y - 300} fill={deep} />
      {[300, 400, 500].map((y) => (
        <rect key={y} x={x - 150} y={y} width={300} height={12} fill={light} />
      ))}
      <rect x={x - 156} y={296} width={12} height={BASE_Y - 296} fill={mid} />
      <rect x={x + 144} y={296} width={12} height={BASE_Y - 296} fill={mid} />
      <rect x={x - 150} y={BASE_Y - 8} width={300} height={8} fill={dark} />
    </g>
  );
}

function Crate({ x, light, mid, dark }: Tones): ReactNode {
  return (
    <g>
      <rect x={x - 110} y={BASE_Y - 130} width={220} height={130} rx={4} fill={mid} />
      <path d={`M${x - 110} ${BASE_Y - 90}h220M${x - 110} ${BASE_Y - 45}h220`} stroke={dark} strokeWidth="5" />
      <rect x={x - 118} y={BASE_Y - 138} width={236} height={14} rx={3} fill={light} />
    </g>
  );
}
