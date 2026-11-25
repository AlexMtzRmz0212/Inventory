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
  /** Shirt, shorts, shoes... as filed in Notion; sharpens how the item is drawn. */
  clothesType: string | null;
  /** A color word that overrides the one guessed from the name. */
  color: string | null;
  /** Image of the cover, for books. */
  cover: string | null;
  /** Where it sits on a table: 0 is the left edge, 100 the right. Empty means wherever there is room. */
  tableX: number | null;
  /** Where it sits on a table: 0 is the back edge, 100 the front. */
  tableY: number | null;
  /** In a closet: hung on a hook or folded in a drawer. Empty means it stands on a shelf or the floor. */
  closetSpot: ClosetSpot | null;
  /** Marked as a favorite. */
  favorite: boolean;
}

export type ClosetSpot = "Hook" | "Drawer";

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
  /** Has things inside that are not listed yet, so it is not drawn as an empty one. */
  filled: boolean;
  locationId: string | null;
  /** Where it sits on a table, as for items. */
  tableX: number | null;
  tableY: number | null;
}

export interface Inventory {
  places: Place[];
  items: Item[];
  containers: Container[];
}
