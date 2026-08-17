/**
 * Sound effects, synthesised with the Web Audio API — no audio files, so the
 * app stays self-contained and adds nothing to the download.
 *
 * The AudioContext is created on the first sound rather than at startup:
 * browsers refuse to start audio outside a user gesture, and every sound here
 * follows a click.
 */

export type SoundName =
  | 'move'
  | 'flip'
  | 'foundation'
  | 'deal'
  | 'invalid'
  | 'undo'
  | 'sweep'
  | 'win';

const STORAGE_KEY = 'wingames.muted';

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private mutedState = read();

  get muted(): boolean {
    return this.mutedState;
  }

  setMuted(muted: boolean): void {
    this.mutedState = muted;
    try {
      localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    } catch {
      // Storage unavailable (private browsing) — the setting just won't persist.
    }
  }

  play(name: SoundName): void {
    if (this.mutedState) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const t = ctx.currentTime;
    switch (name) {
      case 'move':
        this.whoosh(t, 1100, 0.07, 0.09);
        break;
      case 'flip':
        this.whoosh(t, 2600, 0.045, 0.07);
        break;
      case 'deal':
        this.whoosh(t, 1500, 0.05, 0.06);
        this.whoosh(t + 0.06, 1300, 0.05, 0.05);
        break;
      case 'foundation':
        this.tone(t, 'sine', 660, 990, 0.16, 0.1);
        break;
      case 'undo':
        this.tone(t, 'sine', 520, 330, 0.12, 0.07);
        break;
      case 'invalid':
        this.tone(t, 'triangle', 180, 130, 0.12, 0.06);
        break;
      case 'sweep':
        [523, 659, 784].forEach((f, i) => this.tone(t + i * 0.07, 'sine', f, f, 0.16, 0.08));
        break;
      case 'win':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(t + i * 0.12, 'sine', f, f, 0.34, 0.1));
        break;
    }
  }

  /** Short filtered noise burst — the sound of a card sliding. */
  private whoosh(at: number, frequency: number, duration: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.8;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(gain, at + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    src.connect(filter).connect(env).connect(this.master);
    src.start(at);
    src.stop(at + duration + 0.02);
  }

  private tone(
    at: number,
    type: OscillatorType,
    from: number,
    to: number,
    duration: number,
    gain: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + duration);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(gain, at + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(env).connect(this.master);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
    } catch {
      return null;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    // One second of white noise, reused by every whoosh.
    const frames = Math.floor(this.ctx.sampleRate * 0.4);
    this.noise = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    return this.ctx;
  }
}

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
