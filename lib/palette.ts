export const NEUTRAL_LAND = "#1F4A6E";
/** Room color when a place has no country above it. */
export const DEFAULT_TINT = "#E8C547";

export const CATEGORY_COLORS: Record<string, string> = {
  Clothes: "#5B9BF5",
  Electronics: "#A47CF5",
  Books: "#E0A458",
  Documents: "#F0675B",
  Furniture: "#3CC2B4",
  Kitchen: "#F58E4B",
  Toiletries: "#EF8FC0",
  Misc: "#9AA7B5",
};
export const UNCATEGORIZED_COLOR = "#9AA7B5";

export function categoryColor(category: string | null): string {
  return (category && CATEGORY_COLORS[category]) || UNCATEGORIZED_COLOR;
}
