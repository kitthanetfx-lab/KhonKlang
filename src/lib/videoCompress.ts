/**
 * บีบอัดวิดีโอฝั่ง client ก่อนอัปโหลด — ย่อเป็น 480p ~800 kbps (WebM/MP4 ตามที่ browser รองรับ)
 * ใช้ canvas + MediaRecorder ไม่ต้องพึ่ง ffmpeg.wasm
 */

export const MAX_VIDEO_DURATION_SEC = 300; // 5 นาที
export const VIDEO_TARGET_HEIGHT = 480;
export const VIDEO_BITRATE = 800_000;
export const VIDEO_UPLOAD_HINT =
  '⚠️ วิดีโอควรไม่เกิน 5 นาที — ระบบจะบีบเป็น 480p อัตโนมัติก่อนอัปโหลด';

export function isVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true;
  return /\.(mp4|mov|avi|webm|mkv|m4v)$/i.test(file.name);
}

function pickVideoMime(): { mimeType: string; ext: string } {
  const candidates = [
    { mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mimeType: 'video/webm', ext: 'webm' },
    { mimeType: 'video/mp4', ext: 'mp4' },
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mimeType)) return c;
  }
  throw new Error('UNSUPPORTED');
}

async function loadVideoMeta(file: File): Promise<{ video: HTMLVideoElement; url: string; duration: number }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.playsInline = true;
  video.muted = true;
  video.preload = 'auto';

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const ok = () => {
      if (settled) return;
      if (Number.isFinite(video.duration) && video.duration > 0) {
        settled = true;
        resolve();
      }
    };
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    video.onloadedmetadata = ok;
    video.ondurationchange = ok;
    video.onerror = () => fail(new Error('LOAD_FAILED'));
    setTimeout(() => fail(new Error('LOAD_FAILED')), 20000);
  });

  return { video, url, duration: video.duration };
}

function evenDim(n: number): number {
  const v = Math.max(2, Math.round(n));
  return v % 2 === 0 ? v : v - 1;
}

export async function compressVideo(
  file: File,
  onProgress?: (pct: number, label?: string) => void,
): Promise<File> {
  if (!isVideoFile(file)) return file;
  if (typeof MediaRecorder === 'undefined') throw new Error('UNSUPPORTED');

  const { video, url, duration } = await loadVideoMeta(file);

  try {
    if (duration > MAX_VIDEO_DURATION_SEC) throw new Error('VIDEO_TOO_LONG');

    onProgress?.(0, 'กำลังเตรียมบีบอัดวิดีโอ...');

    const { mimeType, ext } = pickVideoMime();
    const scale = Math.min(1, VIDEO_TARGET_HEIGHT / video.videoHeight);
    const w = evenDim(video.videoWidth * scale);
    const h = evenDim(video.videoHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('COMPRESS_FAILED');

    video.muted = false;
    video.volume = 1;

    const canvasStream = canvas.captureStream(24);
    let audioTracks: MediaStreamTrack[] = [];
    let audioCtx: AudioContext | null = null;
    try {
      audioCtx = new AudioContext();
      const source = audioCtx.createMediaElementSource(video);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      audioTracks = dest.stream.getAudioTracks();
    } catch {
      // วิดีโอไม่มีเสียงหรือ browser ไม่รองรับ — บีบเฉพาะภาพ
    }

    const outStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(outStream, {
      mimeType,
      videoBitsPerSecond: VIDEO_BITRATE,
      audioBitsPerSecond: 96_000,
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const recorderDone = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error('COMPRESS_FAILED'));
    });

    recorder.start(1000);

    let rafId = 0;
    const draw = () => {
      if (!video.ended) {
        ctx.drawImage(video, 0, 0, w, h);
        if (onProgress && duration > 0) {
          onProgress(Math.min(99, (video.currentTime / duration) * 100), 'กำลังบีบอัดวิดีโอ...');
        }
        rafId = requestAnimationFrame(draw);
      }
    };

    video.currentTime = 0;
    await video.play();
    draw();

    await new Promise<void>((resolve) => {
      const finish = () => {
        video.removeEventListener('ended', finish);
        resolve();
      };
      video.addEventListener('ended', finish);
      setTimeout(finish, Math.ceil(duration * 1000) + 3000);
    });

    cancelAnimationFrame(rafId);
    ctx.drawImage(video, 0, 0, w, h);
    recorder.stop();
    await recorderDone;

    outStream.getTracks().forEach((t) => t.stop());
    await audioCtx?.close().catch(() => {});

    const blob = new Blob(chunks, { type: mimeType });
    if (!blob.size) throw new Error('COMPRESS_FAILED');

    onProgress?.(100, 'บีบอัดเสร็จ — กำลังอัปโหลด...');

    const base = file.name.replace(/\.[a-zA-Z0-9]+$/, '') || 'video';
    return new File([blob], `${base}.${ext}`, { type: mimeType, lastModified: Date.now() });
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
