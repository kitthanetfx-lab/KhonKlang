// แปลงลิงก์ YouTube รูปแบบต่าง ๆ (watch?v=, youtu.be/, shorts/, m.youtube.com ฯลฯ) ให้เป็น embed URL ที่ใส่ใน <iframe> ได้จริง
// ถ้าใช้ลิงก์หน้า "ดูวิดีโอ" ปกติ (youtube.com/watch?v=...) ฝัง iframe ตรง ๆ จะถูก YouTube ปฏิเสธการเชื่อมต่อ
// ต้องแปลงเป็น https://www.youtube.com/embed/VIDEO_ID ก่อนเสมอ
export function toYouTubeEmbedUrl(input: string): string {
  const raw = String(input || '').trim();
  if (!raw) return '';

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw; // ไม่ใช่ URL ที่ parse ได้ — ส่งค่าเดิมกลับไป (อาจเป็น path เปล่าหรือพิมพ์ผิด)
  }

  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
  let videoId = '';

  if (host === 'youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0] || '';
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') {
      videoId = url.searchParams.get('v') || '';
    } else if (url.pathname.startsWith('/embed/')) {
      return raw; // เป็น embed URL อยู่แล้ว
    } else if (url.pathname.startsWith('/shorts/')) {
      videoId = url.pathname.split('/')[2] || '';
    } else if (url.pathname.startsWith('/live/')) {
      videoId = url.pathname.split('/')[2] || '';
    } else if (url.pathname.startsWith('/v/')) {
      videoId = url.pathname.split('/')[2] || '';
    }
  } else {
    return raw; // โดเมนอื่นที่ไม่ใช่ YouTube — ไม่ยุ่ง ปล่อยให้ผู้ใช้ดูแลเอง
  }

  if (!videoId) return raw;
  return `https://www.youtube.com/embed/${videoId}`;
}
