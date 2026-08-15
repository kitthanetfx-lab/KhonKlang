/**
 * พูดให้พิมพ์ — ใช้เฉพาะในแอpมือถือกลางฮับ (Capacitor)
 * ฝั่งเว็บ/เบราว์เซอร์ใช้ Web Speech API ใน ScamReportForm ตามเดิม ไม่เกี่ยวกับไฟล์นี้
 *
 * ห้าม npm install plugin ฝั่งเว็บ — ใช้ window.Capacitor.Plugins ที่ native ฉีดมาให้
 *
 * ข้อควรระวัง @capacitor-community/speech-recognition@7.0.1 (Android):
 * - stop() ไม่เคย call.resolve() → ห้าม await plugin.stop()
 * - partialResults: false จบหนึ่งประโยคแล้วปิดไมค์ → loop stop/start ทำให้ไมค์กระพริบ
 *   ใช้ partialResults: true + listener แทน แล้ว restart เงียบ ๆ เมื่อ session จบ
 */

import { isGlanghubApp } from '@/lib/nativeAuth';

export const NATIVE_DICTATION_SILENCE_SEC = 10;

const LANGUAGE_CANDIDATES = ['th-TH', 'th_TH', 'en-US'];
const NATIVE_CALL_TIMEOUT_MS = 6000;
/** รอสั้น ๆ ก่อนเปิด session ใหม่หลัง Android ปิดรอบก่อน — ไม่เรียก stop() คั่น */
const SESSION_RESTART_MS = 120;

type PermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';
type PluginListenerHandle = { remove: () => Promise<void> };

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
  addListener(
    event: 'partialResults',
    cb: (data: { matches: string[] }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: 'listeningState',
    cb: (data: { status: 'started' | 'stopped' }) => void,
  ): Promise<PluginListenerHandle>;
};

function sleep(ms: number) {
  return new Promise<void>(resolve => window.setTimeout(resolve, ms));
}

export function getSpeechRecognitionPlugin(): SpeechRecognitionPlugin | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as {
    Capacitor?: { Plugins?: Record<string, unknown> };
  }).Capacitor;
  return (cap?.Plugins?.SpeechRecognition as SpeechRecognitionPlugin | undefined) ?? null;
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

