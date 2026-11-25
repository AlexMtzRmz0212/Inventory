import type { ReactNode } from "react";
import type { ArtKind, ArtSpec } from "@/lib/item-art";
import { isPale, mix } from "@/lib/scene";

/** Every drawing fits a 48 x 48 box. */
const BOX = 48;
const OUTLINE = "#0a1a2a";

interface Paint {
  fill: string;
  shade: string;
  light: string;
  /** The fill is so light that details drawn in `light` would not show; use `shade` for them. */
  pale: boolean;
  spec: ArtSpec;
}

/** A thick line with the same dark outline as the filled shapes. */
function Rod({ d, w = 4, color }: { d: string; w?: number; color: string }) {
  return (
    <>
      <path d={d} fill="none" stroke={OUTLINE} strokeWidth={w + 2.4} />
      <path d={d} fill="none" stroke={color} strokeWidth={w} />
    </>
  );
}

// Body shapes shared by the shirt family.
const TEE = "M16 6 6 12l4 10 5-2v22h18V20l5 2 4-10-10-6q-8 6-16 0Z";
const LONG = "M17 6 8 10 4 36l6 1 5-17v22h18V20l5 17 6-1-4-26-9-4q-7 6-14 0Z";

/** A polo's knit collar and short placket: low, flat flaps in a darker tone. */
function PoloTop({ shade, light }: Pick<Paint, "shade" | "light">) {
  return (
    <>
      <path d="M15 5.5 24 11v6l-6.5-3.5Z" fill={shade} />
      <path d="M33 5.5 24 11v6l6.5-3.5Z" fill={shade} />
      <rect x="22.4" y="11" width="3.2" height="15" rx="1" fill={light} stroke="none" />
      <circle cx="24" cy="15.5" r="1" fill={shade} stroke="none" />
      <circle cx="24" cy="21.5" r="1" fill={shade} stroke="none" />
    </>
  );
}

/** A dress shirt's sharp pointed collar, full button line and chest pocket. */
function DressTop({ shade, light }: Pick<Paint, "shade" | "light">) {
  return (
    <>
      <path d="M14 4.5 24 13l-3.5 8L11 11Z" fill={light} />
      <path d="M34 4.5 24 13l3.5 8L37 11Z" fill={light} />
      <path d="M24 21v21" fill="none" stroke={shade} strokeWidth="1.2" />
      {[27, 33, 39].map((y) => (
        <circle key={y} cx="24" cy={y} r="1.1" fill={shade} stroke="none" />
      ))}
      <rect x="28" y="25" width="6" height="6" rx="0.8" fill="none" stroke={shade} strokeWidth="1.1" />
    </>
  );
}

