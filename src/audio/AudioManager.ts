/**
 * Web Audio sound manager with synthesized placeholder cues.
 *
 * Every cue belongs to a category; replace a category with a real (original or
 * licensed) sample later via `registerSample(category, url)` without touching
 * game code. Audio is never required to understand a feature — every cue has a
 * visual counterpart.
 */
export type SoundCategory =
  | 'ambient' | 'spinStart' | 'land' | 'clusterWin' | 'cascade' | 'corruption' | 'ageTransition'
  | 'echo' | 'paradoxSplit' | 'debtThreshold' | 'clockmaker' | 'bonusEntry' | 'bonusStage' | 'bonusComplete' | 'ui';

type Voice = { type: OscillatorType; freq: number; to?: number; dur: number; gain: number; delay?: number; noise?: boolean };

const CUES: Record<Exclude<SoundCategory, 'ambient'>, Voice[]> = {
  spinStart: [{ type: 'triangle', freq: 220, to: 440, dur: 0.18, gain: 0.25 }, { type: 'sine', freq: 880, dur: 0.06, gain: 0.08, delay: 0.12 }],
  land: [{ type: 'square', freq: 1800, dur: 0.025, gain: 0.05 }, { type: 'sine', freq: 140, dur: 0.12, gain: 0.25 }],
  clusterWin: [{ type: 'triangle', freq: 523, dur: 0.2, gain: 0.2 }, { type: 'triangle', freq: 659, dur: 0.2, gain: 0.18, delay: 0.08 }, { type: 'triangle', freq: 784, dur: 0.3, gain: 0.16, delay: 0.16 }],
  cascade: [{ type: 'sine', freq: 600, to: 200, dur: 0.25, gain: 0.15 }, { type: 'sine', freq: 0, dur: 0.15, gain: 0.08, noise: true }],
  corruption: [{ type: 'sawtooth', freq: 90, to: 60, dur: 0.35, gain: 0.12 }, { type: 'sine', freq: 0, dur: 0.3, gain: 0.1, noise: true }],
  ageTransition: [{ type: 'sine', freq: 1200, to: 600, dur: 0.18, gain: 0.08 }, { type: 'triangle', freq: 300, dur: 0.2, gain: 0.1 }],
  echo: [{ type: 'sine', freq: 660, dur: 0.6, gain: 0.12 }, { type: 'sine', freq: 662, dur: 0.6, gain: 0.12, delay: 0.15 }, { type: 'sine', freq: 990, dur: 0.5, gain: 0.06, delay: 0.3 }],
  paradoxSplit: [{ type: 'sawtooth', freq: 110, to: 55, dur: 0.9, gain: 0.12 }, { type: 'sine', freq: 440, to: 880, dur: 0.8, gain: 0.1 }, { type: 'sine', freq: 0, dur: 0.5, gain: 0.1, noise: true }],
  debtThreshold: [{ type: 'square', freq: 196, dur: 0.12, gain: 0.08 }, { type: 'square', freq: 185, dur: 0.12, gain: 0.08, delay: 0.16 }],
  clockmaker: [{ type: 'triangle', freq: 98, dur: 1.2, gain: 0.2 }, { type: 'sine', freq: 392, dur: 0.6, gain: 0.08, delay: 0.3 }],
  bonusEntry: [{ type: 'triangle', freq: 196, dur: 0.5, gain: 0.2 }, { type: 'triangle', freq: 294, dur: 0.5, gain: 0.18, delay: 0.25 }, { type: 'triangle', freq: 392, dur: 0.9, gain: 0.18, delay: 0.5 }],
  bonusStage: [{ type: 'sine', freq: 1046, dur: 0.08, gain: 0.12 }, { type: 'triangle', freq: 130, dur: 0.6, gain: 0.2 }],
  bonusComplete: [{ type: 'triangle', freq: 392, dur: 0.3, gain: 0.18 }, { type: 'triangle', freq: 523, dur: 0.3, gain: 0.18, delay: 0.15 }, { type: 'triangle', freq: 784, dur: 0.8, gain: 0.2, delay: 0.3 }],
  ui: [{ type: 'sine', freq: 900, dur: 0.05, gain: 0.06 }],
};

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: { stop: () => void } | null = null;
  private samples = new Map<SoundCategory, AudioBuffer>();
  private volume = 0.6;
  private muted = false;

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.applyGain();
    this.startAmbient();
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyGain();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.applyGain();
  }

  get isMuted() {
    return this.muted;
  }

  private applyGain() {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
  }

  async registerSample(category: SoundCategory, url: string) {
    if (!this.ctx) return;
    const buf = await (await fetch(url)).arrayBuffer();
    this.samples.set(category, await this.ctx.decodeAudioData(buf));
  }

  play(category: Exclude<SoundCategory, 'ambient'>) {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    const sample = this.samples.get(category);
    if (sample) {
      const src = ctx.createBufferSource();
      src.buffer = sample;
      src.connect(this.master);
      src.start();
      return;
    }
    const now = ctx.currentTime;
    for (const v of CUES[category]) {
      const t = now + (v.delay ?? 0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v.gain, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + v.dur);
      g.connect(this.master);
      if (v.noise) {
        const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * v.dur), ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const n = ctx.createBufferSource();
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 1200;
        n.buffer = buf;
        n.connect(f).connect(g);
        n.start(t);
        continue;
      }
      const o = ctx.createOscillator();
      o.type = v.type;
      o.frequency.setValueAtTime(v.freq, t);
      if (v.to) o.frequency.exponentialRampToValueAtTime(v.to, t + v.dur);
      o.connect(g);
      o.start(t);
      o.stop(t + v.dur + 0.05);
    }
  }

  /** Clocktower ambience: a low drone plus a soft escapement tick every second. */
  private startAmbient() {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    g.connect(this.master!);
    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 55;
    const drone2 = ctx.createOscillator();
    drone2.type = 'sine';
    drone2.frequency.value = 82.6;
    drone.connect(g);
    drone2.connect(g);
    drone.start();
    drone2.start();
    const tick = window.setInterval(() => {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const tg = this.ctx.createGain();
      tg.gain.setValueAtTime(0.03, t);
      tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      tg.connect(this.master!);
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 2400;
      o.connect(tg);
      o.start(t);
      o.stop(t + 0.06);
    }, 1000);
    this.ambient = {
      stop: () => {
        drone.stop();
        drone2.stop();
        window.clearInterval(tick);
      },
    };
  }

  dispose() {
    this.ambient?.stop();
    void this.ctx?.close();
    this.ctx = null;
  }
}

export const audio = new AudioManager();
