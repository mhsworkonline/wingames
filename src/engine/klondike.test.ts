import { beforeEach, describe, expect, it } from 'vitest';
import { klondike } from './klondike';
import { cards, clearAnd, codesOf, getPile, totalCards, uniqueIds } from './testing';
import type { GameState } from './types';

function fresh(seed = 12345, options?: Record<string, number>): GameState {
  return klondike.create(seed, options);
}

describe('klondike deal', () => {
  let state: GameState;
  beforeEach(() => {
    state = fresh();
  });

  it('deals 1..7 cards into the seven tableau columns', () => {
    for (let i = 0; i < 7; i++) {
      expect(getPile(state, `t${i}`).cards).toHaveLength(i + 1);
    }
  });

  it('turns up only the last card of each column', () => {
    for (let i = 0; i < 7; i++) {
      const pile = getPile(state, `t${i}`);
      expect(pile.cards.filter((c) => c.faceUp)).toHaveLength(1);
      expect(pile.cards[pile.cards.length - 1].faceUp).toBe(true);
    }
  });

  it('leaves 24 cards in the stock and empty foundations', () => {
    expect(getPile(state, 'stock').cards).toHaveLength(24);
    expect(getPile(state, 'waste').cards).toHaveLength(0);
    for (let i = 0; i < 4; i++) expect(getPile(state, `f${i}`).cards).toHaveLength(0);
  });

  it('uses all 52 distinct cards', () => {
    expect(totalCards(state)).toBe(52);
    expect(uniqueIds(state)).toBe(52);
  });

  it('is reproducible from its seed', () => {
    expect(codesOf(getPile(fresh(999), 't6'))).toEqual(codesOf(getPile(fresh(999), 't6')));
    expect(codesOf(getPile(fresh(1), 't6'))).not.toEqual(codesOf(getPile(fresh(2), 't6')));
  });
});

describe('stock and waste', () => {
  it('draws one card at a time in draw-1', () => {
    const state = klondike.apply(fresh(5, { draw: 1 }), { type: 'stock' });
    expect(getPile(state, 'waste').cards).toHaveLength(1);
    expect(getPile(state, 'stock').cards).toHaveLength(23);
    expect(getPile(state, 'waste').cards[0].faceUp).toBe(true);
  });

  it('draws three cards at a time in draw-3', () => {
    const state = klondike.apply(fresh(5, { draw: 3 }), { type: 'stock' });
    expect(getPile(state, 'waste').cards).toHaveLength(3);
    expect(getPile(state, 'stock').cards).toHaveLength(21);
    expect(getPile(state, 'waste').cards.every((c) => c.faceUp)).toBe(true);
  });

  it('recycles the waste back into the stock face down, at a score penalty', () => {
    let state = fresh(5, { draw: 3 });
    for (let i = 0; i < 8; i++) state = klondike.apply(state, { type: 'stock' });
    expect(getPile(state, 'stock').cards).toHaveLength(0);
    expect(getPile(state, 'waste').cards).toHaveLength(24);

    state = { ...state, score: 30 };
    const recycled = klondike.apply(state, { type: 'stock' });
    expect(getPile(recycled, 'stock').cards).toHaveLength(24);
    expect(getPile(recycled, 'waste').cards).toHaveLength(0);
    expect(getPile(recycled, 'stock').cards.every((c) => !c.faceUp)).toBe(true);
    expect(recycled.score).toBe(10);
  });

  it('restores the original stock order after a full cycle', () => {
    let state = fresh(77, { draw: 1 });
    const original = codesOf(getPile(state, 'stock'));
    for (let i = 0; i < 25; i++) state = klondike.apply(state, { type: 'stock' });
    expect(codesOf(getPile(state, 'stock'))).toEqual(original);
  });

  it('rejects the stock click when both stock and waste are empty', () => {
    const state = clearAnd(fresh(), { t0: cards('KS') });
    expect(klondike.canMove(state, { type: 'stock' })).toBe(false);
  });

  it('never leaves the score negative', () => {
    let state = fresh(5, { draw: 3 });
    for (let i = 0; i < 9; i++) state = klondike.apply(state, { type: 'stock' });
    expect(state.score).toBe(0);
  });
});

