/**
 * พูดให้พิมพ์ในแอปมือถือกลางฮับ (Capacitor — โปรเจกต์ glangApp)
 */

import { isGlanghubApp } from '@/lib/nativeAuth';

/** ปิดไมค์อัตโนมัติเมื่อไม่มีเสียงพูด (วินาที) */
export const NATIVE_DICTATION_SILENCE_SEC = 10;

const LANGUAGE_CANDIDATES = ['th-TH', 'th_TH', 'en-US'];
const BETWEEN_SESSION_MS = 380;

type PermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';

type SpeechRecognitionPlugin = {
  available(): Promise<{ available: boolean }>;
  start(opts: {
    language: string;
    maxResults?: number;
    partialResults?: boolean;
    popup?: boolean;
  }): Promise<{ matches?: string[] }>;
  stop(): Promise<void>;
  isListening(): Promise<{ listening: boolean }>;
  requestPermissions(): Promise<{ speechRecognition: PermissionState }>;
};

function sleep(ms: number) {
  return new Promise<void>(resolve => window.setTimeout(resolve, ms));
}

function pickMatch(data: { matches?: unknown }): string {
  const m = data.matches;
  if (Array.isArray(m) && typeof m[0] === 'string') return m[0].trim();
  return '';
}

function getCapacitorPlugins(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor;
  return cap?.Plugins ?? null;
}

export function getSpeechRecognitionPlugin(): SpeechRecognitionPlugin | null {
  const plugins = getCapacitorPlugins();
  if (!plugins) return null;
  return (plugins.SpeechRecognition as SpeechRecognitionPlugin | undefined) ?? null;
}

export function isNativeDictationAvailable(): boolean {
  return isGlanghubApp() && getSpeechRecognitionPlugin() != null;
}

export type NativeDictationCallbacks = {
  append: (text: string) => void;
  setInterim: (text: string) => void;
  setListening: (on: boolean) => void;
  setMicHint: (hint: string) => void;
};

function errorHint(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (/network/i.test(msg)) return 'เครือข่ายขัดข้อง — ตรวจสอบเน็ตและ Google Play services';
  if (/permission|insufficient/i.test(msg)) return 'กรุณาอนุญาตไมโครโฟนในแอป แล้วลองใหม่';
  if (/not available|unavailable/i.test(msg)) return 'อุปกรณ์นี้ไม่รองรับการรู้จำเสียงพูด';
  if (/busy/i.test(msg)) return 'ระบบฟังเสียงไม่ว่าง — ลองอีกครั้ง';
  return '';
}