const DRAW: Record<ArtKind, (p: Paint) => ReactNode> = {
  tee: ({ fill }) => <path d={TEE} fill={fill} />,
  teeLong: ({ fill, shade }) => (
    <>
      <path d={LONG} fill={fill} />
      <path d="M5 31l6 1.5M43 31l-6 1.5" fill="none" stroke={shade} />
    </>
  ),
  polo: (p) => (
    <>
      <path d={TEE} fill={p.fill} />
      {/* Ribbed cuffs on the sleeves. */}
      <path d="M7.6 13.5 11.4 22.3M40.4 13.5 36.6 22.3" fill="none" stroke={p.shade} strokeWidth="3.2" />
      <PoloTop {...p} />
    </>
  ),
  poloLong: (p) => (
    <>
      <path d={LONG} fill={p.fill} />
      <path d="M4.4 33.5 10.6 34.6M43.6 33.5 37.4 34.6" fill="none" stroke={p.shade} strokeWidth="3.4" />
      <PoloTop {...p} />
    </>
  ),
  dress: (p) => (
    <>
      <path d={TEE} fill={p.fill} />
      <DressTop {...p} />
    </>
  ),
  dressLong: (p) => (
    <>
      <path d={LONG} fill={p.fill} />
      <path d="M4.6 30.5l6.4 1.4M43.4 30.5l-6.4 1.4" fill="none" stroke={p.shade} strokeWidth="1.6" />
      <circle cx="8" cy="34" r="1" fill={p.shade} stroke="none" />
      <circle cx="40" cy="34" r="1" fill={p.shade} stroke="none" />
      <DressTop {...p} />
    </>
  ),
  sweater: ({ fill, shade }) => (
    <>
      <path d={LONG} fill={fill} />
      <path d="M17 6q7 8 14 0" fill="none" stroke={shade} strokeWidth="2" />
      <path d="M15 39h18M5 31l6 1.5M43 31l-6 1.5" fill="none" stroke={shade} />
    </>
  ),
  jersey: ({ fill, light }) => (
    <>
      <path d={TEE} fill={fill} />
      <path d="M16 6l8 9 8-9" fill="none" stroke={light} strokeWidth="2" />
      <path d="M7.4 15l5 2.2M40.6 15l-5 2.2" fill="none" stroke={light} strokeWidth="3" />
      <circle cx="19" cy="22" r="2.4" fill={light} stroke="none" />
    </>
  ),
  vest: ({ fill, shade, light }) => (
    <>
      <path d="M14 6h7l3 11 3-11h7l3 8-1 28H12l-1-28Z" fill={fill} />
      <path d="M24 17v25" fill="none" stroke={shade} />
      {[24, 30, 36].map((y) => (
        <circle key={y} cx="24" cy={y} r="1.4" fill={light} stroke={shade} strokeWidth="0.8" />
      ))}
    </>
  ),
  blazer: ({ fill, shade, light }) => (
    <>
      <path d="M15 6 5 11 4 36l6 1 3-17v22h22V20l3 17 6-1-1-25-10-5-9 8Z" fill={fill} />
      <path d="M15 6l9 20-5 4-7-14ZM33 6l-9 20 5 4 7-14Z" fill={light} stroke={shade} strokeWidth="1.2" />
      <path d="M24 26v16M28 35h5" fill="none" stroke={shade} />
      <circle cx="24" cy="33" r="1.4" fill={shade} stroke="none" />
    </>
  ),
  jacket: ({ fill, shade }) => (
    <>
      <path d={LONG} fill={fill} />
      <path d="M17 6l7 5 7-5M24 11v31" fill="none" stroke={shade} strokeWidth="1.6" />
      <path d="M5 31l6 1.5M43 31l-6 1.5" fill="none" stroke={shade} />
    </>
  ),
  scarf: ({ fill, shade }) => (
    <>
      <rect x="9" y="7" width="30" height="10" rx="5" fill={fill} />
      <path d="M13 16h9v26h-9ZM26 16l4 22h9l-4-22Z" fill={fill} />
      <path d="M13 38h9M30 34h9" fill="none" stroke={shade} strokeWidth="1.6" />
    </>
  ),
  pants: ({ fill, shade }) => (
    <>
      <path d="M13 5h22l3 38H27l-3-21-3 21H10Z" fill={fill} />
      <path d="M13 11h22" fill="none" stroke={shade} />
    </>
  ),
  // Everyday shorts: longer, with a belt line, belt loops, pockets and a turned-up hem.
  shorts: ({ fill, shade }) => (
    <>
      <path d="M11 6h26l5 31H27l-3-13-3 13H6Z" fill={fill} />
      <path d="M11 11h26" fill="none" stroke={shade} strokeWidth="2" />
      <path d="M15 6v5M24 6v5M33 6v5" fill="none" stroke={shade} strokeWidth="1.4" />
      <path d="M13 15q5 6 9 0M35 15q-5 6-9 0" fill="none" stroke={shade} strokeWidth="1.2" />
      <path d="M7 33h12M29 33h12" fill="none" stroke={shade} strokeWidth="1.4" />
    </>
  ),
  // Gym and sweat shorts: shorter, elastic waist with a drawstring and a stripe down each side.
  sportShorts: ({ fill, shade, light }) => (
    <>
      <path d="M11 10h26l3 19H27l-3-8-3 8H8Z" fill={fill} />
      <path d="M11 10h26v4H11Z" fill={shade} stroke="none" />
      <path d="M22 14l-2 7M26 14l2 7" fill="none" stroke={light} strokeWidth="1.4" />
      <path d="M12.6 16 10.4 28M35.4 16l2.2 12" fill="none" stroke={light} strokeWidth="2.6" />
    </>
  ),
  // A pair of socks: a cuff, a leg, and a heel and toe in the other tone.
  sock: ({ fill, shade, light }) => {
    const one = "M6 4h11v19h13c4 0 6 3 6 7v4c0 2-2 3-4 3H12c-4 0-6-3-6-6Z";
    return (
      <>
        <g transform="translate(2 1)">
          <path d={one} fill={fill} />
          <path d="M6 4h11v4H6Z" fill={light} />
          <path d="M6 28q0 6 6 6h2v-8Z" fill={shade} stroke="none" />
          <path d="M30 23c4 0 6 3 6 7v4h-6Z" fill={shade} stroke="none" />
        </g>
        <g transform="translate(8 6)" opacity="0.95">
          <path d={one} fill={fill} />
          <path d="M6 4h11v4H6Z" fill={light} />
          <path d="M6 28q0 6 6 6h2v-8Z" fill={shade} stroke="none" />
          <path d="M30 23c4 0 6 3 6 7v4h-6Z" fill={shade} stroke="none" />
        </g>
      </>
    );
  },
  shoe: ({ fill, shade }) => (
    <>
      <path d="M5 30c0-8 6-12 10-12l4 4c4 2 10 2 16 6 5 2 8 5 8 8v2H5Z" fill={fill} />
      <path d="M5 35h38v4H5Z" fill={shade} />
    </>
  ),
  // A sport sandal from the side: a thick sole, a heel loop, and two straps arching over the foot.
  sandal: ({ fill, light }) => (
    <>
      <path d="M3 33h42q2 0 1 4-2 5-8 5H10Q4 42 3 36Z" fill="#6f6a62" />
      <path d="M4 36.5h41" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      <path d="M4 33c-1-7 2-12 8-12h5v5l-5 1c-2 2-2 4-2 6Z" fill={fill} />
      <path d="M14 33c0-12 12-12 14 0h-4c-1-6-5-6-6 0Z" fill={fill} />
      <path d="M30 33c1-8 10-8 13 0h-4c-1-4-5-4-5 0Z" fill={fill} />
      <rect x="15" y="19" width="5" height="4" rx="1" fill={light} stroke="none" />
    </>
  ),
  // A baseball cap from the side, bill to the left: a dome in two tones (a front panel with a logo patch,
  // a back panel), a top button, and a long drooping bill with stitch lines.
  cap: ({ fill, shade, light }) => (
    <>
      <path d="M12 31C10 19 14 11 21 8c10-4 24 1 25 17 0 4 0 7-1 9-11 3-23 2-33-3Z" fill={fill} />
      <path d="M12 31C10 19 14 11 21 8c1.500-.6 2.500-.9 4-1-5 8-6 20-3.500 29-4-.8-7.500-2.600-9.500-5Z" fill={light} />
      <path d="M14.500 17c3-4 6-2.500 6 2.500 0 4.500-2.500 6.500-5 7-2-3-2.500-6-1-9.500Z" fill="#f4f6f8" stroke={shade} strokeWidth="1" />
      <circle cx="25" cy="7" r="2.200" fill={shade} />
      <path d="M12 31c11 5 24 6 33 3" fill="none" stroke={shade} strokeWidth="2" opacity="0.5" />
      <path d="M14 26C8 22 1 24 0.500 31 4 40 18 41 28 37L22 27Z" fill={shade} />
      <path d="M4 31C9 29 16 30 22 33" fill="none" stroke={light} strokeWidth="1" />
    </>
  ),
  boot: ({ fill, shade, light }) => (
    <>
      <path d="M10 4h15v19l14 6c4 2 6 5 6 9v3H7V4Z" fill={fill} />
      <path d="M10 9h15M10 14h15M10 19h15" fill="none" stroke={light} strokeWidth="1.2" />
      <path d="M7 38h38v5H7Z" fill={shade} />
    </>
  ),
  // A house slipper: a rounded fluffy toe box over a thin sole.
  slipper: ({ fill, shade, light }) => (
    <>
      <path d="M4 36c0-9 3-15 12-15l8 4c8 2 18 4 20 11v3H4Z" fill={fill} />
      <path d="M10 28c3-5 9-6 14-2" fill="none" stroke={shade} strokeWidth="2.4" />
      <path d="M4 36h40v4H4Z" fill={shade} />
      <path d="M30 31h8M33 34h8" fill="none" stroke={light} strokeWidth="1.2" />
    </>
  ),
  book: ({ fill, shade, light, spec }) => (
    // A book seen from slightly above and to the side: front cover, spine, and the page edges.
    <>
      <path d="M8 9 12 5h26l-4 4Z" fill="#f1ead8" />
      <path d="M34 9 38 5v35l-4 4Z" fill="#e0d8bf" />
      <path d="M35.6 13v28M37 10v28" fill="none" stroke="#b9ae8c" strokeWidth="0.7" />
      {spec.cover ? (
        <>
          <rect x="8" y="9" width="26" height="35" fill={shade} />
          <image href={spec.cover} x="8" y="9" width="26" height="35" preserveAspectRatio="xMidYMid slice" stroke="none" />
        </>
      ) : spec.pattern === "sudoku" ? (
        <>
          <rect x="8" y="9" width="26" height="35" fill={fill} />
          {/* A sudoku grid: nine by nine thin lines with heavier ones every three. */}
          <rect x="13" y="19" width="18" height="18" fill="#f4f6f8" stroke="none" />
          <path d={Array.from({ length: 8 }, (_, i) => `M${13 + (i + 1) * 2}19v18M13 ${19 + (i + 1) * 2}h18`).join("")} fill="none" stroke="#9aa7b5" strokeWidth="0.35" />
          <path d="M19 19v18M25 19v18M13 25h18M13 31h18" fill="none" stroke={shade} strokeWidth="0.9" />
          <rect x="13" y="19" width="18" height="18" fill="none" stroke={shade} strokeWidth="1.1" />
          <path d="M14 13.5h16" fill="none" stroke={light} strokeWidth="2" />
        </>
      ) : (
        <>
          <rect x="8" y="9" width="26" height="35" fill={fill} />
          <path d="M16 20h12M16 25h12" fill="none" stroke={light} />
        </>
      )}
      {/* The spine: a darker strip with a crease down the front cover. */}
      <rect x="8" y="9" width="4" height="35" fill="rgba(0,0,0,0.32)" stroke="none" />
      <path d="M12.6 9v35" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
      <rect x="8" y="9" width="26" height="35" fill="none" />
    </>
  ),
  notebook: ({ fill, shade, light, spec }) => (
    <>
      <rect x="10" y="5" width="28" height="38" rx="3" fill={fill} />
      {spec.accent && <rect x="10" y="30" width="28" height="9" fill={spec.accent} />}
      <rect x="18" y="12" width="16" height="10" rx="1.5" fill={spec.accent ?? light} stroke="none" />
      <path d="M21 16h10M21 19h7" fill="none" stroke={spec.accent ? fill : shade} strokeWidth="1.2" />
      {[10, 17, 24, 31, 38].map((y) => (
        <ellipse key={y} cx="10" cy={y} rx="2.6" ry="1.6" fill={light} />
      ))}
    </>
  ),
  laptop: ({ fill, shade }) => (
    <>
      <rect x="9" y="9" width="30" height="22" rx="2.5" fill={fill} />
      <rect x="12" y="12" width="24" height="16" rx="1" fill={shade} />
      <path d="M3 35h42l-4 5H7Z" fill={fill} />
    </>
  ),
  keyboard: ({ fill, shade }) => (
    <>
      <rect x="3" y="14" width="42" height="20" rx="3" fill={fill} />
      <path d="M8 20h4M16 20h4M24 20h4M32 20h4M8 25h4M16 25h16M36 25h4" fill="none" stroke={shade} strokeWidth="3" />
    </>
  ),
  mouse: ({ fill, shade }) => (
    <>
      <path d="M15 14C15 6 33 6 33 14l2 20c0 9-22 9-22 0Z" fill={fill} />
      <path d="M24 7v13M15 20h18" fill="none" stroke={shade} />
      <rect x="22" y="10" width="4" height="7" rx="2" fill={shade} stroke="none" />
    </>
  ),
  controller: ({ fill, shade, light }) => (
    <>
      <path d="M12 14h24c6 0 9 12 8 21-1 5-7 5-9 1l-3-5H16l-3 5c-2 4-8 4-9-1-1-9 2-21 8-21Z" fill={fill} />
      <path d="M14 20v7M10.5 23.5h7" fill="none" stroke={shade} strokeWidth="3" />
      <circle cx="33" cy="21" r="2" fill={light} stroke="none" />
      <circle cx="37.5" cy="25" r="2" fill={shade} stroke="none" />
    </>
  ),
  console: ({ fill, shade }) => (
    // A PlayStation 4 from the front: a wide slanted slab, two-tone, with a light bar and the PS mark.
    <>
      <path d="M12 12h34l-6 25H6Z" fill={fill} />
      <path d="M12 12h34l-1.4 5.5H10.6Z" fill={shade} />
      <path d="M9 31h30" fill="none" stroke="#7fc4ff" strokeWidth="1.6" />
      <path d="M11 24h27" fill="none" stroke={shade} strokeWidth="1.4" />
      <circle cx="33" cy="20" r="1.2" fill="#7fc4ff" stroke="none" />
      {/* The PlayStation mark and a 4: a P, an S overlapping it, and the number. */}
      <g fill="none" stroke="#e8eef5" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 31V15h6c3.4 0 5 1.6 5 4s-1.6 4-5 4h-6" />
        <path d="M33 19c-2.2-1.6-6-.8-5.2 1.4.8 2.2 6 1.6 5.2 4.4-.6 2.2-4.6 2.6-7 .8" />
        <path d="M38.5 20.5 35 27h6.2M39.8 23v7" strokeWidth="1.4" />
      </g>
    </>
  ),
  // A laptop cooling pad: a rounded base with a big fan in it.
  coolbase: ({ fill, shade, light }) => (
    <>
      <rect x="3" y="7" width="42" height="34" rx="11" fill={fill} />
      <circle cx="24" cy="24" r="13" fill={shade} />
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} transform={`rotate(${i * 60} 24 24)`} d="M24 24Q32 13 24 11.5Q18 15 24 24Z" fill={light} stroke="none" />
      ))}
      <circle cx="24" cy="24" r="3.2" fill={fill} />
      <path d="M8 36h3M37 36h3" fill="none" stroke={shade} strokeWidth="2" />
    </>
  ),
  watch: ({ fill, shade, light }) => (
    <>
      <path d="M17 2h14v10H17ZM17 36h14v10H17Z" fill={shade} />
      <rect x="12" y="11" width="24" height="26" rx="8" fill={fill} />
      <rect x="15" y="14" width="18" height="20" rx="5" fill={shade} stroke="none" />
      <path d="M20 22h8M20 27h5" fill="none" stroke={light} strokeWidth="1.8" />
    </>
  ),
  headset: ({ fill, shade }) => (
    <>
      <Rod d="M9 28V22C9 5 39 5 39 22v6" w={4} color={shade} />
      <rect x="4" y="25" width="12" height="16" rx="5" fill={fill} />
      <rect x="32" y="25" width="12" height="16" rx="5" fill={fill} />
    </>
  ),
  mask: ({ fill, shade, light }) => (
    <>
      <path d="M3 24C3 13 14 11 24 16c10-5 21-3 21 8s-11 13-21 9C14 37 3 35 3 24Z" fill={fill} />
      <path d="M10 24q5 4 10 0M28 24q5 4 10 0" fill="none" stroke={light} strokeWidth="1.8" />
      <path d="M3 22H0M45 22h3" fill="none" stroke={shade} strokeWidth="2" />
    </>
  ),
  strips: ({ fill, shade, spec }) => (
    <>
      <rect x="7" y="12" width="34" height="24" rx="3" fill={fill} />
      <path d="M24 18q-5 7 0 13q5-6 0-13Z" fill={spec.accent ?? shade} stroke="none" />
      <path d="M11 17h8M29 17h8M11 31h8M29 31h8" fill="none" stroke={spec.accent ?? shade} strokeWidth="1.600" />
    </>
  ),
  // A laptop charger: a long black brick with a cable and a barrel plug.
  laptopcharger: ({ fill, shade, light }) => (
    <>
      <path d="M3 30h8c6 0 6 8 13 8" fill="none" stroke={OUTLINE} strokeWidth="4.400" />
      <path d="M3 30h8c6 0 6 8 13 8" fill="none" stroke={shade} strokeWidth="2" />
      <rect x="22" y="22" width="22" height="12" rx="3" transform="rotate(-18 33 28)" fill={fill} />
      <rect x="26" y="25" width="9" height="3" rx="1" transform="rotate(-18 33 28)" fill={light} stroke="none" />
      <rect x="1" y="27.500" width="6" height="5" rx="1" fill={light} />
    </>
  ),
  // A printout bound with a spiral: loose pages, a clear cover and the coil down the side.
  spiral: ({ shade }) => (
    <>
      <rect x="10" y="5" width="28" height="38" rx="2" fill="#f3f1e7" />
      <rect x="13" y="8" width="25" height="35" rx="1" fill="rgba(180,205,230,0.35)" stroke="none" />
      <path d="M18 14h15M18 19h15M18 24h15M18 29h10" fill="none" stroke={shade} strokeWidth="1.4" />
      {[9, 15, 21, 27, 33, 39].map((y) => (
        <ellipse key={y} cx="11" cy={y} rx="3" ry="1.7" fill="none" stroke="#4b5568" strokeWidth="1.6" />
      ))}
    </>
  ),
  device: ({ fill, shade, light }) => (
    <>
      <rect x="5" y="13" width="38" height="22" rx="5" fill={fill} />
      <path d="M11 24h22" fill="none" stroke={shade} strokeWidth="3" />
      <circle cx="37" cy="24" r="2" fill={light} stroke="none" />
    </>
  ),
  camera: ({ fill, shade, light }) => (
    <>
      <rect x="14" y="9" width="12" height="7" rx="2" fill={shade} />
      <rect x="5" y="14" width="38" height="24" rx="4" fill={fill} />
      <circle cx="24" cy="26" r="9" fill={shade} />
      <circle cx="24" cy="26" r="4.5" fill={light} stroke="none" />
      <circle cx="37" cy="19" r="1.6" fill={light} stroke="none" />
    </>
  ),
  drive: ({ fill, shade, light }) => (
    <>
      <rect x="7" y="11" width="34" height="26" rx="3.5" fill={fill} />
      <rect x="11" y="15" width="17" height="7" rx="1.5" fill={shade} />
      <circle cx="35" cy="32" r="2.2" fill={light} stroke="none" />
    </>
  ),
  hub: ({ fill, shade }) => (
    <>
      <path d="M2 30c6 0 6-6 12-6" fill="none" stroke={shade} strokeWidth="2.4" />
      <rect x="12" y="18" width="32" height="14" rx="4" fill={fill} />
      <path d="M18 25h4M26 25h4M34 25h4" fill="none" stroke={shade} strokeWidth="3.2" />
    </>
  ),
  charger: ({ fill, shade }) => (
    <>
      <path d="M19 10V4M29 10V4" fill="none" strokeWidth="3" />
      <rect x="13" y="10" width="22" height="22" rx="4" fill={fill} />
      <path d="M24 32c0 11 6 11 14 8" fill="none" stroke={shade} strokeWidth="2.4" />
    </>
  ),
  phone: ({ fill, shade, light }) => (
    <>
      <rect x="13" y="4" width="22" height="40" rx="4" fill={fill} />
      <rect x="15.5" y="8" width="17" height="30" rx="1.5" fill={shade} />
      <circle cx="24" cy="6" r="0.9" fill={light} stroke="none" />
    </>
  ),
  tv: ({ fill, shade, light }) => (
    <>
      <path d="M14 35l-3 6M34 35l3 6" fill="none" strokeWidth="3" />
      <rect x="3" y="9" width="42" height="26" rx="2" fill={fill} />
      <rect x="6" y="12" width="36" height="20" rx="1" fill={shade} />
      <path d="M10 28 22 15" fill="none" stroke={light} strokeWidth="1.4" opacity="0.5" />
    </>
  ),
  monitor: ({ fill, shade, light }) => (
    <>
      <path d="M24 32v8M14 41h20" fill="none" strokeWidth="3.4" />
      <rect x="4" y="7" width="40" height="26" rx="2" fill={fill} />
      <rect x="6" y="9" width="36" height="21" rx="1" fill={shade} />
      <path d="M10 27 21 12" fill="none" stroke={light} strokeWidth="1.4" opacity="0.5" />
    </>
  ),
  kindle: ({ fill, shade }) => (
    <>
      <rect x="11" y="4" width="26" height="40" rx="3" fill={fill} />
      <rect x="14" y="8" width="20" height="27" rx="1" fill="#d9dde2" stroke="none" />
      <path d="M17 14h14M17 18h14M17 22h14M17 26h9" fill="none" stroke={shade} strokeWidth="1.2" />
    </>
  ),
  earbuds: ({ fill, shade }) => (
    <>
      <path d="M24 13l2 10M36 17l1 12" fill="none" stroke="#eef2f5" strokeWidth="3" />
      <circle cx="23" cy="11" r="5" fill="#eef2f5" />
      <circle cx="35" cy="15" r="5" fill="#eef2f5" />
      <rect x="5" y="25" width="24" height="18" rx="7" fill={fill} />
      <path d="M5 33h24" fill="none" stroke={shade} />
    </>
  ),
  // Earphones joined by a cable that hangs in a loop, with a small Bluetooth receiver on it.
  earphones: ({ fill, shade, light }) => (
    <>
      <Rod d="M12 13C12 34 15 40 24 40S36 34 36 13" w={1.8} color={shade} />
      <circle cx="12" cy="10" r="4.6" fill="#eef2f5" />
      <circle cx="36" cy="10" r="4.6" fill="#eef2f5" />
      <rect x="18" y="35" width="12" height="9" rx="3" fill={fill} />
      <circle cx="24" cy="39.500" r="1.600" fill={light} stroke="none" />
    </>
  ),
  // A room thermometer: a square body with a display and a small sensor dot.
  thermometer: ({ fill, shade, light }) => (
    <>
      <rect x="7" y="7" width="34" height="34" rx="7" fill={fill} />
      <rect x="12" y="12" width="24" height="15" rx="3" fill={light} stroke="none" />
      <path d="M17 22v-6h4M25 16h4v6h-4ZM32 17.500h1.500" fill="none" stroke={shade} strokeWidth="1.600" />
      <circle cx="24" cy="34" r="2.600" fill={shade} stroke="none" />
    </>
  ),
  lamp: ({ fill, shade }) => (
    // A Luxo-style desk lamp: a base, two arms and a cone shade.
    <>
      <ellipse cx="14" cy="41" rx="10" ry="3.5" fill={fill} />
      <Rod d="M14 39 18 20 31 24" w={3} color={shade} />
      <circle cx="18" cy="20" r="2.4" fill={fill} />
      <path d="M27 16 41 17q3 11-6 15l-8-8Z" fill={fill} />
      <circle cx="35" cy="26" r="3" fill="#ffe9a0" stroke="none" />
    </>
  ),
  scratcher: ({ fill, shade }) => (
    <>
      <Rod d="M7 43 31 16" w={4} color={fill} />
      <path d="M29 15l7-9 5 3-1 6-6 6Z" fill={fill} />
      <path d="M37 6l3-3M40 9l5-2M39 14l6-1" fill="none" stroke={shade} strokeWidth="2" />
    </>
  ),
  cube: ({ spec }) => <Cube grid={spec.grid} scheme={spec.scheme} />,
  megaminx: ({ fill, shade, light }) => {
    const pt = (r: number, i: number, n: number, off = 0) => {
      const a = ((i / n) * 360 + off - 90) * (Math.PI / 180);
      return `${(24 + r * Math.cos(a)).toFixed(1)} ${(24 + r * Math.sin(a)).toFixed(1)}`;
    };
    const outer = Array.from({ length: 10 }, (_, i) => pt(21, i, 10)).join("L");
    const inner = Array.from({ length: 5 }, (_, i) => pt(11, i, 5, 0)).join("L");
    const spokes = Array.from({ length: 5 }, (_, i) => `M${pt(11, i, 5)}L${pt(21, i * 2, 10)}`).join("");
    return (
      <>
        <path d={`M${outer}Z`} fill={fill} />
        <path d={`M${inner}Z`} fill={light} />
        <path d={spokes} fill="none" stroke={shade} />
      </>
    );
  },
  mug: ({ fill, shade }) => (
    <>
      <Rod d="M33 18h3c5 0 5 11-1 11h-2" w={2.4} color={shade} />
      <path d="M9 13h24v21c0 5-3 9-8 9h-8c-5 0-8-4-8-9Z" fill={fill} />
      <path d="M9 18h24" fill="none" stroke={shade} />
    </>
  ),
  bottle: ({ fill, shade, light }) => (
    <>
      <rect x="19" y="3" width="10" height="7" rx="1.5" fill={shade} />
      <path d="M17 10h14v4l3 5v21c0 2-2 4-4 4H18c-2 0-4-2-4-4V19l3-5Z" fill={fill} />
      <rect x="17" y="25" width="14" height="10" rx="1.5" fill={light} stroke="none" />
    </>
  ),
  // A banknote on its side: framed border, a round portrait and the number on it.
  bill: ({ fill, shade, light, spec }) => {
    const denom = String(spec.bill?.denom ?? "");
    return (
      <>
        <rect x="1.5" y="13" width="45" height="22" rx="2.2" fill={fill} />
        <rect x="4.5" y="16" width="39" height="16" rx="1.2" fill="none" stroke={light} strokeWidth="0.9" />
        <circle cx="13.5" cy="24" r="5" fill={light} stroke="none" opacity="0.85" />
        <circle cx="13.5" cy="22.6" r="1.9" fill={shade} stroke="none" />
        <path d="M9.6 28.4c0-2.4 1.8-3.4 3.9-3.4s3.9 1 3.9 3.4Z" fill={shade} stroke="none" />
        <text
          x="32.5"
          y="27.6"
          textAnchor="middle"
          fontSize={denom.length > 3 ? 8 : denom.length > 2 ? 10 : 12.5}
          fontWeight="800"
          fill={shade}
          stroke="none"
          style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}
        >
          {denom}
        </text>
      </>
    );
  },
  // A plastic card: bank and transit cards show a chip, a logo and a swoosh of the second color; IDs
  // a photo and lines of text under a band of it.
  card: ({ fill, shade, light, pale, spec }) => {
    const ink = pale ? shade : light;
    return (
      <>
        <rect x="2" y="10" width="44" height="28" rx="3.6" fill={fill} />
        {spec.card === "id" ? (
          <>
            <path d="M2 17.5v-4A3.5 3.5 0 0 1 5.5 10h37a3.5 3.5 0 0 1 3.5 3.5v4Z" fill={spec.accent ?? shade} stroke="none" />
            <rect x="6" y="20.5" width="12" height="14" rx="1.5" fill={pale ? "#cdd7e0" : light} stroke="none" />
            <circle cx="12" cy="25.4" r="2.6" fill={shade} stroke="none" />
            <path d="M7.6 34.5c0-3.2 2-4.8 4.4-4.8s4.4 1.6 4.4 4.8Z" fill={shade} stroke="none" />
            <path d="M22 23.5h19M22 28h19M22 32.5h12" fill="none" stroke={ink} strokeWidth="1.8" />
          </>
        ) : spec.card === "transit" ? (
          <>
            {/* A transit pass: a bus on the left and the contactless waves on the right, in the second color when there is one. */}
            <rect x="6" y="16" width="19" height="14" rx="3" fill={spec.accent ?? ink} stroke="none" />
            <rect x="8.5" y="18.5" width="14" height="5.5" rx="1" fill={fill} stroke="none" />
            <path d="M15.500 18.500v5.500" fill="none" stroke={spec.accent ?? ink} strokeWidth="1.2" />
            <circle cx="11" cy="31" r="2.3" fill={spec.accent ?? ink} stroke={fill} strokeWidth="1.2" />
            <circle cx="20" cy="31" r="2.3" fill={spec.accent ?? ink} stroke={fill} strokeWidth="1.2" />
            <path d="M32 20q2.600 4 0 8M36 17.500q4.500 6.500 0 13M40 15q6 9 0 18" fill="none" stroke={spec.accent ?? ink} strokeWidth="2" strokeLinecap="round" />
          </>
        ) : (
          <>
            <rect x="6" y="15" width="9.5" height="7.5" rx="1.6" fill="#e2c05a" stroke={shade} strokeWidth="1" />
            <circle cx="36" cy="19" r="3.9" fill={spec.accent ?? ink} stroke="none" opacity="0.9" />
            <circle cx="40.2" cy="19" r="3.9" fill={ink} stroke="none" opacity="0.7" />
            <path d="M6.5 28h4M12.5 28h4M18.5 28h4M24.5 28h4" fill="none" stroke={ink} strokeWidth="2.4" />
            {spec.accent && (
              <path d="M2 32Q22 26.5 46 31.5v2.9a3.6 3.6 0 0 1-3.6 3.6H5.6A3.6 3.6 0 0 1 2 34.4Z" fill={spec.accent} stroke="none" />
            )}
          </>
        )}
      </>
    );
  },
  // An HDMI cable: a black cord between two plugs with flat silver tips.
  hdmi: ({ fill }) => (
    <>
      <Rod d="M16 33C28 33 20 15 32 15" w={3.4} color={fill} />
      <rect x="9" y="28" width="8.5" height="10" rx="2" fill={fill} />
      <path d="M2.5 29.5h6.5v7h-4.5l-2-2Z" fill="#c8ccd2" />
      <rect x="30.5" y="10" width="8.5" height="10" rx="2" fill={fill} />
      <path d="M39 11.5h6.5v5l-2 2H39Z" fill="#c8ccd2" />
    </>
  ),
  // A cable as just its two ends: a USB-A plug (or USB-C) and a USB-C plug, in the cable's color.
  usbcable: ({ fill, spec }) => {
    const cc = spec.cable === "cc";
    return (
      <>
        {/* A short S of cord joining the two ends. */}
        <Rod d="M24 16C34 16 14 33 24 33" w={2.4} color={fill} />
        <rect x="14" y="9" width="11" height="14" rx="3" fill={fill} />
        {cc ? (
          <>
            <rect x="3" y="11.5" width="12" height="9" rx="4.5" fill="#c8ccd2" />
            <rect x="6" y="15" width="7" height="2" rx="1" fill="#3b4351" stroke="none" />
          </>
        ) : (
          <>
            <rect x="3" y="11.5" width="12" height="9" rx="1" fill="#c8ccd2" />
            <rect x="5" y="15.5" width="9" height="2.6" fill={spec.port ?? "#eef2f5"} stroke="none" />
          </>
        )}
        <rect x="23" y="26" width="11" height="14" rx="3" fill={fill} />
        <rect x="33" y="28.5" width="12" height="9" rx="4.5" fill="#c8ccd2" />
        <rect x="36" y="32" width="7" height="2" rx="1" fill="#3b4351" stroke="none" />
      </>
    );
  },
  // A black folding knife, blade out to the left.
  knife: ({ fill, light }) => (
    <>
      <path d="M2.5 28 8 21.5Q15 17.5 26 18V28.5Z" fill={fill} />
      <path d="M8 22.5Q15 19.5 24 19.8" fill="none" stroke={light} strokeWidth="1" opacity="0.55" />
      <path d="M24 17H43Q46 17 46 20V27Q46 30 43 30H27Q24 30 24 28Z" fill={fill} />
      <circle cx="29.5" cy="23.5" r="1.7" fill={light} stroke="none" />
      <path d="M36 25h8M36 27.5h8" fill="none" stroke={light} strokeWidth="1.2" opacity="0.7" />
      <circle cx="43.5" cy="20.3" r="1.1" fill={light} stroke="none" />
    </>
  ),
  // A hammer multi-tool: a cap on one end, a claw over it and the body running down to the right.
  hammer: ({ fill, shade, light }) => (
    <>
      <path d="M19 14 34 12 42 37Q44 44 37 44H31Q27 44 26 40Z" fill={fill} />
      <path d="M14 12Q22 5 34 8Q40 10 41 14Q31 12 22 16L14 20Z" fill={fill} />
      <rect x="3.5" y="10" width="11" height="13" rx="3" fill={shade} />
      <circle cx="31" cy="38" r="2" fill={light} stroke="none" />
      <path d="M28 20 33 34" fill="none" stroke={light} strokeWidth="1.2" opacity="0.6" />
    </>
  ),
  // A piano keyboard: a dark panel over a row of white keys with the black ones between.
  piano: () => (
    <>
      <rect x="2" y="10" width="44" height="10" rx="2.5" fill="#3b4351" />
      <rect x="2" y="19" width="44" height="19" rx="2" fill="#f4f6f8" />
      <path d="M8.3 26v12M14.6 26v12M20.9 26v12M27.1 26v12M33.4 26v12M39.7 26v12" fill="none" strokeWidth="1" />
      {[6, 12.3, 24.8, 31, 37.4].map((x) => (
        <rect key={x} x={x} y="19" width="4.2" height="11" rx="1" fill="#3b4351" />
      ))}
    </>
  ),
  // A box of lego: a brick with studs on top.
  lego: ({ fill, shade, light }) => (
    <>
      <rect x="11" y="12" width="7" height="6" rx="2" fill={fill} />
      <rect x="20.5" y="12" width="7" height="6" rx="2" fill={fill} />
      <rect x="30" y="12" width="7" height="6" rx="2" fill={fill} />
      <rect x="6" y="17" width="36" height="22" rx="3" fill={fill} />
      <path d="M6 24h36" fill="none" stroke={shade} strokeWidth="1.4" />
      <rect x="14" y="28" width="20" height="6" rx="1.5" fill={light} stroke="none" opacity="0.8" />
    </>
  ),
  // A streaming box (a Roku): a small flat box with a light and the logo dot.
  streamer: ({ fill, light }) => (
    <>
      <rect x="5" y="18" width="38" height="15" rx="4.5" fill={fill} />
      <circle cx="14" cy="25.5" r="2.4" fill={light} stroke="none" />
      <path d="M22 25.5h14" fill="none" stroke={light} strokeWidth="1.6" opacity="0.7" />
      <path d="M43 27h3" fill="none" strokeWidth="2" />
    </>
  ),
  // Bedding folded in a stack: stripes in the second color when it has one.
  bedding: ({ fill, shade, spec }) => (
    <>
      <rect x="4" y="14" width="40" height="22" rx="4.5" fill={fill} />
      {spec.accent && <path d="M11 14.8v20.4M19 14.8v20.4M27 14.8v20.4M35 14.8v20.4" fill="none" stroke={spec.accent} strokeWidth="3.4" strokeLinecap="butt" />}
      <path d="M4 25.5h40" fill="none" stroke={shade} strokeWidth="1.3" />
      <rect x="4" y="14" width="40" height="22" rx="4.5" fill="none" />
    </>
  ),
  // One pillow, or two when it is a pair: plump, with a seam along the edge.
  pillow: ({ fill, shade, spec }) => {
    const one = (
      <>
        <path d="M6 16Q24 9 42 16Q46 25 42 34Q24 40 6 34Q2 25 6 16Z" fill={fill} />
        <path d="M10 20Q24 15 38 20M10 30Q24 35 38 30" fill="none" stroke={shade} strokeWidth="1.2" opacity="0.7" />
      </>
    );
    return spec.pair ? (
      <>
        <g transform="translate(-7 -6) scale(0.85)">{one}</g>
        <g transform="translate(5 4) scale(0.85)">{one}</g>
      </>
    ) : (
      one
    );
  },
  // A Mexican passport: a green booklet with the gold coat of arms and the title in gold.
  passport: ({ fill, shade }) => (
    <>
      <rect x="10" y="4" width="28" height="40" rx="2.5" fill={fill} />
      <path d="M14 4.5v39" fill="none" stroke={shade} strokeWidth="1.2" />
      <circle cx="25.5" cy="18.5" r="7" fill="none" stroke="#e2c05a" strokeWidth="1.6" />
      <path d="M22.3 15h6.4l-.6 5.2-2.6 2.8-2.6-2.8Z" fill="#e2c05a" stroke="none" />
      <path d="M18.5 31h14M20.5 35h10" fill="none" stroke="#e2c05a" strokeWidth="1.6" />
    </>
  ),
  // A keychain: a split ring, a short chain and a name tag.
  keychain: ({ fill, shade, light }) => (
    <>
      <Rod d="M18 9a6 6 0 1 0 12 0a6 6 0 1 0-12 0" w={2.4} color="#c8ccd2" />
      <Rod d="M24 15v7" w={2} color="#c8ccd2" />
      <rect x="12" y="21" width="24" height="21" rx="4.5" fill={fill} />
      <circle cx="24" cy="26.2" r="2.1" fill={shade} stroke="none" />
      <path d="M17.5 33.2h13M17.5 37.6h8.5" fill="none" stroke={light} strokeWidth="2" />
    </>
  ),
  folder: ({ fill, shade, light }) => (
    <>
      <path d="M6 11h14l4 4h18v24H6Z" fill={shade} />
      <rect x="10" y="12" width="26" height="14" rx="1" fill={light} stroke="none" />
      <path d="M6 19h36v20H6Z" fill={fill} />
    </>
  ),
  stool: ({ fill, shade }) => (
    <>
      <path d="M12 20 9 43M36 20l3 23" fill="none" stroke={shade} strokeWidth="4" />
      <rect x="7" y="11" width="34" height="10" rx="3.5" fill={fill} />
    </>
  ),
  // A desk taken apart: four white wooden planks, stacked a little askew.
  deskparts: () => (
    <>
      {[
        { y: 31, r: -2, x: 3 },
        { y: 24, r: 2, x: 5 },
        { y: 17, r: -1.5, x: 2 },
        { y: 10, r: 2.5, x: 4 },
      ].map((p, i) => (
        <g key={i} transform={`rotate(${p.r} 24 ${p.y + 3})`}>
          <rect x={p.x} y={p.y} width="40" height="6.5" rx="1.2" fill="#f3f4f6" />
          <path d={`M${p.x + 5} ${p.y + 3.3}h14M${p.x + 24} ${p.y + 3.3}h11`} fill="none" stroke="#c9ced6" strokeWidth="1" />
        </g>
      ))}
    </>
  ),
  tablet: ({ fill, shade, light }) => (
    <>
      <rect x="3" y="9" width="42" height="30" rx="4" fill={fill} />
      <rect x="7" y="13" width="34" height="22" rx="1.5" fill={shade} stroke="none" />
      <path d="M11 29 21 17" fill="none" stroke={light} strokeWidth="1.4" opacity="0.5" />
      <circle cx="5.2" cy="24" r="0.9" fill={light} stroke="none" />
    </>
  ),
  swim: ({ fill, shade, light, spec }) => (
    // Swim trunks: a scalloped hem, a tied waist and a wave band; palm-print ones get leaves.
    <>
      <path d="M11 7h26l4 26c-4 3-9 3-13 0l-4-9-4 9c-4 3-9 3-13 0Z" fill={fill} />
      <path d="M11 7h26v5H11Z" fill={shade} stroke="none" />
      <path d="M22 12l-3 8M26 12l3 8" fill="none" stroke={light} strokeWidth="1.3" />
      {spec.pattern === "palm" ? (
        <g fill="#3fae6a" stroke="none">
          <path d="M13 22q4-7 8-1q-4 3-8 1ZM13 22q2 6 6 5q-1-4-6-5ZM30 20q4-7 8-1q-4 3-8 1ZM29 27q3-5 7-1q-3 3-7 1Z" />
        </g>
      ) : (
        <path d="M8 27q4-3 8 0t8 0t8 0t8 0" fill="none" stroke={light} strokeWidth="1.6" />
      )}
    </>
  ),
  cleats: ({ fill, shade }) => (
    <>
      <path d="M5 28c0-8 6-12 10-12l4 4c4 2 10 2 16 6 5 2 8 4 8 7v1H5Z" fill={fill} />
      <path d="M5 33h38v3H5Z" fill={shade} />
      <path d="M9 36l2 6 2-6M19 36l2 6 2-6M30 36l2 6 2-6M39 36l2 5 2-5" fill={shade} />
    </>
  ),
  // A baseball glove: a rounded mitt with four finger seams, a laced web and a thumb on the side.
  // A pair of batting gloves: two small gloves with separate fingers, a thumb and a strap at the wrist.
  batting: ({ fill, shade, light }) => {
    const one = "M8 40V26c-3-2-2-7 1-6l2 3V9q2-2 4 0v10l1-12q2-2 4 0l1 12 1-10q2-2 4 0v12l1-6q2-2 4 1l-1 14q0 7-6 10Z";
    return (
      <>
        <g transform="translate(-2 1) scale(0.95)">
          <path d={one} fill={fill} />
          <path d="M8 33h19" fill="none" stroke={light} strokeWidth="2" />
        </g>
        <g transform="translate(18 3) scale(0.95)">
          <path d={one} fill={fill} />
          <path d="M8 33h19" fill="none" stroke={light} strokeWidth="2" />
          <path d="M12 26h10" fill="none" stroke={shade} strokeWidth="1" />
        </g>
      </>
    );
  },
  glove: ({ fill, shade, light }) => (
    <>
      <path d="M10 43C4 31 8 15 18 10 27 5 37 8 41 16c4 8 2 20-2 27Z" fill={fill} />
      <path d="M10 27c-6-2-8 8 0 14Z" fill={fill} />
      <path d="M18 11q3 8 0 15M25 8q3 9 0 18M32 10q2 8 0 16" fill="none" stroke={shade} strokeWidth="1.4" />
      <path d="M13 31q12-9 25 0" fill="none" stroke={light} strokeWidth="1.2" strokeDasharray="2 2" />
      <path d="M15 40q10 3 22 0" fill="none" stroke={shade} strokeWidth="1.6" />
    </>
  ),
  box: ({ fill, shade }) => (
    <>
      <path d="M24 4 42 13v22L24 44 6 35V13Z" fill={fill} />
      <path d="M6 13l18 9 18-9M24 22v22" fill="none" stroke={shade} />
    </>
  ),
};

