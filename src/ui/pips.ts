import { SUIT_SYMBOL } from '../engine/cards';
import type { Rank, Suit } from '../engine/types';

/**
 * Pip layouts for ace through ten, in the standard French arrangement: two
 * outer columns with a centre column filling in, and every pip below the
 * midline rotated 180° exactly as on a real card.
 */

const LEFT = 38;
const CENTRE = 60;
const RIGHT = 82;

/** Vertical span the pips occupy; the midline sits halfway between. */
const TOP = 38;
const BOTTOM = 130;
const MIDLINE = (TOP + BOTTOM) / 2;

const PIP_SIZE = 27;
const ACE_SIZE = 54;

/** [column, fraction down the pip field] */
type Spot = [number, number];

const THIRD = 1 / 3;
const SIXTH = 1 / 6;

const LAYOUTS: Record<number, Spot[]> = {
  1: [[CENTRE, 0.5]],
  2: [
    [CENTRE, 0],
    [CENTRE, 1],
  ],
  3: [
    [CENTRE, 0],
    [CENTRE, 0.5],
    [CENTRE, 1],
  ],
  4: [
    [LEFT, 0],
    [RIGHT, 0],
    [LEFT, 1],
    [RIGHT, 1],
  ],
  5: [
    [LEFT, 0],
    [RIGHT, 0],
    [CENTRE, 0.5],
    [LEFT, 1],
    [RIGHT, 1],
  ],
  6: [
    [LEFT, 0],
    [RIGHT, 0],
    [LEFT, 0.5],
    [RIGHT, 0.5],
    [LEFT, 1],
    [RIGHT, 1],
  ],
  7: [
    [LEFT, 0],
    [RIGHT, 0],
    [CENTRE, 0.25],
    [LEFT, 0.5],
    [RIGHT, 0.5],
    [LEFT, 1],
    [RIGHT, 1],
  ],
  8: [
    [LEFT, 0],
    [RIGHT, 0],
    [CENTRE, 0.25],
    [LEFT, 0.5],
    [RIGHT, 0.5],
    [CENTRE, 0.75],
    [LEFT, 1],
    [RIGHT, 1],
  ],
  9: [
    [LEFT, 0],
    [RIGHT, 0],
    [LEFT, THIRD],
    [RIGHT, THIRD],
    [CENTRE, 0.5],
    [LEFT, 2 * THIRD],
    [RIGHT, 2 * THIRD],
    [LEFT, 1],
    [RIGHT, 1],
  ],
  10: [
    [LEFT, 0],
    [RIGHT, 0],
    [CENTRE, SIXTH],
    [LEFT, THIRD],
    [RIGHT, THIRD],
    [LEFT, 2 * THIRD],
    [RIGHT, 2 * THIRD],
    [CENTRE, 5 * SIXTH],
    [LEFT, 1],
    [RIGHT, 1],
  ],
};

/** Every pip position for a rank, as absolute viewBox coordinates. */
export function pipSpots(rank: Rank): { x: number; y: number; flipped: boolean }[] {
  const layout = LAYOUTS[rank];
  if (!layout) return [];
  return layout.map(([x, fraction]) => {
    const y = TOP + fraction * (BOTTOM - TOP);
    return { x, y, flipped: y > MIDLINE };
  });
}

export function isPipCard(rank: Rank): boolean {
  return rank <= 10;
}

export function pipArt(rank: Rank, suit: Suit): string {
  const symbol = SUIT_SYMBOL[suit];
  const size = rank === 1 ? ACE_SIZE : PIP_SIZE;

  const pips = pipSpots(rank)
    .map(({ x, y, flipped }) => {
      const rotate = flipped ? ` transform="rotate(180 ${x} ${round(y)})"` : '';
      return (
        `<text class="pip" x="${x}" y="${round(y)}" font-size="${size}"` +
        ` text-anchor="middle" dominant-baseline="central"${rotate}>${symbol}</text>`
      );
    })
    .join('');

  return (
    `<svg class="pips" viewBox="0 0 120 168" preserveAspectRatio="xMidYMid meet" aria-hidden="true">` +
    pips +
    `</svg>`
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
