type LineMessage =
  | { type: 'text'; text: string }
  | { type: 'image'; originalContentUrl: string; previewImageUrl: string };

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://www.glanghub.com').replace(/\/$/, '');
}

function supportAdminUrl(customerId: string): string {
  return `${appBaseUrl()}/admin/support?with=${encodeURIComponent(customerId)}`;
}

function isLineImageUrl(url: string): boolean {
  const ext = url.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
  return ext === 'jpg' || ext === 'jpeg' || ext === 'png';
}

async function sendLineSupportMessages(messages: LineMessage[]): Promise<void> {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_SUPPORT_GROUP_ID;
  if (!token || !to || !messages.length) return;
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to, messages: messages.slice(0, 5) }),
    });
    if (!res.ok) {
      console.error('[lineSupportNotify] push failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('[lineSupportNotify] push error:', err);
  }
}

/** แจ้ง LINE กลุ่มทีมงาน — ลูกค้าส่งแชท (คนละกลุ่มกับดีล) */
export async function notifySupportLineCustomerMessage(params: {
  customerId: string;
  customerName: string;
  content: string;
  imageUrl?: string;
}): Promise<void> {
  const { customerId, customerName, content, imageUrl } = params;
  const preview = content.trim() || (imageUrl ? 'ส่งรูปภาพ' : '—');
  const lines = [
    '[กลางฮับ] 💬 ลูกค้าติดต่อทีมงาน',
    `ชื่อ: ${customerName}`,
    `ข้อความ: ${preview.slice(0, 500)}`,
    supportAdminUrl(customerId),
  ];

  const messages: LineMessage[] = [{ type: 'text', text: lines.join('\n').slice(0, 5000) }];
  if (imageUrl && isLineImageUrl(imageUrl) && messages.length < 5) {
    messages.push({ type: 'image', originalContentUrl: imageUrl, previewImageUrl: imageUrl });
  }
  await sendLineSupportMessages(messages);
}

/** แจ้ง LINE กลุ่มทีมงาน — ลูกค้ากดขอโทรกลับ */
export async function notifySupportLineCallRequest(params: {
  customerId: string;
  customerName: string;
}): Promise<void> {
  const { customerId, customerName } = params;
  await sendLineSupportMessages([{
    type: 'text',
    text: [
      '[กลางฮับ] 📞 ลูกค้าขอให้โทรกลับ',
      `ชื่อ: ${customerName}`,
      supportAdminUrl(customerId),
    ].join('\n').slice(0, 5000),
  }]);
}
