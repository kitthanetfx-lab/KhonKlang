/**
 * พูดให้พิมพ์ — ใช้เฉพาะในแอpมือถือกลางฮับ (Capacitor)
 * ฝั่งเว็บ/เบราว์เซอร์ใช้ Web Speech API ใน ScamReportForm ตามเดิม ไม่เกี่ยวกับไฟล์นี้
 *
 * ห้าม npm install plugin ฝั่งเว็บ — Capacitor ฉีด shim ของทุก plugin ที่โหลดไว้
 * เข้ามาที่ window.Capacitor.Plugins ให้เองตอน WebView เปิดหน้า (ดู JSExport.java)
 * ถ้า import @capacitor/core มาใน bundle เว็บ มันจะเขียนทับ window.Capacitor
 * ของ native bridge ทำให้ plugin อื่น (SocialLogin / PushNotifications) พังตามไปด้วย
 *
 * ข้อควรระวังของ @capacitor-community/speech-recognition@7.0.1 (Android):
 *
 * 1) stop() ไม่เคยเรียก call.resolve() — resolve เฉพาะกรณี exception ซึ่งไม่เคยเกิด
 *    ดังนั้น `await plugin.stop()` จะค้างตลอดกาล ห้าม await เด็ดขาด
 *    (บั๊กนี้ทำให้ start() ไม่ถูกเรียก → ไมค์ไม่เปิด แต่ปุ่มขึ้นแดงเพราะ
 *    available() กับ requestPermissions() ผ่านไปก่อนแล้ว)
 *
 * 2) partialResults: true จะ call.resolve() ทันทีที่เริ่มฟัง แล้ว onError()
 *    ไป reject บน call ที่ resolve แล้ว JS จึงไม่เคยได้รับ error
 *    ต้องใช้ partialResults: false เพื่ออ่านผลจากค่าที่ start() คืนกลับ
 */

import { isGlanghubApp } from '@/lib/nativeAuth';

export const NATIVE_DICTATION_SILENCE_SEC = 10;

const LANGUAGE_CANDIDATES = ['th-TH', 'th_TH', 'en-US'];

/** เวลาสูงสุดที่ยอมรอ native call ที่ควรตอบกลับทันที */
const NATIVE_CALL_TIMEOUT_MS = 6000;

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

/** กัน native call ที่ไม่ยอม settle ไม่ให้ค้างทั้งระบบเงียบ ๆ */
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

  /**
   * สั่งปล่อยไมค์แบบไม่ await — stop() ของ plugin ไม่ resolve (ดูหมายเหตุหัวไฟล์)
   * แล้วรอด้วย isListening() ที่ resolve จริงแทน
   */
  async function releaseMic(p: SpeechRecognitionPlugin) {
    void Promise.resolve(p.stop()).catch(() => { /* ไม่มีทาง settle อยู่แล้ว */ });

    for (let i = 0; i < 8; i += 1) {
      try {
        const { listening } = await withTimeout('isListening', p.isListening(), 1500);
        if (!listening) return;
      } catch {
        return;
      }
      await sleep(120);
    }
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

        callbacks.setInterim('กำลังฟัง… พูดได้เลย');

        try {
          // ไม่ใส่ timeout — start() จะค้างไว้จนผู้ใช้พูดจบ (นั่นคือพฤติกรรมที่ถูก)
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
          await releaseMic(p);
          if (!active || gen !== generation) break;
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
            await releaseMic(p);
            if (!active || gen !== generation) break;
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
      // ครั้งแรกจะเด้ง dialog ขอสิทธิ์ ผู้ใช้อาจกดช้า จึงให้เวลามากกว่าปกติ
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

    // เคลียร์ session ค้างจากรอบก่อน ก่อนเริ่มฟังรอบใหม่
    await releaseMic(p);

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
    if (p) void Promise.resolve(p.stop()).catch(() => { /* stop() ไม่ resolve */ });
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
