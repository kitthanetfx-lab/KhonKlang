'use client';

import { useState, useEffect, useCallback } from 'react';
import { authHeaders, fileViewUrl, REPORT_BUCKET } from '@/lib/supabase';
import { ShieldAlert, CheckCircle2, XCircle, Loader2, ExternalLink, Scale } from 'lucide-react';
import { AdminScamReportsApp } from '@/components/admin/mobile/AdminScamReportsApp';
import { AdminScamAppealsPanel, type ScamAppealRow } from '@/components/admin/AdminScamAppealsPanel';

const fileUrl = (id: string) => fileViewUrl(REPORT_BUCKET, id);

interface Report {
  id: string; first_name: string; last_name: string; id_card: string;
  bank_accounts: { acct: string; bank: string }[]; product: string; amount: number; transfer_date: string;
  seller_page: string; province: string; detail: string;
  chat_image_ids: string[]; police_doc_ids: string[]; slip_image_ids: string[];
  contact_email: string; contact_phone: string; contact_line: string;
  source_name: string; status: string; created_at: string;
}

type Section = 'reports' | 'appeals';

const REPORT_TABS = [
  { k: 'pending_review', label: 'รอตรวจสอบ' },
  { k: 'approved', label: 'เผยแพร่แล้ว' },
  { k: 'rejected', label: 'ปฏิเสธ' },
];

