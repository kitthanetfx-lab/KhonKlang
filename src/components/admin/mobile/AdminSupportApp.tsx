'use client';

import { ReactNode } from 'react';
import { AppTop, AppFeed } from '@/components/mobile/shells';
import { Icon } from '@/components/Icon';
import { AdminAppSearch } from './AdminAppFrame';

export type SupportThread = {
  customer_id: string;
  customer_name: string;
  last_message: string;
  last_at: string;
  unread_staff: boolean;
  call_status: string;
};

export type SupportMsg = {
  id: string;
  sender_role: 'customer' | 'staff' | 'system';
  sender_name?: string;
  content: string;
  image_url?: string;
  created_at: string;
  pending?: boolean;
};

type Props = {
  threads: SupportThread[] | null;
  filtered: SupportThread[];
  search: string;
  onSearch: (v: string) => void;
  selected: string;
  onSelect: (id: string) => void;
  threadName?: string;
  threadSub?: string;
  msgs: SupportMsg[];
  input: string;
  onInput: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  onBack: () => void;
  onImagePick: () => void;
  uploading: boolean;
  callBanner?: ReactNode;
  headerActions?: ReactNode;
  composeDisabled?: boolean;
  timeShort: (iso: string) => string;
  dayShort: (iso: string) => string;
  readByCustomer?: (m: SupportMsg) => boolean;
};

export function AdminSupportApp({
  threads, filtered, search, onSearch, selected, onSelect, threadName, threadSub,
  msgs, input, onInput, onSend, sending, onBack, onImagePick, uploading,
  callBanner, headerActions, composeDisabled, timeShort, dayShort, readByCustomer,
}: Props) {
  const inThread = !!selected;

  return (
    <div className="admin-app">
      <AppTop
        classPrefix="admin-app"
        title={inThread ? (threadName || 'แชท') : 'แชทลูกค้า'}
        subtitle={inThread ? threadSub : `${threads?.length ?? 0} ห้อง`}
        onBack={inThread ? onBack : undefined}
        right={headerActions}
      />

      {!inThread ? (
        <>
          <div className="admin-app-toolbar px-[var(--app-pad,14px)]">
            <AdminAppSearch value={search} onChange={onSearch} placeholder="ค้นหาชื่อลูกค้า…" />
          </div>
          <AppFeed classPrefix="admin-app">
            {threads === null ? (
              <div className="app-loading"><div className="mkt-spinner" /></div>
            ) : filtered.length === 0 ? (
              <div className="app-empty"><p>ยังไม่มีห้องแชท</p></div>
            ) : (
              filtered.map(t => (
                <button
                  key={t.customer_id}
                  type="button"
                  className="admin-app-card w-full text-left"
                  onClick={() => onSelect(t.customer_id)}
                >
                  <div className="admin-app-card-main">
                    <div className="admin-app-card-title flex items-center gap-2">
                      {t.customer_name}
                      {t.unread_staff && <span className="w-2 h-2 rounded-full bg-rose-500" />}
                    </div>
                    <div className="admin-app-card-sub truncate">{t.last_message || 'ยังไม่มีข้อความ'}</div>
                    <div className="admin-app-card-meta">{dayShort(t.last_at)}</div>
                  </div>
                  <Icon name="chevronRight" size={18} className="text-gray-300 shrink-0 self-center" />
                </button>
              ))
            )}
          </AppFeed>
        </>
      ) : (
        <>
          {callBanner}
          <AppFeed classPrefix="admin-app">
            <div className="admin-app-msg-list">
              {msgs.length === 0 && <p className="text-center text-sm text-gray-400 py-8">ยังไม่มีข้อความ</p>}
              {msgs.map(m => {
                if (m.sender_role === 'system') {
                  return <p key={m.id} className="text-center text-xs text-gray-400">{m.content}</p>;
                }
                const mine = m.sender_role === 'staff';
                return (
                  <div key={m.id} className={mine ? 'ml-auto max-w-[85%]' : 'max-w-[85%]'}>
                    <div className={`admin-app-msg${mine ? ' is-mine' : ' is-theirs'}`}>
                      {m.image_url && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={m.image_url} alt="" className="max-w-full rounded-lg mb-1" />
                      )}
                      {m.content}
                    </div>
                    <div className={`admin-app-msg-meta${mine ? ' text-right' : ''}`}>
                      {timeShort(m.created_at)}{m.pending ? ' · กำลังส่ง…' : readByCustomer?.(m) ? ' · อ่านแล้ว' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </AppFeed>
          <div className="admin-app-compose px-[var(--app-pad,14px)] pb-[calc(10px+env(safe-area-inset-bottom,0px))]">
            <button type="button" onClick={onImagePick} disabled={uploading || composeDisabled} aria-label="แนบรูป"
              className="w-11 h-11 rounded-full border border-gray-200 bg-white shrink-0 disabled:opacity-40">
              📷
            </button>
            <input
              value={input}
              onChange={e => onInput(e.target.value)}
              placeholder="พิมพ์ข้อความ…"
              disabled={composeDisabled}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            />
            <button type="button" onClick={onSend} disabled={!input.trim() || sending || composeDisabled} aria-label="ส่ง">
              <Icon name="arrowRight" size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
