import { SUIT_SYMBOL, color } from '../engine/cards';
import type { Rank, Suit } from '../engine/types';

/**
 * Court card figures, drawn as inline SVG in the traditional French style: one
 * half-figure, repeated rotated 180° so the card reads the same either way up.
 *
 * Everything is vector and self-contained — no image assets, and the art scales
 * with the card, so it stays crisp at any board size.
 */

const INK = '#26304a';
const GOLD = '#e0aa3e';
const GOLD_DARK = '#b5832a';
const SKIN = '#f7e3cd';
const HAIR = '#3a4667';
const SILVER = '#b9c4d6';
const LINEN = '#f2f4f8';

/** Mirror axis: the figure is drawn in the top half and rotated about this point. */
const CENTRE_X = 60;
const CENTRE_Y = 84;

export function isCourt(rank: Rank): boolean {
  return rank >= 11;
}

export function courtArt(rank: Rank, suit: Suit): string {
  const robe = color(suit) === 'red' ? '#c0272d' : '#2f3b63';
  const trim = color(suit) === 'red' ? '#8f1b20' : '#1d2645';
  const pip = SUIT_SYMBOL[suit];
  const half =
    rank === 13 ? king(robe, trim, pip) : rank === 12 ? queen(robe, trim, pip) : jack(robe, trim, pip);

  return (
    `<svg class="court" viewBox="0 0 120 168" preserveAspectRatio="xMidYMid meet" aria-hidden="true">` +
    // Tinted panel behind the figure, borderless so the corner index — which
    // paints above it — stays clean and unobstructed.
    `<rect x="16" y="12" width="88" height="144" rx="6" fill="${LINEN}"/>` +
    `<g stroke-linejoin="round" stroke-linecap="round">${half}</g>` +
    `<g stroke-linejoin="round" stroke-linecap="round" transform="rotate(180 ${CENTRE_X} ${CENTRE_Y})">${half}</g>` +
    `</svg>`
  );
}

/** Shoulders and robe, shared by all three figures. */
function robeBlock(robe: string, trim: string, pip: string): string {
  return (
    `<path d="M22 84 L22 70 Q60 50 98 70 L98 84 Z" fill="${robe}" stroke="${INK}" stroke-width="1.4"/>` +
    // Ermine placket down the front.
    `<path d="M46 60 Q60 80 74 60 L74 84 L46 84 Z" fill="${LINEN}" stroke="${INK}" stroke-width="1.2"/>` +
    `<path d="M51 66 Q60 76 69 66" fill="none" stroke="${trim}" stroke-width="1.6"/>` +
    `<circle cx="60" cy="76" r="3.2" fill="${GOLD}" stroke="${INK}" stroke-width="1"/>` +
    // Suit motifs on the shoulders.
    `<text x="32" y="82" font-size="11" fill="${GOLD}" text-anchor="middle">${pip}</text>` +
    `<text x="88" y="82" font-size="11" fill="${GOLD}" text-anchor="middle">${pip}</text>`
  );
}

function king(robe: string, trim: string, pip: string): string {
  return (
    robeBlock(robe, trim, pip) +
    // Sword held at the shoulder: blade, crossguard, grip and pommel.
    `<rect x="86" y="16" width="5" height="44" rx="1.5" fill="${SILVER}" stroke="${INK}" stroke-width="1"/>` +
    `<rect x="79" y="59" width="19" height="4.5" rx="2" fill="${GOLD}" stroke="${INK}" stroke-width="1"/>` +
    `<rect x="86.5" y="63" width="4" height="8" fill="${GOLD_DARK}" stroke="${INK}" stroke-width="0.9"/>` +
    `<circle cx="88.5" cy="73" r="3.2" fill="${GOLD}" stroke="${INK}" stroke-width="1"/>` +
    // Hair falling either side of the face.
    `<path d="M45 38 Q42 56 48 60 Q44 44 47 36 Z" fill="${HAIR}"/>` +
    `<path d="M75 38 Q78 56 72 60 Q76 44 73 36 Z" fill="${HAIR}"/>` +
    // Head.
    `<ellipse cx="60" cy="44" rx="13" ry="14" fill="${SKIN}" stroke="${INK}" stroke-width="1.3"/>` +
    `<circle cx="55" cy="42" r="1.7" fill="${INK}"/>` +
    `<circle cx="65" cy="42" r="1.7" fill="${INK}"/>` +
    `<path d="M56 49 Q60 52 64 49" fill="none" stroke="${INK}" stroke-width="1.2"/>` +
    // The king's beard.
    `<path d="M47 46 Q49 64 60 66 Q71 64 73 46 Q60 58 47 46 Z" fill="${LINEN}" stroke="${INK}" stroke-width="1.2"/>` +
    // Crown.
    `<path d="M43 32 L47 19 L53 27 L60 15 L67 27 L73 19 L77 32 Z" fill="${GOLD}" stroke="${INK}" stroke-width="1.3"/>` +
    `<rect x="43" y="31" width="34" height="7" rx="2.5" fill="${GOLD_DARK}" stroke="${INK}" stroke-width="1.3"/>` +
    `<circle cx="60" cy="15" r="2.6" fill="${LINEN}" stroke="${INK}" stroke-width="1"/>` +
    `<circle cx="52" cy="34.5" r="1.8" fill="${robe}"/>` +
    `<circle cx="68" cy="34.5" r="1.8" fill="${robe}"/>`
  );
}

