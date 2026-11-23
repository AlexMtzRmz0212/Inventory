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
}: {
  inventory: Inventory;
  idx: PlaceIndex;
  /** Fly to the place an item is in. */
  onGo: (placeId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
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
    if (terms.length === 0) return { tree: root, count: 0 };
    const hits = inventory.items.filter((i) => {
      const text = fold(`${i.name} ${i.notes} ${i.category ?? ""} ${i.color ?? ""}`);
      return terms.every((t) => text.includes(t));
    });
    for (const item of hits.slice(0, MAX_RESULTS)) {
      const path: { key: string; name: string }[] = chainTo(idx, item.locationId).map((p) => ({ key: p.id, name: p.name }));
      const box = item.boxId ? containers.get(item.boxId) : undefined;
      if (box) path.push({ key: `box:${box.id}`, name: box.name });
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
  }, [query, inventory.items, containers, idx]);

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
        <div className="search__results">
          {query.trim() === "" ? (
            <p className="search__hint">Type a name, a note or a category. Each result shows where it is.</p>
          ) : count === 0 ? (
            <p className="search__hint">Nothing matches.</p>
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
