/**
 * พูดให้พิมพ์ในแอpมือถือกลางฮับ (Capacitor — @capacitor-community/speech-recognition)
 */

import { isGlanghubApp } from '@/lib/nativeAuth';

export const NATIVE_DICTATION_SILENCE_SEC = 10;

const LANGUAGE_CANDIDATES = ['th-TH', 'th_TH', 'en-US'];

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

let pluginPromise: Promise<SpeechRecognitionPlugin | null> | null = null;

/** โหลด plugin ผ่าน registerPlugin — listener จาก Capacitor.Plugins มักไม่ทำงานใน WebView */
async function loadSpeechPlugin(): Promise<SpeechRecognitionPlugin | null> {
  if (!isGlanghubApp()) return null;

  try {
    const mod = await import('@capacitor-community/speech-recognition');
    return mod.SpeechRecognition as unknown as SpeechRecognitionPlugin;
  } catch {
    const cap = (window as unknown as {
      Capacitor?: { Plugins?: Record<string, unknown>; getPlugin?: (n: string) => unknown };
    }).Capacitor;
    if (!cap) return null;
    const fromPlugins = cap.Plugins?.SpeechRecognition as SpeechRecognitionPlugin | undefined;
    if (fromPlugins) return fromPlugins;
    try {
      return cap.getPlugin?.('SpeechRecognition') as SpeechRecognitionPlugin | undefined ?? null;
    } catch {
      return null;
    }
  }
}

export function getSpeechRecognitionPlugin(): SpeechRecognitionPlugin | null {
  if (!isGlanghubApp()) return null;
  const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor;
  return (cap?.Plugins?.SpeechRecognition as SpeechRecognitionPlugin | undefined) ?? null;
}

async function getSpeechPluginAsync(): Promise<SpeechRecognitionPlugin | null> {
  if (!pluginPromise) pluginPromise = loadSpeechPlugin();
  return pluginPromise;
}

/** ในแอp ถือว่ามี native dictation — plugin โหลดตอนกดไมค์ */
export function isNativeDictationAvailable(): boolean {
  return isGlanghubApp();
}

export type NativeDictationCallbacks = {
  append: (text: string) => void;
  setInterim: (text: string) => void;
  setListening: (on: boolean) => void;
  setMicHint: (hint: string) => void;
};

function errorHint(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (/network/i.test(msg)) return 'เครือข่ายขัดข้อง — ตรวจสอบเน็ตและ Google app';
  if (/permission|insufficient|not allowed/i.test(msg)) return 'กรุณาอนุญาตไมโครโฟนในแอp แล้วลองใหม่';
  if (/not available|unavailable/i.test(msg)) return 'อุปกรณ์นี้ไม่รองรับการรู้จำเสียงพูด — ติดตั้ง/อัปเดต Google app';
  if (/busy|recognizer/i.test(msg)) return 'ระบบฟังเสียงไม่ว่าง — ลองอีกครั้ง';
  if (/no match|no speech|didn't understand/i.test(msg)) return '';
  return msg ? `ไม่สามารถฟังเสียงได้ (${msg.slice(0, 80)})` : '';
}

function isRetryableError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err ?? '');
  return /no match|no speech|didn't understand|busy|recognizer/i.test(msg);
}

