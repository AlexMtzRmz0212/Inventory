import "server-only";

/** A country keeps its color down to every room inside it. Picked by its position among the countries. */
const COUNTRY_PALETTE = ["#EE6A55", "#34B38A", "#7C8CF0", "#E8C547", "#B07CE8", "#4FB5D6", "#E78BC0"];

export function countryColor(order: number): string {
  return COUNTRY_PALETTE[order % COUNTRY_PALETTE.length];
}

/** Common short names -> name used in the world-atlas dataset. Anything else is used as written. */
const ATLAS_ALIASES: Record<string, string> = {
  usa: "United States of America",
  us: "United States of America",
  "united states": "United States of America",
  uk: "United Kingdom",
  uae: "United Arab Emirates",
  "czech republic": "Czechia",
  "south korea": "South Korea",
};

export const atlasName = (name: string): string => ATLAS_ALIASES[name.trim().toLowerCase()] ?? name;
