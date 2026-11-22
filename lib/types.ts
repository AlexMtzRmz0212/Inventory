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
  /** Has things inside that are not listed yet, so it is not drawn as an empty one. */
  filled: boolean;
  locationId: string | null;
}

export interface Inventory {
  places: Place[];
  items: Item[];
  containers: Container[];
}
