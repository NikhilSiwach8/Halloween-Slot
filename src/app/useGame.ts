import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../audio/AudioManager';
import type { ClockmakerPath } from '../config/types';
import type { ForceOption, StepResult } from '../engine/GameEngine';
import type { PlatformAdapter } from '../platform/PlatformAdapter';
import { eventDuration, eventSound, initialDisplay, reduceEvent, type DisplayState } from './presentation';

export type Speed = 'normal' | 'fast' | 'instant';

export interface Settings {
  volume: number;
  muted: boolean;
  reducedMotion: boolean;
  speed: Speed;
}

const SETTINGS_KEY = 'hollow-hour:settings:v1';

/** Settings are the ONLY thing persisted locally (never balances or outcomes). */
export function loadSettings(defaults: Settings): Settings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

function saveSettings(s: Settings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: settings stay in memory */
  }
}

const SPEED_FACTOR: Record<Speed, number> = { normal: 1, fast: 0.4, instant: 0 };

export function useGame(adapter: PlatformAdapter, initialSettings: Settings) {
  const cfg = adapter.config;
  const [display, setDisplay] = useState<DisplayState>(() => initialDisplay(adapter.getState(), cfg));
  const [settings, setSettingsState] = useState<Settings>(initialSettings);
  const [bet, setBet] = useState(cfg.defaultBet);
  const [error, setError] = useState<string | null>(null);
  const skipRef = useRef(false);
  const busyRef = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    audio.setVolume(settings.volume);
    audio.setMuted(settings.muted);
    saveSettings(settings);
  }, [settings]);

  const setSettings = useCallback((patch: Partial<Settings>) => setSettingsState((s) => ({ ...s, ...patch })), []);

  const play = useCallback(async (step: StepResult) => {
    for (const ev of step.events) {
      setDisplay((d) => reduceEvent(d, ev, cfg));
      const sound = eventSound(ev);
      if (sound && !skipRef.current) audio.play(sound);
      const s = settingsRef.current;
      // Reduced motion keeps every state visible long enough to read, but drops movement (CSS handles that).
      const factor = skipRef.current ? 0 : SPEED_FACTOR[s.speed] * (s.reducedMotion ? 0.8 : 1);
      const ms = eventDuration(ev) * factor;
      if (ms > 0) await new Promise((r) => setTimeout(r, ms));
    }
    skipRef.current = false;
    const snap = adapter.getState();
    // Re-sync with the authoritative engine state after the animation queue drains.
    setDisplay((d) => ({
      ...d, busy: false, awaiting: snap.awaiting, balance: snap.balance, debt: snap.debt, debtState: snap.debtState,
      echoes: snap.echoes, recentEchoes: snap.recentEchoes, board: snap.board ?? d.board,
      uiPhase: snap.phase, banner: snap.awaiting === 'SPIN' ? d.banner : d.banner,
      marks: snap.awaiting === 'SPIN' ? {} : d.marks,
    }));
    busyRef.current = false;
  }, [adapter, cfg]);

  const run = useCallback(async (fn: () => Promise<StepResult>) => {
    if (busyRef.current) return; // the UI cannot overlap requests; the engine also rejects them
    busyRef.current = true;
    setError(null);
    setDisplay((d) => ({ ...d, busy: true }));
    audio.unlock();
    try {
      await play(await fn());
    } catch (e) {
      busyRef.current = false;
      setError(e instanceof Error ? e.message : String(e));
      setDisplay((d) => ({ ...d, busy: false, awaiting: adapter.getState().awaiting }));
    }
  }, [adapter, play]);

  const spin = useCallback((force?: ForceOption) => run(() => adapter.spin(bet, force)), [adapter, bet, run]);
  const choose = useCallback((path: ClockmakerPath) => run(() => adapter.chooseClockmakerPath(path)), [adapter, run]);
  const playBonusStage = useCallback(() => run(() => adapter.playBonusStage()), [adapter, run]);
  const skip = useCallback(() => {
    if (busyRef.current) skipRef.current = true;
  }, []);

  const canSpin = !display.busy && display.awaiting === 'SPIN' && display.balance >= bet;

  return useMemo(
    () => ({ cfg, display, settings, setSettings, bet, setBet, spin, choose, playBonusStage, skip, canSpin, error, setError }),
    [cfg, display, settings, setSettings, bet, spin, choose, playBonusStage, skip, canSpin, error],
  );
}

export type GameApi = ReturnType<typeof useGame>;
