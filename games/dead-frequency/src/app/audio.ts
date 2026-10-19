import type { BonusType } from '../config/types';

export type AudioMood = 'base' | BonusType;

/**
 * Dead Frequency's sound: a looping music track plus effects synthesized live with the Web Audio
 * API.
 *
 *  - Music: "Halloween Waltz" (public/assets/audio/halloween-waltz-loop.mp3; see docs/AUDIO.md for
 *    its source and licence), cut to a seamless 20.7 s loop. It plays everywhere: base game,
 *    Feature Spins, bonus buys and bonuses, a little louder in bonuses, and ducks under the
 *    bonus jump scare and the win screens.
 *  - Ambience: a dark radio drone with a slowly breathing filter, tuned-off-station hiss and
 *    crackle, and muffled ghost voices drifting through. Each bonus has its own mood: Morse blips
 *    in Night Shift, more whispers in Possession, a heartbeat in Dead Air.
 *  - Effects: reel thunks, Static bursts, a tuning-dial sweep for Retune, beacon pings, tube-radio
 *    bells for wins, the tape deck, the bonus jump-scare sting and a swelling pad for big wins.
 *
 * Nothing plays until the first user gesture (browser autoplay rules). Mute is remembered.
 */
const MOODS: Record<AudioMood, { drone: number; cutoff: number; voiceEvery: [number, number]; heartbeat: number; morse: boolean }> = {
  base: { drone: 49, cutoff: 260, voiceEvery: [9, 20], heartbeat: 0, morse: false },
  NIGHT_SHIFT: { drone: 55, cutoff: 420, voiceEvery: [10, 22], heartbeat: 0, morse: true },
  POSSESSION: { drone: 46.25, cutoff: 300, voiceEvery: [3, 8], heartbeat: 0, morse: false },
  DEAD_AIR: { drone: 41.2, cutoff: 360, voiceEvery: [6, 14], heartbeat: 0.92, morse: false },
};

const MUTE_KEY = 'dead-frequency:muted';

const MUSIC_URL = `${import.meta.env.BASE_URL}assets/audio/halloween-waltz-loop.mp3`;
/** Length of the seamless loop in the file (seconds); see docs/AUDIO.md for how it was cut. */
const MUSIC_LOOP_S = 913475 / 44100;
/** Music level in the base game and in bonuses (before ducking and the master volume). */
const MUSIC_LEVEL = { base: 0.3, bonus: 0.38 };
/** The synthesized ambience sits under the music once it plays. */
const AMBIENCE_UNDER_MUSIC = 0.28;

