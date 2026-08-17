import { RANK_LABEL, SUIT_SYMBOL, color } from '../engine/cards';
import type { Card, Game, GameState, Pile } from '../engine/types';
import { courtArt, isCourt } from './court';
import { pipArt } from './pips';

export interface Metrics {
  cardW: number;
  cardH: number;
  gapX: number;
  gapY: number;
}

/** Fan offsets as a fraction of card height / width. */
const FAN_FACE_UP = 0.3;
const FAN_FACE_DOWN = 0.14;
const FAN_RIGHT = 0.32;
/**
 * Compression floors. Below roughly half its natural offset a face-up card's
 * rank stops being readable; a face-down card only has to show that it is there.
 * A pile too deep even at these limits overflows and the board scrolls, which
 * beats squashing everything into an unreadable mush.
 */
const MIN_FACE_UP_SCALE = 0.55;
const MIN_FACE_DOWN_SCALE = 0.3;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const GAP_RATIO = 0.14;
const CARD_ASPECT = 1.4;
/** Share of the board area the cards may claim, leaving a gutter at the edges. */
const WIDTH_USE = 0.92;
const MIN_CARD_W = 48;
/** Beyond this the cards just look cartoonish on very large displays. */
const MAX_CARD_W = 200;

/**
 * Cards are sized to fill the board area, taking whichever of width or height
 * binds first. The height budget (`game.heightUnits`) covers the top row plus a
 * typical fanned column; deeper piles than that compress via `fanOffsets`
 * rather than shrinking every card on the board.
 */
export function computeMetrics(
  game: Game,
  cols: number,
  viewportW: number,
  viewportH: number,
): Metrics {
  const byWidth = (viewportW * WIDTH_USE) / (cols + (cols - 1) * GAP_RATIO);
  const byHeight = (viewportH - 16) / (game.heightUnits * CARD_ASPECT);
  const cardW = Math.round(
    Math.max(MIN_CARD_W, Math.min(MAX_CARD_W, Math.min(byWidth, byHeight))),
  );
  return {
    cardW,
    cardH: Math.round(cardW * CARD_ASPECT),
    gapX: Math.round(cardW * GAP_RATIO),
    gapY: Math.round(cardW * 0.24),
  };
}

export function pileLeft(p: Pile, m: Metrics): number {
  return p.x * (m.cardW + m.gapX);
}

export function pileTop(p: Pile, m: Metrics): number {
  return p.y * (m.cardH + m.gapY);
}

/**
 * Per-card offsets within a pile, compressed when a pile grows too long to fit
 * the board. Returned values are pixel offsets from the pile origin.
 */
export function fanOffsets(p: Pile, m: Metrics, maxHeight: number): { dx: number; dy: number }[] {
  const n = p.cards.length;
  const offsets: { dx: number; dy: number }[] = [];
  if (p.fan === 'none') {
    for (let i = 0; i < n; i++) offsets.push({ dx: 0, dy: 0 });
    return offsets;
  }

  if (p.fan === 'right') {
    const visible = Math.min(p.fanLimit ?? n, n);
    const step = m.cardW * FAN_RIGHT;
    for (let i = 0; i < n; i++) {
      offsets.push({ dx: Math.max(0, i - (n - visible)) * step, dy: 0 });
    }
    return offsets;
  }

  // Downward fan: face-down cards sit tighter than face-up ones. A pile too long
  // for the board squeezes the face-down cards first — they carry no information
  // — and only then the face-up ones, down to the readability floor.
  const upStep = m.cardH * FAN_FACE_UP;
  const downStep = m.cardH * FAN_FACE_DOWN;
  let ups = 0;
  let downs = 0;
  for (let i = 0; i < n - 1; i++) (p.cards[i].faceUp ? ups++ : downs++);

  const available = Math.max(0, maxHeight - m.cardH);
  let up = upStep;
  let down = downStep;

  if (downs * down + ups * up > available && downs > 0) {
    const room = Math.max(0, available - ups * up);
    down = clamp(room / downs, downStep * MIN_FACE_DOWN_SCALE, downStep);
  }
  if (downs * down + ups * up > available && ups > 0) {
    const room = Math.max(0, available - downs * down);
    up = clamp(room / ups, upStep * MIN_FACE_UP_SCALE, upStep);
  }

  let y = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) y += p.cards[i - 1].faceUp ? up : down;
    offsets.push({ dx: 0, dy: y });
  }
  return offsets;
}

