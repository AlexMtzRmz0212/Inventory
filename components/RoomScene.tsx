"use client";

import { animate } from "framer-motion";
import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import { flushSync } from "react-dom";
import { setDeskSpot, setDeskSpots } from "@/app/actions/inventory";
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
import { artKind, artOf, type ArtKind } from "@/lib/item-art";
import type { PlaceIndex } from "@/lib/places";
import {
  BASE_Y,
  BURST_ITEM,
  DRAWER_CHEST,
  FLOOR_BOX_Y,
  FLOOR_ITEMS_Y,
  FLOOR_Y,
  FURNITURE_WIDTH,
  HOOK_WIDTH,
  MAX_INDIVIDUAL,
  SCENE_H,
  SCENE_W,
  burstPlan,
  closetStorage,
  deskLayout,
  deskPoint,
  deskSpotEdits,
  deskUV,
  deskWidth,
  drawerGroups,
  hasTableSpot,
  hookLayout,
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
  type HookPlaced,
  type Level,
  type LineupPlan,
  type PlacedBox,
  type PlacedItem,
  type SpotEdit,
  underDesk,
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
  /** The owner may pin things to spots on a desk by dragging them. */
  canArrange?: boolean;
  /** The owner may mark an item as a favorite, or take the mark off. */
  onFavorite?: (id: string, favorite: boolean) => void;
}

/** Where a thing sits on its desk, 0 to 100 each way; both null is "wherever there is room". */
type Spot = { x: number | null; y: number | null };

/** The owner's tools while arranging one desk, handed to the things on it. */
interface Arrange {
  svg: RefObject<SVGSVGElement | null>;
  /** Center and width of the desk, to turn a point on the screen into a spot on its top. */
  cx: number;
  wide: number;
  /** The thing being dragged, drawn last so it passes in front of the rest. */
  liftedId: string | null;
  lift: (id: string | null) => void;
  /** Pins a thing to a spot on this desk, or lets it go with null. It never changes where the thing is kept. */
  move: (kind: "item" | "container", id: string, x: number | null, y: number | null) => void;
  /** Containers standing on the desk top: the only ones that can be moved. */
  boxIds: Set<string>;
}

