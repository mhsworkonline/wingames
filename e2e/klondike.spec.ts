import { expect, test } from '@playwright/test';
import { card, cards } from '../src/engine/testing';
import {
  cardId,
  canMove,
  clickCard,
  clickStock,
  completeFoundation,
  dragCardTo,
  dragCardToPile,
  loadState,
  openGame,
  pileCards,
  pileCount,
  readState,
  positionFrom,
  topOf,
  trackPageErrors,
} from './helpers';

test.describe('klondike gameplay', () => {
  test('deals the classic 1-through-7 staircase', async ({ page }) => {
    await openGame(page, 'klondike', 1234);
    for (let i = 0; i < 7; i++) {
      await expect(page.locator(`.pile[data-pile="t${i}"] .card`)).toHaveCount(i + 1);
      await expect(page.locator(`.pile[data-pile="t${i}"] .card:not(.back)`)).toHaveCount(1);
    }
    await expect(page.locator('.pile[data-pile="waste"] .card')).toHaveCount(0);
  });

  test('drawing from the stock turns cards onto the waste', async ({ page }) => {
    await openGame(page, 'klondike', 1234);
    await clickStock(page);
    await expect(page.locator('.pile[data-pile="waste"] .card:not(.back)')).toHaveCount(1);
    expect(pileCount(await readState(page), 'stock')).toBe(23);

    await clickStock(page);
    await expect(page.locator('.pile[data-pile="waste"] .card')).toHaveCount(2);
  });

  test('recycles the waste once the stock runs out', async ({ page }) => {
    await openGame(page, 'klondike', 1234);
    for (let i = 0; i < 24; i++) await clickStock(page);
    expect(pileCount(await readState(page), 'stock')).toBe(0);
    await expect(page.locator('.pile[data-pile="stock"] .slot')).toHaveText('↻');

    await clickStock(page);
    const state = await readState(page);
    expect(pileCount(state, 'stock')).toBe(24);
    expect(pileCount(state, 'waste')).toBe(0);
  });

  test('drags a card onto a legal tableau build', async ({ page }) => {
    const errors = trackPageErrors(page);
    await openGame(page, 'klondike', 1);
    const base = await readState(page);
    await loadState(
      page,
      positionFrom(base, {
        t0: cards('8S'),
        t1: cards('7H'),
        t2: [card('4C', false), card('KD')],
        stock: cards('2C 3C', false),
      }),
    );

    await dragCardToPile(page, cardId('7H'), 't0');
    const state = await readState(page);
    expect(pileCards(state, 't0')).toEqual(['8S', '7H']);
    expect(pileCount(state, 't1')).toBe(0);
    expect(state.moves).toBe(1);
    expect(errors).toEqual([]);
  });

  test('refuses an illegal drop and leaves the card where it was', async ({ page }) => {
    await openGame(page, 'klondike', 1);
    const base = await readState(page);
    await loadState(page, positionFrom(base, { t0: cards('8S'), t1: cards('7S'), t2: cards('KD') }));

    // 7S on 8S is the same colour, so the drop must be rejected.
    expect(await canMove(page, { type: 'move', from: 't1', to: 't0', count: 1 })).toBe(false);
    await dragCardToPile(page, cardId('7S'), 't0');

    const state = await readState(page);
    expect(pileCards(state, 't1')).toEqual(['7S']);
    expect(pileCards(state, 't0')).toEqual(['8S']);
    expect(state.moves).toBe(0);
  });

  test('a card dropped on empty space snaps back', async ({ page }) => {
    await openGame(page, 'klondike', 1);
    const base = await readState(page);
    await loadState(page, positionFrom(base, { t0: cards('8S'), t1: cards('7H') }));

    const box = await page.locator('.board-wrap').boundingBox();
    await dragCardTo(page, cardId('7H'), box!.x + box!.width - 30, box!.y + box!.height - 30);

    const state = await readState(page);
    expect(pileCards(state, 't1')).toEqual(['7H']);
    expect(state.moves).toBe(0);
    await expect(page.locator('.drag-layer')).toHaveCount(0);
  });

  test('turns over the card exposed by a move', async ({ page }) => {
    await openGame(page, 'klondike', 1);
    const base = await readState(page);
    await loadState(
      page,
      positionFrom(base, { t0: cards('8S'), t1: [card('5D', false), card('7H')] }),
    );
    await expect(page.locator('.pile[data-pile="t1"] .card.back')).toHaveCount(1);

    await dragCardToPile(page, cardId('7H'), 't0');
    await expect(page.locator('.pile[data-pile="t1"] .card.back')).toHaveCount(0);
    await expect(page.locator('.pile[data-pile="t1"] .card:not(.back)')).toHaveCount(1);
    expect((await readState(page)).score).toBe(5);
  });

  test('drags a multi-card run as a unit', async ({ page }) => {
    await openGame(page, 'klondike', 1);
    const base = await readState(page);
    await loadState(page, positionFrom(base, { t0: cards('10H'), t1: cards('9S 8H 7S') }));

    await dragCardToPile(page, cardId('9S'), 't0');
    const state = await readState(page);
    expect(pileCards(state, 't0')).toEqual(['10H', '9S', '8H', '7S']);
    expect(pileCount(state, 't1')).toBe(0);
  });

  test('click-to-move sends a card to the foundation', async ({ page }) => {
    await openGame(page, 'klondike', 1);
    const base = await readState(page);
    await loadState(page, positionFrom(base, { t0: cards('AS'), t1: cards('KD') }));

    await clickCard(page, cardId('AS'));
    const state = await readState(page);
    expect(pileCards(state, 'f0')).toEqual(['1S']);
    expect(state.score).toBe(10);
    await expect(page.locator('.pile[data-pile="f0"] .card')).toHaveCount(1);
  });

  test('click-to-move builds on the tableau when no foundation accepts the card', async ({ page }) => {
    await openGame(page, 'klondike', 1);
    const base = await readState(page);
    await loadState(page, positionFrom(base, { t0: cards('QH'), t1: cards('KS'), t2: [] }));

    await clickCard(page, cardId('QH'));
    expect(pileCards(await readState(page), 't1')).toEqual(['13S', '12H']);
  });

  test('clicking a foundation card leaves it alone, but a drag retrieves it', async ({ page }) => {
    await openGame(page, 'klondike', 1);
    const base = await readState(page);
    await loadState(page, positionFrom(base, { f0: cards('AS'), t0: cards('2H'), t1: cards('KD') }));

    await clickCard(page, cardId('AS'));
    expect(pileCards(await readState(page), 'f0')).toEqual(['1S']);
    expect((await readState(page)).moves).toBe(0);

    await dragCardToPile(page, cardId('AS'), 't0');
    const state = await readState(page);
    expect(pileCards(state, 't0')).toEqual(['2H', '1S']);
    expect(pileCount(state, 'f0')).toBe(0);
  });

  test('draws court figures on the jack, queen and king only', async ({ page }) => {
    await openGame(page, 'klondike', 1);
    const base = await readState(page);
    await loadState(
      page,
      positionFrom(base, { t0: cards('JS'), t1: cards('QH'), t2: cards('KD'), t3: cards('10C'), t4: cards('AS') }),
    );

    for (const pile of ['t0', 't1', 't2']) {
      await expect(page.locator(`.pile[data-pile="${pile}"] .card svg.court`)).toHaveCount(1);
    }
    for (const pile of ['t3', 't4']) {
      await expect(page.locator(`.pile[data-pile="${pile}"] .card svg.court`)).toHaveCount(0);
    }

    // The corner index stays legible on top of the artwork.
    await expect(page.locator('.pile[data-pile="t2"] .card .corner.tl')).toHaveText('K♦');
    // Court cards still move like any other card.
    await dragCardToPile(page, cardId('JS'), 't1');
    expect(pileCards(await readState(page), 't1')).toEqual(['12H', '11S']);
  });

  test('moves a card from the waste to the tableau', async ({ page }) => {
    await openGame(page, 'klondike', 1);
    const base = await readState(page);
    await loadState(page, positionFrom(base, { waste: cards('7H'), t0: cards('8S') }));

    await dragCardToPile(page, cardId('7H'), 't0');
    const state = await readState(page);
    expect(pileCards(state, 't0')).toEqual(['8S', '7H']);
    expect(state.score).toBe(5);
  });

  test('only a king may take an empty column', async ({ page }) => {
    await openGame(page, 'klondike', 1);
    const base = await readState(page);
    await loadState(page, positionFrom(base, { t0: cards('QH'), t1: cards('KS'), t2: [] }));

    await dragCardToPile(page, cardId('QH'), 't2');
    expect(pileCount(await readState(page), 't2')).toBe(0);

    await dragCardToPile(page, cardId('KS'), 't2');
    expect(pileCards(await readState(page), 't2')).toEqual(['13S']);
  });

  test('undo steps back through moves and stops at the deal', async ({ page }) => {
    await openGame(page, 'klondike', 1);
    const base = await readState(page);
    await loadState(page, positionFrom(base, { t0: cards('8S'), t1: cards('7H'), t2: cards('AD') }));
    await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();

    await dragCardToPile(page, cardId('7H'), 't0');
    await clickCard(page, cardId('AD'));
    expect((await readState(page)).moves).toBe(2);

    await page.getByRole('button', { name: 'Undo' }).click();
    expect(pileCards(await readState(page), 't2')).toEqual(['1D']);

    await page.getByRole('button', { name: 'Undo' }).click();
    const state = await readState(page);
    expect(pileCards(state, 't1')).toEqual(['7H']);
    expect(pileCards(state, 't0')).toEqual(['8S']);
    expect(state.moves).toBe(0);
    await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  test('undoes a stock draw with the keyboard shortcut', async ({ page }) => {
    await openGame(page, 'klondike', 1);
    await clickStock(page);
    expect(pileCount(await readState(page), 'waste')).toBe(1);

    await page.keyboard.press('Control+z');
    const state = await readState(page);
    expect(pileCount(await readState(page), 'waste')).toBe(0);
    expect(pileCount(state, 'stock')).toBe(24);
  });

  test('counts moves and keeps the score visible', async ({ page }) => {
    await openGame(page, 'klondike', 1);
    const base = await readState(page);
    await loadState(page, positionFrom(base, { t0: cards('AS'), t1: cards('2S') }));

    await clickCard(page, cardId('AS'));
    await clickCard(page, cardId('2S'));
    await expect(page.locator('#stat-moves')).toHaveText('2');
    await expect(page.locator('#stat-score')).toHaveText('20');
  });

  test('autoplay finishes a nearly solved board and declares a win', async ({ page }) => {
    const errors = trackPageErrors(page);
    await openGame(page, 'klondike', 1);
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
        t2: [card('KD', true, 6)],
        t3: [card('KC', true, 7)],
      }),
    );

    await page.getByRole('button', { name: 'Autoplay' }).click();
    await expect(page.locator('.overlay')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.dialog h2')).toHaveText('You win!');
    await expect(page.locator('#win-summary')).toContainText('Klondike');

    const state = await readState(page);
    expect(state.won).toBe(true);
    for (let i = 0; i < 4; i++) expect(pileCount(state, `f${i}`)).toBe(13);
    expect(errors).toEqual([]);
  });

  test('detects a win from the final manual move', async ({ page }) => {
    await openGame(page, 'klondike', 1);
    const base = await readState(page);
    await loadState(
      page,
      positionFrom(base, {
        f0: completeFoundation('S', 0),
        f1: completeFoundation('H', 1),
        f2: completeFoundation('D', 2),
        f3: completeFoundation('C', 3).slice(0, 12),
        t0: [card('KC', true, 7)],
      }),
    );
    await expect(page.locator('.overlay')).toBeHidden();

    await clickCard(page, card('KC', true, 7).id);
    await expect(page.locator('.overlay')).toBeVisible();
    expect((await readState(page)).won).toBe(true);
  });

  test('starts a new game from the win dialog', async ({ page }) => {
    await openGame(page, 'klondike', 1);
    const base = await readState(page);
    await loadState(
      page,
      positionFrom(base, {
        f0: completeFoundation('S', 0),
        f1: completeFoundation('H', 1),
        f2: completeFoundation('D', 2),
        f3: completeFoundation('C', 3).slice(0, 12),
        t0: [card('KC', true, 7)],
      }),
    );
    await clickCard(page, card('KC', true, 7).id);
    await expect(page.locator('.overlay')).toBeVisible();

    await page.locator('#btn-win-new').click();
    await expect(page.locator('.overlay')).toBeHidden();
    const state = await readState(page);
    expect(state.won).toBe(false);
    expect(state.moves).toBe(0);
    expect(topOf(state, 't6')).not.toBeNull();
    await expect(page.locator('.pile[data-kind="tableau"] .card')).toHaveCount(28);
  });
});
