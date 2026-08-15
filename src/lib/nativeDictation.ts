/**

 * พูดให้พิมพ์ในแอpมือถือกลางฮับ (Capacitor — @capacitor-community/speech-recognition)

 */

import { isGlanghubApp } from '@/lib/nativeAuth';



export const NATIVE_DICTATION_SILENCE_SEC = 10;



const LANGUAGE_CANDIDATES = ['th-TH', 'th_TH', 'en-US'];



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



function getCapacitor(): {

  Plugins?: Record<string, unknown>;

  getPlugin?: (name: string) => unknown;

} | null {

  if (typeof window === 'undefined') return null;

  return (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown>; getPlugin?: (n: string) => unknown } }).Capacitor ?? null;

}



export function getSpeechRecognitionPlugin(): SpeechRecognitionPlugin | null {

  const cap = getCapacitor();

  if (!cap) return null;

  const fromPlugins = cap.Plugins?.SpeechRecognition as SpeechRecognitionPlugin | undefined;

  if (fromPlugins) return fromPlugins;

  try {

    return cap.getPlugin?.('SpeechRecognition') as SpeechRecognitionPlugin | undefined ?? null;

  } catch {

    return null;

  }

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

  if (/network/i.test(msg)) return 'เครือข่ายขัดข้อง — ตรวจสอบเน็ตและ Google app';

  if (/permission|insufficient|not allowed/i.test(msg)) return 'กรุณาอนุญาตไมโครโฟนในแอp แล้วลองใหม่';

  if (/not available|unavailable/i.test(msg)) return 'อุปกรณ์นี้ไม่รองรับการรู้จำเสียงพูด — ติดตั้ง/อัปเดต Google app';

  if (/busy|recognizer/i.test(msg)) return 'ระบบฟังเสียงไม่ว่าง — ลองอีกครั้ง';

  if (/no match|no speech|didn't understand/i.test(msg)) return '';

  return msg ? `ไม่สามารถฟังเสียงได้ (${msg.slice(0, 80)})` : '';

}



/** ควบคุม native speech — แตะเปิด/ปิด + partial results แบบต่อเนื่อง */

export function createNativeDictation(callbacks: NativeDictationCallbacks) {

  let active = false;

  let loopRunning = false;

  let toggling = false;

  let generation = 0;

  let languageIndex = 0;

  let silenceTimer: number | null = null;

  let lastPartial = '';

  let listenersBound = false;

  let partialHandle: PluginListenerHandle | null = null;

  let stateHandle: PluginListenerHandle | null = null;



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



  function flushPartial() {

    const t = lastPartial.trim();

    lastPartial = '';

    callbacks.setInterim('');

    if (t) {

      callbacks.append(t);

      resetSilenceTimer();

    }

  }



  async function ensureListeners(p: SpeechRecognitionPlugin) {

    if (listenersBound) return;

    listenersBound = true;

    partialHandle = await p.addListener('partialResults', ({ matches }) => {

      const text = Array.isArray(matches) ? String(matches[0] || '').trim() : '';

      if (!text || !active) return;

      lastPartial = text;

      callbacks.setInterim(text);

      resetSilenceTimer();

    });

    stateHandle = await p.addListener('listeningState', ({ status }) => {

      if (status === 'started') {

        callbacks.setListening(true);

        resetSilenceTimer();

      }

      if (status === 'stopped' && active) {

        flushPartial();

        if (active) void scheduleNextListen();

      }

    });

  }



  async function releaseMic() {

    const p = plugin();

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

    await sleep(280);

  }



  async function scheduleNextListen() {

    if (!active) return;

    await sleep(320);

    if (active) void listenLoop(generation);

  }



  async function listenLoop(gen: number) {

    if (loopRunning || !active || gen !== generation) return;

    const p = plugin();

    if (!p) return;



    loopRunning = true;

    try {

      while (active && gen === generation) {

        await releaseMic();

        if (!active || gen !== generation) break;



        try {

          await p.start({

            language: currentLanguage(),

            maxResults: 5,

            partialResults: true,

            popup: false,

          });

          resetSilenceTimer();

          // partialResults=true → start() คืนทันที, รอ event listeningState

          break;

        } catch (err) {

          if (!active || gen !== generation) break;

          const hint = errorHint(err);

          if (/busy/i.test(String(err))) {

            await sleep(700);

            continue;

          }

          if (/no match|no speech|didn't understand/i.test(String(err))) {

            if (languageIndex < LANGUAGE_CANDIDATES.length - 1) {

              languageIndex += 1;

              callbacks.setMicHint(`สลับภาษาเป็น ${currentLanguage()} — ลองพูดอีกครั้ง`);

            }

            await sleep(500);

            continue;

          }

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

    const p = plugin();

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



    await ensureListeners(p);



    generation += 1;

    const gen = generation;

    active = true;

    languageIndex = 0;

    lastPartial = '';

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

    flushPartial();

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

    await partialHandle?.remove();

    await stateHandle?.remove();

    partialHandle = null;

    stateHandle = null;

    listenersBound = false;

  }



  return { toggle, stop: stopInternal, destroy, silenceSec: NATIVE_DICTATION_SILENCE_SEC };

}


