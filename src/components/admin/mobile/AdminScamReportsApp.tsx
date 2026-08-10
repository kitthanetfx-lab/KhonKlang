'use client';

import { useState } from 'react';
import { AdminAppCard, AdminAppChip, AdminAppFrame } from './AdminAppFrame';

export type ScamReportRow = {
  id: string;
  first_name: string;
  last_name: string;
  id_card: string;
  bank_accounts: { acct: string; bank: string }[];
  product: string;
  amount: number;
  seller_page: string;
  detail: string;
  chat_image_ids: string[];
  police_doc_ids: string[];
  slip_image_ids: string[];
  contact_email: string;
  contact_phone: string;
  contact_line: string;
  created_at: string;
};

const TABS = [
  { k: 'pending_review', label: 'รอตรวจ' },
  { k: 'approved', label: 'เผยแพร่' },
  { k: 'rejected', label: 'ปฏิเสธ' },
];

type Props = {
  tab: string;
  reports: ScamReportRow[] | null;
  onTab: (t: string) => void;
  renderActions: (r: ScamReportRow) => React.ReactNode;
  fileUrl: (id: string) => string;
};

export function AdminScamReportsApp({ tab, reports, onTab, renderActions, fileUrl }: Props) {
  const [expanded, setExpanded] = useState('');

  return (
    <AdminAppFrame
      title="รายงานคนโกง"
      subtitle="ตรวจหลักฐานก่อนเผยแพร่"
      stats={
        <>
          {TABS.map(t => (
            <AdminAppChip key={t.k} label={t.label} active={tab === t.k} onClick={() => onTab(t.k)} />
          ))}
        </>
      }
    >
      {reports === null ? (
        <div className="app-loading"><div className="mkt-spinner" /></div>
      ) : reports.length === 0 ? (
        <div className="app-empty"><p>ไม่มีรายงาน</p></div>
      ) : (
        reports.map(r => {
          const accts = r.bank_accounts || [];
          const imgs = [...(r.slip_image_ids || []), ...(r.chat_image_ids || []), ...(r.police_doc_ids || [])];
          const open = expanded === r.id;
          return (
            <AdminAppCard
              key={r.id}
              title={`${r.first_name} ${r.last_name}`}
              subtitle={open ? r.detail : (r.detail ? r.detail.slice(0, 120) + (r.detail.length > 120 ? '…' : '') : undefined)}
              badges={
                <>
                  {r.amount > 0 && <span className="admin-app-badge bg-red-100 text-red-700">฿{Number(r.amount).toLocaleString()}</span>}
                  {accts.slice(0, 1).map((a, i) => (
                    <span key={i} className="admin-app-badge bg-gray-100 text-gray-600 font-mono text-[10px]">{a.acct}</span>
                  ))}
                </>
              }
              meta={new Date(r.created_at).toLocaleDateString('th-TH')}
              onClick={() => setExpanded(open ? '' : r.id)}
              actions={
                <div className="admin-app-actions flex-col items-end">
                  <button type="button" className="text-xs text-blue-600" onClick={e => { e.stopPropagation(); setExpanded(open ? '' : r.id); }}>
                    {open ? 'ย่อ' : `หลักฐาน (${imgs.length})`}
                  </button>
                  {tab === 'pending_review' && renderActions(r)}
                </div>
              }
            />
          );
        })
      )}
      {expanded && reports && (() => {
        const r = reports.find(x => x.id === expanded);
        if (!r) return null;
        const imgs = [...(r.slip_image_ids || []), ...(r.chat_image_ids || []), ...(r.police_doc_ids || [])];
        return (
          <div className="admin-app-form-card mt-2">
            {imgs.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {imgs.map(id => (
                  <a key={id} href={fileUrl(id)} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fileUrl(id)} alt="" className="w-full aspect-square object-cover rounded-lg border" />
                  </a>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500">
              ติดต่อ: {r.contact_email || r.contact_phone || r.contact_line || '—'}
            </p>
          </div>
        );
      })()}
    </AdminAppFrame>
  );
}
