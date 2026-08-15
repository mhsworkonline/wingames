import { expect, test } from '@playwright/test';
import { clickCard, clickStock, openGame, readState, trackPageErrors } from './helpers';

test.describe('application shell', () => {
  test('starts up on Klondike with a dealt board and no console errors', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.wingames));

    await expect(page.locator('.brand')).toHaveText('WinGames');
    await expect(page.locator('.tab.active')).toHaveText('Klondike');
    await expect(page.locator('.pile[data-kind="tableau"]')).toHaveCount(7);
    // All 52 cards are on the board: 28 dealt to the tableau, 24 face down in the stock.
    await expect(page.locator('.card')).toHaveCount(52);
    await expect(page.locator('.pile[data-kind="tableau"] .card:not(.back)')).toHaveCount(7);
    await expect(page.locator('[data-pile="stock"] .card.back')).toHaveCount(24);
    expect(errors).toEqual([]);
  });

  test('offers exactly the three games in the menu', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.tab')).toHaveText(['Klondike', 'Spider', 'FreeCell']);
  });

  test('switches between games and lays out each board correctly', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.wingames));

    await page.getByRole('button', { name: 'Spider', exact: true }).click();
    await expect(page.locator('.tab.active')).toHaveText('Spider');
    await expect(page.locator('.pile[data-kind="tableau"]')).toHaveCount(10);
    await expect(page.locator('.pile[data-kind="foundation"]')).toHaveCount(8);
    await expect(page.locator('.card')).toHaveCount(104);
    await expect(page.locator('.pile[data-kind="tableau"] .card')).toHaveCount(54);
    await expect(page.locator('.pile[data-kind="tableau"] .card:not(.back)')).toHaveCount(10);

    await page.getByRole('button', { name: 'FreeCell', exact: true }).click();
    await expect(page.locator('.tab.active')).toHaveText('FreeCell');
    await expect(page.locator('.pile[data-kind="tableau"]')).toHaveCount(8);
    await expect(page.locator('.pile[data-kind="cell"]')).toHaveCount(4);
    await expect(page.locator('.pile[data-kind="stock"]')).toHaveCount(0);
    await expect(page.locator('.card')).toHaveCount(52);
    await expect(page.locator('.card.back')).toHaveCount(0);

    await page.getByRole('button', { name: 'Klondike', exact: true }).click();
    await expect(page.locator('.pile[data-kind="tableau"]')).toHaveCount(7);
    expect(errors).toEqual([]);
  });

  test('keeps each game in progress while switching tabs', async ({ page }) => {
    await openGame(page, 'klondike', 4242);
    await clickStock(page);
    const klondikeMoves = (await readState(page)).moves;
    expect(klondikeMoves).toBe(1);

    await page.getByRole('button', { name: 'Spider', exact: true }).click();
    expect((await readState(page)).moves).toBe(0);

    await page.getByRole('button', { name: 'Klondike', exact: true }).click();
    expect((await readState(page)).moves).toBe(1);
  });

  test('shows game-specific options and hides score where it does not apply', async ({ page }) => {
    await openGame(page, 'klondike', 3);
    await expect(page.locator('select[data-option="draw"]')).toBeVisible();
    await expect(page.locator('#stat-score-box')).toBeVisible();

    await page.getByRole('button', { name: 'Spider', exact: true }).click();
    await expect(page.locator('select[data-option="suits"]')).toBeVisible();

    await page.getByRole('button', { name: 'FreeCell', exact: true }).click();
    await expect(page.locator('.options select')).toHaveCount(0);
    await expect(page.locator('#stat-score-box')).toBeHidden();
  });

  test('changing the draw option starts a fresh deal', async ({ page }) => {
    await openGame(page, 'klondike', 11);
    await clickStock(page);
    expect((await readState(page)).options.draw).toBe(1);
    expect(await page.locator('.pile[data-pile="waste"] .card').count()).toBe(1);

    await page.locator('select[data-option="draw"]').selectOption('3');
    const state = await readState(page);
    expect(state.options.draw).toBe(3);
    expect(state.moves).toBe(0);

    await clickStock(page);
    expect(await page.locator('.pile[data-pile="waste"] .card').count()).toBe(3);
  });

  test('runs the clock from the first move and resets it for a new game', async ({ page }) => {
    await openGame(page, 'klondike', 77);
    await expect(page.locator('#stat-time')).toHaveText('0:00');
    expect(await page.evaluate(() => window.wingames.elapsed())).toBe(0);

    await clickStock(page);
    await expect(page.locator('#stat-time')).toHaveText('0:01', { timeout: 3000 });

    await page.getByRole('button', { name: 'New Game' }).click();
    await expect(page.locator('#stat-time')).toHaveText('0:00');
    await expect(page.locator('#stat-moves')).toHaveText('0');
  });

  test('deals a different game each time New Game is pressed', async ({ page }) => {
    await openGame(page, 'klondike', 5);
    const first = (await readState(page)).seed;
    await page.getByRole('button', { name: 'New Game' }).click();
    const second = await page.evaluate(() => window.wingames.seed());
    expect(second).not.toBe(first);
    await expect(page.locator('.pile[data-kind="tableau"] .card')).toHaveCount(28);
  });

  test('Restart Deal replays the same cards', async ({ page }) => {
    await openGame(page, 'klondike', 8080);
    const before = await readState(page);
    await clickCard(page, (await topCardId(page)) ?? '');
    await page.getByRole('button', { name: 'Restart Deal' }).click();

    const after = await readState(page);
    expect(after.seed).toBe(before.seed);
    expect(after.moves).toBe(0);
    expect(after.piles.map((p) => p.cards.map((c) => c.id))).toEqual(
      before.piles.map((p) => p.cards.map((c) => c.id)),
    );
  });
});

async function topCardId(page: import('@playwright/test').Page): Promise<string | null> {
  const state = await readState(page);
  const t6 = state.piles.find((p) => p.id === 't6');
  const top = t6?.cards[t6.cards.length - 1];
  return top?.id ?? null;
}