const SCHEMES = {
  classic: ["#f2d13b", "#2f6fdc", "#e0584d"],
  phantom: ["#3a414d", "#4a525e", "#2c323c"],
  mirror: ["#d4a93a", "#c8ccd2", "#e2c05a"],
};

/** A Rubik's-style cube: three visible faces, each a grid of stickers. */
function Cube({ grid, scheme }: { grid: number; scheme: keyof typeof SCHEMES }) {
  const [top, left, right] = SCHEMES[scheme];
  // Corners of the hexagon outline.
  const c = [24, 24], t = [24, 4], ur = [41.3, 14], b = [24, 44], ul = [6.7, 14];
  const face = (o: number[], u: number[], v: number[], color: string, shadeBy: number) => {
    const cells = [];
    const g = 0.07;
    for (let i = 0; i < grid; i++) {
      for (let j = 0; j < grid; j++) {
        const a = [(i + g) / grid, (j + g) / grid], z = [(i + 1 - g) / grid, (j + 1 - g) / grid];
        const p = (s: number, r: number) => `${(o[0] + (u[0] - o[0]) * s + (v[0] - o[0]) * r).toFixed(1)} ${(o[1] + (u[1] - o[1]) * s + (v[1] - o[1]) * r).toFixed(1)}`;
        const mirror = scheme === "mirror" && (i + j) % 2 === 1;
        cells.push(
          <path
            key={`${i}-${j}`}
            d={`M${p(a[0], a[1])}L${p(z[0], a[1])}L${p(z[0], z[1])}L${p(a[0], z[1])}Z`}
            fill={mix(mirror ? SCHEMES.mirror[1] : color, "#000000", shadeBy)}
            stroke="none"
          />,
        );
      }
    }
    return cells;
  };
  return (
    <>
      <path d="M24 4 41.3 14v20L24 44 6.7 34V14Z" fill="#0a1a2a" />
      {face(t, ur, ul, top, 0)}
      {face(c, ul, b, left, 0.12)}
      {face(c, ur, b, right, 0.25)}
    </>
  );
}

/** One item, centered on (0, 0). Position and spin it with a wrapping group. */
export function ItemArt({ spec, size = 52 }: { spec: ArtSpec; size?: number }) {
  const shade = mix(spec.fill, "#0a1a2a", 0.35);
  const light = mix(spec.fill, "#ffffff", 0.55);
  return (
    <g
      transform={`scale(${size / BOX}) translate(${-BOX / 2} ${-BOX / 2})`}
      stroke={OUTLINE}
      strokeWidth="2.4"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {DRAW[spec.kind]({ fill: spec.fill, shade, light, pale: isPale(spec.fill), spec })}
    </g>
  );
}
