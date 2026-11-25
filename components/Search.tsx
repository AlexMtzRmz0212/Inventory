"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { chainTo, type PlaceIndex } from "@/lib/places";
import type { Inventory, Item } from "@/lib/types";

interface Node {
  name: string;
  kids: Map<string, Node>;
  items: Item[];
}

/** Lower case with accents taken off, so "tio" finds "Tío". */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const MAX_RESULTS = 80;

/**
 * Search over every item. The matches are shown as a directory tree of where they are: place
 * inside place, down to the container they are in, with the item as the leaf.
 */
export function Search({
  inventory,
  idx,
  onGo,
  onClose,
  initialFavorites = false,
}: {
  inventory: Inventory;
  idx: PlaceIndex;
  /** Fly to the place an item is in. */
  onGo: (placeId: string) => void;
  onClose: () => void;
  /** Open showing only the favorites. */
  initialFavorites?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [onlyFavs, setOnlyFavs] = useState(initialFavorites);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    // Escape closes the search and goes no further (it would also step the map back out).
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", esc, true);
    return () => window.removeEventListener("keydown", esc, true);
  }, [onClose]);

  const containers = useMemo(() => new Map(inventory.containers.map((c) => [c.id, c])), [inventory.containers]);

  const { tree, count } = useMemo(() => {
    const terms = fold(query).split(/\s+/).filter(Boolean);
    const root: Node = { name: "", kids: new Map(), items: [] };
    // With no words typed, nothing is listed, unless it is the favorites that are asked for.
    if (terms.length === 0 && !onlyFavs) return { tree: root, count: 0 };
    const hits = inventory.items.filter((i) => {
      if (onlyFavs && !i.favorite) return false;
      const text = fold(`${i.name} ${i.notes} ${i.category ?? ""} ${i.color ?? ""} ${i.closetSpot ?? ""}`);
      return terms.every((t) => text.includes(t));
    });
    for (const item of hits.slice(0, MAX_RESULTS)) {
      const path: { key: string; name: string }[] = chainTo(idx, item.locationId).map((p) => ({ key: p.id, name: p.name }));
      const box = item.boxId ? containers.get(item.boxId) : undefined;
      if (box) path.push({ key: `box:${box.id}`, name: box.name });
      else if (item.closetSpot) {
        path.push({
          key: `spot:${item.locationId}:${item.closetSpot}`,
          name: item.closetSpot === "Hook" ? "On a hook" : "In a drawer",
        });
      }
      if (path.length === 0) path.push({ key: "none", name: "No place yet" });
      let node = root;
      for (const step of path) {
        let next = node.kids.get(step.key);
        if (!next) {
          next = { name: step.name, kids: new Map(), items: [] };
          node.kids.set(step.key, next);
        }
        node = next;
      }
      node.items.push(item);
    }
    return { tree: root, count: hits.length };
  }, [query, onlyFavs, inventory.items, containers, idx]);

  const renderNode = (n: Node): React.ReactNode => (
    <ul className="search__tree">
      {[...n.kids.entries()].map(([key, kid]) => (
        <li key={key}>
          <span className="search__node">{kid.name}</span>
          {renderNode(kid)}
        </li>
      ))}
      {n.items.map((i) => (
        <li key={i.id}>
          <button
            type="button"
            className="search__item"
            disabled={!i.locationId}
            onClick={() => {
              onClose();
              if (i.locationId) onGo(i.locationId);
            }}
          >
            {i.favorite && (
              <span className="search__star" role="img" aria-label="Favorite">
                ★
              </span>
            )}
            {i.name}
            {i.category && <small>{i.category}</small>}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="search" role="dialog" aria-label="Search items" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="search__panel">
        <input
          ref={inputRef}
          className="search__input"
          type="search"
          placeholder="Search everything you have…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search items"
        />
        <div className="search__bar">
          <button type="button" className="search__chip" aria-pressed={onlyFavs} onClick={() => setOnlyFavs((v) => !v)}>
            <span aria-hidden="true">★</span> Favorites only
          </button>
        </div>
        <div className="search__results">
          {query.trim() === "" && !onlyFavs ? (
            <p className="search__hint">Type a name, a note or a category. Each result shows where it is.</p>
          ) : count === 0 ? (
            <p className="search__hint">
              {onlyFavs && query.trim() === "" ? "No favorites yet. Open an item and press its star." : "Nothing matches."}
            </p>
          ) : (
            <>
              <p className="search__hint">
                {count} {count === 1 ? "item" : "items"}
                {count > MAX_RESULTS ? `, showing the first ${MAX_RESULTS}` : ""}
              </p>
              {renderNode(tree)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
