// Web Audio API Sound Generator for Real-Time Delivery Notifications
// Self-contained: playback still requires the browser's audio permission.

let audioCtx: AudioContext | null = null;
let soundEnabled = true;

// Mute state for order alarms (persisted in localStorage)
let isMutedState = false;
if (typeof window !== 'undefined') {
  try {
    isMutedState = localStorage.getItem('admin_orders_sound_muted') === 'true';
  } catch (e) {}
}

let alertLoopTimer: ReturnType<typeof setInterval> | null = null;
let isLoopRunning = false;
let releaseLoopOwnership: (() => void) | null = null;
let ownershipAbort: AbortController | null = null;
let loopGeneration = 0;
let currentChimeUntil = 0;
const activeChimeNodes = new Set<OscillatorNode>();
const muteUntilKey = 'admin_orders_sound_muted_until';
let muteUntilState = 0;
export const ORDER_SOUND_EVENT = 'order-sound-state';

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

export function getAudioContextState(): AudioContextState | 'unsupported' {
  if (typeof window === 'undefined') return 'unsupported';
  if (audioCtx) return audioCtx.state;
  return window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext ? 'suspended' : 'unsupported';
}

export async function unlockAudio(): Promise<boolean> {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') await ctx.resume();
    return ctx.state === 'running';
  } catch { return false; }
}

export function enableAudio() {
  soundEnabled = true;
  unlockAudio();
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }
}

export function isAudioEnabled(): boolean {
  return soundEnabled;
}

export function setOrderSoundMuted(muted: boolean): void {
  isMutedState = muted;
  muteUntilState = 0;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('admin_orders_sound_muted', muted ? 'true' : 'false');
      localStorage.removeItem(muteUntilKey);
    } catch (e) {}
  }
  if (muted) stopCurrentOrderChime();
  notifySoundState();
}

export function isOrderSoundMuted(): boolean {
  try {
    if (typeof window !== 'undefined') isMutedState = localStorage.getItem('admin_orders_sound_muted') === 'true';
  } catch {}
  return isMutedState || getOrderSoundMuteUntil() > Date.now();
}

export function getOrderSoundMuteUntil(): number {
  try {
    if (typeof window !== 'undefined') muteUntilState = Number(localStorage.getItem(muteUntilKey)) || 0;
  } catch {}
  return muteUntilState;
}

export function muteOrderSoundTemporarily(durationMs = 5 * 60 * 1000): void {
  isMutedState = false;
  muteUntilState = Date.now() + durationMs;
  try {
    localStorage.setItem('admin_orders_sound_muted', 'false');
    localStorage.setItem(muteUntilKey, String(muteUntilState));
  } catch {}
  stopCurrentOrderChime();
  notifySoundState();
}

function notifySoundState() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ORDER_SOUND_EVENT));
}

function trackChimeNode(node: OscillatorNode) {
  activeChimeNodes.add(node);
  node.onended = () => { activeChimeNodes.delete(node); node.disconnect(); };
}

function stopCurrentOrderChime() {
  for (const node of activeChimeNodes) {
    try { node.stop(); node.disconnect(); } catch {}
  }
  activeChimeNodes.clear();
  currentChimeUntil = 0;
}

export function isOrderAlertLoopActive(): boolean {
  return isLoopRunning;
}

/**
 * High-definition, professional multi-tone delivery bell chime (~2.4s)
 * Warm, resonant, highly perceptible without being abrasive.
 * Four-tone pos chime (D5 -> F#5 -> A5 -> D6) + double harmonic sustain chord.
 */
export function playOrderAlertChime() {
  if (isOrderSoundMuted()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx || !soundEnabled || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    if (now < currentChimeUntil) return;
    currentChimeUntil = now + 2.1;

    // Master bus gain
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.7, now);
    masterGain.connect(ctx.destination);

    // Chime notes: D5 (587Hz), F#5 (740Hz), A5 (880Hz), D6 (1175Hz)
    const notes = [
      { freq: 587.33, start: 0.00, dur: 0.55, vol: 0.35, type: 'sine' as OscillatorType },
      { freq: 739.99, start: 0.14, dur: 0.55, vol: 0.38, type: 'sine' as OscillatorType },
      { freq: 880.00, start: 0.28, dur: 0.60, vol: 0.42, type: 'sine' as OscillatorType },
      { freq: 1174.66, start: 0.42, dur: 0.95, vol: 0.50, type: 'triangle' as OscillatorType },
    ];

    notes.forEach(({ freq, start, dur, vol, type }) => {
      const osc = ctx.createOscillator();
      trackChimeNode(osc);
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + start);

      // Subtle vibrato shimmer on the higher tones
      if (freq > 800) {
        const vibrato = ctx.createOscillator();
        trackChimeNode(vibrato);
        const vibGain = ctx.createGain();
        vibrato.frequency.setValueAtTime(5.5, now + start);
        vibGain.gain.setValueAtTime(3.0, now + start);
        vibrato.connect(vibGain);
        vibGain.connect(osc.frequency);
        vibrato.start(now + start);
        vibrato.stop(now + start + dur);
      }

      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(vol, now + start + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + start + dur);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now + start);
      osc.stop(now + start + dur);
    });

    // Secondary warm harmonic bell strike at +0.70s for sustained restaurant ambiance
    const chordNotes = [880.0, 1318.5]; // A5 + E6
    chordNotes.forEach((freq, idx) => {
      const chordOsc = ctx.createOscillator();
      trackChimeNode(chordOsc);
      const chordGain = ctx.createGain();
      const chordStart = now + 0.72 + idx * 0.06;

      chordOsc.type = 'sine';
      chordOsc.frequency.setValueAtTime(freq, chordStart);

      chordGain.gain.setValueAtTime(0, chordStart);
      chordGain.gain.linearRampToValueAtTime(0.28, chordStart + 0.04);
      chordGain.gain.exponentialRampToValueAtTime(0.0005, chordStart + 1.2);

      chordOsc.connect(chordGain);
      chordGain.connect(masterGain);

      chordOsc.start(chordStart);
      chordOsc.stop(chordStart + 1.25);
      if (idx === chordNotes.length - 1) {
        chordOsc.onended = () => {
          activeChimeNodes.delete(chordOsc);
          chordOsc.disconnect();
          masterGain.disconnect();
        };
      }
    });
  } catch (err) {
    console.warn('Audio playback notice:', err);
  }
}

