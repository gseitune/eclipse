"use client";

import { useEffect, useRef } from "react";
import { liveMatchIds } from "./live";
import type { StateSnapshot } from "./types";

// ── Module-level sound toggle (session-local, shared by all consumers) ──
let _soundEnabled = true;

export function isSoundEnabled(): boolean {
  return _soundEnabled;
}

export function setSoundEnabled(v: boolean): void {
  _soundEnabled = v;
}

// ── Audio context + unlock state ──
let audioCtx: AudioContext | null = null;
let audioLocked = true;
const pendingChimes: number[] = [];
let unlockHandlerRegistered = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function registerUnlockHandlers(): void {
  if (typeof window === "undefined" || unlockHandlerRegistered) return;
  unlockHandlerRegistered = true;
  const handler = () => {
    if (audioLocked) {
      audioLocked = false;
      const ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      // Drain pending chimes
      while (pendingChimes.length > 0) {
        const freq = pendingChimes.shift()!;
        playBeep(freq);
      }
    }
  };
  document.addEventListener("pointerdown", handler, { once: false });
  document.addEventListener("keydown", handler, { once: false });
}

function playBeep(freq: number = 880): void {
  const ctx = getAudioContext();
  if (!ctx || !_soundEnabled) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.value = 0.2;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.start(now);
  osc.stop(now + 0.3);
}

/**
 * Play a short, pleasant notification ping (two-tone sine beep, ~300-500ms total, low volume).
 * If audio is still locked, the chime is queued and played on the next user gesture.
 * If AudioContext is unavailable (SSR, weird env), no-ops silently.
 */
export function chime(): void {
  if (typeof window === "undefined") return;
  registerUnlockHandlers();

  if (audioLocked) {
    // Queue for next user gesture
    pendingChimes.push(880);
    pendingChimes.push(1100);
    return;
  }

  if (!_soundEnabled) return;

  playBeep(880);
  setTimeout(() => playBeep(1100), 120);
}

// ── Pure function: detect new live match IDs ──
/**
 * Return the array of match IDs present in `next` but not in `prev`.
 * Order follows insertion order of `next`.
 */
export function detectNewLive(prev: Set<string>, next: Set<string>): string[] {
  const result: string[] = [];
  for (const id of next) {
    if (!prev.has(id)) {
      result.push(id);
    }
  }
  return result;
}

// ── React hook ──
export function useChime(options?: {
  state: StateSnapshot | null;
  matchMinutes?: number;
  onNewLive?: (matchId: string) => void;
}): { soundEnabled: boolean; setSoundEnabled: (v: boolean) => void } {
  const { state, matchMinutes = 20, onNewLive } = options ?? {};
  const prevLiveRef = useRef<Set<string>>(new Set());
  const onNewLiveRef = useRef(onNewLive);
  useEffect(() => {
    onNewLiveRef.current = onNewLive;
  });

  useEffect(() => {
    if (!state) return;
    const currentLive = liveMatchIds(state.schedule, matchMinutes);
    const newIds = detectNewLive(prevLiveRef.current, currentLive);

    if (newIds.length > 0) {
      for (const id of newIds) {
        chime();
        onNewLiveRef.current?.(id);
      }
    }

    prevLiveRef.current = currentLive;
  }, [state, matchMinutes]);

  return {
    soundEnabled: _soundEnabled,
    setSoundEnabled: (v: boolean) => { _soundEnabled = v; },
  };
}