export default function AdminScamReports() {
  const [section, setSection] = useState<Section>('reports');
  const [tab, setTab] = useState('pending_review');
  const [appealTab, setAppealTab] = useState('pending_review');
  const [reports, setReports] = useState<Report[] | null>(null);
  const [appeals, setAppeals] = useState<ScamAppealRow[] | null>(null);
  const [acting, setActing] = useState('');
  const [expanded, setExpanded] = useState('');
  const [appealExpanded, setAppealExpanded] = useState('');

  const loadReports = useCallback(async (status: string) => {
    setReports(null);
    try {
      const headers = await authHeaders();
      const r = await fetch(`/api/admin/scam-reports?status=${status}`, { headers });
      const d = await r.json();
      setReports(d.documents || []);
    } catch { setReports([]); }
  }, []);

  const loadAppeals = useCallback(async (status: string) => {
    setAppeals(null);
    try {
      const headers = await authHeaders();
      const r = await fetch(`/api/admin/scam-appeals?status=${status}`, { headers });
      const d = await r.json();
      setAppeals(d.documents || []);
    } catch { setAppeals([]); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (section === 'reports') void loadReports(tab);
      else void loadAppeals(appealTab);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [section, tab, appealTab, loadReports, loadAppeals]);

  async function actReport(id: string, action: 'approve' | 'reject') {
    setActing(id);
    try {
      const headers = await authHeaders();
      const r = await fetch('/api/admin/scam-reports', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (r.ok) setReports(prev => (prev || []).filter(x => x.id !== id));
    } finally { setActing(''); }
  }

  async function actAppeal(id: string, action: 'accept' | 'reject') {
    const msg = action === 'accept'
      ? 'รับอุธรณ์ — จะถอนรายงานนี้ออกจากฐานข้อมูลสาธารณะทันที ยืนยัน?'
      : 'ปฏิเสธอุธรณ์ — รายงานจะยังอยู่ในฐานข้อมูล ยืนยัน?';
    if (!window.confirm(msg)) return;

    setActing(id);
    try {
      const headers = await authHeaders();
      const r = await fetch('/api/admin/scam-appeals', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error || 'ดำเนินการไม่สำเร็จ'); return; }
      setAppeals(prev => (prev || []).filter(x => x.id !== id));
    } finally { setActing(''); }
  }

  const sectionTabs = (
    <div className="flex gap-2 mb-4">
      <button
        type="button"
        onClick={() => setSection('reports')}
        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 ${section === 'reports' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'}`}
      >
        <ShieldAlert size={15} /> รายงานคนโกง
      </button>
      <button
        type="button"
        onClick={() => setSection('appeals')}
        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 ${section === 'appeals' ? 'bg-amber-500 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'}`}
      >
        <Scale size={15} /> อุธรณ์ / คำชี้แจง
      </button>
    </div>
  );

  return (
    <>
      <div className="admin-mobile-only">
        {sectionTabs}
        {section === 'reports' ? (
          <AdminScamReportsApp
            tab={tab}
            reports={reports}
            onTab={setTab}
            fileUrl={fileUrl}
            renderActions={r => (
              <div className="flex gap-2">
                <button type="button" onClick={() => actReport(r.id, 'reject')} disabled={!!acting}
                  className="text-xs text-gray-600">ปฏิเสธ</button>
                <button type="button" onClick={() => actReport(r.id, 'approve')} disabled={!!acting}
                  className="text-xs text-green-600">{acting === r.id ? '…' : 'เผยแพร่'}</button>
              </div>
            )}
          />
        ) : (
          <AdminScamAppealsPanel
            variant="mobile"
            tab={appealTab}
            appeals={appeals}
            acting={acting}
            expanded={appealExpanded}
            fileUrl={fileUrl}
            onTab={setAppealTab}
            onExpand={setAppealExpanded}
            onAct={actAppeal}
          />
        )}
      </div>

      <div className="admin-desktop-only">
        <div className="w-full">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert size={22} className="text-red-500" />
            <h1 className="text-xl font-bold">รายงานคนโกง</h1>
          </div>
          <p className="text-sm text-gray-500 mb-5">
            ตรวจสอบหลักฐานก่อนเผยแพร่ในฐานข้อมูล — และพิจารณาคำอุธรณ์จากผู้ที่ถูกรายงาน
          </p>

          {sectionTabs}

          {section === 'reports' ? (
            <>
              <div className="flex gap-2 mb-5">
                {REPORT_TABS.map(t => (
                  <button key={t.k} onClick={() => setTab(t.k)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.k ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              {reports === null && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>}
              {reports !== null && reports.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                  <CheckCircle2 size={36} className="mx-auto mb-2 opacity-40" />
                  <p>ไม่มีรายงานในหมวดนี้</p>
                </div>
              )}

              <div className="space-y-3">
                {(reports || []).map(r => {
                  const accts = r.bank_accounts || [];
                  const imgs = [...(r.slip_image_ids || []), ...(r.chat_image_ids || []), ...(r.police_doc_ids || [])];
                  const open = expanded === r.id;
                  return (
                    <div key={r.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-bold text-gray-900 dark:text-gray-100">{r.first_name} {r.last_name}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                            {accts.map((a, i) => <span key={i} className="font-mono">🏦 {a.acct} {a.bank}</span>)}
                            {r.id_card && <span>บัตร: {r.id_card}</span>}
                            {r.amount > 0 && <span>฿{Number(r.amount).toLocaleString()}</span>}
                            {r.seller_page && <span>เพจ: {r.seller_page}</span>}
                          </div>
                        </div>
                        <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('th-TH')}</span>
                      </div>

                      {r.detail && <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 leading-relaxed whitespace-pre-wrap">{open ? r.detail : r.detail.slice(0, 200) + (r.detail.length > 200 ? '…' : '')}</p>}

                      {open && (
                        <>
                          {imgs.length > 0 && (
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3">
                              {imgs.map(id => (
                                <a key={id} href={fileUrl(id)} target="_blank" rel="noopener noreferrer" className="block">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={fileUrl(id)} alt="หลักฐาน" loading="lazy" className="w-full aspect-square object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                                </a>
                              ))}
                            </div>
                          )}
                          <div className="mt-3 text-xs text-gray-500 space-y-1 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                            <p className="font-semibold text-gray-600 dark:text-gray-300">ข้อมูลติดต่อผู้รายงาน (ลับ):</p>
                            {r.contact_email && <p>อีเมล: {r.contact_email}</p>}
                            {r.contact_phone && <p>โทร: {r.contact_phone}</p>}
                            {r.contact_line && <p>LINE: {r.contact_line}</p>}
                            {!r.contact_email && !r.contact_phone && !r.contact_line && <p>— ไม่ระบุ —</p>}
                          </div>
                        </>
                      )}

                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <button onClick={() => setExpanded(open ? '' : r.id)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                          <ExternalLink size={12} /> {open ? 'ย่อ' : `ดูหลักฐาน (${imgs.length} รูป) + ติดต่อ`}
                        </button>
                        {tab === 'pending_review' && (
                          <div className="ml-auto flex gap-2">
                            <button onClick={() => actReport(r.id, 'reject')} disabled={!!acting}
                              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 hover:bg-red-50 hover:text-red-600 flex items-center gap-1 disabled:opacity-50">
                              <XCircle size={14} /> ปฏิเสธ
                            </button>
                            <button onClick={() => actReport(r.id, 'approve')} disabled={!!acting}
                              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-1 disabled:opacity-50">
                              {acting === r.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} เผยแพร่
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <AdminScamAppealsPanel
              tab={appealTab}
              appeals={appeals}
              acting={acting}
              expanded={appealExpanded}
              fileUrl={fileUrl}
              onTab={setAppealTab}
              onExpand={setAppealExpanded}
              onAct={actAppeal}
            />
          )}
        </div>
      </div>
    </>
  );
}
