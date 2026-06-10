// Shared notification helper — ใช้สร้างแจ้งเตือนจาก API ฝั่ง server
import { Databases, DatabasesIndexType, ID, OrderBy, Permission, Role } from 'node-appwrite';

export const DB_ID = 'khonklang_db';
export const COL_NOTIFICATIONS = 'notifications';

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export async function ensureNotificationsCollection(db: Databases) {
  try { await db.getCollection(DB_ID, COL_NOTIFICATIONS); return; } catch { /* create below */ }
  try {
    await db.createCollection(DB_ID, COL_NOTIFICATIONS, 'Notifications', [
      Permission.read(Role.users()),
    ]);
    await Promise.all([
      db.createStringAttribute(DB_ID, COL_NOTIFICATIONS, 'userId',   255, true),
      db.createStringAttribute(DB_ID, COL_NOTIFICATIONS, 'title',    200, false, ''),
      db.createStringAttribute(DB_ID, COL_NOTIFICATIONS, 'body',     500, false, ''),
      db.createStringAttribute(DB_ID, COL_NOTIFICATIONS, 'link',     300, false, ''),
      db.createBooleanAttribute(DB_ID, COL_NOTIFICATIONS, 'read',    false, false),
      db.createStringAttribute(DB_ID, COL_NOTIFICATIONS, 'createdAt', 30, false, ''),
    ]);
    for (let i = 0; i < 20; i += 1) {
      try {
        const col = await db.listAttributes(DB_ID, COL_NOTIFICATIONS);
        if ((col.attributes as { status?: string }[]).every(a => a.status === 'available')) break;
      } catch { /* keep polling */ }
      await sleep(500);
    }
    await Promise.all([
      { key: 'idx_user',    attrs: ['userId'],    orders: [OrderBy.Asc] },
      { key: 'idx_created', attrs: ['createdAt'], orders: [OrderBy.Desc] },
    ].map(i => db.createIndex(DB_ID, COL_NOTIFICATIONS, i.key, DatabasesIndexType.Key, i.attrs, i.orders).catch(() => {})));
  } catch (err) {
    if (String(err).includes('missing scopes')) return;
    throw err;
  }
}

/** สร้างแจ้งเตือนให้ผู้ใช้หลายคน (best-effort — ห้ามทำให้ action หลักล้ม) */
export async function notifyUsers(
  db: Databases,
  userIds: string[],
  n: { title: string; body: string; link: string },
) {
  try {
    await ensureNotificationsCollection(db);
    const unique = [...new Set(userIds.filter(Boolean))];
    await Promise.all(unique.map(userId =>
      db.createDocument(DB_ID, COL_NOTIFICATIONS, ID.unique(), {
        userId,
        title: n.title.slice(0, 200),
        body: n.body.slice(0, 500),
        link: n.link.slice(0, 300),
        read: false,
        createdAt: new Date().toISOString(),
      }).catch(() => null),
    ));
  } catch { /* best effort */ }
}
