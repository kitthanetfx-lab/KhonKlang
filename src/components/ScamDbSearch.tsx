'use client';
/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import { Icon } from './Icon';
import { fileViewUrl, REPORT_BUCKET } from '@/lib/supabase';

const fileUrl = (id: string) => fileViewUrl(REPORT_BUCKET, id);

interface Hit {
  id: string; firstName: string; lastName: string; bankAccounts: { acct: string; bank: string }[];
  product: string; amount: number; transferDate: string; sellerPage: string;
  province: string; detail: string; chatImageIds: string[]; slipImageIds: string[];
  sourceName: string; status: string; createdAt: string;
}

export function ScamDbSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Hit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState('');

  async function search() {
    const query = q.trim();
    if (query.length < 3) { setError('พิมพ์คำค้นอย่างน้อย 3 ตัวอักษร'); return; }
    setLoading(true); setError(''); setResults(null);
    try {
      const r = await fetch(`/api/scam-reports?q=${encodeURIComponent(query)}`);
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'ค้นหาไม่สำเร็จ'); return; }
      setResults(d.results || []);
    } catch { setError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <div className="cs-search-row">
        <div className="cs-search-wrap">
          <svg className="cs-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="ชื่อ-สกุล, เลขบัญชี, เบอร์โทร หรือชื่อเพจ..." onKeyDown={e => { if (e.key === 'Enter') search(); }} />
        </div>
        <button className="cs-btn-all" onClick={search} disabled={loading}>{loading ? 'กำลังค้น...' : 'ค้นหา'}</button>
      </div>

      {error && <p className="rv-error">{error}</p>}

      {results !== null && !loading && (
        results.length === 0 ? (
          <div className="csr-card" style={{ textAlign: 'center', padding: '36px 20px' }}>
            <p style={{ fontSize: 30, marginBottom: 8 }}>✅</p>
            <p style={{ fontWeight: 700, color: 'var(--green-600)', fontFamily: 'var(--font-display)' }}>ไม่พบประวัติในฐานข้อมูลคนกลาง</p>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
              ฐานข้อมูลของเรายังเติบโตอยู่ — แนะนำให้เช็คเว็บภายนอกประกอบด้วย และใช้บริการคนกลางเพื่อความปลอดภัยสูงสุด
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            <p style={{ fontSize: 13.5, color: 'var(--rose-500)', fontWeight: 600 }}>⚠️ พบ {results.length} รายงานที่เกี่ยวข้อง — ตรวจสอบรายละเอียดก่อนตัดสินใจโอนเงิน</p>
            {results.map(h => {
              const accts = h.bankAccounts || [];
              const imgs = [...(h.slipImageIds || []), ...(h.chatImageIds || [])].slice(0, 6);
              const open = expanded === h.id;
              return (
                <div key={h.id} className="csr-card csr-hit">
                  <div className="csr-hit-head">
                    <b>{h.firstName} {h.lastName}</b>
                    {h.status === 'approved'
                      ? <span className="badge badge-rose">ยืนยันโดยทีมงาน</span>
                      : <span className="badge badge-amber">รอตรวจสอบ</span>}
                    {h.sourceName && <span className="badge badge-gray">แหล่งข้อมูล: {h.sourceName}</span>}
                  </div>
                  <div className="csr-hit-meta">
                    {accts.map((a, i) => <span key={i} className="csr-acct">🏦 {a.acct}{a.bank ? ` · ${a.bank}` : ''}</span>)}
                    {h.product && <span>สินค้า: {h.product}</span>}
                    {h.amount > 0 && <span>ยอดโอน: ฿{Number(h.amount).toLocaleString()}</span>}
                    {h.transferDate && <span>วันที่โอน: {h.transferDate}</span>}
                    {h.sellerPage && <span>เพจ: {h.sellerPage}</span>}
                    {h.province && <span>📍 {h.province}</span>}
                  </div>
                  {h.detail && <p className="csr-hit-detail">{open ? h.detail : h.detail.slice(0, 160) + (h.detail.length > 160 ? '…' : '')}</p>}
                  {imgs.length > 0 && open && (
                    <div className="csr-hit-imgs">
                      {imgs.map(id => (
                        <a key={id} href={fileUrl(id)} target="_blank" rel="noopener noreferrer">
                          <img src={fileUrl(id)} alt="หลักฐาน" loading="lazy" />
                        </a>
                      ))}
                    </div>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setExpanded(open ? '' : h.id)}>
                    {open ? 'ย่อรายละเอียด' : `ดูรายละเอียด + หลักฐาน (${imgs.length} รูป)`} <Icon name="chevronDown" size={14} style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}

      {results === null && !loading && (
        <p className="cs-footer-note" style={{ marginTop: 8 }}>
          ฐานข้อมูลคนโกงของคนกลางเอง — รวบรวมจากรายงานของสมาชิกที่แนบหลักฐานครบถ้วน<br />
          ทุกรายงานผ่านการคัดกรองก่อนยืนยัน เพื่อป้องกันผู้บริสุทธิ์เสียหาย
        </p>
      )}
    </div>
  );
}

export default ScamDbSearch;
