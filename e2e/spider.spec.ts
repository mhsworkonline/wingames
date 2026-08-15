import { expect, test } from '@playwright/test';
import { card, cards } from '../src/engine/testing';
import {
  cardId,
  canMove,
  clickCard,
  clickStock,
  completeFoundation,
  descendingRun,
  dragCardToPile,
  loadState,
  openGame,
  pileCards,
  pileCount,
  positionFrom,
  readState,
  trackPageErrors,
} from './helpers';

test.describe('spider gameplay', () => {
  test('deals 54 cards across ten columns', async ({ page }) => {
    await openGame(page, 'spider', 2024, { suits: 1 });
    for (let i = 0; i < 10; i++) {
      await expect(page.locator(`.pile[data-pile="t${i}"] .card`)).toHaveCount(i < 4 ? 6 : 5);
      await expect(page.locator(`.pile[data-pile="t${i}"] .card:not(.back)`)).toHaveCount(1);
    }
    expect(pileCount(await readState(page), 'stock')).toBe(50);
  });

  test('honours the suit-count option', async ({ page }) => {
    await openGame(page, 'spider', 2024, { suits: 1 });
    await page.locator('select[data-option="suits"]').selectOption('4');
    const state = await readState(page);
    expect(state.options.suits).toBe(4);
    const suits = new Set(state.piles.flatMap((p) => p.cards.map((c) => c.suit)));
    expect(suits.size).toBe(4);
  });

  test('dealing from the stock adds one card to every column', async ({ page }) => {
    await openGame(page, 'spider', 2024, { suits: 1 });
    const before = await readState(page);
    await clickStock(page);
    const after = await readState(page);

    for (let i = 0; i < 10; i++) {
      expect(pileCount(after, `t${i}`)).toBe(pileCount(before, `t${i}`) + 1);
    }
    expect(pileCount(after, 'stock')).toBe(40);
    await expect(page.locator('#stat-moves')).toHaveText('1');
  });

  test('refuses to deal onto an empty column', async ({ page }) => {
    await openGame(page, 'spider', 2024, { suits: 1 });
    const base = await readState(page);
    const layout: Record<string, ReturnType<typeof cards>> = { stock: cards('2S 3S 4S 5S 6S 7S 8S 9S 10S JS', false) };
    for (let i = 1; i < 10; i++) layout[`t${i}`] = [card('5C', true, i)];
    await loadState(page, positionFrom(base, layout));

    expect(await canMove(page, { type: 'stock' })).toBe(false);
    await clickStock(page);
    expect((await readState(page)).moves).toBe(0);
    expect(pileCount(await readState(page), 'stock')).toBe(10);
  });

  test('builds down across suits but moves only same-suit runs', async ({ page }) => {
    await openGame(page, 'spider', 7, { suits: 4 });
    const base = await readState(page);
    await loadState(
      page,
      positionFrom(base, { t0: cards('8S'), t1: cards('7H'), t2: cards('9S 8H 7S'), t3: cards('10H') }),
    );

    // A single card drops onto any suit one rank higher.
    await dragCardToPile(page, cardId('7H'), 't0');
    expect(pileCards(await readState(page), 't0')).toEqual(['8S', '7H']);

    // A mixed-suit sequence cannot be lifted as a unit.
    expect(await canMove(page, { type: 'move', from: 't2', to: 't3', count: 3 })).toBe(false);
    await dragCardToPile(page, cardId('9S'), 't3');
    expect(pileCount(await readState(page), 't3')).toBe(1);
  });

  test('drags a same-suit run as a unit', async ({ page }) => {
    await openGame(page, 'spider', 7, { suits: 1 });
    const base = await readState(page);
    await loadState(page, positionFrom(base, { t0: cards('10S'), t1: cards('9S 8S 7S') }));

    await dragCardToPile(page, cardId('9S'), 't0');
    const state = await readState(page);
    expect(pileCards(state, 't0')).toEqual(['10S', '9S', '8S', '7S']);
    expect(pileCount(state, 't1')).toBe(0);
  });

  test('turns over the card left exposed', async ({ page }) => {
    await openGame(page, 'spider', 7, { suits: 1 });
    const base = await readState(page);
    await loadState(page, positionFrom(base, { t0: cards('10S'), t1: [card('4S', false), card('9S')] }));
    await expect(page.locator('.pile[data-pile="t1"] .card.back')).toHaveCount(1);

    await dragCardToPile(page, cardId('9S'), 't0');
    await expect(page.locator('.pile[data-pile="t1"] .card.back')).toHaveCount(0);
  });

  test('any card may take an empty column', async ({ page }) => {
    await openGame(page, 'spider', 7, { suits: 1 });
    const base = await readState(page);
    await loadState(page, positionFrom(base, { t0: cards('7S'), t1: [] }));

    await dragCardToPile(page, cardId('7S'), 't1');
    expect(pileCards(await readState(page), 't1')).toEqual(['7S']);
  });

  test('sweeps a completed suit into a foundation and scores it', async ({ page }) => {
    const errors = trackPageErrors(page);
    await openGame(page, 'spider', 7, { suits: 1 });
    const base = await readState(page);
    const run = descendingRun('S', 0);
    await loadState(
      page,
      positionFrom(base, { t0: run.slice(0, 12), t1: [run[12]], t2: [card('5S', true, 9)] }),
    );

    await dragCardToPile(page, run[12].id, 't0');
    await expect(page.locator('.pile[data-pile="f0"] .card')).toHaveCount(13);
    const state = await readState(page);
    expect(pileCount(state, 't0')).toBe(0);
    expect(state.score).toBe(500 - 1 + 100);
    await expect(page.locator('#stat-score')).toHaveText('599');
    expect(errors).toEqual([]);
  });

  test('undo returns a swept suit to the tableau', async ({ page }) => {
    await openGame(page, 'spider', 7, { suits: 1 });
    const base = await readState(page);
    const run = descendingRun('S', 0);
    await loadState(page, positionFrom(base, { t0: run.slice(0, 12), t1: [run[12]] }));

    await dragCardToPile(page, run[12].id, 't0');
    expect(pileCount(await readState(page), 'f0')).toBe(13);

    await page.getByRole('button', { name: 'Undo' }).click();
    const state = await readState(page);
    expect(pileCount(state, 'f0')).toBe(0);
    expect(pileCount(state, 't0')).toBe(12);
    expect(pileCount(state, 't1')).toBe(1);
  });

  test('click-to-move prefers a same-suit landing spot', async ({ page }) => {
    await openGame(page, 'spider', 7, { suits: 4 });
    const base = await readState(page);
    await loadState(page, positionFrom(base, { t0: cards('7S'), t1: cards('8H'), t2: cards('8S') }));

    await clickCard(page, cardId('7S'));
    expect(pileCards(await readState(page), 't2')).toEqual(['8S', '7S']);
  });

  test('declares a win when the eighth suit is completed', async ({ page }) => {
    await openGame(page, 'spider', 7, { suits: 1 });
    const base = await readState(page);
    const run = descendingRun('S', 20);
    const layout: Record<string, ReturnType<typeof cards>> = {
      t0: run.slice(0, 12),
      t1: [run[12]],
    };
    for (let i = 0; i < 7; i++) layout[`f${i}`] = completeFoundation('S', i);
    await loadState(page, positionFrom(base, layout));

    await dragCardToPile(page, run[12].id, 't0');
    await expect(page.locator('.overlay')).toBeVisible();
    await expect(page.locator('#win-summary')).toContainText('Spider');
    expect((await readState(page)).won).toBe(true);
  });
});
