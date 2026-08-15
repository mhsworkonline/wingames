import { buildDeck, cloneState, findPile, pile, rng, shuffle, topCard, transfer } from './cards';
import type { Card, Game, GameState, Move, Pile, Suit } from './types';

const TABLEAU_COUNT = 10;
const FOUNDATION_COUNT = 8;
const DEAL_SIZE = TABLEAU_COUNT;

export const SPIDER_TABLEAUS = Array.from({ length: TABLEAU_COUNT }, (_, i) => `t${i}`);

/** Face-up, same suit, descending by one — the only movable unit in Spider. */
function isValidRun(cards: Card[]): boolean {
  for (let i = 0; i < cards.length; i++) {
    if (!cards[i].faceUp) return false;
    if (i > 0 && (cards[i - 1].suit !== cards[i].suit || cards[i - 1].rank !== cards[i].rank + 1)) {
      return false;
    }
  }
  return true;
}

function suitsFor(count: number): Suit[] {
  if (count === 1) return ['S'];
  if (count === 2) return ['S', 'H'];
  return ['S', 'H', 'D', 'C'];
}

/** Turns the top card face up when a move leaves a face-down card exposed. */
function flipExposed(p: Pile): void {
  const top = topCard(p);
  if (top && !top.faceUp) top.faceUp = true;
}

/** Sweeps completed King-to-Ace suits off the tableau into foundations. */
function collectCompleted(state: GameState): number {
  let collected = 0;
  for (const p of state.piles) {
    if (p.kind !== 'tableau' || p.cards.length < 13) continue;
    const tail = p.cards.slice(p.cards.length - 13);
    if (tail[0].rank !== 13 || tail[12].rank !== 1 || !isValidRun(tail)) continue;
    const foundation = state.piles.find((f) => f.kind === 'foundation' && f.cards.length === 0);
    if (!foundation) continue;
    transfer(p, foundation, 13);
    flipExposed(p);
    collected += 1;
  }
  return collected;
}

export const spider: Game = {
  id: 'spider',
  name: 'Spider',
  cols: 10,
  heightUnits: 4.1,
  hasScore: true,
  options: [
    {
      key: 'suits',
      label: 'Suits',
      values: [
        { value: 1, label: '1 Suit' },
        { value: 2, label: '2 Suits' },
        { value: 4, label: '4 Suits' },
      ],
      default: 1,
    },
  ],

  create(seed, options = {}) {
    const suits = [1, 2, 4].includes(options.suits) ? options.suits : 1;
    const deck = shuffle(buildDeck(2, suitsFor(suits)), rng(seed));

    const piles: Pile[] = [pile('stock', 'stock', 0, 0)];
    for (let i = 0; i < FOUNDATION_COUNT; i++) {
      piles.push(pile(`f${i}`, 'foundation', 2 + i, 0));
    }
    for (let i = 0; i < TABLEAU_COUNT; i++) {
      piles.push(pile(`t${i}`, 'tableau', i, 1, 'down'));
    }

    const byId = new Map(piles.map((p) => [p.id, p]));
    // 54 cards down: six each to the first four columns, five to the rest.
    for (let col = 0; col < TABLEAU_COUNT; col++) {
      const size = col < 4 ? 6 : 5;
      for (let n = 0; n < size; n++) {
        const card = deck.pop()!;
        card.faceUp = n === size - 1;
        byId.get(`t${col}`)!.cards.push(card);
      }
    }
    byId.get('stock')!.cards.push(...deck);

    return {
      game: 'spider',
      seed,
      options: { suits },
      piles,
      moves: 0,
      score: 500,
      won: false,
    };
  },

  grabCount(state, pileId, cardIndex) {
    const p = findPile(state, pileId);
    if (p.kind !== 'tableau') return 0;
    if (cardIndex < 0 || cardIndex >= p.cards.length) return 0;
    const run = p.cards.slice(cardIndex);
    return isValidRun(run) ? run.length : 0;
  },

  canMove(state, move) {
    if (move.type === 'stock') {
      const stock = findPile(state, 'stock');
      if (stock.cards.length < DEAL_SIZE) return false;
      // Standard rule: no dealing onto an empty column.
      return !state.piles.some((p) => p.kind === 'tableau' && p.cards.length === 0);
    }
    const { from, to, count } = move;
    if (from === to || count < 1) return false;
    const src = findPile(state, from);
    const dst = findPile(state, to);
    if (dst.kind !== 'tableau' || src.kind !== 'tableau') return false;
    if (count > src.cards.length) return false;
    if (this.grabCount(state, from, src.cards.length - count) !== count) return false;

    const head = src.cards[src.cards.length - count];
    const top = topCard(dst);
    if (!top) return true;
    return top.faceUp && top.rank === head.rank + 1;
  },

  apply(state, move) {
    const next = cloneState(state);
    next.moves += 1;
    next.score = Math.max(0, next.score - 1);

    if (move.type === 'stock') {
      const stock = findPile(next, 'stock');
      for (const p of next.piles) {
        if (p.kind !== 'tableau') continue;
        const card = stock.cards.pop()!;
        card.faceUp = true;
        p.cards.push(card);
      }
    } else {
      const src = findPile(next, move.from);
      const dst = findPile(next, move.to);
      transfer(src, dst, move.count);
      flipExposed(src);
    }

    next.score += 100 * collectCompleted(next);
    next.won = this.isWon(next);
    return next;
  },

  autoTarget(state, from, count) {
    const src = findPile(state, from);
    if (src.cards.length === 0) return null;
    const head = src.cards[src.cards.length - count];
    const legal = state.piles.filter(
      (p) => p.id !== from && this.canMove(state, { type: 'move', from, to: p.id, count }),
    );
    // Continuing a same-suit run beats a mixed-suit landing, which beats an empty column.
    const sameSuit = legal.find((p) => topCard(p)?.suit === head.suit);
    if (sameSuit) return sameSuit.id;
    const stacked = legal.find((p) => p.cards.length > 0);
    return (stacked ?? legal[0])?.id ?? null;
  },

  foundationTarget() {
    // Spider foundations fill automatically; there is no manual send-to-foundation.
    return null;
  },

  isWon(state) {
    return state.piles.filter((p) => p.kind === 'foundation' && p.cards.length === 13).length === FOUNDATION_COUNT;
  },

  autoplayStep(state) {
    if (state.won) return null;
    // Only offer moves that immediately complete a suit — anything else is strategy.
    for (const src of state.piles) {
      if (src.kind !== 'tableau' || src.cards.length === 0) continue;
      for (let i = 0; i < src.cards.length; i++) {
        const count = this.grabCount(state, src.id, i);
        if (count !== src.cards.length - i || count === 0) continue;
        const run = src.cards.slice(i);
        if (run[run.length - 1].rank !== 1) continue;
        for (const dst of state.piles) {
          if (dst.id === src.id || dst.kind !== 'tableau') continue;
          const move: Move = { type: 'move', from: src.id, to: dst.id, count };
          if (!this.canMove(state, move)) continue;
          const merged = [...dst.cards.slice(Math.max(0, dst.cards.length - (13 - count))), ...run];
          if (merged.length === 13 && merged[0].rank === 13 && isValidRun(merged)) return move;
        }
        break;
      }
    }
    return null;
  },
};
