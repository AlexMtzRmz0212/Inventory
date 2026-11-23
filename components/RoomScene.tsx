"use client";

import { animate } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { lerp } from "@/lib/camera";
import {
  CASH_ART,
  CASH_PICK,
  CASH_SUM,
  cashGroups,
  cashStubs,
  isCashStub,
  money,
  splitCash,
  type CashGroup,
} from "@/lib/cash";
import { artKind, artOf } from "@/lib/item-art";
import type { PlaceIndex } from "@/lib/places";
import {
  BASE_Y,
  BURST_ITEM,
  FLOOR_BOX_Y,
  FLOOR_ITEMS_Y,
  FLOOR_Y,
  FURNITURE_WIDTH,
  MAX_INDIVIDUAL,
  SCENE_H,
  SCENE_W,
  burstPlan,
  deskLayout,
  deskWidth,
  hasTableSpot,
  lineupPlan,
  containerAccent,
  containerColor,
  furnitureKind,
  itemsByContainer,
  layoutBoxes,
  mix,
  peekCount,
  peekPicks,
  peekSlots,
  placeOnLevels,
  slotsFor,
  type BurstPlan,
  type Furniture,
  type Group,
  type Level,
  type LineupPlan,
  type PlacedBox,
  type PlacedItem,
} from "@/lib/scene";
import type { Container, Inventory, Item, Place } from "@/lib/types";
import { isPileId, pileStub, splitPiles, type Pile } from "@/lib/pile";
import { PileArt } from "./BookPile";
import { CashBreakdown, CashTotals, Handful } from "./Cash";
import { ItemArt } from "./ItemArt";

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

/**
 * Where things stand on each kind of furniture, front row first. The desk is drawn from a little
 * above, so its rows run back across the top, each a bit smaller and narrower.
 */
const LEVELS: Record<Furniture, Level[]> = {
  desk: [
    { y: 398, width: 310, scale: 1 },
    { y: 361, width: 270, scale: 0.84 },
    { y: 329, width: 235, scale: 0.7 },
    { y: 301, width: 205, scale: 0.58 },
  ],
  closet: [
    { y: 382, width: 210, scale: 1 },
    { y: 312, width: 210, scale: 1 },
  ],
  shelf: [
    { y: 498, width: 270, scale: 1 },
    { y: 398, width: 270, scale: 1 },
    { y: 298, width: 270, scale: 1 },
  ],
  crate: [
    { y: 430, width: 190, scale: 1 },
    { y: 384, width: 170, scale: 0.9 },
  ],
  // Things sit on the seat of a couch.
  couch: [{ y: 505, width: 230, scale: 1 }],
};

/** Where a closet's shelf is: the top of the plank things stand on. */
const CLOSET_SHELF_Y = 382;
/** The top plank of a closet, above the middle shelf; things on it stand on its top edge. */
const CLOSET_TOP_Y = 252;
/** In a closet, a Table Y under this puts a thing on the top shelf (Table X is left to right along it). */
const TOP_SHELF_BELOW = 30;
const onTopShelf = (i: Item) => i.tableX !== null && i.tableY !== null && i.tableY < TOP_SHELF_BELOW;

/** Loose items on a site's floor, when there is no rack for them. */
const FLOOR_LEVELS: Level[] = [
  { y: FLOOR_ITEMS_Y, width: 1000, scale: 1 },
  { y: FLOOR_ITEMS_Y - 52, width: 1000, scale: 1 },
];

/** The two sides of a storage unit, where shelving racks stand clear of the luggage in the middle. */
const RACK_ZONES = [
  { x0: 118, x1: 358 },
  { x0: 842, x1: 1082 },
];

function onKey(e: KeyboardEvent, fn: () => void) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
}

