const MARKETPLACE_ID_RE = /(?:https?:\/\/(?:www\.)?glanghub\.com)?\/marketplace\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

/** ดึง deal id จากข้อความที่มีลิงก์ตลาด/ประมูล (ตัวแรก) */
export function extractMarketplaceId(text: string): string | null {
  MARKETPLACE_ID_RE.lastIndex = 0;
  const m = MARKETPLACE_ID_RE.exec(text);
  return m?.[1] || null;
}

/** แยกข้อความเป็น segment ข้อความ + ลิงก์ตลาด */
export function splitMarketplaceLinkText(text: string): { type: 'text' | 'link'; value: string }[] {
  const out: { type: 'text' | 'link'; value: string }[] = [];
  let last = 0;
  MARKETPLACE_ID_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MARKETPLACE_ID_RE.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) });
    out.push({ type: 'link', value: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
  return out.length ? out : [{ type: 'text', value: text }];
}
