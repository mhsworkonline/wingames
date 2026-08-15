import { buildDeck, cloneState, color, findPile, pile, rng, shuffle, topCard, transfer } from './cards';
import type { Card, Game, GameState, Pile } from './types';

const TABLEAU_COUNT = 7;
const FOUNDATION_COUNT = 4;

export const KLONDIKE_TABLEAUS = Array.from({ length: TABLEAU_COUNT }, (_, i) => `t${i}`);
export const KLONDIKE_FOUNDATIONS = Array.from({ length: FOUNDATION_COUNT }, (_, i) => `f${i}`);

function isTableau(id: string): boolean {
  return id.startsWith('t');
}

/** Face-up, descending, alternating colours — the Klondike tableau sequence rule. */
function isValidRun(cards: Card[]): boolean {
  for (let i = 0; i < cards.length; i++) {
    if (!cards[i].faceUp) return false;
    if (i > 0) {
      const prev = cards[i - 1];
      const cur = cards[i];
      if (prev.rank !== cur.rank + 1) return false;
      if (color(prev.suit) === color(cur.suit)) return false;
    }
  }
  return true;
}

function canDropOnTableau(target: Pile, moving: Card[]): boolean {
  const head = moving[0];
  const top = topCard(target);
  if (!top) return head.rank === 13;
  return top.faceUp && top.rank === head.rank + 1 && color(top.suit) !== color(head.suit);
}

function canDropOnFoundation(target: Pile, moving: Card[]): boolean {
  if (moving.length !== 1) return false;
  const card = moving[0];
  const top = topCard(target);
  if (!top) return card.rank === 1;
  return top.suit === card.suit && top.rank === card.rank - 1;
}

function scoreFor(from: Pile, to: Pile): number {
  if (to.kind === 'foundation' && (from.kind === 'waste' || from.kind === 'tableau')) return 10;
  if (from.kind === 'waste' && to.kind === 'tableau') return 5;
  if (from.kind === 'foundation' && to.kind === 'tableau') return -15;
  return 0;
}