describe('tableau rules', () => {
  it('accepts a descending card of the opposite colour', () => {
    const state = clearAnd(fresh(), { t0: cards('7H'), t1: cards('8S') });
    expect(klondike.canMove(state, { type: 'move', from: 't0', to: 't1', count: 1 })).toBe(true);
  });

  it('rejects a same-colour build', () => {
    const state = clearAnd(fresh(), { t0: cards('7H'), t1: cards('8D') });
    expect(klondike.canMove(state, { type: 'move', from: 't0', to: 't1', count: 1 })).toBe(false);
  });

  it('rejects a non-descending build', () => {
    const state = clearAnd(fresh(), { t0: cards('6H'), t1: cards('8S') });
    expect(klondike.canMove(state, { type: 'move', from: 't0', to: 't1', count: 1 })).toBe(false);
  });

  it('allows only a king onto an empty column', () => {
    const state = clearAnd(fresh(), { t0: cards('KH'), t1: cards('QS'), t2: [] });
    expect(klondike.canMove(state, { type: 'move', from: 't0', to: 't2', count: 1 })).toBe(true);
    expect(klondike.canMove(state, { type: 'move', from: 't1', to: 't2', count: 1 })).toBe(false);
  });

  it('moves a valid multi-card run as a unit', () => {
    const state = clearAnd(fresh(), { t0: cards('9S 8H 7S'), t1: cards('10H') });
    expect(klondike.canMove(state, { type: 'move', from: 't0', to: 't1', count: 3 })).toBe(true);
    const after = klondike.apply(state, { type: 'move', from: 't0', to: 't1', count: 3 });
    expect(codesOf(getPile(after, 't1'))).toEqual(['10H', '9S', '8H', '7S']);
    expect(getPile(after, 't0').cards).toHaveLength(0);
  });

  it('refuses to move a broken run', () => {
    const state = clearAnd(fresh(), { t0: cards('9S 8H 6S'), t1: cards('10H') });
    expect(klondike.grabCount(state, 't0', 0)).toBe(0);
    expect(klondike.canMove(state, { type: 'move', from: 't0', to: 't1', count: 3 })).toBe(false);
  });

  it('refuses to grab a face-down card', () => {
    const state = clearAnd(fresh(), { t0: [...cards('9S', false), ...cards('8H')] });
    expect(klondike.grabCount(state, 't0', 0)).toBe(0);
    expect(klondike.grabCount(state, 't0', 1)).toBe(1);
  });

  it('turns over the card exposed by a move and scores it', () => {
    const state = clearAnd(fresh(), {
      t0: [...cards('5H', false), ...cards('7S')],
      t1: cards('8H'),
    });
    const after = klondike.apply(state, { type: 'move', from: 't0', to: 't1', count: 1 });
    const exposed = getPile(after, 't0').cards[0];
    expect(exposed.faceUp).toBe(true);
    expect(after.score).toBe(5);
  });
});

describe('foundation rules', () => {
  it('starts a foundation with an ace only', () => {
    const state = clearAnd(fresh(), { t0: cards('AS'), t1: cards('2S') });
    expect(klondike.canMove(state, { type: 'move', from: 't0', to: 'f0', count: 1 })).toBe(true);
    expect(klondike.canMove(state, { type: 'move', from: 't1', to: 'f0', count: 1 })).toBe(false);
  });

  it('builds up in suit', () => {
    const state = clearAnd(fresh(), { f0: cards('AS'), t0: cards('2S'), t1: cards('2H'), t2: cards('3S') });
    expect(klondike.canMove(state, { type: 'move', from: 't0', to: 'f0', count: 1 })).toBe(true);
    expect(klondike.canMove(state, { type: 'move', from: 't1', to: 'f0', count: 1 })).toBe(false);
    expect(klondike.canMove(state, { type: 'move', from: 't2', to: 'f0', count: 1 })).toBe(false);
  });

  it('never accepts more than one card at a time', () => {
    const state = clearAnd(fresh(), { f0: cards('AS'), t0: cards('3S 2S') });
    expect(klondike.canMove(state, { type: 'move', from: 't0', to: 'f0', count: 2 })).toBe(false);
  });

  it('scores 10 for a card played to a foundation', () => {
    const state = clearAnd(fresh(), { t0: cards('AS') });
    expect(klondike.apply(state, { type: 'move', from: 't0', to: 'f0', count: 1 }).score).toBe(10);
  });

  it('scores 5 for waste to tableau and deducts 15 for foundation to tableau', () => {
    const wasteMove = clearAnd(fresh(), { waste: cards('7H'), t1: cards('8S') });
    expect(klondike.apply(wasteMove, { type: 'move', from: 'waste', to: 't1', count: 1 }).score).toBe(5);

    const back = { ...clearAnd(fresh(), { f0: cards('AS 2S'), t1: cards('3H') }), score: 40 };
    expect(klondike.apply(back, { type: 'move', from: 'f0', to: 't1', count: 1 }).score).toBe(25);
  });

  it('allows pulling a card back off a foundation', () => {
    const state = clearAnd(fresh(), { f0: cards('AS 2S'), t1: cards('3H') });
    expect(klondike.canMove(state, { type: 'move', from: 'f0', to: 't1', count: 1 })).toBe(true);
  });
});

