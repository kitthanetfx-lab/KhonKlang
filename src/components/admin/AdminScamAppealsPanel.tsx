'use client';

import { CheckCircle2, ExternalLink, Loader2, XCircle } from 'lucide-react';

export type ScamAppealRow = {
  id: string;
  report_id: string;
  appellant_name: string;
  contact_phone: string | null;
  contact_line: string | null;
  contact_email: string | null;
  statement: string;
  evidence_image_ids: string[];
  status: string;
  created_at: string;
  report?: {
    id: string;
    first_name: string;
    last_name: string;
    bank_accounts: { acct: string; bank: string }[];
    product: string;
    amount: number;
    seller_page: string;
    province: string;
    detail: string;
    status: string;
    slip_image_ids: string[];
    chat_image_ids: string[];
    police_doc_ids: string[];
    created_at: string;
  } | null;
};

const APPEAL_TABS = [
  { k: 'pending_review', label: 'รอพิจารณา' },
  { k: 'approved', label: 'รับอุธรณ์แล้ว' },
  { k: 'rejected', label: 'ปฏิเสธอุธรณ์' },
];

type Props = {
  tab: string;
  appeals: ScamAppealRow[] | null;
  acting: string;
  expanded: string;
  fileUrl: (id: string) => string;
  onTab: (tab: string) => void;
  onExpand: (id: string) => void;
  onAct: (id: string, action: 'accept' | 'reject') => void;
  variant?: 'desktop' | 'mobile';
};

export function AdminScamAppealsPanel({
  tab,
  appeals,
  acting,
  expanded,
  fileUrl,
  onTab,
  onExpand,
  onAct,
  variant = 'desktop',
}: Props) {
  const isMobile = variant === 'mobile';

  return (
    <div>
      <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4`}>
        คำอุธรณ์จากผู้ที่ถูกรายงาน — หากไม่ผิดจริง กด「รับอุธรณ์」เพื่อถอนรายงานออกจากฐานข้อมูลสาธารณะ
      </p>

      <div className={`flex gap-2 mb-4 ${isMobile ? 'flex-wrap' : ''}`}>
        {APPEAL_TABS.map(t => (
          <button
            key={t.k}
            type="button"
            onClick={() => onTab(t.k)}
            className={isMobile
              ? `admin-app-chip${tab === t.k ? ' is-on' : ''}`
              : `px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.k ? 'bg-amber-500 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {appeals === null && (
        <div className={`flex justify-center ${isMobile ? 'py-10' : 'py-16'}`}>
          <Loader2 className="animate-spin text-gray-400" />
        </div>
      )}

      {appeals !== null && appeals.length === 0 && (
        <div className={`text-center ${isMobile ? 'py-10' : 'py-16'} text-gray-400`}>
          <CheckCircle2 size={36} className="mx-auto mb-2 opacity-40" />
          <p>ไม่มีคำอุธรณ์ในหมวดนี้</p>
        </div>
      )}

      <div className="space-y-3">
        {(appeals || []).map(a => {
          const r = a.report;
          const open = expanded === a.id;
          const reportImgs = r
            ? [...(r.slip_image_ids || []), ...(r.chat_image_ids || []), ...(r.police_doc_ids || [])]
            : [];
          const appealImgs = a.evidence_image_ids || [];
          const accts = r?.bank_accounts || [];

          return (
            <div
              key={a.id}
              className={`${isMobile ? 'admin-app-card' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4'}`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-bold text-gray-900 dark:text-gray-100">
                    อุธรณ์: {a.appellant_name}
                  </p>
                  {r && (
                    <p className="text-sm text-rose-600 mt-0.5">
                      รายงาน: {r.first_name} {r.last_name}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                    {accts.map((acct, i) => (
                      <span key={i} className="font-mono">🏦 {acct.acct} {acct.bank}</span>
                    ))}
                    {r?.amount ? <span>฿{Number(r.amount).toLocaleString()}</span> : null}
                    {r?.product ? <span>สินค้า: {r.product}</span> : null}
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(a.created_at).toLocaleDateString('th-TH')}
                </span>
              </div>

              <div className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {open ? a.statement : `${a.statement.slice(0, 200)}${a.statement.length > 200 ? '…' : ''}`}
              </div>

              {open && (
                <>
                  {(appealImgs.length > 0 || reportImgs.length > 0) && (
                    <div className="mt-3">
                      {appealImgs.length > 0 && (
                        <>
                          <p className="text-xs font-semibold text-gray-600 mb-2">หลักฐานจากผู้ยื่นอุธรณ์</p>
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-3">
                            {appealImgs.map(id => (
                              <a key={id} href={fileUrl(id)} target="_blank" rel="noopener noreferrer" className="block">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={fileUrl(id)} alt="หลักฐานอุธรณ์" loading="lazy" className="w-full aspect-square object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                              </a>
                            ))}
                          </div>
                        </>
                      )}
                      {reportImgs.length > 0 && (
                        <>
                          <p className="text-xs font-semibold text-gray-600 mb-2">หลักฐานจากรายงานเดิม</p>
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                            {reportImgs.map(id => (
                              <a key={id} href={fileUrl(id)} target="_blank" rel="noopener noreferrer" className="block">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={fileUrl(id)} alt="หลักฐานรายงาน" loading="lazy" className="w-full aspect-square object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                              </a>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <div className="mt-3 text-xs text-gray-500 space-y-1 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <p className="font-semibold text-gray-600 dark:text-gray-300">ช่องทางติดต่อผู้ยื่นอุธรณ์:</p>
                    {a.contact_email && <p>อีเมล: {a.contact_email}</p>}
                    {a.contact_phone && <p>โทร: {a.contact_phone}</p>}
                    {a.contact_line && <p>LINE: {a.contact_line}</p>}
                    {!a.contact_email && !a.contact_phone && !a.contact_line && <p>— ไม่ระบุ —</p>}
                    {r?.detail && (
                      <p className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2 whitespace-pre-wrap">
                        รายงานเดิม: {r.detail}
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => onExpand(open ? '' : a.id)}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <ExternalLink size={12} /> {open ? 'ย่อ' : 'ดูหลักฐาน + รายละเอียด'}
                </button>
                {tab === 'pending_review' && (
                  <div className="ml-auto flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onAct(a.id, 'reject')}
                      disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 hover:bg-red-50 hover:text-red-600 flex items-center gap-1 disabled:opacity-50"
                    >
                      <XCircle size={14} /> ปฏิเสธอุธรณ์
                    </button>
                    <button
                      type="button"
                      onClick={() => onAct(a.id, 'accept')}
                      disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 flex items-center gap-1 disabled:opacity-50"
                    >
                      {acting === a.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      รับอุธรณ์ — ลบออกจากฐานข้อมูล
                    </button>
                  </div>
                )}
                {tab === 'approved' && r?.status === 'rejected' && (
                  <span className="ml-auto text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
                    ถอนออกจากฐานข้อมูลแล้ว
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
