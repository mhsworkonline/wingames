import { SUIT_SYMBOL, color } from '../engine/cards';
import type { Rank, Suit } from '../engine/types';

/**
 * Court card figures, drawn as inline SVG in the traditional style: one
 * half-figure — crown, face, mantle, and a rank-appropriate prop — repeated
 * rotated 180° so the card reads the same either way up, exactly how a real
 * King/Queen/Jack is printed.
 *
 * Everything is vector and self-contained — no image assets, and the art
 * scales with the card, so it stays crisp at any board size.
 */

const INK = '#26304a';
const GOLD = '#d9a441';
const GOLD_DARK = '#a97a26';
const SKIN = '#f3d9bb';
const HAIR = '#4a3324';
const SILVER = '#c7d0dc';
const LINEN = '#fbf9f3';

/** Mirror axis: the figure is drawn in the top half and rotated about this point. */
const CENTRE_X = 60;
const CENTRE_Y = 84;

export function isCourt(rank: Rank): boolean {
  return rank >= 11;
}

export function courtArt(rank: Rank, suit: Suit): string {
  const robe = color(suit) === 'red' ? '#b5222b' : '#233a63';
  const trim = color(suit) === 'red' ? '#7c151c' : '#152947';
  const pip = SUIT_SYMBOL[suit];
  const half =
    rank === 13 ? king(robe, trim, pip) : rank === 12 ? queen(robe, trim, pip) : jack(robe, trim, pip);

  return (
    `<svg class="court" viewBox="0 0 120 168" preserveAspectRatio="xMidYMid meet" aria-hidden="true">` +
    `<g stroke-linejoin="round" stroke-linecap="round">${half}</g>` +
    `<g stroke-linejoin="round" stroke-linecap="round" transform="rotate(180 ${CENTRE_X} ${CENTRE_Y})">${half}</g>` +
    `</svg>`
  );
}

/**
 * Mantle and shoulders, shared by all three figures: a wide robe reaching
 * nearly to the card's edges, a fold of linen down the front, and a small
 * medallion bearing the suit over the chest.
 */
function torso(robe: string, trim: string, pip: string): string {
  return (
    `<path d="M11 84 L13 60 Q60 40 107 60 L109 84 Z" fill="${robe}" stroke="${INK}" stroke-width="1.5"/>` +
    // Sheen along the shoulder line, so the mantle reads as fabric.
    `<path d="M16 63 Q60 45 104 63 L104 67 Q60 51 16 67 Z" fill="#ffffff" opacity="0.12"/>` +
    // Drapery folds falling from the shoulders.
    `<path d="M24 68 Q22 78 26 84" fill="none" stroke="${trim}" stroke-width="1" opacity="0.5"/>` +
    `<path d="M96 68 Q98 78 94 84" fill="none" stroke="${trim}" stroke-width="1" opacity="0.5"/>` +
    shoulderBeads() +
    // Centre placket.
    `<path d="M46 56 Q60 78 74 56 L74 84 L46 84 Z" fill="${LINEN}" stroke="${INK}" stroke-width="1.1"/>` +
    `<path d="M51 62 Q60 72 69 62" fill="none" stroke="${trim}" stroke-width="1.4"/>` +
    // Suit medallion over the chest.
    `<circle cx="60" cy="75" r="8" fill="${LINEN}" stroke="${trim}" stroke-width="1.1"/>` +
    `<text x="60" y="76" font-size="11" fill="${trim}" text-anchor="middle" dominant-baseline="central">${pip}</text>`
  );
}

/** A run of gold beads tracing the shoulder curve, like brocade trim. */
function shoulderBeads(): string {
  const spots: [number, number][] = [
    [18, 61],
    [32, 51],
    [46, 45],
    [74, 45],
    [88, 51],
    [102, 61],
  ];
  return spots.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.7" fill="${GOLD}" stroke="${INK}" stroke-width="0.6"/>`).join('');
}

/** The arm that holds the rank's prop, raised on the figure's right. */
function armRaised(robe: string): string {
  return (
    `<path d="M84 64 Q94 52 91 28 Q85 28 81 33 Q84 50 77 62 Z" fill="${robe}" stroke="${INK}" stroke-width="1.2"/>` +
    `<circle cx="89" cy="26" r="4.2" fill="${SKIN}" stroke="${INK}" stroke-width="1"/>`
  );
}