export function cardElement(card: Card): HTMLElement {
  const el = document.createElement('div');
  if (!card.faceUp) {
    el.className = 'card back';
    el.dataset.card = card.id;
    return el;
  }
  const suitColor = color(card.suit);
  el.className = `card ${suitColor}`;
  el.dataset.card = card.id;
  el.dataset.rank = String(card.rank);
  el.dataset.suit = card.suit;
  const label = RANK_LABEL[card.rank];
  const symbol = SUIT_SYMBOL[card.suit];
  const face = isCourt(card.rank)
    ? `<span class="face court-face">${courtArt(card.rank, card.suit)}</span>`
    : `<span class="face pip-face">${pipArt(card.rank, card.suit)}</span>`;
  el.innerHTML =
    `<span class="corner tl">${label}<b>${symbol}</b></span>` +
    face +
    `<span class="corner br">${label}<b>${symbol}</b></span>`;
  return el;
}

function emptyMarker(p: Pile, game: Game): string {
  if (p.kind === 'stock') return game.id === 'spider' ? '' : '↻';
  if (p.kind === 'foundation') return 'A';
  return '';
}

export interface RenderOptions {
  /** Cards hidden because they are currently being dragged. */
  hidden?: Set<string>;
  maxPileHeight: number;
}

/** How many card columns the current layout spans, taken from the piles themselves. */
export function boardColumns(state: GameState): number {
  return state.piles.reduce((widest, p) => Math.max(widest, p.x + 1), 1);
}

export function renderBoard(
  board: HTMLElement,
  game: Game,
  state: GameState,
  m: Metrics,
  opts: RenderOptions,
): void {
  board.replaceChildren();
  board.style.setProperty('--card-w', `${m.cardW}px`);
  board.style.setProperty('--card-h', `${m.cardH}px`);

  let boardHeight = 0;
  for (const p of state.piles) {
    const left = pileLeft(p, m);
    const top = pileTop(p, m);
    const offsets = fanOffsets(p, m, opts.maxPileHeight);
    const last = offsets[offsets.length - 1] ?? { dx: 0, dy: 0 };

    const pileEl = document.createElement('div');
    pileEl.className = `pile pile-${p.kind}`;
    pileEl.dataset.pile = p.id;
    pileEl.dataset.kind = p.kind;
    pileEl.dataset.count = String(p.cards.length);
    pileEl.style.left = `${left}px`;
    pileEl.style.top = `${top}px`;
    pileEl.style.width = `${m.cardW + last.dx}px`;
    pileEl.style.height = `${m.cardH + last.dy}px`;

    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.textContent = p.cards.length === 0 ? emptyMarker(p, game) : '';
    pileEl.appendChild(slot);

    p.cards.forEach((card, i) => {
      if (opts.hidden?.has(card.id)) return;
      const el = cardElement(card);
      el.dataset.pile = p.id;
      el.dataset.index = String(i);
      el.style.transform = `translate(${offsets[i].dx}px, ${offsets[i].dy}px)`;
      el.style.zIndex = String(i + 1);
      pileEl.appendChild(el);
    });

    board.appendChild(pileEl);
    boardHeight = Math.max(boardHeight, top + m.cardH + last.dy);
  }

  board.style.width = `${boardColumns(state) * (m.cardW + m.gapX) - m.gapX}px`;
  board.style.height = `${boardHeight}px`;
}
