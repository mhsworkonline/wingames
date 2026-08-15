import { beforeEach, describe, expect, it } from 'vitest';
import { freecell, maxSupermove } from './freecell';
import { card, cards, clearAnd, codesOf, getPile, totalCards, uniqueIds } from './testing';
import type { Card, GameState } from './types';

function fresh(seed = 777): GameState {
  return freecell.create(seed);
}

/**
 * Builds an exact position, blocking every column the test did not name.
 * Stray empty columns would otherwise inflate supermove capacity and act as
 * unintended landing spots.
 */
function board(layout: Record<string, Card[]>): GameState {
  const filled: Record<string, Card[]> = { ...layout };
  for (let i = 0; i < 8; i++) {
    if (!(`t${i}` in filled)) filled[`t${i}`] = [card('2D', true, i)];
  }
  return clearAnd(fresh(), filled);
}

describe('freecell deal', () => {
  let state: GameState;
  beforeEach(() => {
    state = fresh();
  });

  it('deals seven cards to the first four columns and six to the rest', () => {
    for (let i = 0; i < 8; i++) {
      expect(getPile(state, `t${i}`).cards).toHaveLength(i < 4 ? 7 : 6);
    }
  });

  it('deals every card face up', () => {
    expect(state.piles.every((p) => p.cards.every((c) => c.faceUp))).toBe(true);
  });

  it('starts with four empty cells and four empty foundations', () => {
    for (let i = 0; i < 4; i++) {
      expect(getPile(state, `c${i}`).cards).toHaveLength(0);
      expect(getPile(state, `f${i}`).cards).toHaveLength(0);
    }
  });

  it('uses all 52 distinct cards and has no stock', () => {
    expect(totalCards(state)).toBe(52);
    expect(uniqueIds(state)).toBe(52);
    expect(state.piles.some((p) => p.kind === 'stock')).toBe(false);
    expect(freecell.canMove(state, { type: 'stock' })).toBe(false);
  });

  it('is reproducible from its seed', () => {
    expect(codesOf(getPile(fresh(21), 't0'))).toEqual(codesOf(getPile(fresh(21), 't0')));
    expect(codesOf(getPile(fresh(21), 't0'))).not.toEqual(codesOf(getPile(fresh(22), 't0')));
  });
});

describe('free cells', () => {
  it('accepts exactly one card', () => {
    const state = clearAnd(fresh(), { t0: cards('9H 4S'), c0: [] });
    expect(freecell.canMove(state, { type: 'move', from: 't0', to: 'c0', count: 1 })).toBe(true);
    expect(freecell.canMove(state, { type: 'move', from: 't0', to: 'c0', count: 2 })).toBe(false);
  });

  it('rejects a card when the cell is occupied', () => {
    const state = clearAnd(fresh(), { t0: cards('4S'), c0: cards('KH') });
    expect(freecell.canMove(state, { type: 'move', from: 't0', to: 'c0', count: 1 })).toBe(false);
  });

  it('lets a parked card come back out', () => {
    const state = clearAnd(fresh(), { c0: cards('4S'), t0: cards('5H'), f0: cards('AS 2S 3S') });
    expect(freecell.canMove(state, { type: 'move', from: 'c0', to: 't0', count: 1 })).toBe(true);
    expect(freecell.canMove(state, { type: 'move', from: 'c0', to: 'f0', count: 1 })).toBe(true);
  });
});

describe('tableau rules', () => {
  it('builds down in alternating colours', () => {
    const state = clearAnd(fresh(), { t0: cards('7H'), t1: cards('8S'), t2: cards('8D') });
    expect(freecell.canMove(state, { type: 'move', from: 't0', to: 't1', count: 1 })).toBe(true);
    expect(freecell.canMove(state, { type: 'move', from: 't0', to: 't2', count: 1 })).toBe(false);
  });

  it('accepts any card onto an empty column', () => {
    const state = clearAnd(fresh(), { t0: cards('7H'), t1: [] });
    expect(freecell.canMove(state, { type: 'move', from: 't0', to: 't1', count: 1 })).toBe(true);
  });

  it('grabs only a properly alternating descending run', () => {
    const good = clearAnd(fresh(), { t0: cards('9S 8H 7S') });
    expect(freecell.grabCount(good, 't0', 0)).toBe(3);

    const bad = clearAnd(fresh(), { t0: cards('9S 8S 7H') });
    expect(freecell.grabCount(bad, 't0', 0)).toBe(0);
    expect(freecell.grabCount(bad, 't0', 1)).toBe(2);
  });
});

