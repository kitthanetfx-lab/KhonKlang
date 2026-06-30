/**
 * บีบอัดรูปฝั่ง client ก่อนอัปโหลด — ลดขนาดรูปจากกล้องมือถือ (หลาย MB)
 * ให้เล็กพอผ่านลิมิต request ของโฮสติ้ง และอัปโหลดเร็วขึ้นมาก
 * ไฟล์ที่ไม่ใช่รูป (เช่น PDF) หรือบีบแล้วไม่เล็กลง จะคืนไฟล์เดิม
 */
export async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  // รูปเล็กอยู่แล้ว ไม่ต้องแตะ
  if (file.size < 600 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[a-zA-Z0-9]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file; // บีบไม่ได้ก็ส่งไฟล์เดิม ให้ server ตัดสิน
  }
}