export default function RoomScene({ site, idx, inventory, tint, focusId, visible, onFocus }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const aspectRef = useRef(16 / 9);
  /** Same as aspectRef, for the layout that depends on it while rendering. */
  const [aspect, setAspect] = useState(16 / 9);
  const camRef = useRef<{ cx: number; cy: number; w: number } | null>(null);
  const firstRef = useRef(true);
  const [picked, setPicked] = useState<{ group: Group; at: string | null } | null>(null);
  /** The container that is open, and where the camera was when it opened. */
  const [open, setOpen] = useState<{ id: string; at: string | null } | null>(null);

  const spots = useMemo(
    () => (idx.children.get(site.id) ?? []).filter((p) => p.level === "Spot"),
    [idx, site.id],
  );
  const kinds = useMemo(() => spots.map((p) => furnitureKind(p.name)), [spots]);
  const { xs, span } = useMemo(() => slotsFor(kinds), [kinds]);
  const spotIndex = spots.findIndex((s) => s.id === focusId);

  const boxesAt = (id: string) => inventory.containers.filter((c) => c.locationId === id);
  const contents = useMemo(() => itemsByContainer(inventory), [inventory]);

  // An item inside a container drawn here comes out of it instead of standing around on its own.
  const hereIds = new Set([site.id, ...spots.map((s) => s.id)]);
  const drawnBoxIds = new Set(
    inventory.containers.filter((c) => c.locationId && hereIds.has(c.locationId)).map((c) => c.id),
  );
  const itemsAt = (id: string) =>
    inventory.items.filter((i) => i.locationId === id && !(i.boxId && drawnBoxIds.has(i.boxId)));

  // A desk that is also a place is already drawn as furniture, so skip its item row.
  const furnitureNames = new Set(spots.map((s) => s.name.trim().toLowerCase()));
  const looseFloor = itemsAt(site.id).filter((i) => !furnitureNames.has(i.name.trim().toLowerCase()));
  // Furniture that has been taken apart lies in pieces instead of standing as an item.
  const taken = looseFloor.filter((i) => artKind(i) === "deskparts");
  const rest = looseFloor.filter((i) => artKind(i) !== "deskparts");
  // With no furniture to put things on and too many to line up on the floor, shelving racks
  // along the two sides hold them by category, leaving the middle to the luggage.
  const rackOn = spots.length === 0 && rest.length > MAX_INDIVIDUAL;

  // Containers are laid out once, so the open one can fan its items out above everything else.
  const hasItems = (c: Container) => (contents.get(c.id)?.length ?? 0) > 0;
  // A desk where things have been given a place on it is laid out as its owner has it.
  const deskPlans = spots.map((spot, i) => {
    const here = boxesAt(spot.id);
    const loose = itemsAt(spot.id);
    if (kinds[i] !== "desk" || !(loose.some(hasTableSpot) || here.some(hasTableSpot))) return null;
    const onTop = here.filter((c) => c.type === "Wallet" || c.type === "Pouch" || hasTableSpot(c));
    return deskLayout(loose, onTop, xs[i], deskWidth(spot.name));
  });
  // Cardboard boxes in a closet sit on its shelf; backpacks and the like stand on the floor.
  const shelfBoxes = spots.map((spot, i) =>
    kinds[i] === "closet" ? boxesAt(spot.id).filter((c) => c.type === "Cardboard box") : [],
  );
  // Things on a closet's top shelf stand along it where their Table X says; the rest go on the usual rows.
  const closetPlans = spots.map((spot, i) => {
    if (kinds[i] !== "closet") return undefined;
    const loose = itemsAt(spot.id);
    const top = loose.filter(onTopShelf);
    if (top.length === 0) return undefined;
    const levels = shelfBoxes[i].length > 0 ? LEVELS.closet.slice(1) : LEVELS.closet;
    const size = 38;
    const onShelf = top.map((item) => ({
      item,
      x: xs[i] + ((item.tableX ?? 50) / 100 - 0.5) * 190,
      y: CLOSET_TOP_Y - size / 2,
      size,
    }));
    return [...placeOnLevels(loose.filter((it) => !onTopShelf(it)), levels, xs[i]), ...onShelf].sort((a, b) => a.y - b.y);
  });
  const spotBoxes = spots.map((spot, i) => {
    const kind = furnitureKind(spot.name);
    const here = boxesAt(spot.id);
    const plan = deskPlans[i];
    if (plan) {
      const onTop = new Set(plan.boxes.map((p) => p.c.id));
      return [
        ...plan.boxes,
        ...layoutBoxes(here.filter((c) => !onTop.has(c.id)), xs[i], BASE_Y - 6, FURNITURE_WIDTH[kind] - 50, hasItems),
      ];
    }
    if (shelfBoxes[i].length > 0) {
      const onShelf = new Set(shelfBoxes[i].map((c) => c.id));
      return [
        ...layoutBoxes(shelfBoxes[i], xs[i], CLOSET_SHELF_Y, 200, hasItems, 2.2),
        // The rest keep their life size on the floor, as they did beside the boxes.
        ...layoutBoxes(here.filter((c) => !onShelf.has(c.id)), xs[i], BASE_Y - 6, FURNITURE_WIDTH[kind] - 50, hasItems, 1.5),
      ];
    }
    // A wallet is small enough to sit on top of the furniture instead of standing on the floor in front of it.
    const small = here.filter((c) => c.type === "Wallet");
    return [
      ...layoutBoxes(here.filter((c) => c.type !== "Wallet"), xs[i], BASE_Y - 6, FURNITURE_WIDTH[kind] - 50, hasItems),
      ...layoutBoxes(small, xs[i] + 150, LEVELS[kind][0].y - 4, 90, hasItems, 4.5),
    ];
  });
  const floorBoxes = layoutBoxes(boxesAt(site.id), SCENE_W / 2, FLOOR_BOX_Y, rackOn ? 480 : 1100, hasItems);
  const placedBoxes = [...spotBoxes.flat(), ...floorBoxes];
  const live = visible && open && open.at === focusId ? open : null;
  const openId = live ? live.id : null;
  const stackId = live && live.id.startsWith("stack:") ? live.id.slice(6) : null;
  const openBox = live && !stackId ? (placedBoxes.find((p) => p.c.id === live.id) ?? null) : null;
  // A stack that was clicked: its containers stand up in a row so each can be told from the others.
  const stackBoxes = stackId ? placedBoxes.filter((p) => p.column?.[0] === stackId) : [];
  const lineup =
    stackBoxes.length > 0
      ? lineupPlan(
          stackBoxes.map((p) => p.c),
          stackBoxes[0].left + stackBoxes[0].w / 2,
          stackBoxes[0].base,
          aspect,
        )
      : null;
  // The open container's items, and the camera that fits them to the screen. Cash is drawn as one
  // handful with its total beside it instead of a slot for every note.
  const rawOpen = live ? (contents.get(live.id) ?? []) : [];
  const openCash = splitCash(rawOpen);
  const openGroups = cashGroups(openCash.bills);
  const openPiles = splitPiles(openCash.others);
  const openItems =
    live && (openCash.bills.length > 0 || openPiles.piles.length > 0)
      ? [
          ...(openCash.bills.length > 0 ? cashStubs(live.id) : []),
          ...openPiles.piles.map((p) => pileStub(p, live.id)),
          ...openPiles.others,
        ]
      : rawOpen;
  const burst = openBox && openItems.length > 0 ? burstPlan(openBox, openItems.length, aspect) : null;

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
    if (burst) return burst.frame;
    if (lineup) return lineup.frame;
    // A desk is looked at closer, so the things on it fill the screen.
    if (spotIndex >= 0 && kinds[spotIndex] === "desk") {
      // Something on the floor under the desk pulls the view back and down to include it.
      const low = deskPlans[spotIndex]?.items.some((p) => p.y > 440) ?? false;
      return {
        cx: xs[spotIndex],
        cy: low ? 360 : 316,
        w: Math.max(330, 210 * a) * deskWidth(spots[spotIndex].name) * (low ? 1.2 : 1),
      };
    }
    // A couch sits low in the room, so look at it lower and closer.
    if (spotIndex >= 0 && kinds[spotIndex] === "couch") return { cx: xs[spotIndex], cy: 490, w: Math.max(460, 300 * a) };
    // A closet fills more of the screen, so what is on its shelf and floor reads clearly.
    if (spotIndex >= 0 && kinds[spotIndex] === "closet") return { cx: xs[spotIndex], cy: 380, w: Math.max(500, 380 * a) };
    return spotIndex >= 0
      ? { cx: xs[spotIndex], cy: 400, w: Math.max(520, 420 * a) }
      : { cx: SCENE_W / 2, cy: 440, w: Math.max(1100, 620 * a, span + 180) };
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
    const ro = new ResizeObserver(() => {
      measure();
      setAspect(aspectRef.current);
    });
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
  }, [spotIndex, spots.length, burst?.frame.cx, burst?.frame.cy, burst?.frame.w, lineup?.frame.cx, lineup?.frame.cy, lineup?.frame.w]);

  const pick = (group: Group) => setPicked({ group, at: focusId });
  const isEmpty =
    spots.length === 0 &&
    rest.length === 0 &&
    taken.length === 0 &&
    floorBoxes.length === 0;

  const showPicked = visible && picked && picked.at === focusId ? picked.group : null;
  const toggle = (id: string) => {
    setPicked(null);
    setOpen(openId === id ? null : { id, at: focusId });
  };
  const pickItem = (i: Item) =>
    pick({ key: i.id, label: i.name, category: i.category, items: [i], pile: false });
  /** The handful (or its total) was clicked: show the notes by denomination. */
  const pickBurst = (i: Item) => {
    const pile = openPiles.piles.find((p) => p.id === i.id);
    if (pile && openBox) return pick({ key: pile.id, label: `${pile.label}, ${pile.items.length}`, category: i.category, items: pile.items, pile: true });
    if (!isCashStub(i.id) || !openBox) return pickItem(i);
    pick({ key: `${CASH_PICK}${openBox.c.id}`, label: `Cash in ${openBox.c.name}`, category: "Misc", items: [], pile: false });
  };
  const cashBoxId = showPicked?.key.startsWith(CASH_PICK) ? showPicked.key.slice(CASH_PICK.length) : null;

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
        onClick={() => {
          // One step out per click: what is open, then the furniture. The room itself stays.
          if (showPicked || live) {
            // A container opened from farther away lands on the furniture it stands on.
            const on = openBox?.c.locationId;
            setPicked(null);
            setOpen(null);
            if (on && on !== focusId && spots.some((s) => s.id === on)) onFocus(on);
          } else if (focusId) {
            onFocus(site.id);
          }
        }}
      >
        {/* Room shell */}
        {site.scene === "storage-unit" ? (
          <StorageShell tint={tint} />
        ) : (
          <>
            <rect x={-4000} y={-4000} width={9200} height={4000 + FLOOR_Y} fill={wall} />
            <rect x={-4000} y={FLOOR_Y} width={9200} height={4000} fill={floor} />
          </>
        )}
        {site.scene === "apartment" && (
          <g>
            <rect x={70} y={120} width={200} height={240} rx={6} fill={mix(tint, "#eaf0f4", 0.8)} opacity={0.22} />
            <path d="M170 120v240M70 240h200" stroke={wallDeep} strokeWidth="8" />
            <rect x={70} y={120} width={200} height={240} rx={6} fill="none" stroke={wallDeep} strokeWidth="10" />
          </g>
        )}
        {site.scene !== "storage-unit" && (
          <rect x={-4000} y={FLOOR_Y - 8} width={9200} height={16} fill={wallDeep} />
        )}

        {spots.map((spot, i) => {
          const kind = furnitureKind(spot.name);
          const x = xs[i];
          const dim = focusId !== null && focusId !== spot.id;
          return (
            <g key={spot.id} className={dim ? "scene__spot is-dim" : "scene__spot"}>
              <ellipse cx={x} cy={BASE_Y + 6} rx={FURNITURE_WIDTH[kind] * 0.55} ry={12} fill="#000" opacity={0.22} />
              <g
                className={focusId === spot.id ? "furn is-focus" : "furn"}
                role="button"
                tabIndex={visible ? 0 : -1}
                aria-label={focusId === spot.id ? spot.name : `Look at ${spot.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (focusId !== spot.id) onFocus(spot.id);
                }}
                onKeyDown={(e) => onKey(e, () => focusId !== spot.id && onFocus(spot.id))}
              >
                {kind === "desk" && <Desk x={x} light={light} mid={mid} dark={dark} wide={deskWidth(spot.name)} drawers={deskWidth(spot.name) > 1} />}
                {kind === "closet" && <Closet x={x} light={light} mid={mid} deep={wallDeep} />}
                {kind === "shelf" && <Shelf x={x} light={light} mid={mid} dark={dark} deep={wallDeep} />}
                {kind === "crate" && <Crate x={x} light={light} mid={mid} dark={dark} />}
                {kind === "couch" && <Couch x={x} light={light} mid={mid} dark={dark} />}
                <text className="scene__label" x={x} y={BASE_Y + 40}>
                  {spot.name}
                </text>
              </g>
              <Boxes placed={spotBoxes[i]} contents={contents} openId={openId} visible={visible} onToggle={toggle} />
              <Standing
                items={itemsAt(spot.id)}
                // With boxes on the closet shelf, loose things hang above it instead.
                levels={shelfBoxes[i].length > 0 ? LEVELS[kind].slice(1) : LEVELS[kind]}
                cx={kind === "desk" ? x - 40 : x}
                placed={deskPlans[i]?.items ?? closetPlans[i]}
                visible={visible}
                onPick={pickItem}
              />
            </g>
          );
        })}

        {/* Behind the luggage: things against the back wall. */}
        {taken.map((it, i) => (
          <TakenApart
            key={it.id}
            item={it}
            x={rackOn ? RACK_ZONES[0].x0 + 115 + i * 130 : 190 + i * 150}
            y={rackOn ? FLOOR_Y + 85 : FLOOR_Y - 55}
            size={rackOn ? 120 : 150}
            visible={visible}
            onPick={() => pickItem(it)}
          />
        ))}
        {rackOn && <SideRacks items={rest} tint={tint} visible={visible} onPick={pickItem} />}
        <Boxes placed={floorBoxes} contents={contents} openId={openId} visible={visible} onToggle={toggle} />
        {!rackOn && <Standing items={rest} levels={FLOOR_LEVELS} cx={SCENE_W / 2} visible={visible} onPick={pickItem} />}

        {lineup && <Lineup plan={lineup} visible={visible} />}

        {openBox && burst && (
          <Burst
            box={openBox}
            items={openItems}
            showBox
            plan={burst}
            groups={openGroups}
            piles={openPiles.piles}
            visible={visible}
            onPickItem={pickBurst}
          />
        )}

        {isEmpty && (
          <text className="scene__empty" x={SCENE_W / 2} y={380}>
            Nothing recorded here yet.
          </text>
        )}
      </svg>

      {(openBox || lineup) && (
        <button
          type="button"
          className="btn btn--ghost scene__close"
          onClick={() => {
            setPicked(null);
            setOpen(null);
          }}
        >
          {openBox ? `Close ${openBox.c.name}` : "Put the stack back"}
        </button>
      )}

      {showPicked && (
        <aside className="scene__pop" role="dialog" aria-label={showPicked.label}>
          <h2>{showPicked.label}</h2>
          {cashBoxId ? (
            <CashBreakdown groups={cashGroups(splitCash(contents.get(cashBoxId) ?? []).bills)} />
          ) : showPicked.pile ? (
            <ul>
              {showPicked.items.map((i) => (
                <li key={i.id}>
                  {i.name}
                  {i.fragile && <small>Fragile</small>}
                  {i.notes && <small>{i.notes}</small>}
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

/** A one-point-perspective storage unit: corrugated walls, ceiling and floor running out to the screen edges. */
function StorageShell({ tint }: { tint: string }) {
  const wall = mix(tint, "#0a1a2a", 0.62);
  const side = mix(tint, "#0a1a2a", 0.74);
  const wallDeep = mix(tint, "#0a1a2a", 0.84);
  const ceiling = mix(tint, "#0a1a2a", 0.88);
  const floor = mix(tint, "#0a1a2a", 0.93);
  // The back wall, and the point every edge of the room runs toward.
  const L = 110, R = 1090, T = 150, B = FLOOR_Y;
  const vx = 600, vy = 380, k = 9;
  const far = ([x, y]: number[]) => [vx + (x - vx) * k, vy + (y - vy) * k];
  const [tlx, tly] = far([L, T]), [trx, try_] = far([R, T]), [blx, bly] = far([L, B]), [brx, bry] = far([R, B]);
  /** Y of the top and bottom edge of a side wall at x. */
  const edge = (x: number) => {
    const s = Math.abs(vx - x) / (vx - L);
    return [vy + (T - vy) * s, vy + (B - vy) * s];
  };
  // Ribs of the corrugated metal: closer together far away, wider apart up close.
  const ribs = Array.from({ length: 22 }, (_, i) => 36 * (Math.pow(1.22, i) - 1) + 14 * i);
  const left = ribs.map((d) => L - d);
  const right = ribs.map((d) => R + d);
  const rib = (x: number) => {
    const [t, b] = edge(x);
    return `M${x} ${t}V${b}`;
  };
  return (
    <g>
      <polygon points={`${L},${T} ${R},${T} ${trx},${try_} ${tlx},${tly}`} fill={ceiling} />
      <polygon points={`${L},${B} ${R},${B} ${brx},${bry} ${blx},${bly}`} fill={floor} />
      <polygon points={`${L},${T} ${L},${B} ${blx},${bly} ${tlx},${tly}`} fill={side} />
      <polygon points={`${R},${T} ${R},${B} ${brx},${bry} ${trx},${try_}`} fill={side} />
      <rect x={L} y={T} width={R - L} height={B - T} fill={wall} />
      {/* Ribs on the back wall and both side walls */}
      <path d={Array.from({ length: 31 }, (_, i) => `M${L + 13 + i * 26} ${T}V${B}`).join("")} stroke={wallDeep} strokeWidth="5" opacity="0.7" />
      <path d={left.map(rib).join("")} stroke={wallDeep} strokeWidth="5" opacity="0.8" />
      <path d={right.map(rib).join("")} stroke={wallDeep} strokeWidth="5" opacity="0.8" />
      {/* Where the walls meet the floor and ceiling */}
      <path d={`M${L} ${T}H${R}V${B}H${L}Z`} fill="none" stroke={wallDeep} strokeWidth="6" />
      <path d={`M${L} ${B}L${blx} ${bly}M${R} ${B}L${brx} ${bry}M${L} ${T}L${tlx} ${tly}M${R} ${T}L${trx} ${try_}`} stroke={wallDeep} strokeWidth="6" />
    </g>
  );
}

/** Items standing on a piece of furniture (or the floor), drawn as themselves, front row first. */
function Standing({
  items,
  levels,
  cx,
  placed: given,
  visible,
  onPick,
}: {
  items: Item[];
  levels: Level[];
  cx: number;
  /** Where each item stands, when it has already been worked out (a desk laid out by its owner). */
  placed?: PlacedItem[];
  visible: boolean;
  onPick: (i: Item) => void;
}) {
  // Back rows first, so the front ones overlap them.
  const placed = given ?? placeOnLevels(items, levels, cx).sort((a, b) => a.y - b.y);
  return (
    <g>
      {placed.map(({ item, x, y, size }) => (
        <g
          key={item.id}
          className="rack__item"
          role="button"
          tabIndex={visible ? 0 : -1}
          aria-label={item.name}
          onClick={(e) => {
            e.stopPropagation();
            onPick(item);
          }}
          onKeyDown={(e) => onKey(e, () => onPick(item))}
          transform={`translate(${x} ${y})`}
        >
          <title>{item.name}</title>
          <ItemArt spec={artOf(item)} size={size} />
        </g>
      ))}
    </g>
  );
}

/**
 * Shelving racks standing on the two sides of the back wall, one shelf per category (a long
 * category takes several shelves). Everything is drawn standing on its shelf.
 */
function SideRacks({ items, tint, visible, onPick }: { items: Item[]; tint: string; visible: boolean; onPick: (i: Item) => void }) {
  const by = new Map<string, Item[]>();
  for (const i of items) by.set(i.category ?? "Other", [...(by.get(i.category ?? "Other") ?? []), i]);
  const cats = [...by.entries()].sort((a, b) => b[1].length - a[1].length);
  const BOTTOM = 508;
  const TOP = 172;
  const zoneW = RACK_ZONES[0].x1 - RACK_ZONES[0].x0;

  type Shelf = { name: string; first: boolean; total: number; items: Item[] };
  const build = (size: number): Shelf[] => {
    const cap = Math.max(1, Math.floor((zoneW - 36) / (size + 14)));
    const out: Shelf[] = [];
    for (const [name, list] of cats) {
      for (let k = 0; k < list.length; k += cap) out.push({ name, first: k === 0, total: list.length, items: list.slice(k, k + cap) });
    }
    return out;
  };
  // As big as will fit: shrink until each rack's shelves all fit between the floor and the top.
  let size = 54;
  for (; size > 24; size -= 2) {
    if (Math.ceil(build(size).length / 2) <= Math.floor((BOTTOM - TOP) / (size + 26))) break;
  }
  const shelves = build(size);
  const half = Math.ceil(shelves.length / 2);
  const racks = [shelves.slice(0, half), shelves.slice(half)];
  const frame = mix(tint, "#eaf0f4", 0.45);
  const post = mix(tint, "#eaf0f4", 0.25);

  return (
    <g>
      {racks.map((list, ri) => {
        if (list.length === 0) return null;
        const { x0, x1 } = RACK_ZONES[ri];
        const levelH = Math.min(120, (BOTTOM - TOP) / list.length);
        const top = BOTTOM - list.length * levelH;
        return (
          <g key={ri}>
            <rect x={x0 - 8} y={top - 6} width={8} height={BOTTOM - top + 6} fill={post} />
            <rect x={x1} y={top - 6} width={8} height={BOTTOM - top + 6} fill={post} />
            {list.map((shelf, li) => {
              const plank = top + (li + 1) * levelH;
              return (
                <g key={li}>
                  <rect x={x0 - 8} y={plank - 8} width={x1 - x0 + 16} height={8} fill={frame} />
                  <text className="rack__label" x={x0 + 4} y={plank - levelH + 16}>
                    {shelf.first ? `${shelf.name} · ${shelf.total}` : shelf.name}
                  </text>
                  {shelf.items.map((it, j) => (
                    <g
                      key={it.id}
                      className="rack__item"
                      role="button"
                      tabIndex={visible ? 0 : -1}
                      aria-label={it.name}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPick(it);
                      }}
                      onKeyDown={(e) => onKey(e, () => onPick(it))}
                      transform={`translate(${x0 + 18 + size / 2 + j * (shelf.items.length > 1 ? Math.min(size + 34, (zoneW - 36 - size) / (shelf.items.length - 1)) : 0)} ${plank - 8 - size / 2})`}
                    >
                      <title>{it.name}</title>
                      <ItemArt spec={artOf(it)} size={size} />
                    </g>
                  ))}
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

/** A desk in pieces: the top leaning on the wall and the legs on the floor. */
function TakenApart({
  item,
  x,
  y,
  size,
  visible,
  onPick,
}: {
  item: Item;
  x: number;
  y: number;
  size: number;
  visible: boolean;
  onPick: () => void;
}) {
  return (
    <g
      className="rack__item"
      role="button"
      tabIndex={visible ? 0 : -1}
      aria-label={`${item.name}, taken apart`}
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
      onKeyDown={(e) => onKey(e, onPick)}
    >
      <title>{`${item.name} (taken apart)`}</title>
      <g transform={`translate(${x} ${y})`}>
        <ItemArt spec={artOf(item)} size={size} />
      </g>
      <text className="scene__label" x={x} y={y + size / 2 + 22}>
        {item.name}
      </text>
    </g>
  );
}

/** Luggage and boxes, drawn to scale from their real dimensions. Click one to open it. */
function Boxes({
  placed,
  contents,
  openId,
  visible,
  onToggle,
}: {
  placed: PlacedBox[];
  contents: Map<string, Item[]>;
  openId: string | null;
  visible: boolean;
  onToggle: (id: string) => void;
}) {
  if (placed.length === 0) return null;
  // Wallets and pouches share one size for what sticks out of them, set by the smallest of them,
  // so a card looks the same size whichever of them it comes from.
  const small = placed.filter((p) => p.c.type === "Wallet" || p.c.type === "Pouch");
  const sharedPeek = small.length > 0 ? peekSizeFor(Math.min(...small.map((p) => p.w))) : undefined;
  return (
    <g>
      {placed.map((p) => (
        <Luggage
          key={p.c.id}
          peek={p.c.type === "Wallet" || p.c.type === "Pouch" ? sharedPeek : undefined}
          p={p}
          items={contents.get(p.c.id) ?? []}
          open={openId === p.c.id || (!!p.column && openId === `stack:${p.column[0]}`)}
          visible={visible}
          onToggle={onToggle}
        />
      ))}
    </g>
  );
}

/** What sticks out of a container is smaller than the container, never bigger than it. */
const peekSizeFor = (containerW: number) => Math.min(52, Math.max(16, containerW * 0.65));

function Luggage({
  p,
  peek,
  items,
  open,
  visible,
  onToggle,
  decor = false,
}: {
  p: PlacedBox;
  /** Drawn size of the things sticking out of it, when it should match another container's. */
  peek?: number;
  items: Item[];
  open: boolean;
  visible: boolean;
  onToggle?: (id: string) => void;
  /** A look-alike drawn above the backdrop: no button, not read out. */
  decor?: boolean;
}) {
  const { c, left, w, h, base } = p;
  const color = containerColor(c);
  const top = base - h;
  const card = c.type === "Cardboard box";
  const bag = c.type === "Bag";
  const pack = c.type === "Backpack";
  const wallet = c.type === "Wallet";
  const pouch = c.type === "Pouch";
  const accent = containerAccent(c);
  const slots = peekSlots(peekCount(w, items.length), left, w);
  const peeking = peekPicks(items, slots.length);
  const peekSize = peek ?? peekSizeFor(w);
  const peekK = peekSize / 52;
  const badge = Math.min(13, Math.max(8, w * 0.2));
  const flap = mix(color, "#ffffff", 0.18);
  const stacked = !!p.column && items.length === 0;
  const toggle = () => onToggle?.(stacked && p.column ? `stack:${p.column[0]}` : c.id);
  const has = items.length > 0;
  const live = (has || stacked) && !decor;
  return (
    <g
      className={`box${live ? " is-live" : ""}${open ? " is-open" : ""}`}
      role={live ? "button" : undefined}
      tabIndex={live && visible ? 0 : undefined}
      aria-expanded={live ? open : undefined}
      aria-label={
        live
          ? stacked
            ? `${c.name}, in a stack of ${p.column?.length}. Press to stand them up and tell them apart`
            : `${c.name}, ${items.length} ${items.length === 1 ? "item" : "items"}`
          : undefined
      }
      aria-hidden={decor || undefined}
      pointerEvents={decor ? "none" : undefined}
      onClick={
        live
          ? (e) => {
              e.stopPropagation();
              toggle();
            }
          : undefined
      }
      onKeyDown={live ? (e) => onKey(e, toggle) : undefined}
    >
      {!decor && <title>{stacked ? `${c.name} (stack of ${p.column?.length}: click to line them up)` : c.name}</title>}
      {card && (
        <>
          <path d={`M${left} ${top}l-9-15 ${w * 0.3 + 9}-2v17Z`} fill={flap} stroke="rgba(0,0,0,0.35)" strokeWidth="2" strokeLinejoin="round" />
          <path d={`M${left + w} ${top}l9-15-${w * 0.3 + 9}-2v17Z`} fill={flap} stroke="rgba(0,0,0,0.35)" strokeWidth="2" strokeLinejoin="round" />
        </>
      )}
      {/* Behind the body, so only the top of each item shows above the opening. */}
      <g className="box__peek">
        {peeking.map((it, i) => (
          <g key={it.id} transform={`translate(${slots[i].x} ${top - (slots[i].rise - 4) * peekK}) rotate(${slots[i].rot})`}>
            <ItemArt spec={artOf(it)} size={peekSize} />
          </g>
        ))}
      </g>
      {bag && (
        <>
          <path d={`M${left + w * 0.28} ${top}Q${left + w * 0.35} ${top - 24} ${left + w * 0.42} ${top}M${left + w * 0.58} ${top}Q${left + w * 0.65} ${top - 24} ${left + w * 0.72} ${top}`} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="9" strokeLinecap="round" />
          <path d={`M${left + w * 0.28} ${top}Q${left + w * 0.35} ${top - 24} ${left + w * 0.42} ${top}M${left + w * 0.58} ${top}Q${left + w * 0.65} ${top - 24} ${left + w * 0.72} ${top}`} fill="none" stroke={accent ?? mix(color, "#ffffff", 0.3)} strokeWidth="5" strokeLinecap="round" />
        </>
      )}
      <rect x={left} y={top} width={w} height={h} rx={card ? 4 : bag ? h * 0.4 : pack ? w * 0.28 : wallet ? 6 : pouch ? h * 0.35 : 12} fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
      {card ? (
        <>
          <rect x={left + w / 2 - 10} y={top} width={20} height={h * 0.38} fill="rgba(255,255,255,0.28)" />
          <path d={`M${left} ${top + 8}h${w}`} stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
        </>
      ) : bag ? (
        <>
          {/* A gym bag: side panels and a zipper along the top in the trim color. */}
          <rect x={left + w * 0.1} y={top + 2} width={w * 0.07} height={h - 4} fill={accent ?? "rgba(255,255,255,0.28)"} />
          <rect x={left + w * 0.83} y={top + 2} width={w * 0.07} height={h - 4} fill={accent ?? "rgba(255,255,255,0.28)"} />
          <path d={`M${left + w * 0.17} ${top + 8}H${left + w * 0.83}`} stroke={accent ?? "rgba(255,255,255,0.4)"} strokeWidth="3" strokeDasharray="4 3" />
          <rect x={left + w * 0.34} y={top + h * 0.45} width={w * 0.32} height={h * 0.38} rx={4} fill="none" stroke={accent ?? "rgba(255,255,255,0.3)"} strokeWidth="3" />
        </>
      ) : wallet ? (
        <>
          {/* A bifold wallet: stitched edge, a flap line and a corner of card showing. */}
          <rect x={left + 4} y={top + 4} width={w - 8} height={h - 8} rx={4} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.6" strokeDasharray="3 2.5" />
          <path d={`M${left} ${top + h * 0.35}H${left + w}`} stroke="rgba(0,0,0,0.3)" strokeWidth="2" />
          <rect x={left + w * 0.68} y={top - 5} width={w * 0.2} height={8} rx={1.5} fill="#e8eef5" stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
        </>
      ) : pouch ? (
        <>
          {/* A zippered pouch: a zipper along the top and a wrist strap looped off one end. */}
          <path d={`M${left + w} ${top + h * 0.3}c${h * 0.5} 0 ${h * 0.5} ${h * 0.4} 0 ${h * 0.4}`} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="3" strokeLinecap="round" />
          <path d={`M${left + w * 0.1} ${top + h * 0.3}H${left + w * 0.9}`} stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeDasharray="3 2.5" />
        </>
      ) : pack ? (
        <>
          {/* A backpack: a grab loop on top, a big front pocket with a zipper, and shoulder straps down the sides. */}
          <path d={`M${left + w * 0.4} ${top}v-9h${w * 0.2}v9`} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x={left + w * 0.12} y={top + h * 0.5} width={w * 0.76} height={h * 0.42} rx={w * 0.12} fill="rgba(0,0,0,0.18)" stroke="rgba(0,0,0,0.3)" strokeWidth="2" />
          <path d={`M${left + w * 0.22} ${top + h * 0.6}H${left + w * 0.78}`} stroke="rgba(255,255,255,0.45)" strokeWidth="3" strokeDasharray="4 3" />
          <path d={`M${left + w * 0.1} ${top + h * 0.12}V${top + h * 0.7}M${left + w * 0.9} ${top + h * 0.12}V${top + h * 0.7}`} stroke="rgba(0,0,0,0.3)" strokeWidth="5" strokeLinecap="round" />
        </>
      ) : p.lying ? (
        <>
          {/* A case on its back: handle on the end, ribs running the long way. */}
          <path d={`M${left + w} ${top + h * 0.3}h9v${h * 0.4}h-9`} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d={`M${left + 14} ${top + h * 0.33}h${w - 28}M${left + 14} ${top + h * 0.67}h${w - 28}`} stroke="rgba(255,255,255,0.22)" strokeWidth="4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d={`M${left + w / 2 - 14} ${top}v-12h28v12`} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="5" strokeLinecap="round" />
          <path d={`M${left + w * 0.3} ${top + 14}v${h - 28}M${left + w * 0.7} ${top + 14}v${h - 28}`} stroke="rgba(255,255,255,0.22)" strokeWidth="5" strokeLinecap="round" />
        </>
      )}
      {/* The inside of the opening: a darker rim along the top edge. */}
      {has && <rect x={left + 3} y={top + 2} width={w - 6} height={6} rx={3} fill="rgba(0,0,0,0.3)" />}
      {live && has && (
        <>
          <circle className="tile__badge" cx={left + w - 2} cy={top + 2} r={badge} />
          <text className="tile__count" x={left + w - 2} y={top + 2 + badge * 0.35} style={{ fontSize: badge }}>
            {items.length}
          </text>
        </>
      )}
    </g>
  );
}

/** A name under a container: split in two at the space nearest the middle when it is long. */
function LineupLabel({ name, x, y, room }: { name: string; x: number; y: number; room: number }) {
  const words = name.split(" ");
  let lines = [name];
  if (name.length > 11 && words.length > 1) {
    let best = 1;
    for (let i = 1; i < words.length; i++) {
      if (Math.abs(words.slice(0, i).join(" ").length - name.length / 2) < Math.abs(words.slice(0, best).join(" ").length - name.length / 2)) best = i;
    }
    lines = [words.slice(0, best).join(" "), words.slice(best).join(" ")];
  }
  const longest = Math.max(...lines.map((l) => l.length));
  const size = Math.max(10, Math.min(22, room / (longest * 0.78)));
  return (
    <text className="scene__label" x={x} y={y} style={{ fontSize: size }}>
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : size * 1.15}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

/** A stack stood up in a row over a dark backdrop, each container with its name under it. */
function Lineup({ plan, visible }: { plan: LineupPlan; visible: boolean }) {
  return (
    <g className="burst">
      <rect className="burst__veil" x={-4000} y={-4000} width={9200} height={9200} />
      {plan.boxes.map((p) => (
        <g key={p.c.id} className="burst__item" style={{ "--x": "0px", "--y": "0px", "--r": "0deg", "--d": "0s" } as CSSProperties}>
          <Luggage p={p} items={[]} open visible={visible} decor />
          {/* The name sits under its own container, on two lines when it is long, sized to fit. */}
          <LineupLabel name={p.c.name} x={p.left + p.w / 2} y={p.base + 36} room={p.w + 30} />
        </g>
      ))}
    </g>
  );
}

/**
 * All of an open container's items, fanned out above it over a dark backdrop. The camera has
 * zoomed to fit them (see burstPlan).
 */
function Burst({
  box,
  items,
  showBox,
  plan,
  groups,
  piles,
  visible,
  onPickItem,
}: {
  box: PlacedBox;
  items: Item[];
  /** Draw the container's look-alike under the items (not for a loose pile). */
  showBox: boolean;
  plan: BurstPlan;
  /** The cash in the container, which the stand-in items for the handful and its total draw. */
  groups: CashGroup[];
  /** The piles (books, cards, ...) drawn as one stack each. */
  piles: Pile[];
  visible: boolean;
  onPickItem: (i: Item) => void;
}) {
  const { slots, anchorX, anchorY } = plan;
  const cashLabel = `Cash: ${groups.map((g) => money(g.total, g.currency)).join(", ")}. Press for the notes by denomination`;
  const style = (i: number) =>
    ({
      "--x": `${slots[i].x}px`,
      "--y": `${slots[i].y}px`,
      "--r": `${slots[i].rot}deg`,
      "--d": `${slots[i].delay}s`,
    }) as CSSProperties;
  return (
    <g className="burst">
      {/* Dims the room; a click on it falls through to the scene and closes the container. */}
      <rect className="burst__veil" x={-4000} y={-4000} width={9200} height={9200} />
      {showBox && <Luggage p={box} items={items} open visible={visible} decor />}
      <g transform={`translate(${anchorX} ${anchorY})`}>
      {items.map((it, i) => (
        <g
          key={it.id}
          className="burst__item"
          style={style(i)}
          role="button"
          tabIndex={visible ? 0 : -1}
          aria-label={isCashStub(it.id) ? cashLabel : isPileId(it.id) ? `${piles.find((p) => p.id === it.id)?.label}, piled up` : it.name}
          onClick={(e) => {
            e.stopPropagation();
            onPickItem(it);
          }}
          onKeyDown={(e) => onKey(e, () => onPickItem(it))}
        >
          <title>{isCashStub(it.id) ? cashLabel : isPileId(it.id) ? (piles.find((p) => p.id === it.id)?.label ?? it.name) : it.name}</title>
          <g className="burst__art">
            {it.id === CASH_ART ? (
              <Handful groups={groups} size={BURST_ITEM * 1.05} />
            ) : it.id === CASH_SUM ? (
              <CashTotals groups={groups} />
            ) : isPileId(it.id) ? (
              <PileArt pile={piles.find((p) => p.id === it.id) ?? { id: it.id, label: it.name, kind: "books", items: [] }} size={BURST_ITEM} />
            ) : (
              <ItemArt spec={artOf(it)} size={BURST_ITEM} />
            )}
          </g>
        </g>
      ))}
      </g>
    </g>
  );
}

interface Tones {
  x: number;
  light: string;
  mid: string;
  dark: string;
}

/**
 * A desk seen from well above so the top is a deep slab tilted toward us: narrow and high at the
 * back, wide and low at the front, with room for rows of things. A work desk (wide) is longer and
 * has a pedestal of drawers on the right. The back legs stand on the floor behind the front ones.
 */
function Desk({
  x,
  light,
  mid,
  dark,
  wide = 1,
  drawers = false,
}: Tones & { wide?: number; drawers?: boolean }): ReactNode {
  const w = wide;
  const px = x + 208 * w - 118;
  return (
    <g>
      <rect x={x - 156 * w} y={264} width={11} height={548 - 264} fill={dark} opacity={0.65} />
      <rect x={x + 145 * w} y={264} width={11} height={548 - 264} fill={dark} opacity={0.65} />
      <rect x={x - 192 * w} y={414} width={16} height={BASE_Y - 414} fill={dark} />
      {drawers ? (
        <g>
          <rect x={px} y={414} width={106} height={BASE_Y - 414} rx={4} fill={mid} />
          {[0, 1, 2].map((k) => (
            <g key={k}>
              <path d={`M${px + 6} ${462 + k * 48}h94`} stroke={dark} strokeWidth="3" opacity="0.5" />
              <rect x={px + 41} y={440 + k * 48} width={24} height={6} rx={3} fill={dark} opacity="0.7" />
            </g>
          ))}
        </g>
      ) : (
        <rect x={x + 176 * w} y={414} width={16} height={BASE_Y - 414} fill={dark} />
      )}
      <polygon points={`${x - 160 * w},252 ${x + 160 * w},252 ${x + 208 * w},402 ${x - 208 * w},402`} fill={light} />
      <path d={`M${x - 175 * w} 300H${x + 175 * w}M${x - 188 * w} 340H${x + 188 * w}M${x - 199 * w} 375H${x + 199 * w}`} stroke={mid} strokeWidth="2" opacity="0.45" />
      <rect x={x - 208 * w} y={402} width={416 * w} height={16} rx={4} fill={mid} />
    </g>
  );
}

function Closet({ x, light, mid, deep }: Omit<Tones, "dark"> & { deep: string }): ReactNode {
  return (
    <g>
      <rect x={x - 130} y={190} width={260} height={BASE_Y - 190} rx={6} fill={mid} />
      <rect x={x - 114} y={206} width={228} height={BASE_Y - 206 - 10} fill={deep} />
      <rect x={x - 114} y={CLOSET_SHELF_Y + 2} width={228} height={10} fill={light} />
      {/* The top shelf, above the one in the middle. */}
      <rect x={x - 114} y={CLOSET_TOP_Y} width={228} height={9} fill={light} />
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

/** A couch seen from the front: a back, two arms and a seat cushion to put things on. */
function Couch({ x, light, mid, dark }: Tones): ReactNode {
  return (
    <g>
      <rect x={x - 150} y={438} width={300} height={100} rx={16} fill={mid} />
      <rect x={x - 172} y={472} width={38} height={98} rx={14} fill={light} />
      <rect x={x + 134} y={472} width={38} height={98} rx={14} fill={light} />
      <rect x={x - 136} y={502} width={272} height={52} rx={10} fill={light} />
      <path d={`M${x} 504v48`} stroke={dark} strokeWidth="3" opacity="0.35" />
      <rect x={x - 150} y={554} width={12} height={16} fill={dark} />
      <rect x={x + 138} y={554} width={12} height={16} fill={dark} />
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