describe('supermove capacity', () => {
  it('allows one card plus one per free cell', () => {
    const state = board({
      t0: cards('9S 8H 7S'),
      t1: cards('10H'),
      c0: cards('KD'),
      c1: cards('KS'),
    });
    // Two cells free -> up to three cards, with no empty columns in play.
    expect(maxSupermove(state)).toBe(3);
    expect(freecell.canMove(state, { type: 'move', from: 't0', to: 't1', count: 3 })).toBe(true);
  });

  it('refuses a run longer than the available capacity', () => {
    const state = board({
      t0: cards('9S 8H 7S'),
      t1: cards('10H'),
      c0: cards('KD'),
      c1: cards('KS'),
      c2: cards('KH'),
      c3: cards('KC'),
    });
    expect(maxSupermove(state)).toBe(1);
    expect(freecell.canMove(state, { type: 'move', from: 't0', to: 't1', count: 3 })).toBe(false);
    expect(freecell.canMove(state, { type: 'move', from: 't0', to: 't1', count: 1 })).toBe(false);
  });

  it('doubles capacity for each empty column', () => {
    const state = board({
      t0: cards('9S 8H 7S'),
      t1: cards('10H'),
      c0: cards('KD'),
      c1: cards('KS'),
      c2: cards('KH'),
      t2: [],
    });
    // One free cell (2 cards) doubled by one empty column.
    expect(maxSupermove(state)).toBe(4);
    expect(freecell.canMove(state, { type: 'move', from: 't0', to: 't1', count: 3 })).toBe(true);
  });

  it('does not count the destination column as working space', () => {
    const state = board({
      t0: cards('9S 8H 7S'),
      t1: [],
      c0: cards('KD'),
      c1: cards('KS'),
      c2: cards('KH'),
      c3: cards('KC'),
    });
    expect(maxSupermove(state, getPile(state, 't1'))).toBe(1);
    expect(freecell.canMove(state, { type: 'move', from: 't0', to: 't1', count: 3 })).toBe(false);
    expect(freecell.canMove(state, { type: 'move', from: 't0', to: 't1', count: 1 })).toBe(true);
  });
});

describe('foundations', () => {
  it('starts with an ace and builds up in suit', () => {
    const state = clearAnd(fresh(), { t0: cards('AS'), t1: cards('2S'), t2: cards('2H') });
    expect(freecell.canMove(state, { type: 'move', from: 't0', to: 'f0', count: 1 })).toBe(true);
    expect(freecell.canMove(state, { type: 'move', from: 't1', to: 'f0', count: 1 })).toBe(false);

    const withAce = clearAnd(fresh(), { f0: cards('AS'), t1: cards('2S'), t2: cards('2H') });
    expect(freecell.canMove(withAce, { type: 'move', from: 't1', to: 'f0', count: 1 })).toBe(true);
    expect(freecell.canMove(withAce, { type: 'move', from: 't2', to: 'f0', count: 1 })).toBe(false);
  });

  it('reports a win when all four foundations are complete', () => {
    const full = (suit: string) =>
      cards(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].map((r) => r + suit).join(' '));
    const state = clearAnd(fresh(), { f0: full('S'), f1: full('H'), f2: full('D'), f3: full('C') });
    expect(freecell.isWon(state)).toBe(true);
    expect(freecell.isWon(fresh())).toBe(false);
  });
});

