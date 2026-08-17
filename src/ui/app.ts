import { defaultOptions, getGame, GAMES } from '../engine';
import { findPile } from '../engine/cards';
import type { Card, Game, GameId, GameState, Move } from '../engine/types';
import { formatTime, getRecord, submitWin, variantKey, type Improvements } from './records';
import { boardColumns, cardElement, computeMetrics, type Metrics, renderBoard } from './render';
import { Sound } from './sound';

interface Session {
  game: Game;
  state: GameState;
  history: GameState[];
  seed: number;
  options: Record<string, number>;
  elapsedMs: number;
  runningSince: number | null;
}

interface DragState {
  pointerId: number;
  from: string;
  count: number;
  cards: Card[];
  layer: HTMLElement;
  grabX: number;
  grabY: number;
  moved: boolean;
  startX: number;
  startY: number;
}

const DRAG_THRESHOLD = 5;
/**
 * Swallows the second tap of a double-click on the pile that was just emptied,
 * so a habitual double-click sends one card up rather than two. Clicks on any
 * other pile stay live, which keeps rapid click-to-move play responsive.
 */
const CLICK_GUARD_MS = 200;
/** How long a card takes to glide to its new home. */
const GLIDE_MS = 190;

export class App {
  private root: HTMLElement;
  private board!: HTMLElement;
  private boardWrap!: HTMLElement;
  private overlay!: HTMLElement;
  private stats!: {
    time: HTMLElement;
    moves: HTMLElement;
    score: HTMLElement;
    scoreBox: HTMLElement;
    best: HTMLElement;
  };
  private optionBar!: HTMLElement;
  private tabs = new Map<GameId, HTMLButtonElement>();
  private undoBtn!: HTMLButtonElement;
  private autoBtn!: HTMLButtonElement;
  private muteBtn!: HTMLButtonElement;