describe('waste and stock as sources', () => {
  it('moves only the top waste card', () => {
    const state = clearAnd(fresh(), { waste: cards('5C 7H'), t0: cards('8S') });
    expect(klondike.grabCount(state, 'waste', 0)).toBe(0);
    expect(klondike.grabCount(state, 'waste', 1)).toBe(1);
    expect(klondike.canMove(state, { type: 'move', from: 'waste', to: 't0', count: 1 })).toBe(true);
  });

  it('never lets the stock be a drag source or a drop target', () => {
    const state = clearAnd(fresh(), { stock: cards('5C', false), t0: cards('KS') });
    expect(klondike.grabCount(state, 'stock', 0)).toBe(0);
    expect(klondike.canMove(state, { type: 'move', from: 't0', to: 'stock', count: 1 })).toBe(false);
    expect(klondike.canMove(state, { type: 'move', from: 't0', to: 'waste', count: 1 })).toBe(false);
  });
});

describe('click-to-move targeting', () => {
  it('prefers the foundation for a single card', () => {
    const state = clearAnd(fresh(), { f0: cards('AS'), t0: cards('2S'), t1: cards('3H') });
    expect(klondike.autoTarget(state, 't0', 1)).toBe('f0');
  });

  it('prefers an occupied column over an empty one', () => {
    const state = clearAnd(fresh(), { t0: cards('KH'), t1: cards('AS'), t2: [] });
    // The king has nowhere to build, so the empty column is the only option.
    expect(klondike.autoTarget(state, 't0', 1)).toBe('t2');

    const withStack = clearAnd(fresh(), { t0: cards('QH'), t1: cards('KS'), t2: [] });
    expect(klondike.autoTarget(withStack, 't0', 1)).toBe('t1');
  });

  it('never pulls a card back off a foundation on a click', () => {
    const state = clearAnd(fresh(), { f0: cards('AS'), t0: cards('2H'), t1: cards('KD') });
    // The drag is still legal; only the click-to-move shortcut declines it.
    expect(klondike.canMove(state, { type: 'move', from: 'f0', to: 't0', count: 1 })).toBe(true);
    expect(klondike.autoTarget(state, 'f0', 1)).toBeNull();
  });

  it('returns null when nothing accepts the card', () => {
    const state = clearAnd(fresh(), { t0: cards('QH'), t1: cards('2S'), t2: cards('9D') });
    expect(klondike.autoTarget(state, 't0', 1)).toBeNull();
  });

  it('finds the matching foundation for a double-click', () => {
    const state = clearAnd(fresh(), { f0: cards('AH'), f1: cards('AS'), t0: cards('2S') });
    expect(klondike.foundationTarget(state, 't0')).toBe('f1');
  });
});

describe('winning', () => {
  it('reports a win once all four foundations are complete', () => {
    const full = (suit: string) =>
      cards(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].map((r) => r + suit).join(' '));
    const state = clearAnd(fresh(), { f0: full('S'), f1: full('H'), f2: full('D'), f3: full('C') });
    expect(klondike.isWon(state)).toBe(true);
  });

  it('is not won mid-game', () => {
    expect(klondike.isWon(fresh())).toBe(false);
  });

  it('sets the won flag on the move that completes the last foundation', () => {
    const full = (suit: string, upTo: number) =>
      cards(
        ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
          .slice(0, upTo)
          .map((r) => r + suit)
          .join(' '),
      );
    const state = clearAnd(fresh(), {
      f0: full('S', 13),
      f1: full('H', 13),
      f2: full('D', 13),
      f3: full('C', 12),
      t0: cards('KC'),
    });
    const after = klondike.apply(state, { type: 'move', from: 't0', to: 'f3', count: 1 });
    expect(after.won).toBe(true);
  });
});