/** The inventory with the owner's latest pins laid over it, until what was saved comes back. */
function withSpots(inv: Inventory, spots: Record<string, Spot>): Inventory {
  if (Object.keys(spots).length === 0) return inv;
  const at = <T extends { id: string; tableX: number | null; tableY: number | null }>(t: T): T => {
    const s = spots[t.id];
    return s ? { ...t, tableX: s.x, tableY: s.y } : t;
  };
  return { ...inv, items: inv.items.map(at), containers: inv.containers.map(at) };
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
    { y: 418, width: 210, scale: 1 },
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
const CLOSET_SHELF_Y = 418;
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

export default function RoomScene({ site, idx, inventory: base, tint, focusId, visible, onFocus, canArrange = false, onFavorite }: Props) {
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

  // Spots the owner has just pinned, shown at once while they are saved.
  const [pins, setPins] = useState<Record<string, Spot>>({});
  // Once what was saved comes back with the next page, the pin has done its job.
  const [seen, setSeen] = useState(base);
  if (seen !== base) {
    setSeen(base);
    setPins((o) => {
      const kept: Record<string, Spot> = {};
      for (const t of [...base.items, ...base.containers]) {
        const s = o[t.id];
        if (s && !(t.tableX === s.x && t.tableY === s.y)) kept[t.id] = s;
      }
      return kept;
    });
  }
  const inventory = useMemo(() => withSpots(base, pins), [base, pins]);
  /** Which items are favorites right now, for the ones in an open list that was taken before the mark changed. */
  const favOf = useMemo(() => new Map(inventory.items.map((i) => [i.id, i.favorite])), [inventory]);
  /** The desk being arranged (a spot id), the thing being dragged, and a message when a save fails. */
  const [arrangeFor, setArrangeFor] = useState<string | null>(null);
  const [liftedId, setLiftedId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [, startSave] = useTransition();

  const spots = useMemo(
    () => (idx.children.get(site.id) ?? []).filter((p) => p.level === "Spot"),
    [idx, site.id],
  );
  const kinds = useMemo(() => spots.map((p) => furnitureKind(p.name)), [spots]);
  const { xs, span } = useMemo(() => slotsFor(kinds), [kinds]);
  const spotIndex = spots.findIndex((s) => s.id === focusId);
  const deskFocused = spotIndex >= 0 && kinds[spotIndex] === "desk";
  const arranging = canArrange && visible && deskFocused && arrangeFor === focusId;

  /** Pins a thing to a spot on the desk it is on, or lets it go with null. Only its Table X and Y ever change. */
  const save = (kind: "item" | "container", id: string, x: number | null, y: number | null) => {
    setNote(null);
    setPins((o) => ({ ...o, [id]: { x, y } }));
    startSave(async () => {
      let ok = false;
      try {
        ok = (await setDeskSpot(kind, id, x, y)).ok;
      } catch {
        ok = false;
      }
      if (!ok) {
        setPins((o) => {
          const rest = { ...o };
          delete rest[id];
          return rest;
        });
        setNote("Couldn't save that spot.");
      }
    });
  };

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
    // While arranging, the desk is laid out the same way whether or not anything is pinned yet, so what is dragged is what is seen.
    const forced = arranging && spot.id === focusId;
    if (kinds[i] !== "desk" || !(forced || loose.some(hasTableSpot) || here.some(hasTableSpot))) return null;
    const onTop = here.filter((c) => c.type === "Wallet" || c.type === "Pouch" || hasTableSpot(c));
    return deskLayout(loose, onTop, xs[i], deskWidth(spot.name));
  });
  // What "Pin all" and "Unpin all" would change on the desk being arranged.
  const bulk = useMemo(() => {
    const plan = arranging ? deskPlans[spotIndex] : null;
    return plan ? deskSpotEdits(plan, xs[spotIndex], deskWidth(spots[spotIndex].name)) : { pin: [], unpin: [] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arranging, spotIndex, inventory, xs, spots]);

  /** Pins or lets go of a whole desk's things in one go, so one drag does not reshuffle the rest. */
  const saveAll = (edits: SpotEdit[]) => {
    if (edits.length === 0) return;
    setNote(null);
    setPins((o) => {
      const next = { ...o };
      for (const e of edits) next[e.id] = { x: e.x, y: e.y };
      return next;
    });
    startSave(async () => {
      let failed = edits.map((e) => e.id);
      try {
        failed = (await setDeskSpots(edits)).failed;
      } catch {
        // everything is put back
      }
      if (failed.length > 0) {
        setPins((o) => {
          const rest = { ...o };
          for (const id of failed) delete rest[id];
          return rest;
        });
        setNote(`Couldn't save ${failed.length === edits.length ? "those spots" : `${failed.length} of them`}.`);
      }
    });
  };

  // Cardboard boxes in a closet sit on its shelf; backpacks and the like stand on the floor.
  const shelfBoxes = spots.map((spot, i) =>
    kinds[i] === "closet" ? boxesAt(spot.id).filter((c) => c.type === "Cardboard box") : [],
  );
  // In a closet, clothes on a hook hang across the back and clothes in a drawer are folded in the chest
  // on the floor; only what is kept in neither stands around on the shelf and floor.
  const closetStores = spots.map((spot, i) =>
    kinds[i] === "closet" ? closetStorage(itemsAt(spot.id)) : null,
  );
  const hookPlans: (HookPlaced[] | null)[] = spots.map((_, i) => {
    const hooks = closetStores[i]?.hooks ?? [];
    return hooks.length > 0 ? hookLayout(hooks, xs[i]) : null;
  });
  const chestOn = closetStores.map((s) => (s?.drawers.length ?? 0) > 0);
  /** Where loose things in a closet stand: its shelf rows, or just the floor once hooks hang where the upper row would be. */
  const closetLevels = (i: number): Level[] => {
    if (hookPlans[i]) return [{ y: BASE_Y - 10, width: chestOn[i] ? 96 : 200, scale: 1 }];
    return shelfBoxes[i].length > 0 ? LEVELS.closet.slice(1) : LEVELS.closet;
  };
  // With a chest of drawers on the right of the floor, what stands on the floor keeps to the left of it.
  const closetX = (i: number) => (chestOn[i] ? xs[i] - 58 : xs[i]);
  // Things on a closet's top shelf stand along it where their Table X says; the rest go on the usual rows.
  const closetPlans = spots.map((spot, i) => {
    if (kinds[i] !== "closet") return undefined;
    const loose = closetStores[i]?.rest ?? [];
    const top = loose.filter(onTopShelf);
    if (top.length === 0) return undefined;
    const levels = closetLevels(i);
    const size = 38;
    const onShelf = top.map((item) => ({
      item,
      x: xs[i] + ((item.tableX ?? 50) / 100 - 0.5) * 190,
      y: CLOSET_TOP_Y - size / 2,
      size,
    }));
    return [...placeOnLevels(loose.filter((it) => !onTopShelf(it)), levels, closetX(i)), ...onShelf].sort((a, b) => a.y - b.y);
  });
  const spotBoxes = spots.map((spot, i) => {
    const kind = furnitureKind(spot.name);
    const here = boxesAt(spot.id);
    const plan = deskPlans[i];
    // Luggage on a closet floor keeps to the left of its chest of drawers, when it has one.
    const floorX = kind === "closet" ? closetX(i) : xs[i];
    const floorW = kind === "closet" && chestOn[i] ? 100 : FURNITURE_WIDTH[kind] - 50;
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
        ...layoutBoxes(shelfBoxes[i], xs[i], CLOSET_SHELF_Y, 200, hasItems, 1.5),
        // The rest keep their life size on the floor, as they did beside the boxes.
        ...layoutBoxes(here.filter((c) => !onShelf.has(c.id)), floorX, BASE_Y - 6, floorW, hasItems, 1.5),
      ];
    }
    // A wallet is small enough to sit on top of the furniture instead of standing on the floor in front of it.
    const small = here.filter((c) => c.type === "Wallet");
    return [
      ...layoutBoxes(here.filter((c) => c.type !== "Wallet"), floorX, BASE_Y - 6, floorW, hasItems),
      ...layoutBoxes(small, xs[i] + 150, LEVELS[kind][0].y - 4, 90, hasItems, 4.5),
    ];
  });
  const floorBoxes = layoutBoxes(boxesAt(site.id), SCENE_W / 2, FLOOR_BOX_Y, rackOn ? 480 : 1100, hasItems);
  const placedBoxes = [...spotBoxes.flat(), ...floorBoxes];
  // Each drawer with something in it opens like a container: it is laid out here as one, and what is
  // folded in it comes out of it above the room.
  const drawerBoxes: PlacedBox[] = [];
  const drawerContents = new Map<string, Item[]>();
  spots.forEach((spot, i) => {
    if (!chestOn[i]) return;
    const { dx, width, top, bottom } = DRAWER_CHEST;
    const groups = drawerGroups(closetStores[i]?.drawers ?? []);
    const h = (bottom - top) / groups.length;
    groups.forEach((g, k) => {
      if (g.items.length === 0) return;
      const id = `drawer:${spot.id}:${g.label}`;
      const c: Container = {
        id,
        name: `${g.label} drawer`,
        type: "Drawer",
        color: null,
        owner: null,
        widthCm: null,
        heightCm: null,
        lengthCm: null,
        volumeL: null,
        filled: false,
        locationId: spot.id,
        tableX: null,
        tableY: null,
      };
      drawerBoxes.push({ c, left: xs[i] + dx, w: width, h: h - 3, base: top + (k + 1) * h - 1.5 });
      drawerContents.set(id, g.items);
    });
  });
  const live = visible && open && open.at === focusId ? open : null;
  const openId = live ? live.id : null;
  const stackId = live && live.id.startsWith("stack:") ? live.id.slice(6) : null;
  const openBox = live && !stackId ? ([...placedBoxes, ...drawerBoxes].find((p) => p.c.id === live.id) ?? null) : null;
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
  const rawOpen = live ? (contents.get(live.id) ?? drawerContents.get(live.id) ?? []) : [];
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
      const name = spots[spotIndex].name;
      const wide = deskWidth(name);
      // A big desk ("Large desk", "Office desk") is aimed higher, so less of its legs show and its top fills the view.
      const big = /large|office/i.test(name);
      return {
        cy: (low ? 360 : 316) - (big ? 30 : 0),
        cx: xs[spotIndex],
        w: Math.max(330, 210 * a) * wide * (low ? 1.2 : 1),
      };
    }
    // A couch sits low in the room, so look at it lower and closer.
    if (spotIndex >= 0 && kinds[spotIndex] === "couch") return { cx: xs[spotIndex], cy: 490, w: Math.max(460, 300 * a) };
    // A closet fills the screen, its edges almost on the view's edges. The view is 400 tall, from 175 (the closet
    // starts at 190) to 575 (its base is at 570); it is 400 wide at least, and wider on a wide screen so the height holds.
    if (spotIndex >= 0 && kinds[spotIndex] === "closet") return { cx: xs[spotIndex], cy: 375, w: Math.max(400, 400 * a) };
    return spotIndex >= 0
      ? { cx: xs[spotIndex], cy: 400, w: Math.max(520, 420 * a) }
      : // Mom's apartment is aimed higher, so everything sits lower in the view: less floor, more wall.
        { cx: SCENE_W / 2, cy: /mom/i.test(site.name) ? 365 : 440, w: Math.max(1100, 620 * a, span + 180) };
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
        className={arranging ? "scene__svg is-arranging" : "scene__svg"}
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
          const arrange: Arrange | undefined =
            arranging && spot.id === focusId
              ? {
                  svg: svgRef,
                  cx: x,
                  wide: deskWidth(spot.name),
                  liftedId,
                  lift: setLiftedId,
                  move: save,
                  boxIds: new Set((deskPlans[i]?.boxes ?? []).map((p) => p.c.id)),
                }
              : undefined;
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
              {hookPlans[i] && (
                <>
                  <HookRack x={x} placed={hookPlans[i] ?? []} light={light} />
                  <Standing
                    items={[]}
                    levels={[]}
                    cx={x}
                    // Lower rows hang in front of the higher ones.
                    placed={[...(hookPlans[i] ?? [])].sort((a, b) => a.peg - b.peg)}
                    visible={visible}
                    onPick={pickItem}
                  />
                </>
              )}
              {chestOn[i] && (
                <DrawerChest
                  x={x}
                  groups={drawerGroups(closetStores[i]?.drawers ?? [])}
                  light={light}
                  mid={mid}
                  dark={dark}
                  visible={visible}
                  openId={openId}
                  onPick={(label) => toggle(`drawer:${spot.id}:${label}`)}
                />
              )}
              <Boxes placed={spotBoxes[i]} contents={contents} openId={openId} visible={visible} onToggle={toggle} arrange={arrange} />
              <Standing
                items={closetStores[i]?.rest ?? itemsAt(spot.id)}
                // With boxes on the closet shelf, loose things hang above it instead.
                levels={kind === "closet" ? closetLevels(i) : shelfBoxes[i].length > 0 ? LEVELS[kind].slice(1) : LEVELS[kind]}
                cx={kind === "desk" ? x - 40 : kind === "closet" ? closetX(i) : x}
                placed={deskPlans[i]?.items ?? closetPlans[i]}
                visible={visible}
                onPick={pickItem}
                arrange={arrange}
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
            backdrop={
              openBox.c.type === "Drawer" ? (
                <DrawerOpen box={openBox} fill={mid} edge={dark} />
              ) : undefined
            }
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

      {canArrange && deskFocused && !openBox && !lineup && (
        <div className="scene__arrange">
          {arranging && <p>{note ?? "Drag to pin. Tap a pin to let go."}</p>}
          {arranging && bulk.pin.length > 0 && (
            <button type="button" className="btn btn--ghost" onClick={() => saveAll(bulk.pin)}>
              Pin all
            </button>
          )}
          {arranging && bulk.unpin.length > 0 && (
            <button type="button" className="btn btn--ghost" onClick={() => saveAll(bulk.unpin)}>
              Unpin all
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost"
            aria-pressed={arranging}
            onClick={() => {
              setNote(null);
              setPicked(null);
              setArrangeFor(arranging ? null : focusId);
            }}
          >
            {arranging ? "Done" : "Arrange"}
          </button>
        </div>
      )}

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
            <ul className={showPicked.art ? "scene__pop-art" : undefined}>
              {showPicked.items.map((i) => (
                <li key={i.id}>
                  {showPicked.art && (
                    <svg viewBox="-26 -26 52 52" width="38" height="38" aria-hidden="true">
                      <ItemArt spec={artOf(i)} size={48} />
                    </svg>
                  )}
                  <span>
                    {i.name}
                    {i.fragile && <small>Fragile</small>}
                    {i.notes && <small>{i.notes}</small>}
                  </span>
                  <FavButton item={i} favorite={favOf.get(i.id) ?? i.favorite} onFavorite={onFavorite} compact />
                </li>
              ))}
            </ul>
          ) : (
            <>
              <ul>
                <li>
                  {showPicked.items[0].category ?? "Other"}
                  {showPicked.items[0].fragile && <small>Fragile</small>}
                  {showPicked.items[0].notes && <small>{showPicked.items[0].notes}</small>}
                </li>
              </ul>
              <FavButton item={showPicked.items[0]} favorite={favOf.get(showPicked.items[0].id) ?? showPicked.items[0].favorite} onFavorite={onFavorite} />
            </>
          )}
          <button type="button" className="btn btn--ghost" onClick={() => setPicked(null)}>
            Close
          </button>
        </aside>
      )}
    </div>
  );
}

