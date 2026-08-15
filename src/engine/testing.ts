import type { Card, GameState, Pile, Rank, Suit } from './types';

/**
 * Helpers shared by the unit tests for building exact positions.
 * `card('KS')` / `card('10H')` parse the familiar rank+suit shorthand.
 */
export function card(code: string, faceUp = true, copy = 0): Card {
  const suit = code.slice(-1).toUpperCase() as Suit;
  const rankPart = code.slice(0, -1).toUpperCase();
  const rank = parseRank(rankPart);
  return { id: `${suit}${rank}#${copy}`, suit, rank, faceUp };
}

function parseRank(part: string): Rank {
  const named: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13, T: 10 };
  const value = named[part] ?? Number(part);
  if (!Number.isInteger(value) || value < 1 || value > 13) throw new Error(`bad rank: ${part}`);
  return value as Rank;
}

export function cards(codes: string, faceUp = true): Card[] {
  const trimmed = codes.trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+/).map((c, i) => card(c, faceUp, i));
}

export function getPile(state: GameState, id: string): Pile {
  const p = state.piles.find((x) => x.id === id);
  if (!p) throw new Error(`no pile ${id}`);
  return p;
}

/** Replaces the contents of the named piles, leaving the rest untouched. */
export function setPiles(state: GameState, layout: Record<string, Card[]>): GameState {
  const next: GameState = {
    ...state,
    piles: state.piles.map((p) => ({ ...p, cards: layout[p.id] ? layout[p.id].map((c) => ({ ...c })) : [...p.cards] })),
  };
  return next;
}

/** Empties every pile, then applies the given layout — a blank slate for tests. */
export function clearAnd(state: GameState, layout: Record<string, Card[]>): GameState {
  const emptied: GameState = { ...state, piles: state.piles.map((p) => ({ ...p, cards: [] })) };
  return setPiles(emptied, layout);
}

export function codesOf(p: Pile): string[] {
  return p.cards.map((c) => `${c.rank}${c.suit}`);
}

/** Counts every card on the board — used to prove no move creates or loses cards. */
export function totalCards(state: GameState): number {
  return state.piles.reduce((sum, p) => sum + p.cards.length, 0);
}

export function uniqueIds(state: GameState): number {
  return new Set(state.piles.flatMap((p) => p.cards.map((c) => c.id))).size;
}