/** ควบคุม native speech — แตะเปิด/ปิด + ปิดอัตโนมัติเมื่อเงียบ */
export function createNativeDictation(callbacks: NativeDictationCallbacks) {
  let active = false;
  let loopRunning = false;
  let toggling = false;
  let generation = 0;
  let languageIndex = 0;
  let silenceTimer: number | null = null;
  let noMatchStreak = 0;

  function plugin() {
    return getSpeechRecognitionPlugin();
  }

  function clearSilenceTimer() {
    if (silenceTimer != null) {
      window.clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  }

  function resetSilenceTimer() {
    clearSilenceTimer();
    if (!active) return;
    silenceTimer = window.setTimeout(() => {
      callbacks.setMicHint(`ปิดไมค์อัตโนมัติ — ไม่ได้ยินเสียง ${NATIVE_DICTATION_SILENCE_SEC} วินาที`);
      void stopInternal();
    }, NATIVE_DICTATION_SILENCE_SEC * 1000);
  }

  function currentLanguage() {
    return LANGUAGE_CANDIDATES[languageIndex] ?? LANGUAGE_CANDIDATES[0];
  }

  function appendText(text: string) {
    const t = text.trim();
    if (!t) return;
    noMatchStreak = 0;
    resetSilenceTimer();
    callbacks.append(t);
  }

  async function releaseMic() {
    const p = plugin();
    if (!p) return;
    try {
      await p.stop();
    } catch { /* ignore */ }
    for (let i = 0; i < 8; i += 1) {
      try {
        const { listening } = await p.isListening();
        if (!listening) break;
      } catch {
        break;
      }
      await sleep(100);
    }
    await sleep(BETWEEN_SESSION_MS);
  }

  async function listenOnce(gen: number): Promise<'ok' | 'stop' | 'retry'> {
    if (!active || gen !== generation) return 'stop';
    const p = plugin();
    if (!p) return 'stop';

    await releaseMic();
    if (!active || gen !== generation) return 'stop';

    callbacks.setInterim('…');
    try {
      const result = await p.start({
        language: currentLanguage(),
        maxResults: 1,
        partialResults: false,
        popup: false,
      });
      if (!active || gen !== generation) return 'stop';

      callbacks.setInterim('');
      const text = pickMatch(result);
      if (text) appendText(text);
      else noMatchStreak += 1;
      return 'ok';
    } catch (err) {
      if (!active || gen !== generation) return 'stop';
      callbacks.setInterim('');
      const msg = err instanceof Error ? err.message : String(err ?? '');
      if (/busy/i.test(msg)) return 'retry';
      if (/no match|no speech|didn't understand/i.test(msg)) {
        noMatchStreak += 1;
        if (noMatchStreak >= 6 && languageIndex < LANGUAGE_CANDIDATES.length - 1) {
          languageIndex += 1;
          noMatchStreak = 0;
          callbacks.setMicHint(`สลับภาษาเป็น ${currentLanguage()} — ลองพูดอีกครั้ง`);
        }
        return 'ok';
      }
      const hint = errorHint(err);
      if (hint) callbacks.setMicHint(hint);
      return 'ok';
    }
  }

  async function listenLoop(gen: number) {
    if (loopRunning) return;
    loopRunning = true;
    try {
      while (active && gen === generation) {
        if (!plugin()) {
          callbacks.setMicHint('ไม่พบ speech plugin — อัปเดตแอปเป็นเวอร์ชันล่าสุด');
          await stopInternal();
          break;
        }
        const outcome = await listenOnce(gen);
        if (!active || gen !== generation || outcome === 'stop') break;
        if (outcome === 'retry') {
          await sleep(700);
          continue;
        }
        await sleep(BETWEEN_SESSION_MS);
      }
    } finally {
      loopRunning = false;
      if (gen === generation) callbacks.setInterim('');
    }
  }

  async function startInternal(): Promise<boolean> {
    if (active) return true;
    const p = plugin();
    if (!p) {
      callbacks.setMicHint('ไม่พบ speech plugin — อัปเดตแอปเป็นเวอร์ชันล่าสุด');
      return false;
    }

    callbacks.setListening(true);
    callbacks.setInterim('กำลังเปิดไมค์…');
    callbacks.setMicHint('');

    try {
      const avail = await p.available();
      if (!avail.available) {
        callbacks.setMicHint('อุปกรณ์นี้ไม่รองรับการรู้จำเสียงพูด (ต้องมี Google app)');
        callbacks.setListening(false);
        callbacks.setInterim('');
        return false;
      }
      const perm = await p.requestPermissions();
      if (perm.speechRecognition !== 'granted') {
        callbacks.setMicHint('กรุณาอนุญาตไมโครโฟนในแอป แล้วลองใหม่');
        callbacks.setListening(false);
        callbacks.setInterim('');
        return false;
      }
    } catch {
      callbacks.setMicHint('ไม่สามารถขอสิทธิ์ไมโครโฟนได้ — ลองใหม่อีกครั้ง');
      callbacks.setListening(false);
      callbacks.setInterim('');
      return false;
    }

    generation += 1;
    const gen = generation;
    active = true;
    languageIndex = 0;
    noMatchStreak = 0;
    callbacks.setInterim('');
    resetSilenceTimer();
    void listenLoop(gen);
    return true;
  }

  async function stopInternal() {
    generation += 1;
    active = false;
    clearSilenceTimer();
    callbacks.setInterim('');
    callbacks.setListening(false);
    await releaseMic();
  }

  async function toggle() {
    if (toggling) return;
    toggling = true;
    try {
      if (active) {
        callbacks.setMicHint('');
        await stopInternal();
        return;
      }
      await startInternal();
    } finally {
      toggling = false;
    }
  }

  async function destroy() {
    await stopInternal();
  }

  return { toggle, stop: stopInternal, destroy, silenceSec: NATIVE_DICTATION_SILENCE_SEC };
}
