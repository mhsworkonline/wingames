import { freecell } from './freecell';
import { klondike } from './klondike';
import { spider } from './spider';
import type { Game, GameId } from './types';

export const GAMES: Game[] = [klondike, spider, freecell];

export function getGame(id: GameId): Game {
  const game = GAMES.find((g) => g.id === id);
  if (!game) throw new Error(`unknown game: ${id}`);
  return game;
}

export function defaultOptions(game: Game): Record<string, number> {
  return Object.fromEntries(game.options.map((o) => [o.key, o.default]));
}

export { freecell, klondike, spider };
export * from './cards';
export type * from './types';
