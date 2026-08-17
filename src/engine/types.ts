/**
 * Shared vocabulary for every game in the collection.
 *
 * The rules layer is pure: `create` / `apply` return brand-new state objects and
 * never touch the DOM. The renderer is generic — it draws whatever piles the
 * state describes, using the layout coordinates each game assigns to its piles.
 */

export type Suit = 'S' | 'H' | 'D' | 'C';
export type Color = 'black' | 'red';

/** 1 = Ace ... 13 = King */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  /** Unique within a game (two-deck games repeat suit+rank, so the id carries a copy index). */
  id: string;
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
}

export type PileKind = 'stock' | 'waste' | 'foundation' | 'tableau' | 'cell';

/** How a pile spreads its cards on the board. */
export type Fan = 'none' | 'down' | 'right';

export interface Pile {
  id: string;
  kind: PileKind;
  cards: Card[];
  /** Board grid coordinates (in card widths / heights); the renderer converts to pixels. */
  x: number;
  y: number;
  fan: Fan;
  /** Cap on how many cards render as a visible spread (waste in draw-3 Klondike). */
  fanLimit?: number;
}

export type GameId = 'klondike' | 'spider' | 'freecell';

export interface GameState {
  game: GameId;
  seed: number;
  /** Game-specific options, echoed back so the UI can restore them on New Game. */
  options: Record<string, number>;
  piles: Pile[];
  moves: number;
  score: number;
  won: boolean;
}

/**
 * `move` transfers `count` cards from the top of `from` onto `to`.
 * `stock` is the game's stock click: draw in Klondike, deal a row in Spider.
 */
export type Move =
  | { type: 'move'; from: string; to: string; count: number }
  | { type: 'stock' };

export interface GameOption {
  key: string;
  label: string;
  values: { value: number; label: string }[];
  default: number;
}

export interface Game {
  id: GameId;
  name: string;
  /**
   * Vertical budget in card heights: the top row plus a typical fanned column.
   * Used to size cards; longer piles compress their fan instead.
   */
  heightUnits: number;
  options: GameOption[];
  hasScore: boolean;

  create(seed: number, options?: Record<string, number>): GameState;

  /** Short summary of what a difficulty level changes, shown in the toolbar. */
  describeLevel(level: number): string;

  /**
   * How many cards can be picked up starting at `cardIndex` of `pileId`,
   * ignoring any destination. Returns 0 when the grab is not allowed.
   */
  grabCount(state: GameState, pileId: string, cardIndex: number): number;

  canMove(state: GameState, move: Move): boolean;
  /** Applies a move assumed legal; returns a new state. */
  apply(state: GameState, move: Move): GameState;

  /** Best destination for click-to-move, or null when there is none. */
  autoTarget(state: GameState, from: string, count: number): string | null;
  /** Destination for double-click (send to foundation), or null. */
  foundationTarget(state: GameState, from: string): string | null;

  isWon(state: GameState): boolean;

  /** One safe automatic move (used by the Autoplay button), or null when done. */
  autoplayStep(state: GameState): Move | null;
}