class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private ambience!: GainNode;
  private reverb!: ConvolverNode;
  private noise!: AudioBuffer;
  private drone: { oscs: OscillatorNode[]; filter: BiquadFilterNode } | null = null;
  private mood: AudioMood = 'base';
  /** Music: level (mood) and duck gains in series, so ducking never fights the mood level. */
  private musicLevel: GainNode | null = null;
  private musicDuck: GainNode | null = null;
  private timers: number[] = [];
  private _muted = false;

  constructor() {
    try {
      this._muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      /* storage unavailable: default to sound on */
    }
  }

  get muted() {
    return this._muted;
  }

  set muted(m: boolean) {
    this._muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  /** Call from a user gesture. Creates the audio graph on first use and starts the ambience. */
  resume() {
    if (typeof AudioContext === 'undefined') return;
    if (!this.ctx) this.build();
    void this.ctx!.resume();
  }

  private build() {
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain();
    this.master.gain.value = this._muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    this.ambience = ctx.createGain();
    this.ambience.gain.value = 0.55;
    this.ambience.connect(this.master);

    // Reverb: a generated impulse (decaying stereo noise), like a big empty studio.
    this.reverb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.8);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    this.reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.reverb.connect(wet).connect(this.master);

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const n = this.noise.getChannelData(0);
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;

    this.startAmbience();
    void this.startMusic();
    document.addEventListener('visibilitychange', () => (document.hidden ? void ctx.suspend() : void ctx.resume()));
  }

  // ------------------------------------------------------------ building blocks
  private get now() {
    return this.ctx!.currentTime;
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; delay?: number; attack?: number; glideTo?: number; reverb?: number; bus?: GainNode } = {}) {
    if (!this.ctx) return;
    const t = this.now + (opts.delay ?? 0);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.glideTo) o.frequency.exponentialRampToValueAtTime(opts.glideTo, t + dur);
    this.env(g, t, opts.gain ?? 0.1, opts.attack ?? 0.005, dur);
    o.connect(g).connect(opts.bus ?? this.sfx);
    if (opts.reverb) {
      const s = this.ctx.createGain();
      s.gain.value = opts.reverb;
      g.connect(s).connect(this.reverb);
    }
    o.start(t);
    o.stop(t + dur + (opts.attack ?? 0.005) + 0.05);
  }

  /** Filtered noise burst; `sweep` moves the filter's centre from `freq` to that value. */
  private hiss(dur: number, opts: { freq?: number; q?: number; gain?: number; delay?: number; sweep?: number; type?: BiquadFilterType; attack?: number; reverb?: number; bus?: GainNode } = {}) {
    if (!this.ctx) return;
    const t = this.now + (opts.delay ?? 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.setValueAtTime(opts.freq ?? 2000, t);
    if (opts.sweep) f.frequency.exponentialRampToValueAtTime(opts.sweep, t + dur);
    f.Q.value = opts.q ?? 0.8;
    const g = this.ctx.createGain();
    this.env(g, t, opts.gain ?? 0.08, opts.attack ?? 0.005, dur);
    src.connect(f).connect(g).connect(opts.bus ?? this.sfx);
    if (opts.reverb) {
      const s = this.ctx.createGain();
      s.gain.value = opts.reverb;
      g.connect(s).connect(this.reverb);
    }
    src.start(t, Math.random());
    src.stop(t + dur + (opts.attack ?? 0.005) + 0.05);
  }

  // ------------------------------------------------------------------ ambience
  private startAmbience() {
    const ctx = this.ctx!;
    // Drone: two detuned saws and a sub sine through a slowly breathing low-pass.
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 6;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.06;
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    const g = ctx.createGain();
    g.gain.value = 0.11;
    filter.connect(g).connect(this.ambience);
    const oscs = [-7, 7, 0].map((detune, i) => {
      const o = ctx.createOscillator();
      o.type = i < 2 ? 'sawtooth' : 'sine';
      o.detune.value = detune;
      o.connect(filter);
      o.start();
      return o;
    });
    this.drone = { oscs, filter };

    // Off-station hiss, band-limited like an old receiver.
    const hiss = ctx.createBufferSource();
    hiss.buffer = this.noise;
    hiss.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 2400;
    hp.Q.value = 0.5;
    const hg = ctx.createGain();
    hg.gain.value = 0.018;
    hiss.connect(hp).connect(hg).connect(this.ambience);
    hiss.start();

    this.applyMood();
    this.schedule(() => this.crackle(), 0.15, 0.6);
    this.scheduleVoices();
    this.schedule(() => this.morse(), 4, 9);
    this.heartbeatLoop();
  }

  private applyMood() {
    if (!this.drone || !this.ctx) return;
    const m = MOODS[this.mood];
    const t = this.now;
    this.drone.oscs.forEach((o, i) => o.frequency.setTargetAtTime(i === 2 ? m.drone / 2 : m.drone, t, 1.5));
    this.drone.filter.frequency.setTargetAtTime(m.cutoff, t, 1.5);
  }

  /** Calls `fn` again and again at random intervals between `min` and `max` seconds. */
  private schedule(fn: () => void, min: number, max: number) {
    const tick = () => {
      fn();
      this.timers.push(window.setTimeout(tick, (min + Math.random() * (max - min)) * 1000));
    };
    this.timers.push(window.setTimeout(tick, (min + Math.random() * (max - min)) * 1000));
  }

  private crackle() {
    if (this._muted || document.hidden) return;
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.hiss(0.012, { freq: 3000 + Math.random() * 4000, q: 2, gain: 0.03 + Math.random() * 0.05, delay: i * 0.03, bus: this.ambience });
  }

  private scheduleVoices() {
    const next = () => {
      const [a, b] = MOODS[this.mood].voiceEvery;
      this.timers.push(window.setTimeout(() => {
        this.ghostVoice();
        next();
      }, (a + Math.random() * (b - a)) * 1000));
    };
    next();
  }

  /** A muffled "voice" from another frequency: a buzzy source through moving vowel formants. */
  private ghostVoice() {
    if (!this.ctx || this._muted || document.hidden) return;
    const ctx = this.ctx;
    const t = this.now;
    const syllables = 3 + Math.floor(Math.random() * 5);
    const dur = syllables * 0.19;
    const pitch = 95 + Math.random() * 70;
    const src = ctx.createOscillator();
    src.type = 'sawtooth';
    src.frequency.setValueAtTime(pitch, t);
    const vib = ctx.createOscillator();
    const vibG = ctx.createGain();
    vib.frequency.value = 5;
    vibG.gain.value = 4;
    vib.connect(vibG).connect(src.frequency);
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    const radio = ctx.createBiquadFilter();
    radio.type = 'bandpass';
    radio.frequency.value = 1100;
    radio.Q.value = 0.9;
    const vowels: [number, number][] = [[730, 1090], [270, 2290], [570, 840], [530, 1840], [300, 870]];
    for (const k of [0, 1]) {
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 9;
      for (let s = 0; s < syllables; s++) f.frequency.setTargetAtTime(vowels[Math.floor(Math.random() * vowels.length)][k], t + s * 0.19, 0.03);
      src.connect(f).connect(out);
    }
    for (let s = 0; s < syllables; s++) {
      const st = t + s * 0.19;
      out.gain.setTargetAtTime(0.05 + Math.random() * 0.04, st, 0.02);
      out.gain.setTargetAtTime(0.0001, st + 0.12, 0.03);
    }
    const g = ctx.createGain();
    g.gain.value = this.mood === 'POSSESSION' ? 0.8 : 0.55;
    out.connect(radio).connect(g).connect(this.ambience);
    const verb = ctx.createGain();
    verb.gain.value = 0.6;
    g.connect(verb).connect(this.reverb);
    src.start(t);
    vib.start(t);
    src.stop(t + dur + 0.4);
    vib.stop(t + dur + 0.4);
    this.hiss(dur + 0.3, { freq: 1500, q: 0.6, gain: 0.025, bus: this.ambience });
  }

  private morse() {
    if (!this.ctx || !MOODS[this.mood].morse || this._muted) return;
    let d = 0;
    for (let i = 0; i < 6; i++) {
      const long = Math.random() < 0.4;
      this.tone(1180, long ? 0.18 : 0.06, { type: 'sine', gain: 0.025, delay: d, attack: 0.004, bus: this.ambience, reverb: 0.3 });
      d += (long ? 0.18 : 0.06) + 0.07;
    }
  }

  private heartbeatLoop() {
    const beat = () => {
      const period = MOODS[this.mood].heartbeat;
      if (period && this.ctx && !this._muted) {
        this.tone(62, 0.18, { gain: 0.32, glideTo: 38, bus: this.ambience });
        this.tone(58, 0.2, { gain: 0.22, glideTo: 36, delay: 0.24, bus: this.ambience });
      }
      this.timers.push(window.setTimeout(beat, (period || 1) * 1000));
    };
    beat();
  }

  setMood(mood: AudioMood) {
    if (mood === this.mood) return;
    this.mood = mood;
    this.applyMood();
    if (this.ctx && this.musicLevel) this.musicLevel.gain.setTargetAtTime(mood === 'base' ? MUSIC_LEVEL.base : MUSIC_LEVEL.bonus, this.now, 0.8);
  }

  // --------------------------------------------------------------------- music
  /** Loads the music and loops it gaplessly, fading in. A failed load just leaves the ambience. */
  private async startMusic() {
    const ctx = this.ctx!;
    try {
      const res = await fetch(MUSIC_URL);
      if (!res.ok) return;
      const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
      // Some decoders keep the MP3 encoder delay as leading silence: loop from the first sound.
      const ch = buffer.getChannelData(0);
      let first = 0;
      while (first < ch.length && Math.abs(ch[first]) < 1e-4) first++;
      const loopStart = first / buffer.sampleRate;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.loopStart = loopStart;
      src.loopEnd = Math.min(buffer.duration, loopStart + MUSIC_LOOP_S);
      this.musicLevel = ctx.createGain();
      this.musicLevel.gain.value = 0;
      this.musicDuck = ctx.createGain();
      src.connect(this.musicLevel).connect(this.musicDuck).connect(this.master);
      src.start(this.now + 0.05, loopStart);
      this.musicLevel.gain.setTargetAtTime(this.mood === 'base' ? MUSIC_LEVEL.base : MUSIC_LEVEL.bonus, this.now, 0.9);
      this.ambience.gain.setTargetAtTime(AMBIENCE_UNDER_MUSIC, this.now, 0.9);
    } catch {
      /* no music (offline, blocked or undecodable): the synthesized ambience carries on alone */
    }
  }

  /** Dips the music to `depth` of its level for `hold` seconds, then brings it back over `release`. */
  private duck(depth: number, hold: number, release = 1.2) {
    if (!this.ctx || !this.musicDuck) return;
    const g = this.musicDuck.gain;
    const t = this.now;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(depth, t + 0.08);
    g.setValueAtTime(depth, t + hold);
    g.linearRampToValueAtTime(1, t + hold + release);
  }

  // ------------------------------------------------------------------- effects
  /** Reels start: a tape-transport whir that winds up. */
  spin() {
    this.hiss(0.55, { freq: 400, sweep: 1800, q: 1.2, gain: 0.05, attack: 0.06 });
    this.tone(70, 0.5, { type: 'sawtooth', gain: 0.025, glideTo: 140, attack: 0.08 });
  }

  /** One heavy thunk per reel as it lands, `stagger` seconds apart (matches the CSS landing). */
  land(delays: number[]) {
    delays.forEach((d, r) => {
      this.tone(96 - r * 4, 0.12, { gain: 0.16, glideTo: 50, delay: d });
      this.hiss(0.025, { freq: 2600, q: 3, gain: 0.035, delay: d });
    });
  }

  /** A reel spinning on because a bonus is close: a rising, wavering whine with a heartbeat under it. */
  tease(delay: number, dur: number) {
    this.tone(220, dur, { type: 'sawtooth', gain: 0.025, glideTo: 440, delay, attack: dur * 0.6 });
    this.tone(223, dur, { type: 'sawtooth', gain: 0.02, glideTo: 446, delay, attack: dur * 0.6 });
    this.hiss(dur, { freq: 900, sweep: 4200, q: 2, gain: 0.04, delay, attack: dur * 0.8 });
    for (let t = 0; t + 0.2 < dur; t += 0.42) this.tone(52, 0.18, { gain: 0.22, glideTo: 36, delay: delay + t });
  }

  /** The win counter passing into a higher tier: a hit and a bell chord, higher for every tier. */
  tierUp(level: number, delay = 0) {
    this.tone(60, 0.7, { gain: 0.4, glideTo: 30, delay });
    this.hiss(0.4, { freq: 400, q: 0.6, gain: 0.14, reverb: 0.7, delay });
    const root = 261.6 * Math.pow(2, (level * 3) / 12);
    [1, 1.189, 1.498, 2].forEach((m, i) => this.tone(root * m, 1.4, { type: 'triangle', gain: 0.05, delay: delay + 0.04 + i * 0.05, reverb: 0.6 }));
  }

  /** Win-screen jump scare: a static blast swelling into an impact and a screech, harsher per tier. */
  scare(level: number) {
    this.duck(0.15, 0.9, 0.8);
    this.hiss(0.32, { freq: 2600, q: 0.3, gain: 0.13 });
    this.hiss(0.3, { freq: 300, sweep: 5000, q: 1.4, gain: 0.1, attack: 0.28 });
    this.tone(46, 0.9, { type: 'sine', gain: 0.5, glideTo: 26, delay: 0.3 });
    this.hiss(0.5, { freq: 280, q: 0.5, gain: 0.18, delay: 0.3, reverb: 0.8 });
    const base = 1150 + level * 90;
    [0, 1.06, 1.12, 1.19].forEach((m, i) => this.tone(base * (m || 1), 0.5, { type: 'sawtooth', gain: 0.016 + level * 0.003, glideTo: base * 0.65, delay: 0.3 + i * 0.012, reverb: 0.6 }));
  }

  /** Random jump scares (purely cosmetic): a different sting for each kind. */
  randomScare(kind: 'face' | 'blackout' | 'hand' | 'widow' | 'glitch' | 'lunge') {
    switch (kind) {
      case 'face':
        this.duck(0.1, 0.6, 0.8);
        this.hiss(0.35, { freq: 2600, q: 0.3, gain: 0.16 });
        [1280, 1356, 1437].forEach((f, i) => this.tone(f, 0.45, { type: 'sawtooth', gain: 0.024, glideTo: f * 0.6, delay: 0.02 + i * 0.01, reverb: 0.6 }));
        this.tone(44, 0.6, { gain: 0.45, glideTo: 26 });
        break;
      case 'blackout':
        this.duck(0.03, 1.2, 1.2);
        this.tone(220, 0.5, { type: 'sawtooth', gain: 0.05, glideTo: 40 }); // power dies
        this.tone(58, 1.3, { type: 'sawtooth', gain: 0.07, delay: 0.5, attack: 0.3 }); // growl
        this.tone(61.5, 1.3, { type: 'sawtooth', gain: 0.06, delay: 0.5, attack: 0.3 });
        this.hiss(0.9, { freq: 220, q: 1.5, gain: 0.08, delay: 0.5, attack: 0.3 });
        break;
      case 'hand':
        this.duck(0.2, 0.5, 1);
        this.tone(70, 0.5, { gain: 0.6, glideTo: 32 });
        this.hiss(0.25, { freq: 900, q: 0.7, gain: 0.2, reverb: 0.4 });
        this.tone(2200, 0.9, { type: 'triangle', gain: 0.012, glideTo: 1500, delay: 0.15, reverb: 0.5 }); // glass creak
        break;
      case 'widow':
        this.duck(0.25, 1, 1);
        this.hiss(1.1, { freq: 1500, sweep: 3800, q: 6, gain: 0.07, attack: 0.5 }); // a whisper rushing past
        this.tone(660, 1.0, { type: 'sine', gain: 0.03, glideTo: 330, delay: 0.3, reverb: 0.8 });
        break;
      case 'glitch':
        this.duck(0.1, 0.6, 0.8);
        [180, 191, 203, 760, 805].forEach((f, i) => this.tone(f, 0.5, { type: 'square', gain: 0.02, glideTo: f * (i % 2 ? 1.6 : 0.5), delay: i * 0.02 }));
        this.hiss(0.5, { freq: 3000, q: 0.3, gain: 0.12 });
        break;
      case 'lunge':
        this.duck(0.1, 0.7, 0.9);
        this.tone(48, 0.8, { gain: 0.55, glideTo: 26 });
        this.hiss(0.5, { freq: 260, q: 0.5, gain: 0.2, reverb: 0.8 });
        [1180, 1255, 1322, 1408].forEach((f, i) => this.tone(f, 0.6, { type: 'sawtooth', gain: 0.022, glideTo: f * 0.7, delay: 0.05 + i * 0.015, reverb: 0.6 }));
        break;
    }
  }

  /** One tick of the win counter. */
  tick(pitch: number) {
    this.tone(1400 + pitch * 900, 0.05, { type: 'square', gain: 0.012 });
  }

  /** Static resolves into a symbol. */
  reveal() {
    this.hiss(0.16, { freq: 3200, q: 0.6, gain: 0.09, attack: 0.002 });
    this.tone(420, 0.25, { type: 'triangle', gain: 0.05, glideTo: 840, delay: 0.08, reverb: 0.3 });
  }

  /** Retune: the dial sweeps through stations, with a heterodyne whistle. */
  retune() {
    this.hiss(0.7, { freq: 300, sweep: 3200, q: 4, gain: 0.08, attack: 0.05 });
    this.tone(2400, 0.65, { type: 'sine', gain: 0.025, glideTo: 520, attack: 0.05 });
    for (let i = 0; i < 4; i++) this.hiss(0.05, { freq: 900 + i * 500, q: 8, gain: 0.05, delay: 0.12 + i * 0.13 });
  }

  /** Antennas: a beacon ping per Antenna, rising, in the big room. */
  antenna(n: number) {
    for (let i = 0; i < Math.min(n, 6); i++) this.tone(660 * Math.pow(2, i / 6), 0.45, { type: 'sine', gain: 0.07, delay: i * 0.11, reverb: 0.7 });
  }

  /** Tube-radio bell: inharmonic partials, more notes for bigger wins. */
  win(x100: number) {
    const notes = x100 >= 2000 ? 6 : x100 >= 300 ? 4 : x100 >= 100 ? 2 : 1;
    const scale = [0, 3, 7, 10, 12, 15];
    for (let i = 0; i < notes; i++) {
      const f = 392 * Math.pow(2, scale[i] / 12);
      for (const [mult, g] of [[1, 0.08], [2.76, 0.03], [5.4, 0.012]] as const) this.tone(f * mult, 0.9, { gain: g, delay: i * 0.08, reverb: 0.4 });
    }
  }

  /** The Unmarked Tape: deck clunk, motor, hiss. */
  tape() {
    this.tone(70, 0.12, { type: 'square', gain: 0.08, glideTo: 45 });
    this.hiss(0.05, { freq: 1800, q: 2, gain: 0.08 });
    this.tone(118, 1.2, { type: 'sawtooth', gain: 0.02, delay: 0.15, attack: 0.2 });
    this.hiss(1.4, { freq: 5000, q: 0.4, gain: 0.03, delay: 0.15, attack: 0.3 });
  }

  /** Bonus start: static blast, a reversed swell into the face lunge, an impact and a screech. */
  intercept() {
    this.duck(0.06, 2.6, 2);
    this.hiss(1.0, { freq: 2500, q: 0.3, gain: 0.14, attack: 0.01 });
    this.hiss(1.25, { freq: 200, sweep: 4000, q: 1.5, gain: 0.12, attack: 1.2, delay: 0.1 });
    this.tone(55, 2.2, { type: 'sawtooth', gain: 0.06, delay: 0.1, attack: 0.6 });
    this.tone(58.3, 2.2, { type: 'sawtooth', gain: 0.05, delay: 0.1, attack: 0.6 });
    this.tone(48, 1.2, { type: 'sine', gain: 0.5, glideTo: 28, delay: 1.36 });
    this.hiss(0.6, { freq: 300, q: 0.5, gain: 0.2, delay: 1.36, reverb: 0.8 });
    [1180, 1255, 1322, 1408].forEach((f, i) => this.tone(f, 0.55, { type: 'sawtooth', gain: 0.02, glideTo: f * 0.7, delay: 1.36 + i * 0.015, reverb: 0.6 }));
    [196, 185, 174.6].forEach((f, i) => this.tone(f, 0.9, { type: 'triangle', gain: 0.045, delay: 1.7 + i * 0.25, reverb: 0.5 }));
  }

  /** Big win: a swelling minor pad with bells over it. */
  bigWin() {
    this.duck(0.5, 3);
    [196, 233.1, 293.7, 392].forEach((f) => {
      this.tone(f, 2.6, { type: 'sawtooth', gain: 0.03, attack: 0.6, reverb: 0.5 });
      this.tone(f * 1.003, 2.6, { type: 'sawtooth', gain: 0.025, attack: 0.6 });
    });
    this.win(5000);
  }
}

export const audio = new Audio();