/** The resting arm, bent toward the body. */
function armLower(robe: string): string {
  return (
    `<path d="M36 64 Q27 68 29 76 Q37 81 45 75 Q41 69 39 62 Z" fill="${robe}" stroke="${INK}" stroke-width="1.2"/>` +
    `<circle cx="33" cy="76" r="4" fill="${SKIN}" stroke="${INK}" stroke-width="1"/>`
  );
}

/** Fist on the hip — the Jack's resting arm, with no free hand to draw. */
function armAkimbo(robe: string): string {
  return `<path d="M36 64 Q23 66 25 77 Q34 83 45 76 Q40 70 39 62 Z" fill="${robe}" stroke="${INK}" stroke-width="1.2"/>`;
}

function faceBase(): string {
  return (
    `<ellipse cx="60" cy="46" rx="13.5" ry="15" fill="${SKIN}" stroke="${INK}" stroke-width="1.3"/>` +
    `<path d="M51 41 Q54.5 39 58 41" fill="none" stroke="${INK}" stroke-width="1.1"/>` +
    `<path d="M62 41 Q65.5 39 69 41" fill="none" stroke="${INK}" stroke-width="1.1"/>` +
    `<path d="M52 44.5 Q54.5 43.3 57 44.5" fill="none" stroke="${INK}" stroke-width="1"/>` +
    `<path d="M63 44.5 Q65.5 43.3 68 44.5" fill="none" stroke="${INK}" stroke-width="1"/>` +
    `<path d="M60 45 L58.5 52 L61 52" fill="none" stroke="${INK}" stroke-width="0.9"/>` +
    `<path d="M55.5 55.5 Q60 57.5 64.5 55.5" fill="none" stroke="${INK}" stroke-width="1.1"/>`
  );
}

/** The King's full beard and moustache — the Queen and Jack go without. */
function beard(): string {
  return (
    `<path d="M50 52 Q52.5 47 55.5 52" fill="none" stroke="${INK}" stroke-width="1.3"/>` +
    `<path d="M64.5 52 Q67.5 47 70 52" fill="none" stroke="${INK}" stroke-width="1.3"/>` +
    `<path d="M48 50 Q50 66 60 68 Q70 66 72 50 Q60 60 48 50 Z" fill="${LINEN}" stroke="${INK}" stroke-width="1.2"/>`
  );
}

function hairShort(): string {
  return (
    `<path d="M46 36 Q40 46 44 60 Q43 48 47 34 Z" fill="${HAIR}"/>` +
    `<path d="M74 36 Q80 46 76 60 Q77 48 73 34 Z" fill="${HAIR}"/>` +
    `<path d="M46 34 Q60 24 74 34 Q60 30 46 34 Z" fill="${HAIR}"/>`
  );
}

function hairLong(): string {
  return (
    `<path d="M45 38 Q36 56 41 76 Q40 58 46 36 Z" fill="${HAIR}"/>` +
    `<path d="M75 38 Q84 56 79 76 Q80 58 74 36 Z" fill="${HAIR}"/>` +
    `<path d="M46 34 Q60 24 74 34 Q60 30 46 34 Z" fill="${HAIR}"/>`
  );
}

/** Crown: five points, a jewelled band, and a pearl at the crest. */
function crown(robe: string): string {
  return (
    `<path d="M38 36 L43 17 L51 27 L60 10 L69 27 L77 17 L82 36 Z" fill="${GOLD}" stroke="${INK}" stroke-width="1.3"/>` +
    `<rect x="38" y="35" width="44" height="9" rx="3.5" fill="${GOLD_DARK}" stroke="${INK}" stroke-width="1.3"/>` +
    `<circle cx="46" cy="39.5" r="1.6" fill="${LINEN}"/>` +
    `<circle cx="60" cy="39.5" r="1.6" fill="${LINEN}"/>` +
    `<circle cx="74" cy="39.5" r="1.6" fill="${LINEN}"/>` +
    `<circle cx="51" cy="25" r="2" fill="${robe}" stroke="${INK}" stroke-width="0.8"/>` +
    `<circle cx="69" cy="25" r="2" fill="${robe}" stroke="${INK}" stroke-width="0.8"/>` +
    `<circle cx="60" cy="10" r="2.6" fill="${LINEN}" stroke="${INK}" stroke-width="1"/>`
  );
}

/** Coronet: the same idea as the crown, smaller and without the fifth point. */
function coronet(robe: string): string {
  return (
    `<path d="M42 33 Q46 16 53 26 Q60 12 67 26 Q74 16 78 33 Z" fill="${GOLD}" stroke="${INK}" stroke-width="1.3"/>` +
    `<rect x="42" y="32" width="36" height="7" rx="3" fill="${GOLD_DARK}" stroke="${INK}" stroke-width="1.2"/>` +
    `<circle cx="51" cy="35.5" r="1.4" fill="${LINEN}"/>` +
    `<circle cx="69" cy="35.5" r="1.4" fill="${LINEN}"/>` +
    `<circle cx="60" cy="12" r="2.2" fill="${robe}" stroke="${INK}" stroke-width="0.9"/>`
  );
}

