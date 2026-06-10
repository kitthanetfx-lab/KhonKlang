'use client';

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { account, fileViewUrl } from '@/lib/appwrite';
import {
  Search, CheckCircle2, XCircle, Eye,
  Store, RefreshCw, FileText, Download,
} from 'lucide-react';

interface SellerApp {
  $id: string;
  userId: string;
  fullNameId: string;
  idNumber: string;
  sellerType: string;
  province: string;
  address: string;
  onlineLink: string;
  companyName: string;
  companyRegNum: string;
  bankAcct: string;
  bankName: string;
  bankOwner: string;
  companyBankAcct: string;
  companyBankName: string;
  idCardFileId: string;
  companyCertFileId: string;
  bookbankFileId: string;
  slipFileId: string;
  status: string;
  rejectReason?: string;
  $createdAt: string;
}

const STATUS_TABS = [
  { key: '',               label: 'ทั้งหมด' },
  { key: 'pending_review', label: 'รอตรวจสอบ' },
  { key: 'approved',       label: 'อนุมัติแล้ว' },
  { key: 'rejected',       label: 'ปฏิเสธ' },
];

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending_review: { label: 'รอตรวจสอบ', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  approved:       { label: 'อนุมัติแล้ว', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  rejected:       { label: 'ปฏิเสธ',     cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const SELLER_TYPE_LABEL: Record<string, string> = {
  freelance:   'ผู้ค้าอิสระ',
  physical:    'มีหน้าร้าน',
  distributor: 'ตัวแทนจำหน่าย',
  corporate:   'บริษัท/นิติบุคคล',
};

function maskId(id: string) {
  if (id.length <= 6) return id;
  return id.slice(0, 3) + 'x'.repeat(id.length - 6) + id.slice(-3);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CFG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl divide-y divide-gray-100 dark:divide-gray-700/50">
        {children}
      </div>
    </div>
  );
}

function Row({ k, v, multiline }: { k: string; v: string; multiline?: boolean }) {
  if (!v) return null;
  return (
    <div className={`flex gap-3 px-4 py-2.5 ${multiline ? 'flex-col' : ''}`}>
      <span className="text-xs text-gray-400 shrink-0 w-32">{k}</span>
      <span className={`text-sm font-medium break-all ${multiline ? '' : 'text-right ml-auto'}`}>{v}</span>
    </div>
  );
}

function FileCard({ label, fileId }: { label: string; fileId: string }) {
  const [imgOk, setImgOk] = useState(true);
  if (!fileId) return null;
  const url   = fileViewUrl(fileId);
  const dlUrl = fileViewUrl(fileId) + '&output=attachment';
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <FileText size={13} className="text-gray-400" />
          {label}
        </div>
        <div className="flex gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            <Eye size={12} /> ดูเต็มจอ
          </a>
          <a href={dlUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1">
            <Download size={12} /> ดาวน์โหลด
          </a>
        </div>
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {imgOk ? (
          <img
            src={url}
            alt={label}
            className="w-full max-h-52 object-contain rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 cursor-zoom-in hover:opacity-90 transition-opacity"
            onError={() => setImgOk(false)}
          />
        ) : (
          <div className="flex items-center justify-center h-20 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-400 text-sm gap-2">
            <FileText size={18} /> คลิกเพื่อเปิดไฟล์
          </div>
        )}
      </a>
    </div>
  );
}

// ── Detail slide-over ──
function DetailPanel({ app, onClose, onAction }: {
  app: SellerApp;
  onClose: () => void;
  onAction: (id: string, action: 'approve' | 'reject', reason?: string) => Promise<void>;
}) {
  const [acting, setActing]         = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason]         = useState('');

  const handle = async (action: 'approve' | 'reject') => {
    setActing(true);
    await onAction(app.$id, action, action === 'reject' ? reason : undefined);
    setActing(false);
    setShowReject(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold">รายละเอียดใบสมัครผู้ขาย</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="flex items-center gap-3">
            <StatusBadge status={app.status} />
            <span className="text-xs text-gray-400">{formatDate(app.$createdAt)}</span>
          </div>

          <Section label="ข้อมูลส่วนตัว">
            <Row k="ชื่อ-นามสกุล"    v={app.fullNameId} />
            <Row k="เลขบัตรประชาชน"  v={maskId(app.idNumber)} />
            <Row k="ประเภทผู้ขาย"    v={SELLER_TYPE_LABEL[app.sellerType] ?? app.sellerType} />
          </Section>

          {app.sellerType === 'corporate' && (app.companyName || app.companyRegNum) && (
            <Section label="ข้อมูลบริษัท">
              {app.companyName   && <Row k="ชื่อบริษัท"          v={app.companyName} />}
              {app.companyRegNum && <Row k="เลขทะเบียนนิติบุคคล" v={maskId(app.companyRegNum)} />}
            </Section>
          )}

          <Section label="ที่อยู่และช่องทางขาย">
            <Row k="จังหวัด"          v={app.province} />
            <Row k="ที่อยู่"           v={app.address} multiline />
            {app.onlineLink && <Row k="หน้าร้านออนไลน์" v={app.onlineLink} />}
          </Section>

          <Section label="บัญชีธนาคาร">
            <Row k="ธนาคาร"     v={app.bankName} />
            <Row k="เลขที่บัญชี" v={app.bankAcct} />
            <Row k="ชื่อบัญชี"   v={app.bankOwner} />
            {app.companyBankAcct && (
              <>
                <Row k="บัญชีบริษัท (ธนาคาร)" v={app.companyBankName} />
                <Row k="บัญชีบริษัท (เลข)"    v={app.companyBankAcct} />
              </>
            )}
          </Section>

          <Section label="เอกสารแนบ">
            <FileCard label="บัตรประชาชน"         fileId={app.idCardFileId} />
            <FileCard label="หนังสือรับรองบริษัท"  fileId={app.companyCertFileId} />
            <FileCard label="สมุดบัญชีธนาคาร"      fileId={app.bookbankFileId} />
            <FileCard label="สลิปโอนค่าสมัคร"      fileId={app.slipFileId} />
          </Section>

          {app.rejectReason && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">เหตุผลการปฏิเสธ</p>
              <p className="text-sm text-red-700 dark:text-red-300">{app.rejectReason}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {app.status === 'pending_review' && (
          <div className="shrink-0 border-t border-gray-200 dark:border-gray-800 p-4 space-y-3">
            {showReject ? (
              <div className="space-y-2">
                <textarea
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-400 bg-white dark:bg-gray-800 resize-none"
                  rows={3} placeholder="เหตุผลการปฏิเสธ (ไม่บังคับ)"
                  value={reason} onChange={e => setReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <button onClick={() => setShowReject(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                    ยกเลิก
                  </button>
                  <button onClick={() => handle('reject')} disabled={acting}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-60 transition-all">
                    {acting ? 'กำลังดำเนินการ...' : 'ยืนยันการปฏิเสธ'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button onClick={() => setShowReject(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                  <XCircle size={16} /> ปฏิเสธ
                </button>
                <button onClick={() => handle('approve')} disabled={acting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-60 transition-all">
                  {acting ? 'กำลังอนุมัติ...' : <><CheckCircle2 size={16} /> อนุมัติ</>}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ──
function SellersContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const [apps, setApps]       = useState<SellerApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [detail, setDetail]   = useState<SellerApp | null>(null);
  const [jwt, setJwt]         = useState('');

  const statusFilter = searchParams.get('status') ?? '';

  const load = useCallback(async (j?: string) => {
    const token = j ?? jwt;
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res  = await fetch(`/api/admin/sellers?${params}`, { headers: { 'x-session-jwt': token } });
      const data = await res.json();
      setApps(data.documents ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [jwt, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const { jwt: j } = await account.createJWT().catch(() => ({ jwt: '' }));
      if (!j || cancelled) return;
      setJwt(j);
      await load(j);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [load]);

  const handleAction = async (docId: string, action: 'approve' | 'reject', reason?: string) => {
    const res = await fetch('/api/admin/sellers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-session-jwt': jwt },
      body: JSON.stringify({ docId, action, reason }),
    });
    if (res.ok) { setDetail(null); load(); }
  };

  const filtered = apps.filter(a =>
    !search ||
    a.fullNameId.toLowerCase().includes(search.toLowerCase()) ||
    a.province?.toLowerCase().includes(search.toLowerCase())
  );

  const setStatus = (s: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (s) params.set('status', s); else params.delete('status');
    router.push(`/admin/sellers?${params}`);
  };

  return (
    <div className="space-y-5 max-w-6xl">
      {detail && (
        <DetailPanel app={detail} onClose={() => setDetail(null)} onAction={handleAction} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Store size={20} /> ใบสมัครผู้ขาย</h1>
          <p className="text-sm text-gray-500 mt-0.5">จัดการและอนุมัติใบสมัครผู้ขายในเครือ</p>
        </div>
        <button onClick={() => load()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
          <RefreshCw size={15} /> รีเฟรช
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setStatus(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statusFilter === t.key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            {t.label}
            {t.key === 'pending_review' && apps.filter(a => a.status === 'pending_review').length > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {apps.filter(a => a.status === 'pending_review').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full max-w-sm pl-9 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900"
          placeholder="ค้นหาชื่อหรือจังหวัด..." value={search} onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">ชื่อ-นามสกุล</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">ประเภท</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">จังหวัด</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">เลขบัตร</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">วันที่สมัคร</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">สถานะ</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">ไม่มีข้อมูล</td>
                </tr>
              ) : filtered.map(app => (
                <tr key={app.$id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="px-5 py-3.5 font-medium">{app.fullNameId}</td>
                  <td className="px-4 py-3.5 text-gray-600 dark:text-gray-400">{SELLER_TYPE_LABEL[app.sellerType] ?? app.sellerType}</td>
                  <td className="px-4 py-3.5 text-gray-600 dark:text-gray-400">{app.province || '—'}</td>
                  <td className="px-4 py-3.5 font-mono text-xs text-gray-500">{maskId(app.idNumber)}</td>
                  <td className="px-4 py-3.5 text-gray-500 text-xs whitespace-nowrap">{formatDate(app.$createdAt)}</td>
                  <td className="px-4 py-3.5"><StatusBadge status={app.status} /></td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => setDetail(app)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                        <Eye size={13} /> ดูข้อมูล
                      </button>
                      {app.status === 'pending_review' && (
                        <>
                          <button onClick={() => handleAction(app.$id, 'reject')}
                            className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                            ปฏิเสธ
                          </button>
                          <button onClick={() => handleAction(app.$id, 'approve')}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-all">
                            อนุมัติ
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
            แสดง {filtered.length} จาก {apps.length} รายการ
          </div>
        )}
      </div>
    </div>
  );
}

export default function SellersPage() {
  return (
    <Suspense>
      <SellersContent />
    </Suspense>
  );
}
