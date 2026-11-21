export type Level = "Continent" | "Country" | "City" | "Site" | "Spot";
export type SceneKey = "apartment" | "storage-unit" | "house" | "generic";

export interface Place {
  id: string;
  name: string;
  level: Level;
  /** Only set on Country/City places; drives map position. */
  lat: number | null;
  lng: number | null;
  scene: SceneKey;
  parentId: string | null;
}

export interface Item {
  id: string;
  name: string;
  category: string | null;
  status: string | null;
  fragile: boolean;
  notes: string;
  locationId: string | null;
  boxId: string | null;
}

export interface Container {
  id: string;
  name: string;
  type: string | null;
  color: string | null;
  owner: string | null;
  widthCm: number | null;
  heightCm: number | null;
  lengthCm: number | null;
  volumeL: number | null;
  locationId: string | null;
}

/** One line of the packing list; points at the real item it stands for. */
export interface LuggageEntry {
  id: string;
  name: string;
  group: string | null;
  packed: boolean;
  /** The Packing Inventory row. No link means the entry can't be shown to visitors. */
  itemId: string | null;
  /** The entry this one goes with (a charger goes with its laptop). */
  parentId: string | null;
}

export interface Inventory {
  places: Place[];
  items: Item[];
  containers: Container[];
  luggage: LuggageEntry[];
}
