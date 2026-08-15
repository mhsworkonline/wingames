import { beforeEach, describe, expect, it } from 'vitest';
import { spider } from './spider';
import { cards, clearAnd, codesOf, getPile, totalCards, uniqueIds } from './testing';
import type { GameState } from './types';

function fresh(seed = 4242, options: Record<string, number> = { suits: 4 }): GameState {
  return spider.create(seed, options);
}

/** A full King-to-Ace run in one suit, ready to be completed. */
function fullSuit(suit: string): string {
  return ['K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'A'].map((r) => r + suit).join(' ');
}

describe('spider deal', () => {
  let state: GameState;
  beforeEach(() => {
    state = fresh();
  });

  it('deals 54 cards: six to the first four columns and five to the rest', () => {
    for (let i = 0; i < 10; i++) {
      expect(getPile(state, `t${i}`).cards).toHaveLength(i < 4 ? 6 : 5);
    }
  });

  it('turns up one card per column', () => {
    for (let i = 0; i < 10; i++) {
      const pile = getPile(state, `t${i}`);
      expect(pile.cards.filter((c) => c.faceUp)).toHaveLength(1);
      expect(pile.cards[pile.cards.length - 1].faceUp).toBe(true);
    }
  });

  it('leaves 50 cards in the stock for five deals', () => {
    expect(getPile(state, 'stock').cards).toHaveLength(50);
  });

  it('uses two full decks', () => {
    expect(totalCards(state)).toBe(104);
    expect(uniqueIds(state)).toBe(104);
  });

  it('honours the suit-count option', () => {
    const one = fresh(1, { suits: 1 });
    expect(new Set(one.piles.flatMap((p) => p.cards.map((c) => c.suit))).size).toBe(1);

    const two = fresh(1, { suits: 2 });
    expect(new Set(two.piles.flatMap((p) => p.cards.map((c) => c.suit))).size).toBe(2);

    const four = fresh(1, { suits: 4 });
    expect(new Set(four.piles.flatMap((p) => p.cards.map((c) => c.suit))).size).toBe(4);
  });

  it('starts at 500 points', () => {
    expect(state.score).toBe(500);
  });
});

describe('dealing from the stock', () => {
  it('adds one face-up card to every column', () => {
    const before = fresh();
    const after = spider.apply(before, { type: 'stock' });
    for (let i = 0; i < 10; i++) {
      const pile = getPile(after, `t${i}`);
      expect(pile.cards).toHaveLength(getPile(before, `t${i}`).cards.length + 1);
      expect(pile.cards[pile.cards.length - 1].faceUp).toBe(true);
    }
    expect(getPile(after, 'stock').cards).toHaveLength(40);
  });

  it('refuses to deal while a column is empty', () => {
    const state = fresh();
    const emptied: GameState = {
      ...state,
      piles: state.piles.map((p) => (p.id === 't3' ? { ...p, cards: [] } : p)),
    };
    expect(spider.canMove(emptied, { type: 'stock' })).toBe(false);
  });

  it('refuses to deal from an exhausted stock', () => {
    let state = fresh();
    for (let i = 0; i < 5; i++) state = spider.apply(state, { type: 'stock' });
    expect(getPile(state, 'stock').cards).toHaveLength(0);
    expect(spider.canMove(state, { type: 'stock' })).toBe(false);
  });
});

describe('movement rules', () => {
  it('drops any suit onto the next rank up', () => {
    const state = clearAnd(fresh(), { t0: cards('7H'), t1: cards('8S') });
    expect(spider.canMove(state, { type: 'move', from: 't0', to: 't1', count: 1 })).toBe(true);
  });

  it('rejects a drop onto a non-consecutive rank', () => {
    const state = clearAnd(fresh(), { t0: cards('7H'), t1: cards('9S') });
    expect(spider.canMove(state, { type: 'move', from: 't0', to: 't1', count: 1 })).toBe(false);
  });

  it('accepts any card onto an empty column', () => {
    const state = clearAnd(fresh(), { t0: cards('7H'), t1: [] });
    expect(spider.canMove(state, { type: 'move', from: 't0', to: 't1', count: 1 })).toBe(true);
  });

  it('moves a same-suit run as a unit', () => {
    const state = clearAnd(fresh(), { t0: cards('9S 8S 7S'), t1: cards('10H') });
    expect(spider.grabCount(state, 't0', 0)).toBe(3);
    const after = spider.apply(state, { type: 'move', from: 't0', to: 't1', count: 3 });
    expect(codesOf(getPile(after, 't1'))).toEqual(['10H', '9S', '8S', '7S']);
  });

  it('will not lift a mixed-suit sequence', () => {
    const state = clearAnd(fresh(), { t0: cards('9S 8H 7S'), t1: cards('10H') });
    expect(spider.grabCount(state, 't0', 0)).toBe(0);
    expect(spider.grabCount(state, 't0', 2)).toBe(1);
    expect(spider.canMove(state, { type: 'move', from: 't0', to: 't1', count: 3 })).toBe(false);
  });

  it('will not lift a face-down card', () => {
    const state = clearAnd(fresh(), { t0: [...cards('9S', false), ...cards('8S')] });
    expect(spider.grabCount(state, 't0', 0)).toBe(0);
  });

  it('turns over the card left exposed', () => {
    const state = clearAnd(fresh(), {
      t0: [...cards('5H', false), ...cards('7S')],
      t1: cards('8H'),
    });
    const after = spider.apply(state, { type: 'move', from: 't0', to: 't1', count: 1 });
    expect(getPile(after, 't0').cards[0].faceUp).toBe(true);
  });

  it('never moves cards to or from a foundation directly', () => {
    const state = clearAnd(fresh(), { t0: cards('AS'), f0: cards('2S') });
    expect(spider.canMove(state, { type: 'move', from: 't0', to: 'f0', count: 1 })).toBe(false);
    expect(spider.canMove(state, { type: 'move', from: 'f0', to: 't0', count: 1 })).toBe(false);
    expect(spider.foundationTarget(state, 't0')).toBeNull();
  });
});

describe('completing suits', () => {
  it('sweeps a finished King-to-Ace run into a foundation and scores 100', () => {
    const run = cards(fullSuit('S'));
    const state = clearAnd(fresh(), {
      t0: [...cards('4H', false), ...run.slice(0, 12)],
      t1: [run[12]],
    });
    const after = spider.apply(state, { type: 'move', from: 't1', to: 't0', count: 1 });
    expect(getPile(after, 'f0').cards).toHaveLength(13);
    expect(getPile(after, 't0').cards).toHaveLength(1);
    expect(getPile(after, 't0').cards[0].faceUp).toBe(true);
    expect(after.score).toBe(500 - 1 + 100);
  });

  it('leaves a mixed-suit K-to-A sequence on the tableau', () => {
    const state = clearAnd(fresh(), {
      t0: cards('KS QS JS 10S 9S 8S 7S 6S 5S 4S 3S 2S'),
      t1: cards('AH'),
    });
    const after = spider.apply(state, { type: 'move', from: 't1', to: 't0', count: 1 });
    expect(getPile(after, 't0').cards).toHaveLength(13);
    expect(getPile(after, 'f0').cards).toHaveLength(0);
  });

  it('does not sweep a run that is not headed by a king', () => {
    const state = clearAnd(fresh(), {
      t0: cards('5H QS JS 10S 9S 8S 7S 6S 5S 4S 3S 2S'),
      t1: cards('AS'),
    });
    const after = spider.apply(state, { type: 'move', from: 't1', to: 't0', count: 1 });
    expect(getPile(after, 't0').cards).toHaveLength(13);
    expect(getPile(after, 'f0').cards).toHaveLength(0);
  });

  it('completes a suit formed by a deal from the stock', () => {
    const almost = cards(fullSuit('H')).slice(0, 12);
    const state = clearAnd(fresh(), {
      t0: almost,
      t1: cards('5C'),
      t2: cards('5C'),
      t3: cards('5C'),
      t4: cards('5C'),
      t5: cards('5C'),
      t6: cards('5C'),
      t7: cards('5C'),
      t8: cards('5C'),
      t9: cards('5C'),
      // A deal pops from the end of the stock and fills t0 first, so the last
      // card here is the ace that finishes the heart run.
      stock: cards('2C 3C 4C 6C 7C 8C 9C 10C JC AH', false),
    });
    expect(spider.canMove(state, { type: 'stock' })).toBe(true);
    const after = spider.apply(state, { type: 'stock' });
    expect(getPile(after, 'f0').cards).toHaveLength(13);
    expect(getPile(after, 't0').cards).toHaveLength(0);
  });
});

describe('winning', () => {
  it('needs all eight foundations filled', () => {
    const layout: Record<string, ReturnType<typeof cards>> = {};
    for (let i = 0; i < 8; i++) layout[`f${i}`] = cards(fullSuit('S'));
    expect(spider.isWon(clearAnd(fresh(), layout))).toBe(true);

    delete layout.f7;
    expect(spider.isWon(clearAnd(fresh(), layout))).toBe(false);
  });
});

describe('targeting and autoplay', () => {
  it('prefers a same-suit landing spot', () => {
    const state = clearAnd(fresh(), { t0: cards('7S'), t1: cards('8H'), t2: cards('8S') });
    expect(spider.autoTarget(state, 't0', 1)).toBe('t2');
  });

  it('prefers an occupied column over an empty one', () => {
    const state = clearAnd(fresh(), { t0: cards('7S'), t1: cards('8H'), t2: [] });
    expect(spider.autoTarget(state, 't0', 1)).toBe('t1');
  });

  it('offers only moves that complete a suit', () => {
    const run = cards(fullSuit('S'));
    const state = clearAnd(fresh(), { t0: run.slice(0, 12), t1: [run[12]], t2: cards('9H 8H') });
    expect(spider.autoplayStep(state)).toEqual({ type: 'move', from: 't1', to: 't0', count: 1 });

    const nothingToFinish = clearAnd(fresh(), { t0: cards('9H'), t1: cards('10S') });
    expect(spider.autoplayStep(nothingToFinish)).toBeNull();
  });
});

describe('state integrity', () => {
  it('conserves all 104 cards across a long random game', () => {
    let state = fresh(31337, { suits: 1 });
    for (let i = 0; i < 300; i++) {
      const move = pickMove(state);
      if (!move) break;
      state = spider.apply(state, move);
      expect(totalCards(state)).toBe(104);
      expect(uniqueIds(state)).toBe(104);
    }
    expect(state.moves).toBeGreaterThan(20);
  });

  it('leaves the source state untouched', () => {
    const state = clearAnd(fresh(), { t0: cards('8S'), t1: cards('9S') });
    spider.apply(state, { type: 'move', from: 't0', to: 't1', count: 1 });
    expect(codesOf(getPile(state, 't0'))).toEqual(['8S']);
  });
});

function pickMove(state: GameState) {
  const options: { type: 'move'; from: string; to: string; count: number }[] = [];
  for (const src of state.piles) {
    for (let i = 0; i < src.cards.length; i++) {
      const count = spider.grabCount(state, src.id, i);
      if (count === 0) continue;
      for (const dst of state.piles) {
        if (dst.id === src.id) continue;
        if (spider.canMove(state, { type: 'move', from: src.id, to: dst.id, count })) {
          options.push({ type: 'move', from: src.id, to: dst.id, count });
        }
      }
    }
  }
  if (options.length > 0 && state.moves % 4 !== 3) return options[state.moves % options.length];
  return spider.canMove(state, { type: 'stock' }) ? ({ type: 'stock' } as const) : (options[0] ?? null);
}