/** A small gold star at the top corner of a favorite. */
function FavMark({ size }: { size: number }) {
  const r = Math.max(5, size * 0.17);
  return (
    <g className="favmark" transform={`translate(${size * 0.38} ${-size * 0.38}) scale(${r / 10})`} aria-hidden="true" pointerEvents="none">
      <path d="M0 -10 2.9 -3.4 10 -3.1 4.5 1.6 6.2 8.5 0 4.8 -6.2 8.5 -4.5 1.6 -10 -3.1 -2.9 -3.4Z" />
    </g>
  );
}

/**
 * The star that marks an item as a favorite. The owner can press it to mark or unmark; anyone else
 * only sees it on an item that is one.
 */
function FavButton({
  item,
  favorite,
  onFavorite,
  compact = false,
}: {
  item: Item;
  favorite: boolean;
  onFavorite?: (id: string, favorite: boolean) => void;
  /** Just the star, for a row in a list. */
  compact?: boolean;
}) {
  if (!onFavorite) {
    return favorite ? (
      <span className={compact ? "fav fav--compact fav--static" : "fav fav--static"} title="Favorite">
        <span aria-hidden="true">★</span>
        {compact ? <span className="sr-only">Favorite</span> : " Favorite"}
      </span>
    ) : null;
  }
  return (
    <button
      type="button"
      className={compact ? "fav fav--compact" : "fav"}
      aria-pressed={favorite}
      aria-label={favorite ? `Take ${item.name} off your favorites` : `Add ${item.name} to your favorites`}
      title={favorite ? "Remove from favorites" : "Add to favorites"}
      onClick={() => onFavorite(item.id, !favorite)}
    >
      <span aria-hidden="true">{favorite ? "★" : "☆"}</span>
      {!compact && (favorite ? " Favorite" : " Add to favorites")}
    </button>
  );
}

