import { itemsIn, type PlaceIndex } from "./places";
import type { Inventory, Level } from "./types";

export interface TourStep {
  /** Place to fly to; null is the whole world. */
  placeId: string | null;
  /** One short line, shown while the camera is here. */
  caption: string;
  /** How long to stay once arrived, in ms. */
  dwell: number;
}

const BY_LEVEL: Record<Level, { caption: string; dwell: number }> = {
  Continent: { caption: "Things can be on another continent", dwell: 1800 },
  Country: { caption: "or in another country", dwell: 1600 },
  City: { caption: "or just another city", dwell: 1600 },
  Site: { caption: "in a home or a storage unit", dwell: 2600 },
  Spot: { caption: "on a desk, in a closet, on a shelf", dwell: 2200 },
};

/**
 * A walk through the whole map: the world, then every place that holds
 * something, from continents down to desks and closets, then back out.
 */
export function buildTour(inventory: Inventory, idx: PlaceIndex): TourStep[] {
  const steps: TourStep[] = [
    { placeId: null, caption: "Every thing has a place. Follow the trip.", dwell: 2400 },
  ];

  const walk = (id: string) => {
    const place = idx.byId.get(id);
    if (!place || itemsIn(inventory, idx, id).length === 0) return;
    steps.push({ placeId: id, ...BY_LEVEL[place.level] });
    for (const child of idx.children.get(id) ?? []) walk(child.id);
  };
  for (const root of idx.roots) walk(root.id);

  steps.push({ placeId: null, caption: "Your turn. Pick a pin and fly there.", dwell: 0 });
  return steps;
}
