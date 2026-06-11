'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { account } from '@/lib/appwrite';
import { PROVINCE_NAMES, distanceKm, midpointProvince, sharedGuaranteeDeposit, RATE_PER_KM } from '@/lib/provinceGeo';

const PLATFORM = 50, MM_FEE = 300;

export default function MeetupPage() {
  const router = useRouter();
  const [mode, setMode] = useState<string | null>(null);
  const [feeWho, setFeeWho] = useState('split');
  const [step, setStep] = useState<1 | 2>(1);

  // ── ตัวคำนวณรับประกันเดินทาง ──
  const [myRole, setMyRole] = useState<'buyer' | 'seller'>('buyer');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [buyerProv, setBuyerProv] = useState('');
  const [sellerProv, setSellerProv] = useState('');
  const [meetChoice, setMeetChoice] = useState<'mid' | 'buyer' | 'seller' | 'custom'>('mid');
  const [customProv, setCustomProv] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const total = mode === 'safezone' ? PLATFORM + MM_FEE : PLATFORM;
  const buyerFee = feeWho === 'split' ? total / 2 : feeWho === 'buyer' ? total : 0;
  const sellerFee = feeWho === 'split' ? total / 2 : feeWho === 'seller' ? total : 0;

  const calc = useMemo(() => {
    if (!buyerProv || !sellerProv) return null;
    const meetProv =
      meetChoice === 'buyer' ? buyerProv :
      meetChoice === 'seller' ? sellerProv :
      meetChoice === 'custom' ? (customProv || midpointProvince(buyerProv, sellerProv)) :
      midpointProvince(buyerProv, sellerProv);
    const buyerKm = distanceKm(buyerProv, meetProv);
    const sellerKm = distanceKm(sellerProv, meetProv);
    // ประกัน "เท่ากันทั้งสองฝ่าย" = ระยะรวมสองเส้นทาง × 2 ไป-กลับ × อัตรา
    // ใครผิดนัด อีกฝ่ายได้ชดเชยเต็มทั้งค่าเดินทางและค่าเสียโอกาส
    const deposit = sharedGuaranteeDeposit(buyerKm, sellerKm);
    return {
      meetProv,
      directKm: distanceKm(buyerProv, sellerProv),
      buyerKm, sellerKm,
      totalRoundTripKm: (buyerKm + sellerKm) * 2,
      deposit,
      buyerTotal: deposit + buyerFee,
      sellerTotal: deposit + sellerFee,
    };
  }, [buyerProv, sellerProv, meetChoice, customProv, buyerFee, sellerFee]);

  async function createGuaranteeDeal() {
    if (!title.trim()) { setError('กรุณากรอกชื่อสินค้า/สิ่งที่นัดรับ'); return; }
    if (!calc) { setError('กรุณาเลือกจังหวัดของทั้งสองฝ่าย'); return; }
    setCreating(true); setError('');
    try {
      const jwt = (await account.createJWT()).jwt;
      const meetupData = JSON.stringify({
        buyerProvince: buyerProv, sellerProvince: sellerProv, meetProvince: calc.meetProv,
        buyerKm: calc.buyerKm, sellerKm: calc.sellerKm, ratePerKm: RATE_PER_KM,
        deposit: calc.deposit, // เงินประกันเท่ากันทั้งสองฝ่าย — ต่อรองเปลี่ยนได้ในห้องดีล
        fee: total, feeWho, buyerFee, sellerFee,
      });
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `นัดรับ+ประกันเดินทาง: ${title.trim()}`,
          description: `จุดนัดพบ: ${calc.meetProv} · ประกันผู้ซื้อ ฿${calc.deposit.toLocaleString()} · ประกันผู้ขาย ฿${calc.deposit.toLocaleString()}`,
          price: Number(price) || 0,
          category: 'นัดรับผ่านกลาง',
          creatorRole: myRole,
          source: 'private',
          dealType: 'meetup',
          meetupData,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'สร้างดีลไม่สำเร็จ'); return; }
      router.push(`/deal/${d.deal.$id}`);
    } catch {
      router.push(`/login?returnTo=${encodeURIComponent('/service/meetup')}`);
    } finally { setCreating(false); }
  }

  return (
    <div className="sub-page">
      <header className="sub-header">
        <Link href="/" className="sub-back">←</Link>
        <span className="sub-htitle">นัดรับผ่านกลาง</span>
      </header>
      <div className="svc-inner">

        {step === 1 && (
          <>
            <h2 style={{ marginBottom: 6 }}>เลือกรูปแบบนัดรับ</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 24, lineHeight: 1.6 }}>คนกลางช่วยจัดการจุดนัดพบให้ปลอดภัย ไม่ต้องเจอกันสองต่อสองโดยไม่มีพยาน</p>

            {[
              { k: 'guarantee', icon: '🚗', title: 'รับประกันเดินทาง', sub: 'ทั้งสองฝ่ายวางเงินประกันตามระยะทางจริง มาตามนัดได้คืนเต็มจำนวน ผิดนัดเงินประกันชดเชยให้ฝ่ายที่มา — ไม่ต้องใช้คนกลาง', fee: PLATFORM },
              { k: 'safezone', icon: '🏪', title: 'Safe Zone (จุดนัดพบปลอดภัย)', sub: 'คนกลางเป็นผู้ดูแลสถานที่นัดพบ เช่น ร้านมือถือ อู่รถ หน้าร้านค้า', fee: PLATFORM + MM_FEE },
            ].map(o => (
              <div key={o.k} className={`svc-card${mode === o.k ? ' sel' : ''}`} onClick={() => setMode(o.k)}>
                <div className="svc-card-head">
                  <div className="svc-card-icon">{o.icon}</div>
                  <div><div className="svc-card-title">{o.title}</div><div className="svc-card-sub">{o.sub}</div></div>
                </div>
                {mode === o.k && (
                  <div className="svc-fee-box">
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>ค่าใช้จ่าย</div>
                    <div className="svc-fee-row"><span className="svc-fee-lbl">ค่าธรรมเนียมแพลตฟอร์ม</span><span className="svc-fee-val">฿{PLATFORM}</span></div>
                    {o.k === 'safezone' && <div className="svc-fee-row"><span className="svc-fee-lbl">ค่าบริการคนกลาง</span><span className="svc-fee-val">฿{MM_FEE}</span></div>}
                    {o.k === 'guarantee' && <div className="svc-fee-row"><span className="svc-fee-lbl">เงินประกันเดินทาง (ได้คืนเมื่อมาตามนัด)</span><span className="svc-fee-val">คำนวณตามระยะทาง</span></div>}
                    <div className="svc-fee-total"><span className="svc-fee-lbl">รวม</span><span className="svc-fee-val">฿{o.fee}{o.k === 'guarantee' ? ' + ประกัน' : ''}</span></div>
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 7 }}>ใครออกค่าธรรมเนียม?</div>
                      <div className="svc-who-chips">
                        {[{ k: 'split', l: 'หารกัน' }, { k: 'buyer', l: 'ผู้ซื้อออก' }, { k: 'seller', l: 'ผู้ขายออก' }].map(w => (
                          <button key={w.k} className={`svc-chip${feeWho === w.k ? ' sel' : ''}`} onClick={e => { e.stopPropagation(); setFeeWho(w.k); }}>{w.l}</button>
                        ))}
                      </div>
                      {feeWho === 'split' && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>ผู้ซื้อออก ฿{buyerFee} · ผู้ขายออก ฿{sellerFee}</p>}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {mode === 'guarantee' && (
              <button className="btn btn-primary btn-block" style={{ marginTop: 8 }} onClick={() => setStep(2)}>
                ถัดไป: คำนวณเงินประกันเดินทาง →
              </button>
            )}
            {mode === 'safezone' && (
              <Link href="/deal/create" className="btn btn-primary btn-block" style={{ marginTop: 8, display: 'flex', textDecoration: 'none', justifyContent: 'center' }}>สร้างดีลนัดรับ →</Link>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={() => setStep(1)}>← ย้อนกลับ</button>
            <h2 style={{ marginBottom: 6 }}>🚗 คำนวณเงินประกันเดินทาง</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20, lineHeight: 1.65 }}>
              เงินประกันคิดจากระยะทาง<b>ไป-กลับ</b>ของแต่ละฝ่ายถึงจุดนัดพบ (฿{RATE_PER_KM}/กม.)
              มาตามนัดได้คืนเต็มจำนวน — บริการนี้<b>ไม่ต้องใช้คนกลาง</b>
            </p>

            <div className="mu-form">
              <div className="mu-field">
                <label>ฉันเป็น...</label>
                <div className="svc-who-chips">
                  {([['buyer', '🛍️ ผู้ซื้อ'], ['seller', '🛒 ผู้ขาย']] as const).map(([k, l]) => (
                    <button key={k} className={`svc-chip${myRole === k ? ' sel' : ''}`} onClick={() => setMyRole(k)}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="mu-grid">
                <div className="mu-field">
                  <label>สินค้า/สิ่งที่นัดรับ *</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} maxLength={150} placeholder="เช่น iPhone 15 Pro มือสอง" />
                </div>
                <div className="mu-field">
                  <label>ราคาสินค้า (บาท)</label>
                  <input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} placeholder="ไม่บังคับ" />
                </div>
                <div className="mu-field">
                  <label>จังหวัดของผู้ซื้อ *</label>
                  <select value={buyerProv} onChange={e => setBuyerProv(e.target.value)}>
                    <option value="">เลือกจังหวัด...</option>
                    {PROVINCE_NAMES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="mu-field">
                  <label>จังหวัดของผู้ขาย *</label>
                  <select value={sellerProv} onChange={e => setSellerProv(e.target.value)}>
                    <option value="">เลือกจังหวัด...</option>
                    {PROVINCE_NAMES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="mu-field">
                <label>จุดนัดพบ</label>
                <div className="svc-who-chips">
                  {([['mid', '🤝 คนละครึ่งทาง'], ['buyer', 'ฝั่งผู้ซื้อ'], ['seller', 'ฝั่งผู้ขาย'], ['custom', 'เลือกจังหวัดเอง']] as const).map(([k, l]) => (
                    <button key={k} className={`svc-chip${meetChoice === k ? ' sel' : ''}`} onClick={() => setMeetChoice(k)}>{l}</button>
                  ))}
                </div>
                {meetChoice === 'custom' && (
                  <select value={customProv} onChange={e => setCustomProv(e.target.value)} style={{ marginTop: 10 }}>
                    <option value="">เลือกจังหวัดจุดนัดพบ...</option>
                    {PROVINCE_NAMES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                )}
              </div>

              {calc && (
                <div className="mu-result">
                  <div className="mu-result-head">
                    📍 จุดนัดพบ: <b>{calc.meetProv}</b>
                    <span>ผู้ซื้อ {calc.buyerKm.toLocaleString()} กม. + ผู้ขาย {calc.sellerKm.toLocaleString()} กม. = รวมไป-กลับ {calc.totalRoundTripKm.toLocaleString()} กม.</span>
                  </div>
                  <div className="mu-deposit-band">
                    เงินประกัน <b>เท่ากันทั้งสองฝ่าย</b>: <span className="mu-deposit-val">฿{calc.deposit.toLocaleString()} / ฝ่าย</span>
                    <small>({calc.totalRoundTripKm.toLocaleString()} กม. × ฿{RATE_PER_KM} — ต่อรองเปลี่ยนยอดกับอีกฝ่ายได้ในห้องดีล)</small>
                  </div>
                  <div className="mu-result-grid">
                    <div className="mu-side">
                      <b>🛍️ ผู้ซื้อ ({buyerProv})</b>
                      <span>เดินทาง {calc.buyerKm.toLocaleString()} กม. ถึงจุดนัดพบ</span>
                      <div className="mu-row"><span>เงินประกัน (ได้คืน)</span><span>฿{calc.deposit.toLocaleString()}</span></div>
                      <div className="mu-row"><span>ค่าธรรมเนียม</span><span>฿{buyerFee.toLocaleString()}</span></div>
                      <div className="mu-row total"><span>ต้องโอน</span><span>฿{calc.buyerTotal.toLocaleString()}</span></div>
                    </div>
                    <div className="mu-side">
                      <b>🛒 ผู้ขาย ({sellerProv})</b>
                      <span>เดินทาง {calc.sellerKm.toLocaleString()} กม. ถึงจุดนัดพบ</span>
                      <div className="mu-row"><span>เงินประกัน (ได้คืน)</span><span>฿{calc.deposit.toLocaleString()}</span></div>
                      <div className="mu-row"><span>ค่าธรรมเนียม</span><span>฿{sellerFee.toLocaleString()}</span></div>
                      <div className="mu-row total"><span>ต้องโอน</span><span>฿{calc.sellerTotal.toLocaleString()}</span></div>
                    </div>
                  </div>
                  <p className="mu-note">
                    💡 ทำไมวางเท่ากัน? ไม่ว่าฝ่ายใดผิดนัด อีกฝ่ายได้รับชดเชย<b>ครอบคลุมค่าเดินทางทั้งสองเส้นทาง + ค่าเสียโอกาส</b> จึงไม่มีใครขาดทุน<br />
                    ✅ เจอกันสำเร็จ: บริษัท คนกลาง จำกัด โอนเงินประกันคืน<b>เต็มจำนวน</b>ทั้งสองฝ่าย (เก็บเฉพาะค่าธรรมเนียม)<br />
                    ❌ ฝ่ายใดผิดนัด: เงินประกันของฝ่ายนั้นชดเชยให้ฝ่ายที่มาตามนัด
                  </p>
                </div>
              )}

              {error && <p className="rv-error">{error}</p>}
              <button className="btn btn-primary btn-block btn-lg" disabled={creating || !calc || !title.trim()} onClick={createGuaranteeDeal}>
                {creating ? 'กำลังสร้างดีล...' : 'สร้างดีลนัดรับ + รับลิงก์ชวนอีกฝ่าย →'}
              </button>
              <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>หลังสร้าง ส่งลิงก์ให้อีกฝ่ายเข้าร่วม แล้วทั้งคู่ยอมรับเงื่อนไขและวางเงินประกันในห้องดีล</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