function queen(robe: string, trim: string, pip: string): string {
  return (
    // Long hair, drawn before the robe so it falls behind the shoulders.
    `<path d="M44 42 Q34 60 39 80 Q45 62 48 46 Z" fill="${HAIR}"/>` +
    `<path d="M76 42 Q86 60 81 80 Q75 62 72 46 Z" fill="${HAIR}"/>` +
    robeBlock(robe, trim, pip) +
    // A rose held at the shoulder.
    `<path d="M90 46 Q86 56 88 70" fill="none" stroke="#3f7a4a" stroke-width="2.4"/>` +
    `<path d="M84 52 Q90 48 92 54 Q86 56 84 52 Z" fill="#3f7a4a" stroke="${INK}" stroke-width="0.8"/>` +
    `<circle cx="92" cy="38" r="7" fill="${robe}" stroke="${INK}" stroke-width="1.1"/>` +
    `<circle cx="92" cy="38" r="3.4" fill="${GOLD}" stroke="${INK}" stroke-width="0.9"/>` +
    // Head.
    `<ellipse cx="60" cy="45" rx="12.5" ry="14" fill="${SKIN}" stroke="${INK}" stroke-width="1.3"/>` +
    `<circle cx="55.5" cy="43" r="1.7" fill="${INK}"/>` +
    `<circle cx="64.5" cy="43" r="1.7" fill="${INK}"/>` +
    `<path d="M56 51 Q60 54 64 51" fill="none" stroke="${INK}" stroke-width="1.2"/>` +
    `<path d="M47 38 Q60 28 73 38 Q60 34 47 38 Z" fill="${HAIR}"/>` +
    // Pearl necklace.
    `<path d="M52 62 Q60 70 68 62" fill="none" stroke="${GOLD}" stroke-width="1.6"/>` +
    // Coronet.
    `<path d="M46 30 Q50 20 55 27 Q60 16 65 27 Q70 20 74 30 Z" fill="${GOLD}" stroke="${INK}" stroke-width="1.3"/>` +
    `<rect x="46" y="29" width="28" height="6" rx="2.5" fill="${GOLD_DARK}" stroke="${INK}" stroke-width="1.2"/>` +
    `<circle cx="60" cy="18" r="2.4" fill="${robe}" stroke="${INK}" stroke-width="1"/>`
  );
}

function jack(robe: string, trim: string, pip: string): string {
  return (
    robeBlock(robe, trim, pip) +
    // Halberd shouldered: shaft, axe head and back spike.
    `<rect x="86" y="18" width="3.6" height="54" rx="1.4" fill="${GOLD_DARK}" stroke="${INK}" stroke-width="0.9"/>` +
    `<path d="M89 17 L103 25 L89 35 Z" fill="${SILVER}" stroke="${INK}" stroke-width="1"/>` +
    `<path d="M86 21 L76 27 L86 32 Z" fill="${SILVER}" stroke="${INK}" stroke-width="1"/>` +
    `<circle cx="87.8" cy="14" r="2.6" fill="${SILVER}" stroke="${INK}" stroke-width="1"/>` +
    // Hair under the cap.
    `<path d="M46 40 Q43 54 49 60 Q46 48 48 38 Z" fill="${HAIR}"/>` +
    `<path d="M74 40 Q77 54 71 60 Q74 48 72 38 Z" fill="${HAIR}"/>` +
    // Head — the knave is beardless.
    `<ellipse cx="60" cy="46" rx="12.5" ry="13.5" fill="${SKIN}" stroke="${INK}" stroke-width="1.3"/>` +
    `<circle cx="55.5" cy="44" r="1.7" fill="${INK}"/>` +
    `<circle cx="64.5" cy="44" r="1.7" fill="${INK}"/>` +
    `<path d="M56 52 Q60 55 64 52" fill="none" stroke="${INK}" stroke-width="1.2"/>` +
    // Soft cap with a feather sweeping off to the side.
    `<path d="M46 24 Q30 14 24 22 Q38 22 44 34 Z" fill="${LINEN}" stroke="${INK}" stroke-width="1.1"/>` +
    `<path d="M45 36 Q46 22 60 21 Q74 22 75 36 Q60 30 45 36 Z" fill="${robe}" stroke="${INK}" stroke-width="1.3"/>` +
    `<path d="M45 34 Q60 28 75 34" fill="none" stroke="${GOLD}" stroke-width="2"/>` +
    `<circle cx="60" cy="24" r="2.2" fill="${GOLD}" stroke="${INK}" stroke-width="0.9"/>`
  );
}
