import type { GameId } from '../engine/types';

/**
 * Personal bests, kept per game variant in localStorage. Klondike draw-1 and
 * draw-3 are different games in practice, as are Spider's suit counts, so each
 * variant carries its own record.
 */

const STORAGE_KEY = 'wingames.records.v1';

export interface GameRecord {
  bestTimeMs: number | null;
  bestScore: number | null;
  fewestMoves: number | null;
  wins: number;
}

export interface WinResult {
  timeMs: number;
  score: number;
  moves: number;
}

/** Which fields the latest win improved on. */
export interface Improvements {
  time: boolean;
  score: boolean;
  moves: boolean;
}

export const EMPTY_RECORD: GameRecord = {
  bestTimeMs: null,
  bestScore: null,
  fewestMoves: null,
  wins: 0,
};

export function variantKey(game: GameId, options: Record<string, number>): string {
  const parts = Object.keys(options)
    .sort()
    .map((k) => `${k}${options[k]}`);
  return parts.length > 0 ? `${game}:${parts.join('-')}` : game;
}

export function loadAll(): Record<string, GameRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, GameRecord>;
  } catch {
    return {};
  }
}

export function getRecord(key: string): GameRecord {
  return { ...EMPTY_RECORD, ...loadAll()[key] };
}

/** Folds a win into the stored record and reports which bests were beaten. */
export function submitWin(key: string, result: WinResult): Improvements {
  const all = loadAll();
  const current = { ...EMPTY_RECORD, ...all[key] };

  const improvements: Improvements = {
    time: current.bestTimeMs === null || result.timeMs < current.bestTimeMs,
    score: current.bestScore === null || result.score > current.bestScore,
    moves: current.fewestMoves === null || result.moves < current.fewestMoves,
  };

  all[key] = {
    bestTimeMs: improvements.time ? result.timeMs : current.bestTimeMs,
    bestScore: improvements.score ? result.score : current.bestScore,
    fewestMoves: improvements.moves ? result.moves : current.fewestMoves,
    wins: current.wins + 1,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable — the record simply isn't kept.
  }
  return improvements;
}

export function clearAll(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do.
  }
}

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
