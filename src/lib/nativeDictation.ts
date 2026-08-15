/**
 * พูดให้พิมพ์ในแอปมือถือกลางฮับ (Capacitor — โปรเจกต์ glangApp)
 *
 * Web Speech API มักไม่ทำงานใน Android WebView — ใช้ native plugin
 * @capacitor-community/speech-recognition แทน (แอปฉีด bridge เข้า WebView)
 */

import { isGlanghubApp } from '@/lib/nativeAuth';

/** ปิดไมค์อัตโนมัติเมื่อไม่มีเสียงพูด (วินาที) */
export const NATIVE_DICTATION_SILENCE_SEC = 10;

const LANGUAGE_CANDIDATES = ['th-TH', 'th_TH', 'en-US'];
/** รอให้ session ก่อนหน้าปิดสนิทก่อนเปิดใหม่ — กันไมค์ซ้อน / recognizer busy */
const SESSION_COOLDOWN_MS = 480;
const BUSY_RETRY_MS = 900;

type PermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';

type SpeechRecognitionPlugin = {
  available(): Promise<{ available: boolean }>;
  start(opts: {
    language: string;
    maxResults?: number;
    partialResults?: boolean;
    popup?: boolean;
    prompt?: string;
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
  let plugin = getSpeechRecognitionPlugin();
  let active = false;
  let loopRunning = false;
  let toggleBusy = false;
  /** เปลี่ยนทุกครั้งที่ stop — loop รุ่นเก่าจะหยุดทำงาน */
  let generation = 0;
  let languageIndex = 0;
  let silenceTimer: number | null = null;
  let noMatchStreak = 0;

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
      void stop();
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

  async function forceIdle() {
    plugin = getSpeechRecognitionPlugin();
    if (!plugin) return;
    try {
      await plugin.stop();
    } catch { /* ignore */ }
    const deadline = Date.now() + 2500;
    while (Date.now() < deadline) {
      try {
        const { listening } = await plugin.isListening();
        if (!listening) break;
      } catch {
        break;
      }
      await sleep(120);
    }
    await sleep(SESSION_COOLDOWN_MS);
  }

  async function listenOnce(gen: number): Promise<'ok' | 'stop' | 'retry'> {
    if (!active || gen !== generation) return 'stop';
    plugin = getSpeechRecognitionPlugin();
    if (!plugin) return 'stop';

    await forceIdle();
    if (!active || gen !== generation) return 'stop';

    callbacks.setInterim('…');
    try {
      const result = await plugin.start({
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
        plugin = getSpeechRecognitionPlugin();
        if (!plugin) {
          callbacks.setMicHint('ไม่พบ speech plugin — อัปเดตแอปเป็นเวอร์ชันล่าสุด');
          await stop();
          break;
        }

        const outcome = await listenOnce(gen);
        if (!active || gen !== generation || outcome === 'stop') break;
        if (outcome === 'retry') {
          await sleep(BUSY_RETRY_MS);
          continue;
        }
        await sleep(SESSION_COOLDOWN_MS);
      }
    } finally {
      loopRunning = false;
      if (gen === generation) callbacks.setInterim('');
    }
  }

  async function start(): Promise<boolean> {
    if (active || toggleBusy) return active;
    toggleBusy = true;
    try {
      plugin = getSpeechRecognitionPlugin();
      if (!plugin) {
        callbacks.setMicHint('ไม่พบ speech plugin — อัปเดตแอปเป็นเวอร์ชันล่าสุด');
        return false;
      }
      try {
        const avail = await plugin.available();
        if (!avail.available) {
          callbacks.setMicHint('อุปกรณ์นี้ไม่รองรับการรู้จำเสียงพูด (ต้องมี Google app)');
          return false;
        }
        const perm = await plugin.requestPermissions();
        if (perm.speechRecognition !== 'granted') {
          callbacks.setMicHint('กรุณาอนุญาตไมโครโฟนในแอป แล้วลองใหม่');
          return false;
        }
      } catch {
        callbacks.setMicHint('ไม่สามารถขอสิทธิ์ไมโครโฟนได้ — ลองใหม่อีกครั้ง');
        return false;
      }

      await forceIdle();

      generation += 1;
      const gen = generation;
      active = true;
      languageIndex = 0;
      noMatchStreak = 0;
      callbacks.setMicHint('');
      callbacks.setListening(true);
      resetSilenceTimer();
      void listenLoop(gen);
      return true;
    } finally {
      toggleBusy = false;
    }
  }

  async function stop() {
    if (toggleBusy) await sleep(80);
    generation += 1;
    active = false;
    clearSilenceTimer();
    callbacks.setInterim('');
    callbacks.setListening(false);
    await forceIdle();
  }

  async function toggle() {
    if (toggleBusy) return;
    toggleBusy = true;
    try {
      if (active) {
        callbacks.setMicHint('');
        await stop();
        return;
      }
      await start();
    } finally {
      toggleBusy = false;
    }
  }

  async function destroy() {
    await stop();
  }

  return { toggle, stop, destroy, silenceSec: NATIVE_DICTATION_SILENCE_SEC };
}