/**
 * Starts continuous repeating alert loop as long as pending orders exist.
 * Interval defaults to 7 seconds.
 */
export function startOrderAlertLoop(intervalMs = 7000, scope = 'default') {
  if (isLoopRunning) return;
  isLoopRunning = true;
  const generation = ++loopGeneration;
  const current = () => isLoopRunning && generation === loopGeneration;
  const period = Math.max(3000, intervalMs);
  const key = `novaesweb-order-alert:${scope}`;
  const runOwned = () => {
    if (!current()) return Promise.resolve();
    playOrderAlertChime();
    alertLoopTimer = setInterval(() => { if (current()) playOrderAlertChime(); }, period);
    return new Promise<void>(resolve => {
      releaseLoopOwnership = () => {
        if (alertLoopTimer) clearInterval(alertLoopTimer);
        alertLoopTimer = null;
        stopCurrentOrderChime();
        resolve();
      };
    });
  };
  if (typeof navigator !== 'undefined' && navigator.locks) {
    ownershipAbort = new AbortController();
    void navigator.locks.request(key, { signal: ownershipAbort.signal }, runOwned).catch(error => {
      if (current() && error?.name !== 'AbortError') startLease();
    });
  } else startLease();

  // Lease fallback for browsers without Web Locks. Confirm ownership before each
  // strike; if storage is blocked, only the focused tab may produce audio.
  function startLease() {
    if (!current()) return;
    const token = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    let lastStrike = -Infinity;
    let candidateSince = 0;
    const tick = () => {
      if (!current()) return;
      const now = Date.now();
      try {
        const saved = JSON.parse(localStorage.getItem(key) || 'null');
        if (saved?.token !== token && saved?.expires > now) return;
        if (saved?.token !== token) {
          localStorage.setItem(key, JSON.stringify({ token, expires: now + 5000 }));
          candidateSince = now;
          return;
        }
        localStorage.setItem(key, JSON.stringify({ token, expires: now + 5000 }));
        if (now - candidateSince < 500) return;
      } catch {
        if (typeof document === 'undefined' || !document.hasFocus()) return;
      }
      if (now - lastStrike >= period) {
        playOrderAlertChime();
        lastStrike = now;
      }
    };
    tick();
    alertLoopTimer = setInterval(tick, 1000);
    releaseLoopOwnership = () => {
      if (alertLoopTimer) clearInterval(alertLoopTimer);
      alertLoopTimer = null;
      try {
        if (JSON.parse(localStorage.getItem(key) || 'null')?.token === token) localStorage.removeItem(key);
      } catch {}
      stopCurrentOrderChime();
    };
  }
}

/**
 * Stops continuous alert loop immediately.
 */
export function stopOrderAlertLoop() {
  isLoopRunning = false;
  loopGeneration += 1;
  ownershipAbort?.abort();
  ownershipAbort = null;
  releaseLoopOwnership?.();
  releaseLoopOwnership = null;
  if (alertLoopTimer) {
    clearInterval(alertLoopTimer);
    alertLoopTimer = null;
  }
  stopCurrentOrderChime();
}

/**
 * Ding-Dong Doorbell / New Order Chime (Backwards compatibility)
 */
export function playNewOrderSound() {
  playOrderAlertChime();
}

/**
 * Urgent Order Warning Sound (Backwards compatibility)
 */
export function playUrgentOrderSound() {
  playOrderAlertChime();
}

/**
 * Success / Cash Register Sound
 */
export function playSuccessSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx || !soundEnabled) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.35);
    });
  } catch (err) {
    console.warn('Success sound failed:', err);
  }
}

/**
 * Clean Two-Tone Bell Chime for Real-Time Status Transitions
 */
export function playStatusChangeSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx || !soundEnabled) return;

    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.2, now + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.15); // A5
    gain2.gain.setValueAtTime(0, now + 0.15);
    gain2.gain.linearRampToValueAtTime(0.25, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.7);
  } catch (err) {
    console.warn('Status audio playback not allowed yet:', err);
  }
}

