"use client";

import { animate } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import {
  arcPath,
  arcPoint,
  camFor,
  flightSeconds,
  lerp,
  peakWidth,
  travelTier,
  WORLD_CAM,
  type Cam,
} from "@/lib/camera";
import type { MapData } from "@/lib/map";
import { categoryColor, DEFAULT_TINT, NEUTRAL_LAND } from "@/lib/palette";
import { buildPacking } from "@/lib/packing";
import { chainTo, countByCategory, indexPlaces, itemsIn } from "@/lib/places";
import { buildTour } from "@/lib/tour";
import type { Inventory, Level, Place } from "@/lib/types";
import { CategoryIcon } from "./CategoryIcon";
import { LoginPanel } from "./LoginPanel";
import PackingPanel from "./PackingPanel";
import RoomScene from "./RoomScene";
import { useTour } from "./useTour";

interface Props {
  inventory: Inventory;
  map: MapData;
  isPrivate: boolean;
}

type ZoomLevel = "world" | "continent" | "country" | "city" | "site";

const zoomForLevel = (level: Level | null): ZoomLevel =>
  level === "Continent"
    ? "continent"
    : level === "Country"
      ? "country"
      : level === "City"
        ? "city"
        : level
          ? "site"
          : "world";

/** Which pins are shown at each zoom: continents from afar, then countries, cities and sites as you get close. */
const PIN_ZOOMS: Record<Level, ZoomLevel[]> = {
  Continent: ["world"],
  Country: ["continent"],
  City: ["country", "city"],
  Site: ["city", "site"],
  Spot: [],
};

const EASE = [0.65, 0, 0.35, 1] as const;

