'use client';

import { useState, useEffect, useCallback } from 'react';
import { account } from '@/lib/appwrite';
import { ShieldAlert, CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '';
const PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
const fileUrl = (id: string) => `${ENDPOINT}/storage/buckets/report_files/files/${id}/view?project=${PROJECT}`;

interface Report {
  $id: string; firstName: string; lastName: string; idCard: string;
  bankAccounts: string; product: string; amount: number; transferDate: string;
  sellerPage: string; province: string; detail: string;
  chatImageIds: string; policeDocIds: string; slipImageIds: string;
  contactEmail: string; contactPhone: string; contactLine: string;
  sourceName: string; status: string; createdAt: string;
}

const TABS = [
  { k: 'pending_review', label: 'รอตรวจสอบ' },
  { k: 'approved', label: 'เผยแพร่แล้ว' },
  { k: 'rejected', label: 'ปฏิเสธ' },
];

function parseArr(s: string): string[] { try { return JSON.parse(s || '[]'); } catch { return []; } }
function parseAccts(s: string): { acct: string; bank: string }[] { try { return JSON.parse(s || '[]'); } catch { return []; } }

export default function AdminScamReports() {
  const [tab, setTab] = useState('pending_review');
  const [reports, setReports] = useState<Report[] | null>(null);
  const [acting, setActing] = useState('');
  const [expanded, setExpanded] = useState('');

  const load = useCallback(async (status: string) => {
    setReports(null);
    try {
      const jwt = (await account.createJWT()).jwt;
      const r = await fetch(`/api/admin/scam-reports?status=${status}`, { headers: { 'x-session-jwt': jwt } });
      const d = await r.json();
      setReports(d.documents || []);
    } catch { setReports([]); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(tab); }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, load]);

  async function act(id: string, action: 'approve' | 'reject') {
    setActing(id);
    try {
      const jwt = (await account.createJWT()).jwt;
      const r = await fetch('/api/admin/scam-reports', {
        method: 'PATCH',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (r.ok) setReports(prev => (prev || []).filter(x => x.$id !== id));
    } finally { setActing(''); }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <ShieldAlert size={22} className="text-red-500" />
        <h1 className="text-xl font-bold">รายงานคนโกง</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">ตรวจสอบหลักฐานก่อนเผยแพร่ในฐานข้อมูล — เพื่อป้องกันผู้บริสุทธิ์เสียหายและความเสี่ยงด้านกฎหมาย</p>

      <div className="flex gap-2 mb-5">
        {TABS.map(t => (
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
          const accts = parseAccts(r.bankAccounts);
          const imgs = [...parseArr(r.slipImageIds), ...parseArr(r.chatImageIds), ...parseArr(r.policeDocIds)];
          const open = expanded === r.$id;
          return (
            <div key={r.$id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-bold text-gray-900 dark:text-gray-100">{r.firstName} {r.lastName}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                    {accts.map((a, i) => <span key={i} className="font-mono">🏦 {a.acct} {a.bank}</span>)}
                    {r.idCard && <span>บัตร: {r.idCard}</span>}
                    {r.amount > 0 && <span>฿{Number(r.amount).toLocaleString()}</span>}
                    {r.sellerPage && <span>เพจ: {r.sellerPage}</span>}
                  </div>
                </div>
                <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString('th-TH')}</span>
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
                    {r.contactEmail && <p>อีเมล: {r.contactEmail}</p>}
                    {r.contactPhone && <p>โทร: {r.contactPhone}</p>}
                    {r.contactLine && <p>LINE: {r.contactLine}</p>}
                    {!r.contactEmail && !r.contactPhone && !r.contactLine && <p>— ไม่ระบุ —</p>}
                  </div>
                </>
              )}

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <button onClick={() => setExpanded(open ? '' : r.$id)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <ExternalLink size={12} /> {open ? 'ย่อ' : `ดูหลักฐาน (${imgs.length} รูป) + ติดต่อ`}
                </button>
                {tab === 'pending_review' && (
                  <div className="ml-auto flex gap-2">
                    <button onClick={() => act(r.$id, 'reject')} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 hover:bg-red-50 hover:text-red-600 flex items-center gap-1 disabled:opacity-50">
                      <XCircle size={14} /> ปฏิเสธ
                    </button>
                    <button onClick={() => act(r.$id, 'approve')} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-1 disabled:opacity-50">
                      {acting === r.$id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} เผยแพร่
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
