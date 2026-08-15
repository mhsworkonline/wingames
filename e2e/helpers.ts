import { expect, type Page } from '@playwright/test';
import { card } from '../src/engine/testing';
import type { Card, GameId, GameState, Move } from '../src/engine/types';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** A complete Ace-to-King foundation pile; `copy` keeps card ids unique per pile. */
export function completeFoundation(suit: string, copy = 0): Card[] {
  return RANKS.map((r) => card(r + suit, true, copy));
}

/** King-down-to-Ace run, as it sits on a Spider tableau column. */
export function descendingRun(suit: string, copy = 0): Card[] {
  return [...RANKS].reverse().map((r) => card(r + suit, true, copy));
}

export async function openGame(
  page: Page,
  game: GameId,
  seed = 1,
  options?: Record<string, number>,
): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.wingames));
  await page.evaluate(
    ([g, s, o]) => window.wingames.newGame(g as GameId, s as number, o as Record<string, number>),
    [game, seed, options] as const,
  );
  await expect(page.locator('.tab.active')).toHaveText(gameName(game));
}

function gameName(game: GameId): string {
  return { klondike: 'Klondike', spider: 'Spider', freecell: 'FreeCell' }[game];
}

export function readState(page: Page): Promise<GameState> {
  return page.evaluate(() => window.wingames.state());
}

export async function loadState(page: Page, state: GameState): Promise<void> {
  await page.evaluate((s) => window.wingames.setState(s as GameState), state);
}

export function pileCount(state: GameState, id: string): number {
  return state.piles.find((p) => p.id === id)?.cards.length ?? 0;
}

export function pileCards(state: GameState, id: string): string[] {
  return (state.piles.find((p) => p.id === id)?.cards ?? []).map((c) => `${c.rank}${c.suit}`);
}

export function topOf(state: GameState, id: string): string | null {
  const codes = pileCards(state, id);
  return codes[codes.length - 1] ?? null;
}

/** Replaces the named piles and clears everything else. */
export function positionFrom(state: GameState, layout: Record<string, Card[]>): GameState {
  return {
    ...state,
    won: false,
    moves: 0,
    piles: state.piles.map((p) => ({ ...p, cards: (layout[p.id] ?? []).map((c) => ({ ...c })) })),
  };
}

/** Drags a card onto a pile with real mouse input, in steps, like a human would. */
export async function dragCardToPile(page: Page, cardId: string, pileId: string): Promise<void> {
  const from = await page.evaluate((id) => window.wingames.cardPoint(id), cardId);
  const to = await page.evaluate((id) => window.wingames.dropPoint(id), pileId);
  if (!from) throw new Error(`card ${cardId} is not on the board`);
  if (!to) throw new Error(`pile ${pileId} is not on the board`);

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 8, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

/** Drags a card to arbitrary screen coordinates (used for illegal-drop checks). */
export async function dragCardTo(page: Page, cardId: string, x: number, y: number): Promise<void> {
  const from = await page.evaluate((id) => window.wingames.cardPoint(id), cardId);
  if (!from) throw new Error(`card ${cardId} is not on the board`);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 8, { steps: 4 });
  await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.up();
}

/** Single click on a card — the app's click-to-move gesture. */
export async function clickCard(page: Page, cardId: string): Promise<void> {
  const point = await page.evaluate((id) => window.wingames.cardPoint(id), cardId);
  if (!point) throw new Error(`card ${cardId} is not on the board`);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.up();
  // Clear the double-click guard so consecutive clicks on one pile all register.
  await page.waitForTimeout(220);
}

/** Clicks the stock: draws in Klondike, deals a row in Spider. */
export async function clickStock(page: Page): Promise<void> {
  await page.locator('.pile[data-pile="stock"]').click({ position: { x: 10, y: 10 } });
}

export function cardId(code: string, copy = 0): string {
  return card(code, true, copy).id;
}

export function canMove(page: Page, move: Move): Promise<boolean> {
  return page.evaluate((m) => window.wingames.canMove(m as Move), move);
}

/** Fails the test if the page logged any console error or threw. */
export function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}