/** Soft cap with a turned brim and a feather swept to the side. */
function cap(robe: string): string {
  return (
    `<path d="M42 24 Q26 12 18 20 Q32 21 40 32 Z" fill="${LINEN}" stroke="${INK}" stroke-width="1.1"/>` +
    `<path d="M40 34 Q41 19 60 18 Q79 19 80 34 Q60 27 40 34 Z" fill="${robe}" stroke="${INK}" stroke-width="1.3"/>` +
    `<path d="M40 32 Q60 25 80 32" fill="none" stroke="${GOLD}" stroke-width="1.8"/>` +
    `<circle cx="60" cy="21" r="2.1" fill="${GOLD}" stroke="${INK}" stroke-width="0.9"/>`
  );
}

/** Sword, held blade-up beside the head. */
function sword(): string {
  return (
    `<rect x="87" y="4" width="4" height="24" rx="1.3" fill="${SILVER}" stroke="${INK}" stroke-width="1"/>` +
    `<rect x="81.5" y="27" width="15" height="3.6" rx="1.6" fill="${GOLD}" stroke="${INK}" stroke-width="0.9"/>` +
    `<rect x="87.3" y="30" width="3.4" height="8" fill="${GOLD_DARK}" stroke="${INK}" stroke-width="0.8"/>` +
    `<circle cx="89" cy="40" r="2.6" fill="${GOLD}" stroke="${INK}" stroke-width="0.9"/>`
  );
}

/** The orb of state, resting in the lower hand. */
function orb(): string {
  return (
    `<circle cx="33" cy="70" r="4.4" fill="${GOLD}" stroke="${INK}" stroke-width="1"/>` +
    `<line x1="33" y1="66" x2="33" y2="61" stroke="${GOLD_DARK}" stroke-width="1.4"/>` +
    `<line x1="29.5" y1="63.5" x2="36.5" y2="63.5" stroke="${GOLD_DARK}" stroke-width="1.4"/>`
  );
}

/** A rose, its bloom resting at the fingertips and its stem curving to the chest. */
function rose(robe: string): string {
  return (
    `<path d="M89 30 Q84 42 87 56" fill="none" stroke="#3f7a4a" stroke-width="2"/>` +
    `<path d="M83 44 Q89 40 93 45 Q87 48 83 44 Z" fill="#3f7a4a" stroke="${INK}" stroke-width="0.7"/>` +
    `<circle cx="89" cy="23" r="6.5" fill="${robe}" stroke="${INK}" stroke-width="1.1"/>` +
    `<circle cx="89" cy="23" r="2.8" fill="${GOLD}" stroke="${INK}" stroke-width="0.8"/>`
  );
}

/** Halberd, shouldered with the axe-head turned forward. */
function halberd(): string {
  return (
    `<rect x="87.3" y="4" width="3.4" height="30" rx="1.3" fill="${GOLD_DARK}" stroke="${INK}" stroke-width="0.9"/>` +
    `<path d="M90.5 6 L103 14 L90.5 23 Z" fill="${SILVER}" stroke="${INK}" stroke-width="1"/>` +
    `<path d="M87 10 L77 16 L87 22 Z" fill="${SILVER}" stroke="${INK}" stroke-width="1"/>` +
    `<circle cx="88.9" cy="3" r="2.2" fill="${SILVER}" stroke="${INK}" stroke-width="0.9"/>`
  );
}

function king(robe: string, trim: string, pip: string): string {
  return (
    torso(robe, trim, pip) +
    armLower(robe) +
    armRaised(robe) +
    hairShort() +
    faceBase() +
    beard() +
    crown(robe) +
    orb() +
    sword()
  );
}

function queen(robe: string, trim: string, pip: string): string {
  return (
    torso(robe, trim, pip) +
    armLower(robe) +
    armRaised(robe) +
    hairLong() +
    faceBase() +
    coronet(robe) +
    rose(robe)
  );
}

function jack(robe: string, trim: string, pip: string): string {
  return (
    torso(robe, trim, pip) +
    armAkimbo(robe) +
    armRaised(robe) +
    hairShort() +
    faceBase() +
    cap(robe) +
    halberd()
  );
}
