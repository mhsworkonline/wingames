import type { Card, Color, GameState, Pile, Rank, Suit } from './types';

export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
export const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const RANK_LABEL: Record<Rank, string> = {
  1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K',
};

export function color(suit: Suit): Color {
  return suit === 'H' || suit === 'D' ? 'red' : 'black';
}

export function sameColor(a: Card, b: Card): boolean {
  return color(a.suit) === color(b.suit);
}

/** mulberry32 — small, fast, and reproducible across runs so seeds mean something. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates, in place, driven by a seeded generator. */
export function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Builds `decks` standard 52-card decks. `suits` limits which suits are used and
 * repeats them to fill the deck — Spider's 1- and 2-suit variants rely on this.
 */
export function buildDeck(decks: number, suits: Suit[] = SUITS): Card[] {
  const cards: Card[] = [];
  const suitsPerDeck = SUITS.length;
  for (let d = 0; d < decks; d++) {
    for (let s = 0; s < suitsPerDeck; s++) {
      const suit = suits[s % suits.length];
      for (const rank of RANKS) {
        cards.push({ id: `${suit}${rank}#${d}${s}`, suit, rank, faceUp: false });
      }
    }
  }
  return cards;
}

export function newSeed(): number {
  return Math.floor(Math.random() * 1_000_000) + 1;
}

export function pile(
  id: string,
  kind: Pile['kind'],
  x: number,
  y: number,
  fan: Pile['fan'] = 'none',
  fanLimit?: number,
): Pile {
  const p: Pile = { id, kind, cards: [], x, y, fan };
  if (fanLimit !== undefined) p.fanLimit = fanLimit;
  return p;
}

export function findPile(state: GameState, id: string): Pile {
  const found = state.piles.find((p) => p.id === id);
  if (!found) throw new Error(`unknown pile: ${id}`);
  return found;
}

export function topCard(p: Pile): Card | undefined {
  return p.cards[p.cards.length - 1];
}

/** Deep copy of state; the rules layer clones before mutating so undo is trivial. */
export function cloneState(state: GameState): GameState {
  return {
    ...state,
    options: { ...state.options },
    piles: state.piles.map((p) => ({ ...p, cards: p.cards.map((c) => ({ ...c })) })),
  };
}

/** Moves the top `count` cards of `from` onto `to`, preserving their order. */
export function transfer(from: Pile, to: Pile, count: number): Card[] {
  const moved = from.cards.splice(from.cards.length - count, count);
  to.cards.push(...moved);
  return moved;
}
