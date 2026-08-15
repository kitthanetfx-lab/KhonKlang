/**
 * พูดให้พิมพ์ในแอปมือถือกลางฮับ (Capacitor — โปรเจกต์ glangApp)
 *
 * Web Speech API มักไม่ทำงานใน Android WebView — ใช้ native plugin
 * @capacitor-community/speech-recognition แทน (แอปฉีด bridge เข้า WebView)
 */

import { isGlanghubApp } from '@/lib/nativeAuth';

export const NATIVE_DICTATION_SILENCE_SEC = 20;

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
  requestPermissions(): Promise<{ speechRecognition: PermissionState }>;
  addListener(
    event: 'partialResults',
    cb: (data: { matches: string[] }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    event: 'listeningState',
    cb: (data: { status: 'started' | 'stopped' }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  removeAllListeners(): Promise<void>;
};

function getSpeechRecognitionPlugin(): SpeechRecognitionPlugin | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor;
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

/** ควบคุม native speech — แตะเปิด/ปิด + ปิดอัตโนมัติเมื่อเงียบ */
export function createNativeDictation(callbacks: NativeDictationCallbacks) {
  const plugin = getSpeechRecognitionPlugin();
  let active = false;
  let restarting = false;
  let lastPartial = '';
  let restartTimer: number | null = null;
  let silenceTimer: number | null = null;
  let listenersReady = false;

  function clearRestartTimer() {
    if (restartTimer != null) {
      window.clearTimeout(restartTimer);
      restartTimer = null;
    }
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
      void stop();
    }, NATIVE_DICTATION_SILENCE_SEC * 1000);
  }

  function commitPartial() {
    const text = lastPartial.trim();
    if (text) callbacks.append(text);
    lastPartial = '';
    callbacks.setInterim('');
  }

  async function ensureListeners() {
    if (!plugin || listenersReady) return;
    listenersReady = true;
    await plugin.addListener('partialResults', data => {
      if (!active) return;
      resetSilenceTimer();
      const match = (data.matches?.[0] || '').trim();
      if (!match) return;
      lastPartial = match;
      callbacks.setInterim(match);
    });
    await plugin.addListener('listeningState', data => {
      if (data.status !== 'stopped' || !active || restarting) return;
      commitPartial();
      scheduleRestart();
    });
  }

  function scheduleRestart() {
    if (!active) return;
    clearRestartTimer();
    restartTimer = window.setTimeout(() => {
      restartTimer = null;
      void startSession();
    }, 250);
  }

  async function startSession() {
    if (!plugin || !active) return;
    restarting = true;
    try {
      await plugin.start({
        language: 'th-TH',
        maxResults: 1,
        partialResults: true,
        popup: false,
      });
      callbacks.setListening(true);
      resetSilenceTimer();
    } catch {
      scheduleRestart();
    } finally {
      restarting = false;
    }
  }

  async function start(): Promise<boolean> {
    if (!plugin) return false;
    try {
      const avail = await plugin.available();
      if (!avail.available) {
        callbacks.setMicHint('อุปกรณ์นี้ไม่รองรับการรู้จำเสียงพูด');
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

    active = true;
    lastPartial = '';
    callbacks.setMicHint('');
    callbacks.setListening(true);
    await ensureListeners();
    resetSilenceTimer();
    await startSession();
    return true;
  }

  async function stop() {
    active = false;
    clearRestartTimer();
    clearSilenceTimer();
    commitPartial();
    callbacks.setListening(false);
    if (!plugin) return;
    try {
      await plugin.stop();
    } catch { /* ignore */ }
  }

  async function toggle() {
    if (active) {
      callbacks.setMicHint('');
      await stop();
      return;
    }
    await start();
  }

  async function destroy() {
    await stop();
    if (plugin && listenersReady) {
      try {
        await plugin.removeAllListeners();
      } catch { /* ignore */ }
      listenersReady = false;
    }
  }

  return { toggle, stop, destroy, silenceSec: NATIVE_DICTATION_SILENCE_SEC };
}