function withTimeout<T>(label: string, work: Promise<T>, ms = NATIVE_CALL_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} ไม่ตอบกลับใน ${Math.round(ms / 1000)} วินาที`));
    }, ms);
    work.then(
      value => { window.clearTimeout(timer); resolve(value); },
      err => { window.clearTimeout(timer); reject(err); },
    );
  });
}

function rawMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return String(err ?? '');
}

function errorHint(err: unknown): string {
  const msg = rawMessage(err);
  if (/insufficient permission|not allowed/i.test(msg)) return 'ยังไม่ได้สิทธิ์ไมโครโฟน — ตั้งค่า → แอป → กลางฮับ → สิทธิ์ → ไมโครโฟน';
  if (/network timeout/i.test(msg)) return 'เครือข่ายช้าเกินไป — ลองต่อ Wi-Fi แล้วกดใหม่';
  if (/network/i.test(msg)) return 'ต่อเน็ตไม่ได้ — การถอดเสียงต้องใช้อินเทอร์เน็ต';
  if (/audio recording/i.test(msg)) return 'ไมโครโฟนถูกแอปอื่นใช้อยู่ — ปิดแอปโทร/อัดเสียงแล้วลองใหม่';
  if (/no match|no speech/i.test(msg)) return '';
  if (/busy/i.test(msg)) return '';
  if (/not available|unavailable/i.test(msg)) return 'เครื่องนี้ยังไม่มีตัวถอดเสียง — ติดตั้ง/อัปเดตแอป Google';
  if (/client side/i.test(msg)) return 'ตัวถอดเสียงของระบบขัดข้อง — ลองรีสตาร์ตเครื่อง';
  if (/server/i.test(msg)) return 'เซิร์ฟเวอร์ถอดเสียงของ Google ขัดข้อง — ลองอีกครั้ง';
  return msg ? `ฟังเสียงไม่สำเร็จ: ${msg.slice(0, 90)}` : 'ฟังเสียงไม่สำเร็จ (ไม่ทราบสาเหตุ)';
}

function isRetryable(err: unknown): boolean {
  return /no match|no speech|busy|didn't understand/i.test(rawMessage(err));
}

/** ควบคุม native speech — เปิดครั้งเดียว ฟังต่อเนื่องจนกว่าจะปิดเองหรือเงียบ 10 วิ */
export function createNativeDictation(callbacks: NativeDictationCallbacks) {
  let active = false;
  let toggling = false;
  let generation = 0;
  let languageIndex = 0;
  let silenceTimer: number | null = null;
  let restartTimer: number | null = null;
  let lastPartial = '';
  let listenersBound = false;
  let partialHandle: PluginListenerHandle | null = null;
  let stateHandle: PluginListenerHandle | null = null;
  let starting = false;

  function plugin() {
    return getSpeechRecognitionPlugin();
  }

  function clearSilenceTimer() {
    if (silenceTimer != null) {
      window.clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  }

  function clearRestartTimer() {
    if (restartTimer != null) {
      window.clearTimeout(restartTimer);
      restartTimer = null;
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

  /** สั่ง stop แบบไม่ await — stop() ของ plugin ไม่ resolve */
  function fireStop(p: SpeechRecognitionPlugin) {
    void Promise.resolve(p.stop()).catch(() => { /* stop() ไม่ resolve */ });
  }

  /** เคลียร์ session ค้าง — ใช้เฉพาะตอนเริ่ม/หยุด ไม่ใช่ระหว่างฟังต่อเนื่อง */
  async function releaseMic(p: SpeechRecognitionPlugin) {
    fireStop(p);
    for (let i = 0; i < 6; i += 1) {
      try {
        const { listening } = await withTimeout('isListening', p.isListening(), 1500);
        if (!listening) return;
      } catch {
        return;
      }
      await sleep(100);
    }
  }

  function flushPartial() {
    const text = lastPartial.trim();
    lastPartial = '';
    callbacks.setInterim('');
    if (text) {
      callbacks.append(text);
      resetSilenceTimer();
    }
  }

  async function ensureListeners(p: SpeechRecognitionPlugin, gen: number) {
    if (listenersBound) return;
    listenersBound = true;

    partialHandle = await p.addListener('partialResults', ({ matches }) => {
      if (!active || gen !== generation) return;
      const text = Array.isArray(matches) ? String(matches[0] || '').trim() : '';
      if (!text) return;
      lastPartial = text;
      callbacks.setInterim(text);
      resetSilenceTimer();
    });

    stateHandle = await p.addListener('listeningState', ({ status }) => {
      if (!active || gen !== generation) return;

      if (status === 'started') {
        resetSilenceTimer();
        return;
      }

      if (status === 'stopped') {
        flushPartial();
        if (!active || gen !== generation) return;
        scheduleSessionRestart(gen);
      }
    });
  }

  function scheduleSessionRestart(gen: number) {
    clearRestartTimer();
    restartTimer = window.setTimeout(() => {
      restartTimer = null;
      void beginSession(gen);
    }, SESSION_RESTART_MS);
  }

  /** เปิด session ฟังใหม่ — ไม่เรียก stop() ก่อน (plugin จัดการเอง) */
  async function beginSession(gen: number) {
    if (!active || gen !== generation || starting) return;

    const p = plugin();
    if (!p) {
      callbacks.setMicHint('ไม่พบตัวถอดเสียงในแอป — อัปเดตแอปเป็นเวอร์ชันล่าสุด');
      void stopInternal();
      return;
    }

    starting = true;
    try {
      await p.start({
        language: currentLanguage(),
        maxResults: 5,
        partialResults: true,
      });
      if (!active || gen !== generation) return;
      resetSilenceTimer();
    } catch (err) {
      if (!active || gen !== generation) return;

      if (isRetryable(err)) {
        if (languageIndex < LANGUAGE_CANDIDATES.length - 1 && /no match|no speech/i.test(rawMessage(err))) {
          languageIndex += 1;
          callbacks.setMicHint(`สลับภาษาเป็น ${currentLanguage()} — ลองพูดอีกครั้ง`);
        }
        resetSilenceTimer();
        scheduleSessionRestart(gen);
        return;
      }

      callbacks.setMicHint(errorHint(err));
      void stopInternal();
    } finally {
      starting = false;
    }
  }

  async function startInternal(): Promise<boolean> {
    if (active) return true;

    const p = plugin();
    if (!p) {
      callbacks.setMicHint('ไม่พบตัวถอดเสียงในแอป — อัปเดตแอปเป็นเวอร์ชันล่าสุด');
      return false;
    }

    callbacks.setMicHint('');
    callbacks.setInterim('กำลังเปิดไมค์…');

    try {
      const avail = await withTimeout('available()', p.available());
      if (!avail?.available) {
        callbacks.setMicHint('เครื่องนี้ยังไม่มีตัวถอดเสียง — ติดตั้ง/อัปเดตแอป Google แล้วลองใหม่');
        callbacks.setInterim('');
        return false;
      }
    } catch (err) {
      callbacks.setMicHint(`เช็คตัวถอดเสียงไม่ได้: ${rawMessage(err).slice(0, 80)}`);
      callbacks.setInterim('');
      return false;
    }

    try {
      const perm = await withTimeout('requestPermissions()', p.requestPermissions(), 60000);
      if (perm?.speechRecognition !== 'granted') {
        callbacks.setMicHint('ยังไม่ได้สิทธิ์ไมโครโฟน — ตั้งค่า → แอป → กลางฮับ → สิทธิ์ → ไมโครโฟน');
        callbacks.setInterim('');
        return false;
      }
    } catch (err) {
      callbacks.setMicHint(`ขอสิทธิ์ไมโครโฟนไม่ได้: ${rawMessage(err).slice(0, 80)}`);
      callbacks.setInterim('');
      return false;
    }

    await releaseMic(p);

    generation += 1;
    const gen = generation;
    active = true;
    languageIndex = 0;
    lastPartial = '';
    callbacks.setListening(true);
    callbacks.setInterim('');
    resetSilenceTimer();

    await ensureListeners(p, gen);
    void beginSession(gen);
    return true;
  }

  async function stopInternal() {
    generation += 1;
    active = false;
    starting = false;
    clearSilenceTimer();
    clearRestartTimer();
    flushPartial();
    callbacks.setListening(false);

    const p = plugin();
    if (p) fireStop(p);

    await partialHandle?.remove();
    await stateHandle?.remove();
    partialHandle = null;
    stateHandle = null;
    listenersBound = false;
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