export const klondike: Game = {
  id: 'klondike',
  name: 'Klondike',
  cols: 7,
  heightUnits: 3.8,
  hasScore: true,
  options: [
    {
      key: 'draw',
      label: 'Draw',
      values: [
        { value: 1, label: 'Draw 1' },
        { value: 3, label: 'Draw 3' },
      ],
      default: 1,
    },
  ],

  create(seed, options = {}) {
    const draw = options.draw === 3 ? 3 : 1;
    const deck = shuffle(buildDeck(1), rng(seed));

    const piles: Pile[] = [
      pile('stock', 'stock', 0, 0),
      pile('waste', 'waste', 1, 0, 'right', 3),
    ];
    for (let i = 0; i < FOUNDATION_COUNT; i++) {
      piles.push(pile(`f${i}`, 'foundation', 3 + i, 0));
    }
    for (let i = 0; i < TABLEAU_COUNT; i++) {
      piles.push(pile(`t${i}`, 'tableau', i, 1, 'down'));
    }

    const byId = new Map(piles.map((p) => [p.id, p]));
    // Classic deal: column i gets i+1 cards, only the last of which is face up.
    for (let col = 0; col < TABLEAU_COUNT; col++) {
      for (let n = 0; n <= col; n++) {
        const card = deck.pop()!;
        card.faceUp = n === col;
        byId.get(`t${col}`)!.cards.push(card);
      }
    }
    byId.get('stock')!.cards.push(...deck);

    return {
      game: 'klondike',
      seed,
      options: { draw },
      piles,
      moves: 0,
      score: 0,
      won: false,
    };
  },

  grabCount(state, pileId, cardIndex) {
    const p = findPile(state, pileId);
    if (cardIndex < 0 || cardIndex >= p.cards.length) return 0;
    if (p.kind === 'stock') return 0;
    if (p.kind === 'waste' || p.kind === 'foundation') {
      return cardIndex === p.cards.length - 1 ? 1 : 0;
    }
    const run = p.cards.slice(cardIndex);
    return isValidRun(run) ? run.length : 0;
  },

  canMove(state, move) {
    if (move.type === 'stock') {
      const stock = findPile(state, 'stock');
      const waste = findPile(state, 'waste');
      return stock.cards.length > 0 || waste.cards.length > 0;
    }
    const { from, to, count } = move;
    if (from === to || count < 1) return false;
    const src = findPile(state, from);
    const dst = findPile(state, to);
    if (dst.kind === 'stock' || dst.kind === 'waste') return false;
    if (count > src.cards.length) return false;
    if (this.grabCount(state, from, src.cards.length - count) !== count) return false;

    const moving = src.cards.slice(src.cards.length - count);
    if (dst.kind === 'foundation') return canDropOnFoundation(dst, moving);
    if (dst.kind === 'tableau') return canDropOnTableau(dst, moving);
    return false;
  },

  apply(state, move) {
    const next = cloneState(state);
    next.moves += 1;

    if (move.type === 'stock') {
      const stock = findPile(next, 'stock');
      const waste = findPile(next, 'waste');
      if (stock.cards.length > 0) {
        const n = Math.min(next.options.draw, stock.cards.length);
        for (let i = 0; i < n; i++) {
          const card = stock.cards.pop()!;
          card.faceUp = true;
          waste.cards.push(card);
        }
      } else {
        // Recycle the waste back into the stock, face down, in original order.
        while (waste.cards.length > 0) {
          const card = waste.cards.pop()!;
          card.faceUp = false;
          stock.cards.push(card);
        }
        next.score = Math.max(0, next.score - 20);
      }
      return next;
    }

    const src = findPile(next, move.from);
    const dst = findPile(next, move.to);
    next.score = Math.max(0, next.score + scoreFor(src, dst));
    transfer(src, dst, move.count);

    // Exposing a face-down tableau card turns it over and scores.
    if (src.kind === 'tableau') {
      const exposed = topCard(src);
      if (exposed && !exposed.faceUp) {
        exposed.faceUp = true;
        next.score += 5;
      }
    }

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
    const candidates = state.piles.filter(
      (p) => isTableau(p.id) && p.id !== from && this.canMove(state, { type: 'move', from, to: p.id, count }),
    );
    // Prefer a real stack over breaking open an empty column.
    const stacked = candidates.find((p) => p.cards.length > 0);
    return (stacked ?? candidates[0])?.id ?? null;
  },

  foundationTarget(state, from) {
    const src = findPile(state, from);
    if (src.cards.length === 0 || src.kind === 'foundation' || src.kind === 'stock') return null;
    const card = topCard(src)!;
    if (!card.faceUp) return null;
    const foundations = state.piles.filter((p) => p.kind === 'foundation');
    const matching = foundations.find((p) => topCard(p)?.suit === card.suit);
    if (matching && canDropOnFoundation(matching, [card])) return matching.id;
    const empty = foundations.find((p) => p.cards.length === 0);
    if (empty && canDropOnFoundation(empty, [card])) return empty.id;
    return null;
  },

  isWon(state) {
    return state.piles
      .filter((p) => p.kind === 'foundation')
      .every((p) => p.cards.length === 13);
  },

  autoplayStep(state) {
    if (state.won) return null;
    const stock = findPile(state, 'stock');
    const waste = findPile(state, 'waste');
    const allFaceUp = state.piles
      .filter((p) => p.kind === 'tableau')
      .every((p) => p.cards.every((c) => c.faceUp));
    const endgame = allFaceUp && stock.cards.length === 0 && waste.cards.length === 0;

    // Lowest rank first, so foundations climb evenly and nothing gets stranded.
    const sources = state.piles.filter((p) => p.kind === 'tableau' || p.kind === 'waste');
    const options = sources
      .map((p) => ({ p, card: topCard(p) }))
      .filter((o): o is { p: Pile; card: Card } => !!o.card && o.card.faceUp)
      .sort((a, b) => a.card.rank - b.card.rank);

    for (const { p, card } of options) {
      const target = this.foundationTarget(state, p.id);
      if (!target) continue;
      if (endgame || isSafeToPlay(state, card)) {
        return { type: 'move', from: p.id, to: target, count: 1 };
      }
    }
    return null;
  },
};

/**
 * A card is safe to send to a foundation when no lower card of the opposite
 * colour could still need it as a landing spot.
 */
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
