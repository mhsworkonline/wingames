import { buildDeck, cloneState, color, findPile, pile, rng, shuffle, topCard, transfer } from './cards';
import type { Card, Game, GameState, Pile } from './types';

const TABLEAU_COUNT = 8;
const CELL_COUNT = 4;
const FOUNDATION_COUNT = 4;

export const FREECELL_TABLEAUS = Array.from({ length: TABLEAU_COUNT }, (_, i) => `t${i}`);
export const FREECELL_CELLS = Array.from({ length: CELL_COUNT }, (_, i) => `c${i}`);

function isValidRun(cards: Card[]): boolean {
  for (let i = 1; i < cards.length; i++) {
    const prev = cards[i - 1];
    const cur = cards[i];
    if (prev.rank !== cur.rank + 1) return false;
    if (color(prev.suit) === color(cur.suit)) return false;
  }
  return true;
}

/**
 * How many cards a supermove may carry: one per free cell plus the card itself,
 * doubled for every empty column that can be used as scratch space. A destination
 * that is itself an empty column cannot also serve as scratch space.
 */
export function maxSupermove(state: GameState, destination?: Pile): number {
  const freeCells = state.piles.filter((p) => p.kind === 'cell' && p.cards.length === 0).length;
  const emptyCols = state.piles.filter(
    (p) => p.kind === 'tableau' && p.cards.length === 0 && p.id !== destination?.id,
  ).length;
  return (freeCells + 1) * 2 ** emptyCols;
}

function canDropOnFoundation(target: Pile, moving: Card[]): boolean {
  if (moving.length !== 1) return false;
  const card = moving[0];
  const top = topCard(target);
  if (!top) return card.rank === 1;
  return top.suit === card.suit && top.rank === card.rank - 1;
}

export const freecell: Game = {
  id: 'freecell',
  name: 'FreeCell',
  cols: 8,
  heightUnits: 3.9,
  hasScore: false,
  options: [],

  create(seed) {
    const deck = shuffle(buildDeck(1), rng(seed));

    const piles: Pile[] = [];
    for (let i = 0; i < CELL_COUNT; i++) piles.push(pile(`c${i}`, 'cell', i, 0));
    for (let i = 0; i < FOUNDATION_COUNT; i++) piles.push(pile(`f${i}`, 'foundation', 4 + i, 0));
    for (let i = 0; i < TABLEAU_COUNT; i++) piles.push(pile(`t${i}`, 'tableau', i, 1, 'down'));

    const byId = new Map(piles.map((p) => [p.id, p]));
    // Everything is dealt face up: 7 cards to the first four columns, 6 to the rest.
    for (let col = 0; col < TABLEAU_COUNT; col++) {
      const size = col < 4 ? 7 : 6;
      for (let n = 0; n < size; n++) {
        const card = deck.pop()!;
        card.faceUp = true;
        byId.get(`t${col}`)!.cards.push(card);
      }
    }

    return {
      game: 'freecell',
      seed,
      options: {},
      piles,
      moves: 0,
      score: 0,
      won: false,
    };
  },

  grabCount(state, pileId, cardIndex) {
    const p = findPile(state, pileId);
    if (cardIndex < 0 || cardIndex >= p.cards.length) return 0;
    if (p.kind === 'cell') return 1;
    if (p.kind === 'foundation') return cardIndex === p.cards.length - 1 ? 1 : 0;
    const run = p.cards.slice(cardIndex);
    return isValidRun(run) ? run.length : 0;
  },

  canMove(state, move) {
    if (move.type === 'stock') return false;
    const { from, to, count } = move;
    if (from === to || count < 1) return false;
    const src = findPile(state, from);
    const dst = findPile(state, to);
    if (count > src.cards.length) return false;
    if (this.grabCount(state, from, src.cards.length - count) !== count) return false;

    const moving = src.cards.slice(src.cards.length - count);
    if (dst.kind === 'cell') return count === 1 && dst.cards.length === 0;
    if (dst.kind === 'foundation') return canDropOnFoundation(dst, moving);
    if (dst.kind !== 'tableau') return false;

    if (count > maxSupermove(state, dst)) return false;
    const top = topCard(dst);
    if (!top) return true;
    const head = moving[0];
    return top.rank === head.rank + 1 && color(top.suit) !== color(head.suit);
  },

  apply(state, move) {
    if (move.type === 'stock') return state;
    const next = cloneState(state);
    next.moves += 1;
    transfer(findPile(next, move.from), findPile(next, move.to), move.count);
    next.won = this.isWon(next);
    return next;
  },

  autoTarget(state, from, count) {
    const src = findPile(state, from);
    if (src.cards.length === 0) return null;
    // Taking a card back off a foundation is legal, but only by deliberate drag:
    // a stray click must never undo progress.
    if (src.kind === 'foundation') return null;

    if (count === 1) {
      const target = this.foundationTarget(state, from);
      if (target) return target;
    }
    const tableaus = state.piles.filter(
      (p) => p.kind === 'tableau' && p.id !== from && this.canMove(state, { type: 'move', from, to: p.id, count }),
    );
    const stacked = tableaus.find((p) => p.cards.length > 0);
    if (stacked) return stacked.id;
    if (tableaus[0]) return tableaus[0].id;
    // Parking in a free cell is a last resort, and only for a single card.
    if (count === 1 && src.kind !== 'cell') {
      const cell = state.piles.find((p) => p.kind === 'cell' && p.cards.length === 0);
      if (cell) return cell.id;
    }
    return null;
  },

  foundationTarget(state, from) {
    const src = findPile(state, from);
    if (src.cards.length === 0 || src.kind === 'foundation') return null;
    const card = topCard(src)!;
    const foundations = state.piles.filter((p) => p.kind === 'foundation');
    const matching = foundations.find((p) => topCard(p)?.suit === card.suit);
    if (matching && canDropOnFoundation(matching, [card])) return matching.id;
    const empty = foundations.find((p) => p.cards.length === 0);
    if (empty && canDropOnFoundation(empty, [card])) return empty.id;
    return null;
  },

  isWon(state) {
    return state.piles.filter((p) => p.kind === 'foundation').every((p) => p.cards.length === 13);
  },

  autoplayStep(state) {
    if (state.won) return null;
    const sources = state.piles.filter((p) => p.kind === 'tableau' || p.kind === 'cell');
    const options = sources
      .map((p) => ({ p, card: topCard(p) }))
      .filter((o): o is { p: Pile; card: Card } => !!o.card)
      .sort((a, b) => a.card.rank - b.card.rank);

    for (const { p, card } of options) {
      const target = this.foundationTarget(state, p.id);
      if (target && isSafeToPlay(state, card)) {
        return { type: 'move', from: p.id, to: target, count: 1 };
      }
    }
    return null;
  },
};

/** Safe when no lower opposite-colour card could still need this one as a base. */
function isSafeToPlay(state: GameState, card: Card): boolean {
  if (card.rank <= 2) return true;
  const foundations = state.piles.filter((p) => p.kind === 'foundation');
  const rankOf = (suit: Card['suit']) => {
    const p = foundations.find((f) => topCard(f)?.suit === suit);
    return p ? topCard(p)!.rank : 0;
  };
  const opposite = color(card.suit) === 'red' ? (['S', 'C'] as const) : (['H', 'D'] as const);
  return opposite.every((s) => rankOf(s) >= card.rank - 1);
}
