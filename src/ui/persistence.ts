import type { GameId, GameState } from '../engine/types';

/**
 * Keeps each game's in-progress session across a page reload: the board
 * position, undo history, seed/options, and elapsed time. Records (personal
 * bests) already have their own store in records.ts — this is deliberately
 * separate since a session is working state, not a permanent stat.
 */

const STORAGE_PREFIX = 'wingames.session.v1.';
const ACTIVE_KEY = 'wingames.active.v1';

export interface StoredSession {
  seed: number;
  options: Record<string, number>;
  state: GameState;
  history: GameState[];
  elapsedMs: number;
  /** Whether the timer was counting when saved, so it can resume on load. */
  running: boolean;
}

export function saveSession(id: GameId, data: StoredSession): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(data));
  } catch {
    // Storage unavailable or full — the in-progress game just won't restore.
  }
}

export function loadSession(id: GameId): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + id);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const s = parsed as Partial<StoredSession>;
    if (typeof s.seed !== 'number' || !s.state || !Array.isArray(s.history) || !s.options) return null;
    if (s.state.game !== id) return null;
    return {
      seed: s.seed,
      options: s.options,
      state: s.state,
      history: s.history,
      elapsedMs: typeof s.elapsedMs === 'number' ? s.elapsedMs : 0,
      running: Boolean(s.running),
    };
  } catch {
    return null;
  }
}

export function saveActiveGame(id: GameId): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // Ignore — worst case the app opens back on the default tab.
  }
}

export function loadActiveGame(): GameId | null {
  try {
    const value = localStorage.getItem(ACTIVE_KEY);
    return value === 'klondike' || value === 'spider' || value === 'freecell' ? value : null;
  } catch {
    return null;
  }
}

const CHROME_KEY = 'wingames.toolbarCollapsed.v1';

/** Whether the difficulty/actions toolbar was collapsed last session. */
export function loadToolbarCollapsed(): boolean {
  try {
    return localStorage.getItem(CHROME_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveToolbarCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(CHROME_KEY, collapsed ? '1' : '0');
  } catch {
    // Ignore — worst case the toolbar just reopens next time.
  }
}
