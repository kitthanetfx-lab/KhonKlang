const cache = new Map<string, { friend: boolean; at: number }>();
const CACHE_MS = 60_000;

/** ตรวจว่า user เพิ่มเพื่อน LINE OA แล้วหรือยัง — ใช้ Messaging API get profile */
export async function isLineOaFriend(lineUserId: string): Promise<boolean> {
  const id = String(lineUserId || '').trim();
  if (!id) return false;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.friend;

  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  if (!token) return false;

  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const friend = res.ok;
    cache.set(id, { friend, at: Date.now() });
    return friend;
  } catch {
    return false;
  }
}

export function forgetLineOaFriendCache(lineUserId?: string) {
  if (lineUserId) cache.delete(lineUserId);
  else cache.clear();
}

export function lineOaAddFriendUrl() {
  return (process.env.NEXT_PUBLIC_LINE_OA_ADD_FRIEND_URL || process.env.NEXT_PUBLIC_LINE_OA_URL || '').trim();
}
