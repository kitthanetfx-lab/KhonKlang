'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { AppPage } from '@/components/mobile/AppPage';
import { AppHeader } from '@/components/mobile/AppHeader';
import { AppEmpty } from '@/components/mobile/AppStates';
import { Icon } from '@/components/Icon';

export type MessagesThread = {
  threadId: string;
  otherId: string;
  otherName: string;
  lastContent: string;
  lastAt: string;
  fromMe: boolean;
  unread: number;
};

export type MessagesDm = {
  id: string;
  from_id: string;
  content: string;
  created_at: string;
};

type Props = {
  threads: MessagesThread[] | null;
  active: { id: string; name: string } | null;
  msgs: MessagesDm[];
  myId: string;
  input: string;
  sending: boolean;
  timeAgo: (iso: string) => string;
  onOpenThread: (t: MessagesThread) => void;
  onCloseThread: () => void;
  onInput: (v: string) => void;
  onSend: () => void;
  bottomRef: React.RefObject<HTMLDivElement | null>;
};

export function MessagesApp({
  threads,
  active,
  msgs,
  myId,
  input,
  sending,
  timeAgo,
  onOpenThread,
  onCloseThread,
  onInput,
  onSend,
  bottomRef,
}: Props) {
  if (active) {
    return (
      <AppPage withBottomNav={false} className="dm-app dm-app--room">
        <header className="dm-app-room-head">
          <button type="button" className="dm-app-back" onClick={onCloseThread} aria-label="กลับไปรายชื่อ">
            <Icon name="chevronLeft" size={22} />
          </button>
          <span className="dm-app-av">{(active.name || '?').slice(0, 1)}</span>
          <strong className="dm-app-room-name">{active.name}</strong>
        </header>
        <div className="dm-app-feed">
          {msgs.length === 0 && (
            <p className="dm-app-feed-empty">เริ่มบทสนทนากับ {active.name}</p>
          )}
          {msgs.map(m => {
            const mine = m.from_id === myId;
            return (
              <div key={m.id} className={`dm-app-row${mine ? ' is-mine' : ''}`}>
                <div className={`dm-app-bubble${mine ? ' is-mine' : ''}`}>{m.content}</div>
                <small>{new Date(m.created_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div className="dm-app-bar">
          <input
            value={input}
            onChange={e => onInput(e.target.value)}
            placeholder={`ส่งข้อความถึง ${active.name}...`}
            maxLength={2000}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          />
          <button type="button" onClick={onSend} disabled={!input.trim() || sending} aria-label="ส่ง">
            <Icon name="arrowRight" size={17} />
          </button>
        </div>
        <p className="dm-app-safety">⚠️ อย่าโอนเงินนอกระบบ — ชวน<Link href="/deal/create">เปิดดีลผ่านคนกลาง</Link></p>
      </AppPage>
    );
  }

  return (
    <AppPage withBottomNav={false} className="dm-app">
      <AppHeader title="กล่องข้อความ" backHref="/" />
      <div className="dm-app-list">
        {threads === null && <div className="app-loading"><div className="mkt-spinner" /></div>}
        {threads !== null && threads.length === 0 && (
          <AppEmpty>
            <Icon name="message" size={28} />
            <p>ยังไม่มีข้อความ</p>
            <span>ทักจากหน้าสินค้าหรือประกาศหา — ข้อความจะรวมอยู่ที่นี่</span>
          </AppEmpty>
        )}
        {(threads || []).map(t => (
          <button
            key={t.threadId}
            type="button"
            className={`dm-app-thread${t.unread > 0 ? ' is-unread' : ''}`}
            onClick={() => onOpenThread(t)}
          >
            <span className="dm-app-av">{(t.otherName || '?').slice(0, 1)}</span>
            <span className="dm-app-thread-body">
              <b>{t.otherName}</b>
              <span>{t.fromMe ? 'คุณ: ' : ''}{t.lastContent}</span>
            </span>
            <span className="dm-app-thread-meta">
              <small>{timeAgo(t.lastAt)}</small>
              {t.unread > 0 && <span className="dm-app-unread">{t.unread}</span>}
            </span>
          </button>
        ))}
      </div>
    </AppPage>
  );
}

export default MessagesApp;
