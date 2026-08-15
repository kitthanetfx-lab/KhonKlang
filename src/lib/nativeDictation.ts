/**
 * พูดให้พิมพ์ในแอpมือถือกลางฮับ (Capacitor — @capacitor-community/speech-recognition)
 *
 * ห้าม npm install plugin ฝั่งเว็บ — Capacitor ฉีด shim ของทุก plugin ที่โหลดไว้
 * เข้ามาที่ window.Capacitor.Plugins ให้เองตอน WebView เปิดหน้า (ดู JSExport.java)
 * ถ้า import @capacitor/core มาใน bundle เว็บ มันจะเขียนทับ window.Capacitor
 * ของ native bridge ทำให้ plugin อื่น (SocialLogin / PushNotifications) พังตามไปด้วย
 *
 * สำคัญ: ต้องเรียก start() ด้วย partialResults: false เท่านั้น
 * เพราะฝั่ง Android ถ้า partialResults เป็น true จะ call.resolve() ทันทีที่เริ่มฟัง
 * แล้วเวลาเกิด error, onError() จะ call.reject() บน call ที่ถูก resolve ไปแล้ว
 * ทำให้ JS ไม่เคยได้รับ error — อาการคือปุ่มแดงค้างแบบไม่มีข้อความและไม่มีคำเตือน
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

/** อ่าน plugin จาก shim ที่ native ฉีดมาให้ — ไม่ผ่าน bundle ของเว็บ */
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

function rawMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return String(err ?? '');
}

/** ข้อความ error จาก getErrorText() ฝั่ง Android — แปลเป็นคำแนะนำภาษาไทย */
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

/** error ที่แค่ลองฟังรอบใหม่ได้ ไม่ต้องปิดไมค์ */
function isRetryable(err: unknown): boolean {
  return /no match|no speech|busy|didn't understand/i.test(rawMessage(err));
}

/** ควบคุม native speech — แตะเปิด/ปิด, อ่านผลจากค่าที่ start() คืนกลับมา */
export function createNativeDictation(callbacks: NativeDictationCallbacks) {
  let active = false;
  let loopRunning = false;
  let toggling = false;
  let generation = 0;
  let languageIndex = 0;
  let silenceTimer: number | null = null;
  let emptyStreak = 0;

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

  /** SpeechRecognizer รับ startListening() ซ้อนไม่ได้ — ต้องรอให้ปล่อยไมค์ก่อน */
  async function releaseMic(p: SpeechRecognitionPlugin) {
    try {
      await p.stop();
    } catch { /* ไม่ได้ฟังอยู่ ก็ไม่เป็นไร */ }
    for (let i = 0; i < 8; i += 1) {
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
        const p = plugin();
        if (!p) {
          callbacks.setMicHint('ไม่พบตัวถอดเสียงในแอป — อัปเดตแอปเป็นเวอร์ชันล่าสุด');
          await stopInternal();
          break;
        }

        await releaseMic(p);
        if (!active || gen !== generation) break;

        callbacks.setInterim('กำลังฟัง… พูดได้เลย');

        try {
          const result = await p.start({
            language: currentLanguage(),
            maxResults: 5,
            partialResults: false,
          });
          if (!active || gen !== generation) break;

          callbacks.setInterim('');
          const text = Array.isArray(result?.matches)
            ? String(result.matches[0] ?? '').trim()
            : '';

          if (text) {
            emptyStreak = 0;
            callbacks.setMicHint('');
            callbacks.append(text);
          } else {
            emptyStreak += 1;
          }
          resetSilenceTimer();
          await sleep(150);
        } catch (err) {
          if (!active || gen !== generation) break;
          callbacks.setInterim('');

          if (isRetryable(err)) {
            emptyStreak += 1;
            if (emptyStreak === 3 && languageIndex < LANGUAGE_CANDIDATES.length - 1) {
              languageIndex += 1;
              callbacks.setMicHint(`ยังไม่ได้ยินเสียงพูด — สลับภาษาเป็น ${currentLanguage()}`);
            }
            resetSilenceTimer();
            await sleep(400);
            continue;
          }

          callbacks.setMicHint(errorHint(err));
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

    const p = plugin();
    if (!p) {
      callbacks.setMicHint('ไม่พบตัวถอดเสียงในแอป — อัปเดตแอปเป็นเวอร์ชันล่าสุด');
      return false;
    }

    callbacks.setMicHint('');
    callbacks.setInterim('กำลังเปิดไมค์…');

    try {
      const avail = await p.available();
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
      const perm = await p.requestPermissions();
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

    generation += 1;
    const gen = generation;
    active = true;
    languageIndex = 0;
    emptyStreak = 0;
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
    const p = plugin();
    if (p) await releaseMic(p);
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
