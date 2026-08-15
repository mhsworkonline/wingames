import { describe, expect, it } from 'vitest';
import { buildDeck, color, rng, shuffle } from './cards';

describe('deck construction', () => {
  it('builds a standard 52-card deck with unique ids', () => {
    const deck = buildDeck(1);
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
    expect(deck.every((c) => !c.faceUp)).toBe(true);
  });

  it('builds two decks for Spider', () => {
    const deck = buildDeck(2);
    expect(deck).toHaveLength(104);
    expect(new Set(deck.map((c) => c.id)).size).toBe(104);
    const spades = deck.filter((c) => c.suit === 'S');
    expect(spades).toHaveLength(26);
  });

  it('repeats a limited suit set for the 1- and 2-suit Spider variants', () => {
    const one = buildDeck(2, ['S']);
    expect(one).toHaveLength(104);
    expect(one.every((c) => c.suit === 'S')).toBe(true);

    const two = buildDeck(2, ['S', 'H']);
    expect(two.filter((c) => c.suit === 'S')).toHaveLength(52);
    expect(two.filter((c) => c.suit === 'H')).toHaveLength(52);
    expect(new Set(two.map((c) => c.id)).size).toBe(104);
  });

  it('assigns colours by suit', () => {
    expect(color('S')).toBe('black');
    expect(color('C')).toBe('black');
    expect(color('H')).toBe('red');
    expect(color('D')).toBe('red');
  });
});

describe('seeded shuffle', () => {
  it('is deterministic for a given seed', () => {
    const a = shuffle(buildDeck(1), rng(42)).map((c) => c.id);
    const b = shuffle(buildDeck(1), rng(42)).map((c) => c.id);
    expect(a).toEqual(b);
  });

  it('produces different orders for different seeds', () => {
    const a = shuffle(buildDeck(1), rng(1)).map((c) => c.id);
    const b = shuffle(buildDeck(1), rng(2)).map((c) => c.id);
    expect(a).not.toEqual(b);
  });

  it('preserves every card', () => {
    const shuffled = shuffle(buildDeck(1), rng(7));
    expect(new Set(shuffled.map((c) => c.id)).size).toBe(52);
  });
});
