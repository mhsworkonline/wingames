import { expect, test } from '@playwright/test';
import { card, cards } from '../src/engine/testing';
import {
  cardId,
  canMove,
  clickCard,
  completeFoundation,
  dragCardToPile,
  loadState,
  openGame,
  pileCards,
  pileCount,
  positionFrom,
  readState,
  trackPageErrors,
} from './helpers';

/** Blocks the columns a test does not use, so stray empties do not inflate supermoves. */
function blockUnused(layout: Record<string, ReturnType<typeof cards>>): Record<string, ReturnType<typeof cards>> {
  const filled = { ...layout };
  for (let i = 0; i < 8; i++) {
    if (!(`t${i}` in filled)) filled[`t${i}`] = [card('2D', true, 20 + i)];
  }
  return filled;
}

test.describe('freecell gameplay', () => {
  test('deals every card face up with four empty cells', async ({ page }) => {
    await openGame(page, 'freecell', 999);
    for (let i = 0; i < 8; i++) {
      await expect(page.locator(`.pile[data-pile="t${i}"] .card`)).toHaveCount(i < 4 ? 7 : 6);
    }
    await expect(page.locator('.card.back')).toHaveCount(0);
    await expect(page.locator('.pile[data-kind="cell"] .card')).toHaveCount(0);
  });

  test('parks a card in a free cell and takes it back out', async ({ page }) => {
    const errors = trackPageErrors(page);
    await openGame(page, 'freecell', 999);
    const base = await readState(page);
    await loadState(page, positionFrom(base, blockUnused({ t0: cards('9H 4S'), t1: cards('5D') })));

    await dragCardToPile(page, cardId('4S', 1), 'c0');
    let state = await readState(page);
    expect(pileCards(state, 'c0')).toEqual(['4S']);
    expect(pileCards(state, 't0')).toEqual(['9H']);

    await dragCardToPile(page, cardId('4S', 1), 't1');
    state = await readState(page);
    expect(pileCards(state, 't1')).toEqual(['5D', '4S']);
    expect(pileCount(state, 'c0')).toBe(0);
    expect(errors).toEqual([]);
  });

  test('a cell holds only one card', async ({ page }) => {
    await openGame(page, 'freecell', 999);
    const base = await readState(page);
    await loadState(page, positionFrom(base, blockUnused({ c0: cards('KH'), t0: cards('4S') })));

    expect(await canMove(page, { type: 'move', from: 't0', to: 'c0', count: 1 })).toBe(false);
    await dragCardToPile(page, cardId('4S'), 'c0');
    expect(pileCards(await readState(page), 'c0')).toEqual(['13H']);
    expect(pileCards(await readState(page), 't0')).toEqual(['4S']);
  });

  test('builds down in alternating colours only', async ({ page }) => {
    await openGame(page, 'freecell', 999);
    const base = await readState(page);
    await loadState(page, positionFrom(base, blockUnused({ t0: cards('8S'), t1: cards('7H'), t2: cards('7S') })));

    await dragCardToPile(page, cardId('7S'), 't0');
    expect(pileCards(await readState(page), 't0')).toEqual(['8S']);

    await dragCardToPile(page, cardId('7H'), 't0');
    expect(pileCards(await readState(page), 't0')).toEqual(['8S', '7H']);
  });

  test('carries a supermove when enough cells are free', async ({ page }) => {
    await openGame(page, 'freecell', 999);
    const base = await readState(page);
    await loadState(
      page,
      positionFrom(base, blockUnused({ t0: cards('9S 8H 7S'), t1: cards('10H'), c0: cards('KD'), c1: cards('KS') })),
    );

    // Two cells free -> three cards may travel together.
    await dragCardToPile(page, cardId('9S'), 't1');
    const state = await readState(page);
    expect(pileCards(state, 't1')).toEqual(['10H', '9S', '8H', '7S']);
    expect(pileCount(state, 't0')).toBe(0);
  });

  test('refuses a supermove that exceeds the free capacity', async ({ page }) => {
    await openGame(page, 'freecell', 999);
    const base = await readState(page);
    await loadState(
      page,
      positionFrom(
        base,
        blockUnused({
          t0: cards('9S 8H 7S'),
          t1: cards('10H'),
          c0: cards('KD'),
          c1: cards('KS'),
          c2: cards('KH'),
          c3: cards('KC'),
        }),
      ),
    );

    expect(await canMove(page, { type: 'move', from: 't0', to: 't1', count: 3 })).toBe(false);
    await dragCardToPile(page, cardId('9S'), 't1');
    const state = await readState(page);
    expect(pileCards(state, 't1')).toEqual(['10H']);
    expect(pileCards(state, 't0')).toEqual(['9S', '8H', '7S']);
  });

  test('click-to-move sends a card to the foundation', async ({ page }) => {
    await openGame(page, 'freecell', 999);
    const base = await readState(page);
    await loadState(page, positionFrom(base, blockUnused({ t0: cards('AS'), t1: cards('2S') })));

    await clickCard(page, cardId('AS'));
    expect(pileCards(await readState(page), 'f0')).toEqual(['1S']);

    await clickCard(page, cardId('2S'));
    expect(pileCards(await readState(page), 'f0')).toEqual(['1S', '2S']);
    await expect(page.locator('#stat-moves')).toHaveText('2');
  });

  test('any card may take an empty column', async ({ page }) => {
    await openGame(page, 'freecell', 999);
    const base = await readState(page);
    await loadState(page, positionFrom(base, blockUnused({ t0: cards('9H'), t1: [] })));

    await dragCardToPile(page, cardId('9H'), 't1');
    expect(pileCards(await readState(page), 't1')).toEqual(['9H']);
  });

  test('undo restores a card taken out of a cell', async ({ page }) => {
    await openGame(page, 'freecell', 999);
    const base = await readState(page);
    await loadState(page, positionFrom(base, blockUnused({ t0: cards('9H 4S'), t1: cards('5D') })));

    await dragCardToPile(page, cardId('4S', 1), 'c0');
    await dragCardToPile(page, cardId('4S', 1), 't1');
    expect(pileCards(await readState(page), 't1')).toEqual(['5D', '4S']);

    await page.getByRole('button', { name: 'Undo' }).click();
    expect(pileCards(await readState(page), 'c0')).toEqual(['4S']);

    await page.getByRole('button', { name: 'Undo' }).click();
    const state = await readState(page);
    expect(pileCards(state, 't0')).toEqual(['9H', '4S']);
    expect(pileCount(state, 'c0')).toBe(0);
    expect(state.moves).toBe(0);
  });

  test('autoplay finishes a solved board and declares a win', async ({ page }) => {
    const errors = trackPageErrors(page);
    await openGame(page, 'freecell', 999);
    const base = await readState(page);
    await loadState(
      page,
      positionFrom(base, {
        f0: completeFoundation('S', 0).slice(0, 12),
        f1: completeFoundation('H', 1).slice(0, 12),
        f2: completeFoundation('D', 2).slice(0, 12),
        f3: completeFoundation('C', 3).slice(0, 12),
        t0: [card('KS', true, 4)],
        t1: [card('KH', true, 5)],
        c0: [card('KD', true, 6)],
        c1: [card('KC', true, 7)],
      }),
    );

    await page.getByRole('button', { name: 'Autoplay' }).click();
    await expect(page.locator('.overlay')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#win-summary')).toContainText('FreeCell');

    const state = await readState(page);
    expect(state.won).toBe(true);
    for (let i = 0; i < 4; i++) expect(pileCount(state, `f${i}`)).toBe(13);
    expect(errors).toEqual([]);
  });

  test('plays a real deal through several legal moves', async ({ page }) => {
    const errors = trackPageErrors(page);
    await openGame(page, 'freecell', 42);
    const start = await readState(page);
    expect(start.moves).toBe(0);

    // Walk the board and make whatever legal moves the deal offers.
    let played = 0;
    for (let attempt = 0; attempt < 6; attempt++) {
      const state = await readState(page);
      const source = state.piles.find(
        (p) => p.kind === 'tableau' && p.cards.length > 0 && p.cards[p.cards.length - 1].rank === 1,
      );
      const top = state.piles
        .filter((p) => p.kind === 'tableau' && p.cards.length > 0)
        .map((p) => p.cards[p.cards.length - 1]);
      const card = source ? source.cards[source.cards.length - 1] : top[attempt % top.length];
      const before = (await readState(page)).moves;
      await clickCard(page, card.id);
      if ((await readState(page)).moves > before) played += 1;
    }

    expect(played).toBeGreaterThan(0);
    const end = await readState(page);
    const total = end.piles.reduce((sum, p) => sum + p.cards.length, 0);
    expect(total).toBe(52);
    expect(errors).toEqual([]);
  });
});