  private sessions = new Map<GameId, Session>();
  private current!: Session;
  private metrics!: Metrics;
  private drag: DragState | null = null;
  private lastMoveAt = 0;
  private lastMoveFrom: string | null = null;
  private autoplaying = false;
  private sound = new Sound();
  /** Cards still gliding; the test hooks wait on this reaching zero. */
  private inFlight = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    this.buildChrome();
    this.select('klondike');
    window.addEventListener('resize', () => this.layout());
    window.setInterval(() => this.updateStats(), 250);
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
  }

  // ---------------------------------------------------------------- chrome

  private buildChrome(): void {
    this.root.innerHTML = `
      <header class="topbar">
        <div class="brand">WinGames</div>
        <nav class="tabs" id="tabs"></nav>
        <div class="stats">
          <div class="stat"><span class="label">Time</span><span class="value" id="stat-time">0:00</span></div>
          <div class="stat"><span class="label">Moves</span><span class="value" id="stat-moves">0</span></div>
          <div class="stat" id="stat-score-box"><span class="label">Score</span><span class="value" id="stat-score">0</span></div>
          <div class="stat"><span class="label">Best</span><span class="value" id="stat-best">—</span></div>
        </div>
      </header>
      <div class="toolbar">
        <div class="options" id="options"></div>
        <div class="actions">
          <button class="btn icon" id="btn-mute" type="button" title="Sound on/off"></button>
          <button class="btn" id="btn-undo" type="button">Undo</button>
          <button class="btn" id="btn-auto" type="button">Autoplay</button>
          <button class="btn" id="btn-restart" type="button">Restart Deal</button>
          <button class="btn primary" id="btn-new" type="button">New Game</button>
        </div>
      </div>
      <main class="board-wrap" id="board-wrap">
        <div class="board" id="board"></div>
      </main>
      <div class="overlay hidden" id="overlay">
        <div class="dialog">
          <h2>You win!</h2>
          <p id="win-summary"></p>
          <div class="records" id="win-records"></div>
          <button class="btn primary" id="btn-win-new" type="button">New Game</button>
          <button class="btn" id="btn-win-close" type="button">Close</button>
        </div>
      </div>`;

    const tabsEl = this.root.querySelector<HTMLElement>('#tabs')!;
    for (const game of GAMES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab';
      btn.textContent = game.name;
      btn.dataset.game = game.id;
      btn.addEventListener('click', () => this.select(game.id));
      tabsEl.appendChild(btn);
      this.tabs.set(game.id, btn);
    }

    this.board = this.root.querySelector<HTMLElement>('#board')!;
    this.boardWrap = this.root.querySelector<HTMLElement>('#board-wrap')!;
    this.overlay = this.root.querySelector<HTMLElement>('#overlay')!;
    this.optionBar = this.root.querySelector<HTMLElement>('#options')!;
    this.undoBtn = this.root.querySelector<HTMLButtonElement>('#btn-undo')!;
    this.autoBtn = this.root.querySelector<HTMLButtonElement>('#btn-auto')!;
    this.muteBtn = this.root.querySelector<HTMLButtonElement>('#btn-mute')!;
    this.stats = {
      time: this.root.querySelector<HTMLElement>('#stat-time')!,
      moves: this.root.querySelector<HTMLElement>('#stat-moves')!,
      score: this.root.querySelector<HTMLElement>('#stat-score')!,
      scoreBox: this.root.querySelector<HTMLElement>('#stat-score-box')!,
      best: this.root.querySelector<HTMLElement>('#stat-best')!,
    };

    this.paintMuteButton();
    this.muteBtn.addEventListener('click', () => {
      this.sound.setMuted(!this.sound.muted);
      this.paintMuteButton();
      // Confirm audibly that sound is back on.
      if (!this.sound.muted) this.sound.play('flip');
    });
    this.undoBtn.addEventListener('click', () => this.undo());
    this.autoBtn.addEventListener('click', () => this.autoplay());
    this.root.querySelector('#btn-restart')!.addEventListener('click', () => this.restart());
    this.root.querySelector('#btn-new')!.addEventListener('click', () => this.newGame());
    this.root.querySelector('#btn-win-new')!.addEventListener('click', () => {
      this.hideOverlay();
      this.newGame();
    });
    this.root.querySelector('#btn-win-close')!.addEventListener('click', () => this.hideOverlay());

    this.board.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', () => this.cancelDrag());
  }

  private buildOptionBar(): void {
    this.optionBar.replaceChildren();
    for (const opt of this.current.game.options) {
      const wrap = document.createElement('label');
      wrap.className = 'option';
      wrap.textContent = `${opt.label} `;
      const select = document.createElement('select');
      select.dataset.option = opt.key;
      for (const v of opt.values) {
        const o = document.createElement('option');
        o.value = String(v.value);
        o.textContent = v.label;
        if (this.current.options[opt.key] === v.value) o.selected = true;
        select.appendChild(o);
      }
      select.addEventListener('change', () => {
        const value = Number(select.value);
        // Choosing a difficulty clears any pinned variant setting, so the level
        // alone decides draw count, suit count or cell count.
        this.current.options =
          opt.key === 'level' ? { level: value } : { ...this.current.options, [opt.key]: value };
        this.newGame();
        // A level can change the board width (FreeCell's cell count), so rebuild
        // the option bar and re-measure rather than only redrawing.
        this.buildOptionBar();
      });
      wrap.appendChild(select);
      this.optionBar.appendChild(wrap);
    }

    const hint = document.createElement('span');
    hint.className = 'option-hint';
    hint.id = 'level-hint';
    hint.textContent = this.current.game.describeLevel(this.current.options.level ?? 3);
    this.optionBar.appendChild(hint);
  }

  // ---------------------------------------------------------------- sessions

  select(id: GameId): void {
    this.stopAutoplay();
    const existing = this.sessions.get(id);
    if (existing) {
      this.current = existing;
    } else {
      const game = getGame(id);
      this.current = this.freshSession(game, randomSeed(), defaultOptions(game));
      this.sessions.set(id, this.current);
    }
    for (const [gameId, btn] of this.tabs) btn.classList.toggle('active', gameId === id);
    this.stats.scoreBox.classList.toggle('hidden', !this.current.game.hasScore);
    this.buildOptionBar();
    this.hideOverlay();
    this.layout();
  }

  private freshSession(game: Game, seed: number, options: Record<string, number>): Session {
    return {
      game,
      state: game.create(seed, options),
      history: [],
      seed,
      options,
      elapsedMs: 0,
      runningSince: null,
    };
  }

  newGame(seed = randomSeed()): void {
    this.stopAutoplay();
    const { game, options } = this.current;
    this.current = this.freshSession(game, seed, options);
    this.sessions.set(game.id, this.current);
    this.hideOverlay();
    // layout() re-measures, which matters when a level changes the column count.
    this.layout();
  }

  restart(): void {
    this.newGame(this.current.seed);
  }

  undo(): void {
    this.stopAutoplay();
    const prev = this.current.history.pop();
    if (!prev) return;
    const positions = this.captureRects();
    this.current.state = prev;
    this.hideOverlay();
    this.render();
    this.glideFrom(positions);
    this.sound.play('undo');
  }

  // ---------------------------------------------------------------- moves

  /**
   * `before` lets a caller supply card positions captured earlier — the drop
   * point of a drag, say — so the glide starts from where the player let go.
   */
  tryMove(move: Move, before?: Map<string, DOMRect>): boolean {
    const { game, state } = this.current;
    if (state.won || !game.canMove(state, move)) {
      this.sound.play('invalid');
      return false;
    }
    const positions = before ?? this.captureRects();
    this.current.history.push(state);
    this.current.state = game.apply(state, move);
    this.startTimer();
    this.lastMoveAt = performance.now();
    this.lastMoveFrom = move.type === 'move' ? move.from : null;
    this.render();
    this.glideFrom(positions);
    this.playMoveSound(move, state, this.current.state);
    if (this.current.state.won) this.onWin();
    return true;
  }

  /** Picks the sound that matches what the move actually did. */
  private playMoveSound(move: Move, before: GameState, after: GameState): void {
    if (after.won) {
      this.sound.play('win');
      return;
    }
    const onFoundation = (s: GameState) =>
      s.piles.reduce((n, p) => (p.kind === 'foundation' ? n + p.cards.length : n), 0);
    if (onFoundation(after) > onFoundation(before)) {
      // Spider clears thirteen at once when a suit completes.
      this.sound.play(onFoundation(after) - onFoundation(before) >= 13 ? 'sweep' : 'foundation');
      return;
    }
    if (move.type === 'stock') {
      this.sound.play('deal');
      return;
    }
    const flipped = (s: GameState) => s.piles.reduce((n, p) => n + p.cards.filter((c) => c.faceUp).length, 0);
    this.sound.play(flipped(after) > flipped(before) ? 'flip' : 'move');
  }

  /** Screen positions of every card currently drawn, including a drag layer. */
  private captureRects(): Map<string, DOMRect> {
    const map = new Map<string, DOMRect>();
    for (const el of this.board.querySelectorAll<HTMLElement>('.card[data-card]')) {
      // A dragged card appears twice; the layer clone comes last and wins,
      // which is what we want — that is where the player sees it.
      map.set(el.dataset.card!, el.getBoundingClientRect());
    }
    return map;
  }

  /**
   * FLIP animation: the board has already been redrawn in its new arrangement,
   * so each card that moved is offset back to where it was and then released,
   * which reads as the card sliding into place.
   */
  private glideFrom(before: Map<string, DOMRect>): void {
    if (prefersReducedMotion()) return;
    const moving: { el: HTMLElement; base: string; dx: number; dy: number }[] = [];

    for (const el of this.board.querySelectorAll<HTMLElement>('.card[data-card]')) {
      const previous = before.get(el.dataset.card!);
      if (!previous) continue;
      const now = el.getBoundingClientRect();
      const dx = previous.left - now.left;
      const dy = previous.top - now.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      moving.push({ el, base: el.style.transform, dx, dy });
    }
    if (moving.length === 0) return;

    for (const { el, base, dx, dy } of moving) {
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px) ${base}`;
      el.style.zIndex = String(400 + Number(el.style.zIndex || 0));
      el.classList.add('gliding');
    }

    // Read once to flush the starting offsets before switching the transition on.
    void this.board.offsetHeight;

    for (const { el, base } of moving) {
      this.inFlight += 1;
      el.style.transition = `transform ${GLIDE_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`;
      el.style.transform = base;
      const settle = () => {
        el.style.transition = '';
        el.classList.remove('gliding');
        this.inFlight = Math.max(0, this.inFlight - 1);
      };
      el.addEventListener('transitionend', settle, { once: true });
      // A card already at its destination fires no transitionend; don't leak a count.
      window.setTimeout(() => {
        if (el.classList.contains('gliding')) settle();
      }, GLIDE_MS + 80);
    }
  }

  autoplay(): void {
    if (this.autoplaying) return;
    this.autoplaying = true;
    const step = () => {
      if (!this.autoplaying) return;
      const move = this.current.game.autoplayStep(this.current.state);
      if (!move || !this.tryMove(move)) {
        this.autoplaying = false;
        return;
      }
      window.setTimeout(step, GLIDE_MS - 30);
    };
    step();
  }

  private stopAutoplay(): void {
    this.autoplaying = false;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.ctrlKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      this.undo();
    }
  }

  // ---------------------------------------------------------------- pointer

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 || this.drag || this.current.state.won) return;
    const target = e.target as HTMLElement;
    const pileEl = target.closest<HTMLElement>('.pile');
    if (!pileEl) return;
    const pileId = pileEl.dataset.pile!;
    const { game, state } = this.current;

    if (findPile(state, pileId).kind === 'stock') {
      this.stopAutoplay();
      this.tryMove({ type: 'stock' });
      return;
    }

    const cardEl = target.closest<HTMLElement>('.card');
    if (!cardEl) return;
    if (pileId === this.lastMoveFrom && performance.now() - this.lastMoveAt < CLICK_GUARD_MS) return;

    const index = Number(cardEl.dataset.index);
    const count = game.grabCount(state, pileId, index);
    if (count === 0) return;

    this.stopAutoplay();
    const pile = findPile(state, pileId);
    const cards = pile.cards.slice(pile.cards.length - count);
    const rect = cardEl.getBoundingClientRect();

    const layer = document.createElement('div');
    layer.className = 'drag-layer';
    const step = this.metrics.cardH * 0.3;
    cards.forEach((card, i) => {
      const el = cardElement(card);
      el.style.transform = `translateY(${i * step}px)`;
      el.style.zIndex = String(i + 1);
      layer.appendChild(el);
    });

    // Set before rendering: the renderer hides the cards being carried, and
    // re-attaches the layer afterwards.
    this.drag = {
      pointerId: e.pointerId,
      from: pileId,
      count,
      cards,
      layer,
      grabX: e.clientX - rect.left,
      grabY: e.clientY - rect.top,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
    };
    this.render();
    this.positionDrag(e.clientX, e.clientY);
    this.markDroppable();
  }

  private onPointerMove(e: PointerEvent): void {
    const drag = this.drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.moved) {
      const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
      if (dist < DRAG_THRESHOLD) return;
      drag.moved = true;
      drag.layer.classList.add('active');
    }
    this.positionDrag(e.clientX, e.clientY);
    this.highlightTarget();
  }

  private onPointerUp(e: PointerEvent): void {
    const drag = this.drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { game, state } = this.current;
    const target = drag.moved ? this.bestDropTarget() : game.autoTarget(state, drag.from, drag.count);

    // Capture while the carried cards are still under the pointer, so they
    // glide from there — whether they land on a new pile or fall back.
    const positions = this.captureRects();
    drag.layer.remove();
    this.drag = null;

    if (target) {
      this.tryMove({ type: 'move', from: drag.from, to: target, count: drag.count }, positions);
    } else {
      this.render();
      this.glideFrom(positions);
      if (drag.moved) this.sound.play('invalid');
    }
  }

  private positionDrag(clientX: number, clientY: number): void {
    const drag = this.drag;
    if (!drag) return;
    const boardRect = this.board.getBoundingClientRect();
    const x = clientX - boardRect.left - drag.grabX;
    const y = clientY - boardRect.top - drag.grabY;
    drag.layer.style.transform = `translate(${x}px, ${y}px)`;
  }

  private cancelDrag(): void {
    if (!this.drag) return;
    this.drag.layer.remove();
    this.drag = null;
    this.render();
  }

  private markDroppable(): void {
    const drag = this.drag;
    if (!drag) return;
    const { game, state } = this.current;
    for (const el of this.board.querySelectorAll<HTMLElement>('.pile')) {
      const to = el.dataset.pile!;
      const legal = game.canMove(state, { type: 'move', from: drag.from, to, count: drag.count });
      el.classList.toggle('droppable', legal);
    }
  }

  private highlightTarget(): void {
    const best = this.bestDropTarget();
    for (const el of this.board.querySelectorAll<HTMLElement>('.pile')) {
      el.classList.toggle('drop-hover', el.dataset.pile === best);
    }
  }

  /** Legal pile with the greatest overlap against the dragged card. */
  private bestDropTarget(): string | null {
    const drag = this.drag;
    if (!drag) return null;
    const top = drag.layer.firstElementChild as HTMLElement | null;
    if (!top) return null;
    const rect = top.getBoundingClientRect();
    const { game, state } = this.current;

    let bestId: string | null = null;
    let bestArea = 0;
    for (const el of this.board.querySelectorAll<HTMLElement>('.pile')) {
      const to = el.dataset.pile!;
      if (to === drag.from) continue;
      if (!game.canMove(state, { type: 'move', from: drag.from, to, count: drag.count })) continue;
      const area = overlapArea(rect, el.getBoundingClientRect());
      if (area > bestArea) {
        bestArea = area;
        bestId = to;
      }
    }
    return bestId;
  }

  // ---------------------------------------------------------------- render

  /** Usable board area, inside the wrapper's own padding. */
  private contentBox(): { width: number; height: number } {
    const style = getComputedStyle(this.boardWrap);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    return {
      width: (this.boardWrap.clientWidth || window.innerWidth) - padX,
      height: (this.boardWrap.clientHeight || window.innerHeight) - padY,
    };
  }

  private layout(): void {
    const box = this.contentBox();
    const cols = boardColumns(this.current.state);
    this.metrics = computeMetrics(this.current.game, cols, box.width, box.height);
    this.render();
  }

  private render(): void {
    if (!this.metrics) return;
    const hidden = new Set(this.drag?.cards.map((c) => c.id) ?? []);
    // Space a tableau pile has to itself: the board area below the top row.
    const pileSpace = this.contentBox().height - (this.metrics.cardH + this.metrics.gapY);
    renderBoard(this.board, this.current.game, this.current.state, this.metrics, {
      hidden,
      maxPileHeight: Math.max(this.metrics.cardH * 2, pileSpace),
    });
    // renderBoard replaces the board's children, so the carried cards go back on top.
    if (this.drag) this.board.appendChild(this.drag.layer);
    this.undoBtn.disabled = this.current.history.length === 0;
    this.autoBtn.disabled = this.current.game.autoplayStep(this.current.state) === null;
    this.updateStats();
  }

  private updateStats(): void {
    if (!this.current) return;
    const { state } = this.current;
    this.stats.time.textContent = formatTime(this.elapsed());
    this.stats.moves.textContent = String(state.moves);
    this.stats.score.textContent = String(state.score);
    const best = getRecord(this.recordKey()).bestTimeMs;
    this.stats.best.textContent = best === null ? '—' : formatTime(best);
  }

  private paintMuteButton(): void {
    const muted = this.sound.muted;
    this.muteBtn.textContent = muted ? '🔇' : '🔊';
    this.muteBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    this.muteBtn.classList.toggle('muted', muted);
  }

  private startTimer(): void {
    if (this.current.runningSince === null) this.current.runningSince = performance.now();
  }

  private stopTimer(): void {
    if (this.current.runningSince !== null) {
      this.current.elapsedMs += performance.now() - this.current.runningSince;
      this.current.runningSince = null;
    }
  }

  elapsed(): number {
    const s = this.current;
    return s.elapsedMs + (s.runningSince === null ? 0 : performance.now() - s.runningSince);
  }

  private onWin(): void {
    this.stopAutoplay();
    this.stopTimer();
    const { state, game } = this.current;
    const timeMs = this.elapsed();
    const improvements = submitWin(this.recordKey(), {
      timeMs,
      score: state.score,
      moves: state.moves,
    });

    const parts = [`Time ${formatTime(timeMs)}`, `${state.moves} moves`];
    if (game.hasScore) parts.push(`score ${state.score}`);
    this.root.querySelector<HTMLElement>('#win-summary')!.textContent = `${game.name} — ${parts.join(' · ')}`;
    this.root.querySelector<HTMLElement>('#win-records')!.replaceChildren(
      ...this.recordLines(improvements),
    );
    this.overlay.classList.remove('hidden');
    this.updateStats();
  }

  private recordKey(): string {
    return variantKey(this.current.game.id, this.current.options);
  }

  /** Personal-best lines for the win dialog, flagging anything just beaten. */
  private recordLines(improvements: Improvements): HTMLElement[] {
    const record = getRecord(this.recordKey());
    const rows: [string, string, boolean][] = [
      ['Best time', record.bestTimeMs === null ? '—' : formatTime(record.bestTimeMs), improvements.time],
      ['Fewest moves', record.fewestMoves === null ? '—' : String(record.fewestMoves), improvements.moves],
    ];
    if (this.current.game.hasScore) {
      rows.push(['Best score', record.bestScore === null ? '—' : String(record.bestScore), improvements.score]);
    }
    rows.push(['Games won', String(record.wins), false]);

    return rows.map(([label, value, isNew]) => {
      const row = document.createElement('div');
      row.className = 'record-row';
      row.innerHTML =
        `<span class="record-label">${label}</span>` +
        `<span class="record-value">${value}</span>` +
        (isNew ? `<span class="record-badge">New!</span>` : '');
      return row;
    });
  }

  private hideOverlay(): void {
    this.overlay.classList.add('hidden');
  }

  // ---------------------------------------------------------------- test hooks

  /** Deterministic control surface used by the Playwright suite. */
  testApi() {
    return {
      gameId: () => this.current.game.id,
      state: () => structuredClone(this.current.state),
      seed: () => this.current.seed,
      newGame: (id: GameId, seed: number, options?: Record<string, number>) => {
        this.select(id);
        if (options) this.current.options = { ...this.current.options, ...options };
        this.newGame(seed);
        this.buildOptionBar();
      },
      setState: (state: GameState) => {
        this.stopAutoplay();
        this.current.state = structuredClone(state);
        this.current.history = [];
        this.hideOverlay();
        this.render();
      },
      move: (move: Move) => this.tryMove(move),
      canMove: (move: Move) => this.current.game.canMove(this.current.state, move),
      undo: () => this.undo(),
      autoplay: () => this.autoplay(),
      elapsed: () => this.elapsed(),
      /** True while cards are still gliding — tests wait on this. */
      animating: () => this.inFlight > 0,
      muted: () => this.sound.muted,
      setMuted: (muted: boolean) => {
        this.sound.setMuted(muted);
        this.paintMuteButton();
      },
      record: () => getRecord(this.recordKey()),
      recordKey: () => this.recordKey(),
      /** Screen position of a card's centre, for synthetic drags. */
      cardPoint: (cardId: string) => {
        const el = this.board.querySelector<HTMLElement>(`.card[data-card="${cardId}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 14) };
      },
      /**
       * Where a card would land if dropped on the given pile. Read from the
       * rendered element rather than recomputed, so it cannot drift from the
       * fan compression the renderer actually applied.
       */
      dropPoint: (pileId: string) => {
        const el = this.board.querySelector<HTMLElement>(`.pile[data-pile="${pileId}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + this.metrics.cardW / 2, y: r.bottom - this.metrics.cardH / 2 };
      },
    };
  }
}

function overlapArea(a: DOMRect, b: DOMRect): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000) + 1;
}
