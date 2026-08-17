import type { Game, GameState, Move } from './types';

/**
 * Difficulty runs 1 (Easy) to 5 (Expert). Each game maps a level onto its own
 * real difficulty lever — Klondike's draw count, Spider's suit count, the
 * number of free cells in FreeCell — and then, for levels that share a lever,
 * biases which deal you get.
 *
 * Deal bias works by generating a handful of candidate deals from offsets of
 * the chosen seed, scoring each, and keeping the friendliest or nastiest. It
 * stays deterministic: the same seed and level always produce the same board,
 * so Restart Deal replays exactly.
 */

export type Level = 1 | 2 | 3 | 4 | 5;
export type DealBias = 'easy' | 'none' | 'hard';

export const LEVELS: Level[] = [1, 2, 3, 4, 5];
export const DEFAULT_LEVEL: Level = 3;

export const LEVEL_LABELS: Record<Level, string> = {
  1: '1 · Easy',
  2: '2 · Casual',
  3: '3 · Standard',
  4: '4 · Hard',
  5: '5 · Expert',
};

export function clampLevel(value: number | undefined): Level {
  const n = Math.round(value ?? DEFAULT_LEVEL);
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  return n as Level;
}

export function levelOption() {
  return {
    key: 'level',
    label: 'Difficulty',
    values: LEVELS.map((level) => ({ value: level, label: LEVEL_LABELS[level] })),
    default: DEFAULT_LEVEL,
  };
}

/** Wording for the toolbar hint, taken from the bias actually in force. */
export function describeBias(bias: DealBias, pool: number): string {
  if (pool <= 1 || bias === 'none') return 'straight deal';
  return bias === 'easy' ? 'kinder deals' : 'tougher deals';
}

/** Spacing between candidate seeds; coprime with the RNG period in practice. */
const SEED_STRIDE = 7919;

/**
 * Picks a deal for the given level. With a pool of one this is just the plain
 * deal for the seed, so Standard play is the unbiased game.
 */
export function pickDeal(
  seed: number,
  pool: number,
  bias: DealBias,
  deal: (seed: number) => GameState,
  ease: (state: GameState) => number,
): GameState {
  const chosen = choose(seed, pool, bias, deal, ease);
  // Record the seed the player asked for, not the candidate offset, so
  // Restart Deal reproduces this exact board.
  chosen.seed = seed;
  return chosen;
}

function choose(
  seed: number,
  pool: number,
  bias: DealBias,
  deal: (seed: number) => GameState,
  ease: (state: GameState) => number,
): GameState {
  let best = deal(seed);
  if (pool <= 1 || bias === 'none') return best;

  let bestEase = ease(best);
  for (let i = 1; i < pool; i++) {
    const candidate = deal(seed + i * SEED_STRIDE);
    const candidateEase = ease(candidate);
    const better = bias === 'easy' ? candidateEase > bestEase : candidateEase < bestEase;
    if (better) {
      best = candidate;
      bestEase = candidateEase;
    }
  }
  return best;
}

/**
 * How many legal moves the opening position offers. A board with more ways to
 * start is generally the friendlier one.
 */
export function countOpeningMoves(game: Game, state: GameState): number {
  let moves = 0;
  for (const src of state.piles) {
    for (let i = 0; i < src.cards.length; i++) {
      const count = game.grabCount(state, src.id, i);
      if (count === 0) continue;
      for (const dst of state.piles) {
        if (dst.id === src.id) continue;
        const move: Move = { type: 'move', from: src.id, to: dst.id, count };
        if (game.canMove(state, move)) moves += 1;
      }
    }
  }
  return moves;
}

/**
 * How reachable the low cards are: an ace at the top of its column can go
 * straight to a foundation, one at the bottom is buried under the whole pile.
 */
export function lowCardAccess(state: GameState, throughRank = 2): number {
  let access = 0;
  for (const pile of state.piles) {
    if (pile.kind !== 'tableau') continue;
    const deepest = Math.max(1, pile.cards.length - 1);
    pile.cards.forEach((card, index) => {
      if (card.rank <= throughRank) access += index / deepest;
    });
  }
  return access;
}