/** The rails across the back of a closet and the hook each hanging thing is on. */
function HookRack({ x, placed, light }: { x: number; placed: HookPlaced[]; light: string }) {
  const rows = [...new Set(placed.map((p) => p.peg))];
  return (
    <g aria-hidden="true" pointerEvents="none">
      {rows.map((y) => (
        <rect key={y} x={x - HOOK_WIDTH / 2 - 6} y={y - 2} width={HOOK_WIDTH + 12} height={4} rx={2} fill={light} opacity={0.45} />
      ))}
      {/* A belt hangs from the rail by its buckle, with no hook. */}
      {placed.filter((p) => artKind(p.item) !== "belt").map((p) => (
        <path key={p.item.id} d={`M${p.x} ${p.peg + 5}V${p.peg - 1}a3 3 0 1 1 3 3`} fill="none" stroke={light} strokeWidth="2.2" strokeLinecap="round" />
      ))}
    </g>
  );
}

/** A chest of drawers on a closet's floor: one drawer for tops, one for bottoms, one for the rest. Press a drawer to see what is folded in it. */
function DrawerChest({
  x,
  groups,
  light,
  mid,
  dark,
  visible,
  openId,
  onPick,
}: Tones & {
  groups: { label: string; items: Item[] }[];
  visible: boolean;
  /** The container that is open, so its drawer is not also drawn shut. */
  openId: string | null;
  onPick: (label: string) => void;
}) {
  const { dx, width, top, bottom } = DRAWER_CHEST;
  const left = x + dx;
  const h = (bottom - top) / groups.length;
  return (
    <g>
      <rect x={left - 3} y={top - 4} width={width + 6} height={bottom - top + 4} rx={4} fill={dark} />
      <rect x={left - 6} y={top - 10} width={width + 12} height={7} rx={3} fill={light} />
      {groups.map((g, k) => {
        const y = top + k * h;
        const has = g.items.length > 0;
        const press = () => onPick(g.label);
        return (
          <g
            key={g.label}
            className={has ? "drawer is-live" : "drawer"}
            role={has ? "button" : undefined}
            tabIndex={has && visible ? 0 : undefined}
            aria-expanded={has ? openId?.endsWith(`:${g.label}`) === true && openId.startsWith("drawer:") : undefined}
            aria-label={has ? `${g.label} drawer, ${g.items.length} ${g.items.length === 1 ? "item" : "items"}` : undefined}
            aria-hidden={has ? undefined : true}
            onClick={
              has
                ? (e) => {
                    e.stopPropagation();
                    press();
                  }
                : undefined
            }
            onKeyDown={has ? (e) => onKey(e, press) : undefined}
          >
            {has && <title>{`${g.label} drawer`}</title>}
            <rect x={left} y={y + 1.5} width={width} height={h - 3} rx={3} fill={mid} stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
            <text className="drawer__label" x={left + 7} y={y + 12}>
              {g.label}
            </text>
            <rect x={left + width / 2 - 13} y={y + h - 13} width={26} height={6} rx={3} fill={dark} opacity={0.7} />
            {has && (
              <>
                <circle className="tile__badge" cx={left + width - 9} cy={y + 10} r={6} />
                <text className="tile__count" x={left + width - 9} y={y + 12.5} style={{ fontSize: 7.5 }}>
                  {g.items.length}
                </text>
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** A drawer pulled open: its front with the handle, and a dark opening along the top that what is inside comes out of. */
function DrawerOpen({ box, fill, edge }: { box: PlacedBox; fill: string; edge: string }) {
  const { left, w, h, base } = box;
  const top = base - h;
  return (
    <g aria-hidden="true" pointerEvents="none">
      <rect x={left - 4} y={top - 7} width={w + 8} height={13} rx={4} fill={edge} />
      <rect x={left} y={top} width={w} height={h} rx={3} fill={fill} stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
      <rect x={left + 4} y={top - 3} width={w - 8} height={7} rx={3} fill="rgba(0,0,0,0.55)" />
      <rect x={left + w / 2 - 13} y={base - 13} width={26} height={6} rx={3} fill={edge} opacity={0.7} />
    </g>
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
  arrange,
}: {
  items: Item[];
  levels: Level[];
  cx: number;
  /** Where each item stands, when it has already been worked out (a desk laid out by its owner). */
  placed?: PlacedItem[];
  visible: boolean;
  onPick: (i: Item) => void;
  /** Set while the owner arranges this desk: its things can be dragged around the desk top. */
  arrange?: Arrange;
}) {
  // Back rows first, so the front ones overlap them.
  const sorted = given ?? placeOnLevels(items, levels, cx).sort((a, b) => a.y - b.y);
  // The one being dragged is drawn last, in front of the rest.
  const placed = arrange?.liftedId
    ? [...sorted.filter((p) => p.item.id !== arrange.liftedId), ...sorted.filter((p) => p.item.id === arrange.liftedId)]
    : sorted;
  return (
    <g>
      {placed.map(({ item, x, y, size }) => {
        const art = (
          <g
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
            <title>{item.favorite ? `${item.name} (favorite)` : item.name}</title>
            <ItemArt spec={artOf(item)} size={size} />
            {item.favorite && <FavMark size={size} />}
          </g>
        );
        // What stands on the desk top can be moved on it. What is under the desk is on another level.
        if (!arrange || !given || underDesk(item)) return <Fragment key={item.id}>{art}</Fragment>;
        return (
          <Pinnable
            key={item.id}
            arrange={arrange}
            kind="item"
            id={item.id}
            name={item.name}
            base={{ x, y: y + size / 2 }}
            badge={{ x: x + size * 0.4, y: y - size * 0.42 }}
            pinned={hasTableSpot(item)}
          >
            {art}
          </Pinnable>
        );
      })}
    </g>
  );
}

/**
 * Lets the owner drag one thing around the top of its desk. The drop spot is worked out from where
 * the pointer is, clamped to the desk top, and saved as its Table X and Y; there is nothing here
 * that could drop it into a box, onto other furniture or onto the floor. While the pointer moves
 * only this group's transform changes, so the scene is not rebuilt until the drop.
 */
function Pinnable({
  arrange,
  kind,
  id,
  name,
  base,
  badge,
  pinned,
  children,
}: {
  arrange: Arrange;
  kind: "item" | "container";
  id: string;
  name: string;
  /** Where the thing stands on the desk, in scene units. */
  base: { x: number; y: number };
  /** Where the pin sits, at the top corner of the thing. */
  badge: { x: number; y: number };
  pinned: boolean;
  children: ReactNode;
}) {
  const ref = useRef<SVGGElement>(null);

  const onPointerDown = (e: ReactPointerEvent<SVGGElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const { cx, wide } = arrange;
    const toScene = (clientX: number, clientY: number) => {
      const m = arrange.svg.current?.getScreenCTM();
      if (!m) return null;
      const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
      return { x: p.x, y: p.y };
    };
    const from = toScene(e.clientX, e.clientY);
    if (!from) return;
    // Hold it by the point that was grabbed, so it does not jump to the pointer.
    const grab = { x: from.x - base.x, y: from.y - base.y };
    const home = deskUV(base.x, base.y, cx, wide);
    const homeScale = deskPoint(home.u, home.v, cx, wide).scale;
    const el = ref.current;
    const pid = e.pointerId;
    const downX = e.clientX;
    const downY = e.clientY;
    let moved = false;
    let { u, v } = home;

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      if (!moved) {
        // A tap is not a drag, so it can still open the thing.
        if (Math.hypot(ev.clientX - downX, ev.clientY - downY) < 5) return;
        moved = true;
        el?.classList.add("is-dragging");
        arrange.lift(id);
      }
      const p = toScene(ev.clientX, ev.clientY);
      if (!p) return;
      ({ u, v } = deskUV(p.x - grab.x, p.y - grab.y, cx, wide));
      const to = deskPoint(u, v, cx, wide);
      // Smaller toward the back, as everything on the desk is.
      el?.setAttribute("transform", `translate(${to.x} ${to.y}) scale(${to.scale / homeScale}) translate(${-base.x} ${-base.y})`);
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (!moved) return;
      el?.classList.remove("is-dragging");
      if (ev.type === "pointercancel") {
        el?.removeAttribute("transform");
        arrange.lift(null);
        return;
      }
      // The click that follows a drag is not a tap on anything.
      const swallow = (c: MouseEvent) => {
        c.stopPropagation();
        c.preventDefault();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, true), 100);
      flushSync(() => {
        arrange.move(kind, id, Math.round(u * 1000) / 10, Math.round(v * 1000) / 10);
        arrange.lift(null);
      });
      // Now that it is drawn where it was dropped, the drag's offset is not needed.
      el?.removeAttribute("transform");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  return (
    <g ref={ref} className="spotpin" onPointerDown={onPointerDown}>
      {children}
      {pinned && (
        <g
          className="spotpin__badge"
          transform={`translate(${badge.x} ${badge.y})`}
          role="button"
          tabIndex={0}
          aria-label={`Unpin ${name}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            arrange.move(kind, id, null, null);
          }}
          onKeyDown={(e) => onKey(e, () => arrange.move(kind, id, null, null))}
        >
          <title>{`Unpin ${name}`}</title>
          <circle r="8" />
          <path d="M-2.4 -5h4.8l-.7 3.9 2 2.1h-7.2l2-2.1Z" />
          <line x1="0" y1="1.2" x2="0" y2="5.6" />
        </g>
      )}
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
  arrange,
}: {
  placed: PlacedBox[];
  contents: Map<string, Item[]>;
  openId: string | null;
  visible: boolean;
  onToggle: (id: string) => void;
  /** Set while the owner arranges this desk: the containers standing on its top can be dragged around it. */
  arrange?: Arrange;
}) {
  if (placed.length === 0) return null;
  // Wallets and pouches share one size for what sticks out of them, set by the smallest of them,
  // so a card looks the same size whichever of them it comes from.
  const small = placed.filter((p) => p.c.type === "Wallet" || p.c.type === "Pouch");
  const sharedPeek = small.length > 0 ? peekSizeFor(Math.min(...small.map((p) => p.w))) : undefined;
  // The one being dragged is drawn last, in front of the rest.
  const ordered = arrange?.liftedId
    ? [...placed.filter((p) => p.c.id !== arrange.liftedId), ...placed.filter((p) => p.c.id === arrange.liftedId)]
    : placed;
  return (
    <g>
      {ordered.map((p) => {
        const luggage = (
          <Luggage
            peek={p.c.type === "Wallet" || p.c.type === "Pouch" ? sharedPeek : undefined}
            p={p}
            items={contents.get(p.c.id) ?? []}
            open={openId === p.c.id || (!!p.column && openId === `stack:${p.column[0]}`)}
            visible={visible}
            onToggle={onToggle}
          />
        );
        if (!arrange || !arrange.boxIds.has(p.c.id) || underDesk(p.c)) return <Fragment key={p.c.id}>{luggage}</Fragment>;
        return (
          <Pinnable
            key={p.c.id}
            arrange={arrange}
            kind="container"
            id={p.c.id}
            name={p.c.name}
            base={{ x: p.left + p.w / 2, y: p.base }}
            badge={{ x: p.left + 2, y: p.base - p.h }}
            pinned={hasTableSpot(p.c)}
          >
            {luggage}
          </Pinnable>
        );
      })}
    </g>
  );
}

/** Things whose drawing fills its whole square (puzzle cubes), so what sticks out of a container is drawn smaller for them. */
const CHUNKY = new Set<ArtKind>(["cube", "megaminx"]);

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
  const badge = Math.min(9.5, Math.max(6, w * 0.15));
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
        {peeking.map((it, i) => {
          const chunky = CHUNKY.has(artKind(it));
          const size = peekSize * (chunky ? 0.6 : 1);
          // A cube's lowest corner is 5/12 of its size below its center. Keep it sunk behind the opening so it peeks out instead of floating.
          const lift = (slots[i].rise - 4) * peekK;
          const sunk = chunky ? Math.min(lift, size * 0.12) : lift;
          return (
            <g key={it.id} transform={`translate(${slots[i].x} ${top - sunk}) rotate(${slots[i].rot})`}>
              <ItemArt spec={artOf(it)} size={size} />
            </g>
          );
        })}
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
      {live && has && !wallet && !pouch && !card && (
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
  backdrop,
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
  /** Drawn under the items in place of the luggage look-alike (a drawer pulled open). */
  backdrop?: ReactNode;
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
      {showBox && (backdrop ?? <Luggage p={box} items={items} open visible={visible} decor />)}
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
              <>
                <ItemArt spec={artOf(it)} size={BURST_ITEM} />
                {it.favorite && <FavMark size={BURST_ITEM} />}
              </>
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
