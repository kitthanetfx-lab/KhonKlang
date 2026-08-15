'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { SubPageHeader } from '@/components/mobile/SubPageHeader';
import { PaymentMethods } from '@/components/PaymentMethods';
import { WALLET_TOPUP_PRESETS, baht, WALLET_LEDGER_LABEL } from '@/lib/userWallet';

type Panel = 'none' | 'topup' | 'withdraw';

interface WalletSnap {
  availableBalance: number;
  heldBalance: number;
  updatedAt: string;
}

interface LedgerRow {
  id: string;
  type: string;
  label?: string;
  amount: number;
  available_delta: number;
  title: string;
  created_at: string;
}

interface RequestRow {
  id: string;
  amount: number;
  status: string;
  reject_reason?: string;
  created_at: string;
  slip_file_id?: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending_review: 'รอตรวจสอบ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ปฏิเสธ',
};

export default function WalletPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<WalletSnap | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [topups, setTopups] = useState<RequestRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<RequestRow[]>([]);
  const [bank, setBank] = useState({ bankName: '', bankAcct: '', bankOwner: '' });
  const [panel, setPanel] = useState<Panel>('none');
  const [amount, setAmount] = useState('300');
  const [slipId, setSlipId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const load = useCallback(async () => {
    const headers = await authHeaders();
    const res = await fetch('/api/wallet', { headers });
    if (res.status === 401) {
      router.replace('/login?returnTo=/wallet');
      return;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'โหลดกระเป๋าไม่สำเร็จ');
    setWallet(data.wallet);
    setLedger(data.ledger || []);
    setTopups(data.topups || []);
    setWithdrawals(data.withdrawals || []);
    setBank(data.bank || { bankName: '', bankAcct: '', bankOwner: '' });
  }, [router]);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/login?returnTo=/wallet'); return; }
        await load();
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [load, router]);

  async function uploadSlip(file: File) {
    setUploading(true); setError('');
    try {
      const headers = await authHeaders();
      const form = new FormData(); form.append('file', file);
      const r = await fetch('/api/upload-deal', { method: 'POST', headers, body: form });
      const d = await r.json();
      if (r.ok && d.fileId) setSlipId(d.fileId);
      else setError(d.error || 'อัปโหลดสลิปไม่สำเร็จ');
    } catch { setError('อัปโหลดสลิปไม่สำเร็จ'); }
    finally { setUploading(false); }
  }

  async function submitTopup() {
    const amt = Math.round(Number(amount) || 0);
    if (amt <= 0) return setError('กรุณาเลือกจำนวนเงิน');
    if (!slipId) return setError('กรุณาแนบสลิปการโอนเงิน');
    setSubmitting(true); setError(''); setOk('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/wallet/topups', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, slipFileId: slipId }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'ส่งคำขอไม่สำเร็จ'); return; }
      setOk('ส่งคำขอเติมเงินแล้ว รอแอดมินตรวจสอบสลิป');
      setSlipId('');
      await load();
    } catch { setError('เกิดข้อผิดพลาด กรุณาลองใหม่'); }
    finally { setSubmitting(false); }
  }

  async function submitWithdraw() {
    const amt = Math.round(Number(amount) || 0);
    if (amt <= 0) return setError('กรุณาเลือกจำนวนเงิน');
    setSubmitting(true); setError(''); setOk('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/wallet/withdrawals', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'ส่งคำขอไม่สำเร็จ'); return; }
      setOk('ส่งคำขอถอนแล้ว ทีมงานจะโอนเข้าบัญชีที่บันทึกในโปรไฟล์');
      await load();
    } catch { setError('เกิดข้อผิดพลาด กรุณาลองใหม่'); }
    finally { setSubmitting(false); }
  }

  function openPanel(next: Panel) {
    setPanel(v => v === next ? 'none' : next);
    setError(''); setOk('');
    if (next === 'topup') setAmount('300');
    if (next === 'withdraw') setAmount(String(wallet?.availableBalance || ''));
  }

  if (loading || !wallet) {
    return (
      <div className="dash-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--line)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'dashSpin .8s linear infinite' }} />
      </div>
    );
  }

  const amt = Math.round(Number(amount) || 0);
  const hasBank = Boolean(bank.bankAcct && bank.bankName);

  return (
    <div className="dash-root">
      <SubPageHeader title="กระเป๋าเงิน" titleIcon="wallet" onBack={() => router.back()} />
      <main className="dash-body wal-page">
        <section className="wal-hero">
          <p className="wal-hero-kicker">ยอดพร้อมใช้</p>
          <div className="wal-hero-amt">{baht(wallet.availableBalance)}</div>
          <div className="wal-hero-meta">
            <span>ล็อกประมูล {baht(wallet.heldBalance)}</span>
            <span>รวม {baht(wallet.availableBalance + wallet.heldBalance)}</span>
          </div>
          <div className="wal-hero-actions">
            <button type="button" className={`btn ${panel === 'topup' ? 'btn-primary' : 'btn-green'} btn-sm`} onClick={() => openPanel('topup')}>
              เติมเงิน
            </button>
            <button type="button" className={`btn ${panel === 'withdraw' ? 'btn-primary' : 'btn-soft'} btn-sm`} onClick={() => openPanel('withdraw')}>
              ถอนเงิน
            </button>
          </div>
        </section>

        <p className="wal-hint">
          ยอดนี้ใช้เป็นสิทธิประมูล — ผู้ขายตั้งมัดจำคงที่ ระบบล็อกตอน Bid ถ้าชนะแล้วไม่รับของ จะหักเป็นค่าเสียเวลาให้ผู้ขาย
        </p>

        {panel === 'topup' && (
          <section className="deal-card wal-panel">
            <div className="deal-card-title">เติมเงินเข้ากระเป๋า</div>
            <div className="wal-chips">
              {WALLET_TOPUP_PRESETS.map(n => (
                <button key={n} type="button" className={`wal-chip${amt === n ? ' is-on' : ''}`} onClick={() => setAmount(String(n))}>
                  {baht(n)}
                </button>
              ))}
            </div>
            <label className="wal-field">
              <span>จำนวนเงิน (บาท)</span>
              <input type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)} />
            </label>
            <PaymentMethods amount={Math.max(1, amt)} note="โอนตามยอดที่เลือก แล้วแนบสลิปด้านล่าง" />
            <div className="wal-slip-row">
              {slipId && <img src={fileViewUrl(DEAL_BUCKET, slipId)} alt="สลิป" className="wal-slip" />}
              <label className="btn btn-soft btn-sm" style={{ cursor: 'pointer' }}>
                {uploading ? 'กำลังอัปโหลด...' : slipId ? 'เปลี่ยนสลิป' : 'แนบสลิปการโอน *'}
                <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) uploadSlip(f); e.target.value = ''; }} />
              </label>
            </div>
            {error && <div className="wal-alert wal-alert--err">⚠️ {error}</div>}
            {ok && <div className="wal-alert wal-alert--ok">✅ {ok}</div>}
            <button type="button" className="btn btn-primary" disabled={submitting} onClick={submitTopup}>
              {submitting ? 'กำลังส่ง...' : 'ยืนยันเติมเงิน'}
            </button>
          </section>
        )}

        {panel === 'withdraw' && (
          <section className="deal-card wal-panel">
            <div className="deal-card-title">ถอนเงินออกจากกระเป๋า</div>
            {hasBank ? (
              <div className="wal-bank">
                <span>{bank.bankName}</span>
                <strong>{bank.bankAcct}</strong>
                <span>{bank.bankOwner}</span>
              </div>
            ) : (
              <p className="wal-hint">ยังไม่มีบัญชีรับเงิน — <Link href="/profile">ไปบันทึกในโปรไฟล์</Link></p>
            )}
            <div className="wal-chips">
              {[100, 300, 500, wallet.availableBalance].filter((n, i, arr) => n > 0 && arr.indexOf(n) === i).map(n => (
                <button key={n} type="button" className={`wal-chip${amt === n ? ' is-on' : ''}`} onClick={() => setAmount(String(n))}>
                  {n === wallet.availableBalance ? 'ทั้งหมด' : baht(n)}
                </button>
              ))}
            </div>
            <label className="wal-field">
              <span>จำนวนที่ถอน (บาท)</span>
              <input type="number" min={1} max={wallet.availableBalance} value={amount} onChange={e => setAmount(e.target.value)} />
            </label>
            {error && <div className="wal-alert wal-alert--err">⚠️ {error}</div>}
            {ok && <div className="wal-alert wal-alert--ok">✅ {ok}</div>}
            <button type="button" className="btn btn-primary" disabled={submitting || !hasBank} onClick={submitWithdraw}>
              {submitting ? 'กำลังส่ง...' : 'ยืนยันขอถอน'}
            </button>
          </section>
        )}

        {(topups.length > 0 || withdrawals.length > 0) && (
          <section className="deal-card">
            <div className="deal-card-title">คำขอที่รอตรวจ</div>
            <div className="wal-req-list">
              {topups.filter(t => t.status === 'pending_review').map(t => (
                <div key={t.id} className="wal-req">
                  <span>เติม {baht(t.amount)}</span>
                  <span>{STATUS_LABEL[t.status]}</span>
                </div>
              ))}
              {withdrawals.filter(t => t.status === 'pending_review').map(t => (
                <div key={t.id} className="wal-req">
                  <span>ถอน {baht(t.amount)}</span>
                  <span>{STATUS_LABEL[t.status]}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="deal-card">
          <div className="deal-card-title">ประวัติกระเป๋า</div>
          {ledger.length === 0 ? (
            <p className="wal-hint">ยังไม่มีรายการ — เติมเงินเพื่อเริ่มประมูลได้เลย</p>
          ) : (
            <div className="wal-ledger">
              {ledger.map(row => {
                const inAmt = Number(row.available_delta) > 0;
                return (
                  <div key={row.id} className="wal-ledger-row">
                    <div>
                      <div className="wal-ledger-title">{row.title || WALLET_LEDGER_LABEL[row.type] || row.type}</div>
                      <div className="wal-ledger-sub">{new Date(row.created_at).toLocaleString('th-TH')}</div>
                    </div>
                    <strong className={inAmt ? 'wal-plus' : Number(row.available_delta) < 0 ? 'wal-minus' : ''}>
                      {Number(row.available_delta) === 0 ? baht(row.amount) : `${inAmt ? '+' : ''}${baht(row.available_delta)}`}
                    </strong>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