describe('click-to-move targeting', () => {
  it('sends a card to the foundation first', () => {
    const state = clearAnd(fresh(), { f0: cards('AS'), t0: cards('2S'), t1: cards('3H') });
    expect(freecell.autoTarget(state, 't0', 1)).toBe('f0');
  });

  it('falls back to a tableau build', () => {
    const state = board({ t0: cards('7S'), t1: cards('8H'), t2: [] });
    expect(freecell.autoTarget(state, 't0', 1)).toBe('t1');
  });

  it('uses a free cell only when nothing else works', () => {
    const state = board({ t0: cards('7S'), t1: cards('9H') });
    expect(freecell.autoTarget(state, 't0', 1)).toBe('c0');
  });

  it('never pulls a card back off a foundation on a click', () => {
    const state = board({ f0: cards('AS'), t0: cards('2H'), t1: cards('KD') });
    expect(freecell.canMove(state, { type: 'move', from: 'f0', to: 't0', count: 1 })).toBe(true);
    expect(freecell.autoTarget(state, 'f0', 1)).toBeNull();
  });

  it('never parks a card that is already in a cell into another cell', () => {
    const state = board({ c0: cards('7S'), t0: cards('9H') });
    expect(freecell.autoTarget(state, 'c0', 1)).toBeNull();
  });
});

describe('autoplay', () => {
  it('plays aces and safe low cards', () => {
    const state = clearAnd(fresh(), { t0: cards('AS'), t1: cards('KD') });
    expect(freecell.autoplayStep(state)).toEqual({ type: 'move', from: 't0', to: 'f0', count: 1 });
  });

  it('holds a card that opposite-colour cards may still need', () => {
    const state = clearAnd(fresh(), { f0: cards('AS 2S 3S 4S 5S'), f1: cards('AH 2H'), t0: cards('6S') });
    expect(freecell.autoplayStep(state)).toBeNull();
  });

  it('finishes a solved board', () => {
    let state = clearAnd(fresh(), {
      f0: cards('AS 2S 3S 4S 5S 6S 7S 8S 9S 10S JS QS'),
      f1: cards('AH 2H 3H 4H 5H 6H 7H 8H 9H 10H JH QH'),
      f2: cards('AD 2D 3D 4D 5D 6D 7D 8D 9D 10D JD QD'),
      f3: cards('AC 2C 3C 4C 5C 6C 7C 8C 9C 10C JC QC'),
      t0: cards('KS'),
      t1: cards('KH'),
      c0: cards('KD'),
      c1: cards('KC'),
    });
    for (let i = 0; i < 10 && !state.won; i++) {
      const move = freecell.autoplayStep(state);
      if (!move) break;
      state = freecell.apply(state, move);
    }
    expect(state.won).toBe(true);
  });
});

describe('state integrity', () => {
  it('conserves all 52 cards across a long random game', () => {
    let state = fresh(8080);
    for (let i = 0; i < 300; i++) {
      const move = pickMove(state);
      if (!move) break;
      state = freecell.apply(state, move);
      expect(totalCards(state)).toBe(52);
      expect(uniqueIds(state)).toBe(52);
    }
    expect(state.moves).toBeGreaterThan(20);
  });

  it('leaves the previous state untouched', () => {
    const state = clearAnd(fresh(), { t0: cards('AS'), t1: cards('KD') });
    freecell.apply(state, { type: 'move', from: 't0', to: 'f0', count: 1 });
    expect(codesOf(getPile(state, 't0'))).toEqual(['1S']);
  });
});

function pickMove(state: GameState) {
  const options: { type: 'move'; from: string; to: string; count: number }[] = [];
  for (const src of state.piles) {
    for (let i = 0; i < src.cards.length; i++) {
      const count = freecell.grabCount(state, src.id, i);
      if (count === 0) continue;
      for (const dst of state.piles) {
        if (dst.id === src.id) continue;
        if (freecell.canMove(state, { type: 'move', from: src.id, to: dst.id, count })) {
          options.push({ type: 'move', from: src.id, to: dst.id, count });
        }
      }
    }
  }
  return options.length > 0 ? options[(state.moves * 7) % options.length] : null;
}
