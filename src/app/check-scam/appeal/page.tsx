'use client';
/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authHeaders } from '@/lib/supabase';
import { compressImage } from '@/lib/imageCompress';
import { SubPageHeader } from '@/components/mobile/SubPageHeader';
import { AsyncButton } from '@/components/AsyncButton';

type PickedFile = { file: File; preview: string };

export default function ScamAppealPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = searchParams.get('report') || '';

  const [reportLabel, setReportLabel] = useState('');
  const [appellantName, setAppellantName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactLine, setContactLine] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [statement, setStatement] = useState('');
  const [evidence, setEvidence] = useState<PickedFile[]>([]);
  const [agree, setAgree] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!reportId) return;
    fetch(`/api/scam-reports?report=${encodeURIComponent(reportId)}`)
      .then(r => r.json())
      .then(d => {
        const hit = d.results?.[0];
        if (hit) setReportLabel(`${hit.firstName} ${hit.lastName || ''}`.trim());
      })
      .catch(() => {});
  }, [reportId]);

  function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    const next = [...evidence];
    for (const file of Array.from(files).slice(0, 10 - next.length)) {
      next.push({ file, preview: URL.createObjectURL(file) });
    }
    setEvidence(next);
  }

  async function submit() {
    setError('');
    if (!reportId) { setError('ไม่พบรายงานที่อ้างถึง'); return; }
    if (!appellantName.trim()) { setError('กรุณากรอกชื่อ-นามสกุล'); return; }
    if (statement.trim().length < 30) { setError('กรุณาชี้แจงอย่างน้อย 30 ตัวอักษร'); return; }
    if (!contactPhone.trim() && !contactLine.trim() && !contactEmail.trim()) {
      setError('กรุณากรอกช่องทางติดต่ออย่างน้อย 1 ช่อง');
      return;
    }
    if (!agree) { setError('กรุณายืนยันว่าข้อมูลเป็นความจริง'); return; }

    setSending(true);
    try {
      const headers = await authHeaders();
      if (!headers.Authorization) throw new Error('กรุณาเข้าสู่ระบบก่อนยื่นอุธรณ์');

      const evidenceImageIds: string[] = [];
      for (const item of evidence) {
        const prepared = await compressImage(item.file);
        const form = new FormData();
        form.append('file', prepared);
        const r = await fetch('/api/upload-report', { method: 'POST', headers, body: form });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'อัปโหลดหลักฐานไม่สำเร็จ');
        evidenceImageIds.push(d.fileId);
      }

      const res = await fetch('/api/scam-reports/appeal', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId,
          appellantName: appellantName.trim(),
          contactPhone: contactPhone.trim(),
          contactLine: contactLine.trim(),
          contactEmail: contactEmail.trim(),
          statement: statement.trim(),
          evidenceImageIds,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'ส่งคำชี้แจงไม่สำเร็จ');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setSending(false);
    }
  }

  if (!reportId) {
    return (
      <div className="sub-page">
        <SubPageHeader backHref="/check-scam" title="อุธรณ์ / คำชี้แจง" titleIcon="shieldCheck" />
        <div className="cs-inner">
          <div className="csr-card" style={{ textAlign: 'center', padding: 32 }}>
            <p style={{ color: 'var(--muted)' }}>ไม่พบรายงานที่ต้องการชี้แจง</p>
            <Link href="/check-scam" className="btn btn-primary" style={{ marginTop: 16 }}>กลับหน้าเช็คคนโกง</Link>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="sub-page">
        <SubPageHeader backHref="/check-scam" title="อุธรณ์ / คำชี้แจง" titleIcon="shieldCheck" />
        <div className="cs-inner">
          <div className="csr-card csr-done">
            <div className="rv-thanks-ic">✅</div>
            <h3>รับคำชี้แจงแล้ว</h3>
            <p>ทีมงานจะตรวจสอบและติดต่อกลับตามช่องทางที่ให้ไว้<br />ขอบคุณที่ให้ข้อมูลเพิ่มเติม</p>
            <Link href={`/check-scam?report=${reportId}`} className="btn btn-primary" style={{ marginTop: 20 }}>กลับดูรายงาน</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sub-page">
      <SubPageHeader backHref={`/check-scam?report=${reportId}`} title="อุธรณ์ / คำชี้แจง" titleIcon="shieldCheck" />
      <div className="cs-inner">
        <div className="csr-notice">
          <p>ยื่นคำชี้แจงต่อรายงาน: <strong>{reportLabel || 'กำลังโหลด...'}</strong></p>
          <p>สำหรับผู้ที่ถูกรายงานและ เชื่อว่าข้อมูลไม่ถูกต้อง — ทีมงานจะพิจารณาจากหลักฐานที่แนบ</p>
        </div>

        <div className="csr-card">
          <div className="csr-grid">
            <div className="csr-field csr-span2">
              <label>ชื่อ-นามสกุลผู้ยื่นคำชี้แจง *</label>
              <input value={appellantName} onChange={e => setAppellantName(e.target.value)} placeholder="ชื่อจริงของคุณ" />
            </div>
            <div className="csr-field">
              <label>เบอร์โทร</label>
              <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="08x-xxx-xxxx" inputMode="tel" />
            </div>
            <div className="csr-field">
              <label>LINE ID</label>
              <input value={contactLine} onChange={e => setContactLine(e.target.value)} placeholder="@line หรือ ID" />
            </div>
            <div className="csr-field csr-span2">
              <label>อีเมล</label>
              <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="csr-field csr-span2">
              <label>คำชี้แจง * <span className="csr-req">(อย่างน้อย 30 ตัวอักษร)</span></label>
              <textarea
                rows={6}
                value={statement}
                onChange={e => setStatement(e.target.value)}
                placeholder="อธิบายว่าทำไมรายงานนี้ไม่ถูกต้อง พร้อมข้อเท็จจริงที่เกี่ยวข้อง..."
              />
            </div>
          </div>

          <div className="csr-sec"><span className="csr-sec-ic">📎</span> หลักฐานประกอบ (ไม่บังคับ)</div>
          <div className="csr-pickgrid">
            {evidence.map((item, i) => (
              <div key={item.preview} className="csr-thumb">
                <img src={item.preview} alt="" />
                <div className="csr-thumb-acts">
                  <button type="button" className="del" onClick={() => setEvidence(prev => prev.filter((_, j) => j !== i))}>ลบ</button>
                </div>
              </div>
            ))}
            {evidence.length < 10 && (
              <button type="button" className="csr-addtile" onClick={() => fileRef.current?.click()}>
                <span>+</span><span>แนบรูป</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => onPickFiles(e.target.files)} />

          <label className="csr-agree">
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
            <span>ข้าพเจ้ายืนยันว่าข้อมูลและหลักฐานที่ให้เป็นความจริง และยินดีให้ทีมงานติดต่อกลับเพื่อตรวจสอบ</span>
          </label>

          {error && <p className="rv-error" style={{ marginTop: 12 }}>{error}</p>}

          <AsyncButton
            type="button"
            className="btn btn-primary btn-block btn-lg"
            style={{ marginTop: 16 }}
            loading={sending}
            onClick={() => submit()}
          >
            📨 ส่งคำชี้แจง
          </AsyncButton>
          <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => router.back()}>
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}
