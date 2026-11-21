const PATHS: Record<string, string> = {
  Clothes: "M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0Z",
  Electronics: "M5 6h14v10H5ZM2.5 19h19",
  Books: "M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3ZM5 17a3 3 0 0 1 3-3h10",
  Documents: "M7 3h7l4 4v14H7ZM14 3v4h4M10 12h5M10 16h5",
  Furniture: "M3 9h18M5 9v11M19 9v11M9 9v5h6V9",
  Kitchen: "M6 3v8M9 3v8M6 7h3M7.5 11v10M17 3c-2 2-2 7 0 9v9",
  Toiletries: "M10 3h4v3h-4ZM8 6h8v15H8Z",
  Misc: "m12 3 8 4.5v9L12 21l-8-4.5v-9ZM12 12l8-4.5M12 12v9M12 12 4 7.5",
};

const pathFor = (category: string | null) => (category && PATHS[category]) || PATHS.Misc;

export function CategoryIcon({
  category,
  size = 22,
}: {
  category: string | null;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={pathFor(category)} />
    </svg>
  );
}

/** Same glyph, positioned inside another SVG (scene units). */
export function CategoryGlyph({
  category,
  x,
  y,
  size,
  color,
}: {
  category: string | null;
  x: number;
  y: number;
  size: number;
  color: string;
}) {
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={pathFor(category)} />
    </svg>
  );
}