/** ควบคุม native speech — แตะเปิด/ปิด, รอผลจาก start() โดยตรง (ไม่พึ่ง partialResults listener) */
export function createNativeDictation(callbacks: NativeDictationCallbacks) {
  let active = false;
  let loopRunning = false;
  let toggling = false;
  let generation = 0;
  let languageIndex = 0;
  let silenceTimer: number | null = null;
  let usePopup = false;
  let noMatchStreak = 0;

  let pluginRef: SpeechRecognitionPlugin | null = null;

  async function plugin(): Promise<SpeechRecognitionPlugin | null> {
    if (pluginRef) return pluginRef;
    pluginRef = await getSpeechPluginAsync();
    return pluginRef;
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

  async function releaseMic() {
    const p = await plugin();
    if (!p) return;
    try {
      await p.stop();
    } catch { /* ignore */ }
    for (let i = 0; i < 6; i += 1) {
      try {
        const { listening } = await p.isListening();
        if (!listening) break;
      } catch {
        break;
      }
      await sleep(120);
    }
    await sleep(200);
  }

  async function listenLoop(gen: number) {
    if (loopRunning || !active || gen !== generation) return;
    loopRunning = true;

    try {
      while (active && gen === generation) {
        const p = await plugin();
        if (!p) {
          callbacks.setMicHint('ไม่พบ speech plugin — อัpเดตแอpเป็นเวอร์ชันล่าสุด');
          await stopInternal();
          break;
        }

        if (!usePopup) await releaseMic();
        if (!active || gen !== generation) break;

        callbacks.setInterim('กำลังฟัง…');

        try {
          const result = await p.start({
            language: currentLanguage(),
            maxResults: 5,
            partialResults: false,
            popup: usePopup,
            prompt: usePopup ? 'พูดรายละเอียดเหตุการณ์…' : undefined,
          });

          callbacks.setInterim('');
          noMatchStreak = 0;

          const text = Array.isArray(result.matches)
            ? String(result.matches[0] || '').trim()
            : '';

          if (text) {
            callbacks.append(text);
            resetSilenceTimer();
          } else {
            resetSilenceTimer();
          }

          if (usePopup) {
            // popup mode จบรอบละครั้ง — เปิดใหม่ถ้ายัง active
            if (active && gen === generation) await sleep(400);
          }
        } catch (err) {
          if (!active || gen !== generation) break;
          callbacks.setInterim('');

          if (isRetryableError(err)) {
            noMatchStreak += 1;
            if (noMatchStreak >= 4 && !usePopup) {
              usePopup = true;
              callbacks.setMicHint('สลับโหมด Google voice — พูดเมื่อเห็นหน้าต่างฟังเสียง');
            } else if (languageIndex < LANGUAGE_CANDIDATES.length - 1 && /no match|no speech/i.test(String(err))) {
              languageIndex += 1;
              callbacks.setMicHint(`สลับภาษาเป็น ${currentLanguage()} — ลองพูดอีกครั้ง`);
            }
            resetSilenceTimer();
            await sleep(usePopup ? 600 : 350);
            continue;
          }

          const hint = errorHint(err);
          if (hint) callbacks.setMicHint(hint);
          await stopInternal();
          break;
        }
      }
    } finally {
      loopRunning = false;
    }
  }

  async function startInternal(): Promise<boolean> {
    if (active) return true;

    const p = await plugin();
    if (!p) {
      callbacks.setMicHint('ไม่พบ speech plugin — อัpเดตแอpเป็นเวอร์ชันล่าสุด');
      return false;
    }

    callbacks.setMicHint('');
    callbacks.setInterim('กำลังเปิดไมค์…');

    try {
      const avail = await p.available();
      if (!avail.available) {
        callbacks.setMicHint('อุปกรณ์นี้ไม่รองรับการรู้จำเสียงพูด (ต้องมี Google app)');
        callbacks.setInterim('');
        return false;
      }

      const perm = await p.requestPermissions();
      if (perm.speechRecognition !== 'granted') {
        callbacks.setMicHint('กรุณาอนุญาตไมโครโฟนในแอp (ตั้งค่า → กลางฮับ → ไมโครโฟน)');
        callbacks.setInterim('');
        return false;
      }
    } catch {
      callbacks.setMicHint('ไม่สามารถขอสิทธิ์ไมโครโฟนได้ — ลองใหม่อีกครั้ง');
      callbacks.setInterim('');
      return false;
    }

    generation += 1;
    const gen = generation;
    active = true;
    languageIndex = 0;
    usePopup = false;
    noMatchStreak = 0;
    callbacks.setListening(true);
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
    pluginRef = null;
    pluginPromise = null;
  }

  return { toggle, stop: stopInternal, destroy, silenceSec: NATIVE_DICTATION_SILENCE_SEC };
}