export default function Stage({ inventory, map, isPrivate }: Props) {
  const idx = useMemo(() => indexPlaces(inventory.places), [inventory.places]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [flying, setFlying] = useState(false);
  const [packingOpen, setPackingOpen] = useState(false);
  const packing = useMemo(() => buildPacking(inventory, idx), [inventory, idx]);
  /** The room that is mounted; it stays mounted while fading out on the way to another place. */
  const [sceneSiteId, setSceneSiteId] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const routeRef = useRef<SVGPathElement>(null);
  const parcelRef = useRef<SVGGElement>(null);
  const camRef = useRef<Cam>(WORLD_CAM);
  const aspectRef = useRef(16 / 9);
  const focusRef = useRef<string | null>(null);
  const flightRef = useRef<{ stop: () => void } | null>(null);
  const packingOpenRef = useRef(false);

  const apply = useCallback((c: Cam) => {
    camRef.current = c;
    const svg = svgRef.current;
    if (!svg) return;
    const h = c.w / aspectRef.current;
    // Sit the focus point a little above center so the tray never covers it.
    const cy = c.cy + h * 0.07;
    svg.setAttribute("viewBox", `${c.cx - c.w / 2} ${cy - h / 2} ${c.w} ${h}`);
    svg.style.setProperty("--s", String(c.w / 1000));
    svg.dataset.zoom =
      c.w >= 800 ? "world" : c.w >= 280 ? "continent" : c.w >= 100 ? "country" : c.w >= 30 ? "city" : "site";
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) {
        aspectRef.current = r.width / r.height;
        apply(camRef.current);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [apply]);

  // The room scene is sized to the space above the tray.
  useEffect(() => {
    const tray = trayRef.current;
    const stage = stageRef.current;
    if (!tray || !stage) return;
    const sync = () => stage.style.setProperty("--tray-h", `${tray.offsetHeight}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(tray);
    return () => ro.disconnect();
  }, []);

  const flyTo = useCallback(
    (id: string | null) => {
      if (id === focusRef.current) return;
      const fromId = focusRef.current;
      const from = camRef.current;
      const to = camFor(id ? (idx.byId.get(id) ?? null) : null, map.positions, map.frames);
      const tier = travelTier(idx, fromId, id);
      const posFrom = fromId ? map.positions[fromId] : undefined;
      const posTo = id ? map.positions[id] : undefined;
      const hop =
        (tier === "site" || tier === "city" || tier === "country" || tier === "continent") &&
        !!posFrom &&
        !!posTo;
      const distance = hop && posFrom && posTo ? Math.hypot(posTo[0] - posFrom[0], posTo[1] - posFrom[1]) : 0;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const targetSite = chainTo(idx, id).find((p) => p.level === "Site") ?? null;

      // Same map view (site <-> its spots, spot <-> spot): the room moves its own camera.
      const sameView =
        Math.abs(from.cx - to.cx) < 1e-6 &&
        Math.abs(from.cy - to.cy) < 1e-6 &&
        Math.abs(from.w - to.w) < 1e-6;
      if (sameView && !flightRef.current) {
        focusRef.current = id;
        setFocusId(id);
        if (targetSite) setSceneSiteId(targetSite.id);
        return;
      }

      flightRef.current?.stop();
      flightRef.current = null;
      focusRef.current = id;
      setFocusId(id);
      if (targetSite) setSceneSiteId(targetSite.id);

      const route = routeRef.current;
      const parcel = parcelRef.current;
      const finish = () => {
        flightRef.current = null;
        apply(to);
        route?.classList.remove("is-on");
        parcel?.classList.remove("is-on");
        setFlying(false);
      };

      if (reduce) {
        finish();
        return;
      }

      setFlying(true);
      if (hop && posFrom && posTo && route && parcel) {
        route.setAttribute("d", arcPath(posFrom, posTo));
        route.classList.add("is-on");
        parcel.setAttribute("transform", `translate(${posFrom[0]} ${posFrom[1]})`);
        parcel.classList.add("is-on");
      }

      const bump = hop
        ? Math.log(peakWidth(distance, from, to) / Math.max(from.w, to.w))
        : 0;

      flightRef.current = animate(0, 1, {
        duration: flightSeconds(tier, from, to, distance),
        ease: EASE,
        onUpdate: (t) => {
          apply({
            cx: lerp(from.cx, to.cx, t),
            cy: lerp(from.cy, to.cy, t),
            w: Math.exp(lerp(Math.log(from.w), Math.log(to.w), t) + bump * Math.sin(Math.PI * t)),
          });
          if (hop && posFrom && posTo && parcel) {
            const [x, y] = arcPoint(posFrom, posTo, t);
            parcel.setAttribute("transform", `translate(${x} ${y})`);
          }
        },
        onComplete: finish,
      });
    },
    [apply, idx, map.positions, map.frames],
  );

  const steps = useMemo(() => buildTour(inventory, idx), [inventory, idx]);
  const tour = useTour({ steps, flyTo, focusId, flying, autoStart: !isPrivate });
  const stopTour = tour.stop;
  /** Anything done by hand ends the tour and hands the map over. */
  const go = useCallback(
    (id: string | null) => {
      stopTour();
      flyTo(id);
    },
    [stopTour, flyTo],
  );

  useEffect(() => {
    packingOpenRef.current = packingOpen;
  }, [packingOpen]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // The luggage list sits on top: Escape closes it before it climbs the map.
      if (packingOpenRef.current) {
        setPackingOpen(false);
        return;
      }
      const current = focusRef.current;
      if (current) go(idx.byId.get(current)?.parentId ?? null);
      else stopTour();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      flightRef.current?.stop();
    };
  }, [go, stopTour, idx]);

  const focus = focusId ? (idx.byId.get(focusId) ?? null) : null;
  const zoom = zoomForLevel(focus?.level ?? null);
  const chain = chainTo(idx, focusId);
  const focusSite = chain.find((p) => p.level === "Site") ?? null;
  const sceneSite = sceneSiteId ? (idx.byId.get(sceneSiteId) ?? null) : null;
  const sceneVisible = !!sceneSite && focusSite?.id === sceneSite.id && !flying;
  const sceneFocusId = focus?.level === "Spot" && focus.parentId === sceneSite?.id ? focus.id : null;

  const pins = useMemo(
    () =>
      inventory.places
        .filter((p) => map.positions[p.id] && PIN_ZOOMS[p.level].length > 0)
        .map((p) => {
          const items = itemsIn(inventory, idx, p.id);
          return { place: p, pos: map.positions[p.id], total: items.length, segments: countByCategory(items) };
        }),
    [inventory, idx, map.positions],
  );

  const trayItems = itemsIn(inventory, idx, focusId);
  const trayCats = countByCategory(trayItems);
  const trayMax = Math.max(1, ...trayCats.map((c) => c.count));
  const kids = focusId ? (idx.children.get(focusId) ?? []) : idx.roots;
  // Neighbors let you hop sideways without climbing back up first.
  const siblings = focus
    ? (focus.parentId ? (idx.children.get(focus.parentId) ?? []) : idx.roots).filter(
        (s) => s.id !== focus.id,
      )
    : [];

  const onPinKey = (e: KeyboardEvent, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      go(id);
    }
  };

  return (
    <div ref={stageRef} className="stage" data-flying={flying}>
      <svg
        ref={svgRef}
        className="map"
        viewBox="0 0 1000 500"
        style={{ "--s": 1 } as CSSProperties}
        data-zoom="world"
        role="group"
        aria-label="Map of where my things are"
      >
        <rect className="map__sea" x={-6000} y={-6000} width={13000} height={13000} />
        <path className="map__sphere" d={map.sphere} />
        <path className="map__graticule" d={map.graticule} />
        <g>
          {map.countries.map((c) => (
            <g key={c.name}>
              <path className="land__shadow" d={c.d} />
              <path className="land" d={c.d} fill={c.color ?? NEUTRAL_LAND} />
            </g>
          ))}
        </g>
        <path ref={routeRef} className="route" d="" />
        <g className="pins">
          {pins.map(({ place, pos, total, segments }) => {
            const visible = PIN_ZOOMS[place.level].includes(zoom);
            const active = place.id === focusId;
            let offset = 0;
            return (
              <g
                key={place.id}
                className={`pin pin--${place.level.toLowerCase()}${active ? " is-active" : ""}`}
                transform={`translate(${pos[0]} ${pos[1]})`}
              >
                <g
                  className="pin__body"
                  role="button"
                  tabIndex={visible ? 0 : -1}
                  aria-hidden={!visible}
                  aria-label={`Go to ${place.name}, ${total} items`}
                  onClick={() => go(place.id)}
                  onKeyDown={(e) => onPinKey(e, place.id)}
                >
                  <circle className="pin__hit" r="24" />
                  <circle className="pin__halo" r="17" />
                  <circle className="pin__core" r="11" />
                  <g transform="rotate(-90)">
                    {total === 0 ? (
                      <circle r="11" className="pin__empty" />
                    ) : (
                      segments.map((s) => {
                        const len = (s.count / total) * 100;
                        const dash = Math.max(len - 1.2, 0.5);
                        const el = (
                          <circle
                            key={s.category ?? "none"}
                            r="11"
                            className="pin__seg"
                            stroke={categoryColor(s.category)}
                            pathLength={100}
                            strokeDasharray={`${dash} ${100 - dash}`}
                            strokeDashoffset={-offset}
                          />
                        );
                        offset += len;
                        return el;
                      })
                    )}
                  </g>
                  <text className="pin__count" y="3.5">
                    {total}
                  </text>
                  <text className="pin__label" y="34">
                    {place.name}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
        <g ref={parcelRef} className="parcel" aria-hidden="true">
          <g className="parcel__body">
            <rect x="-11" y="-8" width="22" height="16" rx="3" />
            <path d="M-4 -8v-3h8v3" fill="none" />
            <path d="M-11 -1h22" fill="none" />
          </g>
        </g>
      </svg>

      {sceneSite && (
        <RoomScene
          key={sceneSite.id}
          site={sceneSite}
          idx={idx}
          inventory={inventory}
          tint={map.tints[sceneSite.id] ?? DEFAULT_TINT}
          focusId={sceneFocusId}
          visible={sceneVisible}
          onFocus={go}
        />
      )}

      <div className="topbar">
        <nav className="crumbs" aria-label="Where you are">
          <ol>
            <li>
              <button
                type="button"
                className="crumb"
                aria-current={focusId === null ? "page" : undefined}
                onClick={() => go(null)}
              >
                World
              </button>
            </li>
            {chain.map((p: Place) => (
              <li key={p.id}>
                <svg className="crumbs__sep" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                  <path d="m3 1 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <button
                  type="button"
                  className="crumb"
                  aria-current={p.id === focusId ? "page" : undefined}
                  onClick={() => go(p.id)}
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="topbar__right">
          {tour.status === "idle" && steps.length > 2 && (
            <button type="button" className="btn btn--ghost pack-btn" onClick={tour.play}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M3 1.5v11l9-5.5Z" fill="currentColor" />
              </svg>
              Tour
            </button>
          )}
          {packing.total > 0 && (
            <button
              type="button"
              className="btn btn--ghost pack-btn"
              aria-expanded={packingOpen}
              onClick={() => {
                tour.stop();
                setPackingOpen((o) => !o);
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 7h16v12H4ZM4 12h16" />
              </svg>
              <span className="pack-btn__label">Luggage</span>
              <span className="pack-btn__count">
                {packing.packed}/{packing.total}
              </span>
            </button>
          )}
          <LoginPanel isPrivate={isPrivate} />
        </div>
      </div>

      {tour.status !== "idle" && (
        <div className="tourbar" role="status">
          <p className="tourbar__caption">{tour.caption}</p>
          <div className="tourbar__ctl">
            {tour.status === "playing" && (
              <button type="button" className="btn btn--ghost" onClick={tour.pause}>
                Pause
              </button>
            )}
            {tour.status === "paused" && (
              <button type="button" className="btn btn--ghost" onClick={tour.play}>
                Play
              </button>
            )}
            {tour.status === "done" && (
              <button type="button" className="btn btn--ghost" onClick={tour.play}>
                Replay
              </button>
            )}
            {tour.status !== "done" && (
              <button type="button" className="btn btn--ghost" onClick={tour.skip}>
                Skip
              </button>
            )}
            <button type="button" className="btn" onClick={tour.stop}>
              Explore
            </button>
          </div>
          <i className="tourbar__bar" style={{ "--w": `${tour.progress * 100}%` } as CSSProperties} />
        </div>
      )}

      {packingOpen && (
        <PackingPanel
          packing={packing}
          onClose={() => setPackingOpen(false)}
          onGo={(placeId) => {
            setPackingOpen(false);
            go(placeId);
          }}
        />
      )}

      <section ref={trayRef} className="tray" aria-live="polite">
        <header className="tray__head">
          <h1 className="tray__title">{focus ? focus.name : "Inventory"}</h1>
          <p className="tray__total">
            {trayItems.length} {trayItems.length === 1 ? "item" : "items"}
          </p>
        </header>
        {trayCats.length > 0 ? (
          <ul className="tray__cats">
            {trayCats.map((c) => (
              <li
                key={c.category ?? "none"}
                className="cat"
                style={{ "--c": categoryColor(c.category), "--w": `${Math.max(8, (c.count / trayMax) * 100)}%` } as CSSProperties}
              >
                <CategoryIcon category={c.category} />
                <b>{c.count}</b>
                <span className="cat__name">{c.category ?? "Other"}</span>
                <i className="cat__bar" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="tray__empty">Nothing recorded here yet.</p>
        )}
        {kids.length + siblings.length > 0 && (
          <ul className="tray__places">
            {kids.map((k) => (
              <li key={k.id}>
                <button type="button" className="chip" onClick={() => go(k.id)}>
                  {k.name}
                </button>
              </li>
            ))}
            {kids.length > 0 && siblings.length > 0 && (
              <li className="tray__sep" aria-hidden="true" />
            )}
            {siblings.map((s) => (
              <li key={s.id}>
                <button type="button" className="chip chip--side" onClick={() => go(s.id)}>
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