describe('autoplay', () => {
  it('sends aces and twos to the foundations', () => {
    const state = clearAnd(fresh(), { t0: cards('AS'), t1: cards('KD') });
    expect(klondike.autoplayStep(state)).toEqual({ type: 'move', from: 't0', to: 'f0', count: 1 });
  });

  it('holds back a card that lower cards may still need', () => {
    const state = clearAnd(fresh(), {
      f0: cards('AS 2S 3S 4S 5S'),
      f1: cards('AH 2H'),
      t0: cards('6S'),
      stock: cards('9C 4D', false),
    });
    // Red fives still need a black six to build on, and cards remain undealt.
    expect(klondike.autoplayStep(state)).toBeNull();
  });

  it('plays greedily once every card is face up and the stock is spent', () => {
    const state = clearAnd(fresh(), {
      f0: cards('AS 2S 3S 4S 5S'),
      f1: cards('AH 2H'),
      t0: cards('6S'),
    });
    // Nothing is hidden and no cards remain to be drawn, so holding back gains nothing.
    expect(klondike.autoplayStep(state)).toEqual({ type: 'move', from: 't0', to: 'f0', count: 1 });
  });

  it('clears the board once every card is available', () => {
    let state = clearAnd(fresh(), {
      f0: cards('AS 2S 3S 4S 5S 6S 7S 8S 9S 10S JS QS'),
      f1: cards('AH 2H 3H 4H 5H 6H 7H 8H 9H 10H JH QH'),
      f2: cards('AD 2D 3D 4D 5D 6D 7D 8D 9D 10D JD QD'),
      f3: cards('AC 2C 3C 4C 5C 6C 7C 8C 9C 10C JC QC'),
      t0: cards('KS'),
      t1: cards('KH'),
      t2: cards('KD'),
      t3: cards('KC'),
    });
    for (let i = 0; i < 10 && !state.won; i++) {
      const move = klondike.autoplayStep(state);
      if (!move) break;
      state = klondike.apply(state, move);
    }
    expect(state.won).toBe(true);
  });
});

describe('state integrity', () => {
  it('does not mutate the previous state, so undo is safe', () => {
    const state = clearAnd(fresh(), { t0: cards('AS'), t1: cards('KD') });
    const before = codesOf(getPile(state, 't0'));
    const after = klondike.apply(state, { type: 'move', from: 't0', to: 'f0', count: 1 });
    expect(codesOf(getPile(state, 't0'))).toEqual(before);
    expect(getPile(after, 't0').cards).toHaveLength(0);
  });

  it('conserves all 52 cards across a long random game', () => {
    let state = fresh(2024);
    for (let i = 0; i < 400; i++) {
      const move = randomLegalMove(state);
      if (!move) break;
      state = klondike.apply(state, move);
      expect(totalCards(state)).toBe(52);
      expect(uniqueIds(state)).toBe(52);
    }
    expect(state.moves).toBeGreaterThan(20);
  });
});

function randomLegalMove(state: GameState) {
  const options: { type: 'move'; from: string; to: string; count: number }[] = [];
  for (const src of state.piles) {
    for (let i = 0; i < src.cards.length; i++) {
      const count = klondike.grabCount(state, src.id, i);
      if (count === 0) continue;
      for (const dst of state.piles) {
        if (dst.id === src.id) continue;
        if (klondike.canMove(state, { type: 'move', from: src.id, to: dst.id, count })) {
          options.push({ type: 'move', from: src.id, to: dst.id, count });
        }
      }
    }
  }
  if (options.length > 0 && state.moves % 3 !== 0) {
    return options[state.moves % options.length];
  }
  return klondike.canMove(state, { type: 'stock' }) ? ({ type: 'stock' } as const) : (options[0] ?? null);
}
