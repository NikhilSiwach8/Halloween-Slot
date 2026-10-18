/** Tiny synthesized sound set (placeholder audio: no sample files). */
class Audio {
  private ctx: AudioContext | null = null;
  muted = false;

  resume() {
    if (this.muted) return;
    if (!this.ctx && typeof AudioContext !== 'undefined') this.ctx = new AudioContext();
    void this.ctx?.resume();
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.08, delay = 0) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur);
  }

  private noise(dur: number, gain = 0.05) {
    if (this.muted || !this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.buffer = buf;
    src.connect(g).connect(this.ctx.destination);
    src.start();
  }

  spin() { this.noise(0.18, 0.03); }
  reveal() { this.noise(0.12, 0.06); this.tone(660, 0.18, 'triangle', 0.05, 0.08); }
  retune() { this.tone(300, 0.4, 'sawtooth', 0.03); this.tone(240, 0.4, 'sawtooth', 0.03, 0.15); }
  antenna(n: number) { for (let i = 0; i < Math.min(n, 6); i++) this.tone(520 + i * 90, 0.12, 'square', 0.03, i * 0.07); }
  win(x100: number) { const n = x100 >= 1000 ? 5 : x100 >= 100 ? 3 : 1; for (let i = 0; i < n; i++) this.tone(440 * 2 ** (i / 4), 0.2, 'triangle', 0.06, i * 0.09); }
  tape() { this.tone(110, 0.8, 'sawtooth', 0.04); this.noise(0.6, 0.02); }
  /** Bonus start: a static burst, a low hit and a dissonant screech timed to the face lunge. */
  intercept() {
    this.noise(0.9, 0.07);
    this.tone(55, 2.2, 'sawtooth', 0.05, 0.1);
    this.tone(58, 2.2, 'sawtooth', 0.04, 0.1);
    this.tone(40, 0.8, 'square', 0.09, 1.35);
    [1180, 1250, 1320].forEach((f, i) => this.tone(f, 0.45, 'sawtooth', 0.025, 1.35 + i * 0.02));
    [196, 185, 174].forEach((f, i) => this.tone(f, 0.7, 'triangle', 0.04, 1.6 + i * 0.22));
  }
  bigWin() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.07, i * 0.12)); }
}

export const audio = new Audio();
