'use client';
import React, { useEffect, useRef, useState } from 'react';
import { account } from '@/lib/appwrite';
import { compressImage } from '@/lib/imageCompress';
import { Icon } from './Icon';

const BANKS = [
  'ธนาคารกรุงเทพ (BBL)', 'ธนาคารกสิกรไทย (KBANK)', 'ธนาคารไทยพาณิชย์ (SCB)',
  'ธนาคารกรุงไทย (KTB)', 'ธนาคารกรุงศรีอยุธยา (BAY)', 'ธนาคารทหารไทยธนชาต (TTB)',
  'ธนาคารออมสิน', 'ธนาคารอาคารสงเคราะห์ (GHB)', 'ธนาคารเพื่อการเกษตรและสหกรณ์ (BAAC)',
  'ธนาคารอิสลามแห่งประเทศไทย', 'ธนาคารแลนด์แอนด์เฮ้าส์ (LH Bank)',
  'ธนาคารซีไอเอ็มบีไทย (CIMB Thai)', 'ธนาคารยูโอบี (UOB)', 'TrueMoney Wallet / พร้อมเพย์', 'อื่นๆ',
];
const PROVINCES = ['ไม่ระบุ','กรุงเทพมหานคร','กระบี่','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท','ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก','นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช','นครสวรรค์','นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พะเยา','พังงา','พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','ภูเก็ต','มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน','ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี','ลพบุรี','ลำปาง','ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ','สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู','อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี'];

/* ── Web Speech API (พูดให้พิมพ์) ───────────────────────────── */
interface SpeechResultEvent { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } }; }
interface SpeechRec {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
}

function useDictation(append: (text: string) => void, setInterim: (t: string) => void) {
  const recRef = useRef<SpeechRec | null>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  function toggle() {
    if (listening) { recRef.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) { setSupported(false); return; }
    const rec = new Ctor();
    rec.lang = 'th-TH';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: SpeechResultEvent) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        if (r.isFinal) append(r[0].transcript);
        else interim += r[0].transcript;
      }
      setInterim(interim);
    };
    rec.onend = () => { setListening(false); setInterim(''); };
    rec.onerror = () => { setListening(false); setInterim(''); };
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  useEffect(() => () => { recRef.current?.stop(); }, []);
  return { listening, supported, toggle };
}

/* ── อัปโหลดรูปหลายรูปพร้อมพรีวิว + จัดลำดับ ────────────────── */
interface PickedFile { file: File; url: string }

function MultiImagePick({ label, hint, items, setItems, required, accept = 'image/*' }: {
  label: string; hint?: string; items: PickedFile[];
  setItems: React.Dispatch<React.SetStateAction<PickedFile[]>>;
  required?: boolean; accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  function add(files: FileList | null) {
    if (!files) return;
    const next = [...files].map(f => ({ file: f, url: f.type.startsWith('image/') ? URL.createObjectURL(f) : '' }));
    setItems(prev => [...prev, ...next].slice(0, 20));
  }
  function removeAt(i: number) {
    setItems(prev => { const p = [...prev]; const [gone] = p.splice(i, 1); if (gone?.url) URL.revokeObjectURL(gone.url); return p; });
  }
  function move(i: number, dir: -1 | 1) {
    setItems(prev => {
      const p = [...prev]; const j = i + dir;
      if (j < 0 || j >= p.length) return p;
      [p[i], p[j]] = [p[j], p[i]]; return p;
    });
  }
  return (
    <div className="csr-field csr-span2">
      <label>{label}{required && <span className="csr-req"> *</span>}</label>
      {hint && <p className="csr-hint">{hint}</p>}
      <div className="csr-pickgrid">
        {items.map((it, i) => (
          <div key={it.url || it.file.name + i} className="csr-thumb">
            {it.url
              ? <img src={it.url} alt={`รูปที่ ${i + 1}`} />
              : <span className="csr-thumb-doc">📄<small>{it.file.name.slice(0, 14)}</small></span>}
            <span className="csr-thumb-no">{i + 1}</span>
            <div className="csr-thumb-acts">
              <button type="button" aria-label="เลื่อนขึ้น" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" aria-label="เลื่อนลง" onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</button>
              <button type="button" aria-label="ลบรูป" className="del" onClick={() => removeAt(i)}>✕</button>
            </div>
          </div>
        ))}
        <button type="button" className="csr-addtile" onClick={() => inputRef.current?.click()}>
          <Icon name="plus" size={20} /><span>เพิ่มรูป</span>
        </button>
      </div>
      <input ref={inputRef} type="file" accept={accept} multiple style={{ display: 'none' }}
        onChange={e => { add(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

/* ── ฟอร์มหลัก ──────────────────────────────────────────────── */
export function ScamReportForm({ onDone }: { onDone?: () => void }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [idCard, setIdCard] = useState('');
  const [accounts, setAccounts] = useState<{ acct: string; bank: string }[]>([{ acct: '', bank: '' }]);
  const [product, setProduct] = useState('');
  const [amount, setAmount] = useState('');
  const [transferDate, setTransferDate] = useState('');
  const [sellerPage, setSellerPage] = useState('');
  const [province, setProvince] = useState('ไม่ระบุ');
  const [detail, setDetail] = useState('');
  const [interim, setInterim] = useState('');
  const [chatImgs, setChatImgs] = useState<PickedFile[]>([]);
  const [policeDocs, setPoliceDocs] = useState<PickedFile[]>([]);
  const [slipImgs, setSlipImgs] = useState<PickedFile[]>([]);
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactLine, setContactLine] = useState('');
  const [agree, setAgree] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const detailRef = useRef<HTMLTextAreaElement>(null);

  const dictation = useDictation(
    text => setDetail(prev => (prev ? prev.replace(/\s+$/, '') + ' ' : '') + text.trim()),
    setInterim,
  );

  function setAcct(i: number, patch: Partial<{ acct: string; bank: string }>) {
    setAccounts(prev => prev.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  }

  async function uploadAll(items: PickedFile[], jwt: string, label: string, startAt: number, total: number): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < items.length; i += 1) {
      setProgress(`กำลังอัปโหลด${label} (${startAt + i + 1}/${total})...`);
      const prepared = await compressImage(items[i].file);
      const form = new FormData(); form.append('file', prepared);
      const r = await fetch('/api/upload-report', { method: 'POST', headers: { 'x-session-jwt': jwt }, body: form });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `อัปโหลด${label}ไม่สำเร็จ`);
      ids.push(d.fileId);
    }
    return ids;
  }

  async function submit() {
    setError('');
    if (!firstName.trim()) { setError('กรุณากรอกชื่อคนขาย'); return; }
    if (!accounts.some(a => a.acct.replace(/\D/g, '').length >= 6)) { setError('กรุณากรอกบัญชีธนาคารอย่างน้อย 1 บัญชี (ไม่รู้ให้กรอก 0000000)'); return; }
    if (detail.trim().length < 30) { setError('กรุณาบรรยายรายละเอียดอย่างน้อย 30 ตัวอักษร'); return; }
    if (slipImgs.length === 0) { setError('กรุณาแนบสลิปโอนเงินอย่างน้อย 1 รูป'); return; }
    if (chatImgs.length < 3) { setError('กรุณาแนบรูปแชทอย่างน้อย 3 รูป (แนะนำ 5 รูปขึ้นไป ให้เห็นตั้งแต่ต้นจนจบ)'); return; }
    if (!agree) { setError('กรุณายืนยันว่าข้อมูลเป็นความจริงและยอมรับเงื่อนไข'); return; }

    setSending(true);
    try {
      let jwt = '';
      try { jwt = (await account.createJWT()).jwt; }
      catch { throw new Error('กรุณาเข้าสู่ระบบก่อนรายงานคนโกง'); }

      const total = chatImgs.length + policeDocs.length + slipImgs.length;
      const chatIds = await uploadAll(chatImgs, jwt, 'รูปแชท', 0, total);
      const policeIds = await uploadAll(policeDocs, jwt, 'เอกสารแจ้งความ', chatImgs.length, total);
      const slipIds = await uploadAll(slipImgs, jwt, 'สลิป', chatImgs.length + policeDocs.length, total);

      setProgress('กำลังบันทึกรายงาน...');
      const res = await fetch('/api/scam-reports', {
        method: 'POST',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName, lastName, idCard,
          bankAccounts: accounts.filter(a => a.acct.trim()),
          product, amount: Number(amount) || 0, transferDate, sellerPage,
          province: province === 'ไม่ระบุ' ? '' : province,
          detail,
          chatImageIds: chatIds, policeDocIds: policeIds, slipImageIds: slipIds,
          contactEmail, contactPhone, contactLine,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'บันทึกรายงานไม่สำเร็จ');
      setDone(true);
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally { setSending(false); setProgress(''); }
  }

  if (done) {
    return (
      <div className="csr-card csr-done">
        <span className="rv-thanks-ic" style={{ width: 56, height: 56 }}><Icon name="badgeCheck" size={28} /></span>
        <h3>ส่งรายงานเรียบร้อยแล้ว</h3>
        <p>ทีมงานจะตรวจสอบหลักฐานก่อนเผยแพร่ในฐานข้อมูล เพื่อป้องกันผู้บริสุทธิ์เสียหาย<br />ขอบคุณที่ช่วยทำให้ชุมชนซื้อขายปลอดภัยขึ้น</p>
      </div>
    );
  }

  return (
    <div className="csr-card">
      <div className="csr-notice">
        <p>⚠️ <b>ก่อนรายงาน:</b> บทสนทนาต้องครบ เห็นว่าถูกโกงอย่างไร และต้องเห็นหลักฐานโอนเงิน — หากข้อมูลไม่ครบ รายงานจะไม่ผ่านการตรวจสอบ</p>
        <p>การนำเข้าข้อมูลอันเป็นเท็จ ผู้รายงานต้องรับผิดชอบทางกฎหมาย</p>
      </div>

      {/* ── ข้อมูลผู้ขาย ── */}
      <h3 className="csr-sec"><span className="csr-sec-ic"><Icon name="user" size={15} /></span> ข้อมูลคนขาย</h3>
      <p className="csr-hint" style={{ marginBottom: 12 }}>ใส่ชื่อตามบัญชีที่โอนเงินไปเท่านั้น ไม่ใช่ชื่อเฟซหรือบัตรประชาชนที่ถูกแอบอ้าง — หากไม่แน่ใจให้ใส่ &ldquo;ไม่ทราบ&rdquo;</p>
      <div className="csr-grid">
        <div className="csr-field">
          <label>ชื่อคนขาย (ภาษาไทย)<span className="csr-req"> *</span></label>
          <input value={firstName} onChange={e => setFirstName(e.target.value)} maxLength={120} placeholder="ชื่อบัญชีคนขาย (ไม่ต้องมีนาย/นางสาว)" />
        </div>
        <div className="csr-field">
          <label>นามสกุล (ภาษาไทย)</label>
          <input value={lastName} onChange={e => setLastName(e.target.value)} maxLength={120} placeholder="นามสกุลบัญชีคนขาย" />
        </div>
        <div className="csr-field csr-span2">
          <label>เลขบัตรประชาชนคนขาย</label>
          <input value={idCard} onChange={e => setIdCard(e.target.value.replace(/\D/g, '').slice(0, 13))} placeholder="ไม่รู้ไม่ต้องใส่" inputMode="numeric" />
        </div>
      </div>

      {/* ── บัญชีธนาคาร ── */}
      <h3 className="csr-sec"><span className="csr-sec-ic"><Icon name="banknote" size={15} /></span> บัญชีธนาคารคนขาย</h3>
      <p className="csr-hint" style={{ marginBottom: 12 }}>หากไม่รู้เลขบัญชี ให้กรอก 0000000 — เพิ่มได้หลายบัญชีหากคนขายใช้หลายบัญชีรับเงิน</p>
      {accounts.map((a, i) => (
        <div className="csr-grid csr-acct-row" key={i}>
          <div className="csr-field">
            <label>เลขบัญชี{i === 0 && <span className="csr-req"> *</span>}</label>
            <input value={a.acct} onChange={e => setAcct(i, { acct: e.target.value.replace(/[^\d-]/g, '') })} placeholder="ตัวเลขเท่านั้น" inputMode="numeric" />
          </div>
          <div className="csr-field">
            <label>ธนาคาร{i === 0 && <span className="csr-req"> *</span>}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={a.bank} onChange={e => setAcct(i, { bank: e.target.value })} style={{ flex: 1 }}>
                <option value="">เลือกธนาคาร</option>
                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              {accounts.length > 1 && <button type="button" className="csr-mini-del" aria-label="ลบบัญชีนี้" onClick={() => setAccounts(prev => prev.filter((_, j) => j !== i))}>✕</button>}
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-soft btn-sm" onClick={() => setAccounts(prev => [...prev, { acct: '', bank: '' }])} disabled={accounts.length >= 10}>
        <Icon name="plus" size={15} /> เพิ่มบัญชี
      </button>

      {/* ── รายละเอียดซื้อขาย ── */}
      <h3 className="csr-sec"><span className="csr-sec-ic"><Icon name="package" size={15} /></span> รายละเอียดการซื้อขาย</h3>
      <div className="csr-grid">
        <div className="csr-field">
          <label>สินค้าที่สั่งซื้อ<span className="csr-req"> *</span></label>
          <input value={product} onChange={e => setProduct(e.target.value)} maxLength={200} placeholder="เช่น กล้อง Canon มือสอง" />
        </div>
        <div className="csr-field">
          <label>ยอดโอน (บาท)<span className="csr-req"> *</span></label>
          <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="ยอดโอนตามสลิป" />
        </div>
        <div className="csr-field">
          <label>วันโอนเงิน<span className="csr-req"> *</span></label>
          <input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)} />
        </div>
        <div className="csr-field">
          <label>จังหวัดของผู้รายงาน</label>
          <select value={province} onChange={e => setProvince(e.target.value)}>
            {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="csr-field csr-span2">
          <label>เพจ/ช่องทางขายของ</label>
          <input value={sellerPage} onChange={e => setSellerPage(e.target.value)} maxLength={300} placeholder="ชื่อเพจ FB, IG, LINE หรือลิงก์โปรไฟล์" />
          <p className="csr-hint">ใส่ชื่อเพจ/ลิงก์ให้ถูกต้อง จะช่วยให้คนอื่นค้นเจอเมื่อเสิร์ชชื่อร้านนั้น</p>
        </div>
      </div>

      {/* ── รายละเอียดเพิ่มเติม + ไมค์ ── */}
      <h3 className="csr-sec"><span className="csr-sec-ic"><Icon name="message" size={15} /></span> รายละเอียดเพิ่มเติม<span className="csr-req"> *</span></h3>
      <p className="csr-hint" style={{ marginBottom: 10 }}>
        บรรยายเหตุการณ์ให้ละเอียด: ทักซื้ออย่างไร โอนแล้วเกิดอะไรขึ้น คนขายอ้างอะไร สุดท้ายติดต่อได้หรือไม่
        — พิมพ์เอง หรือกดไมค์แล้วพูดให้ระบบพิมพ์ให้ แล้วค่อยแก้ไขทีหลังได้
      </p>
      <div className={`csr-detail-wrap ${dictation.listening ? 'recording' : ''}`}>
        <textarea
          ref={detailRef}
          value={detail}
          onChange={e => setDetail(e.target.value)}
          rows={7}
          maxLength={5000}
          placeholder="เช่น เห็นโพสต์ขายกล้องราคา 3,500 ทักแชทแล้วแอดไลน์ไปคุย โอนเงินไปบัญชีชื่อ... หลังโอนถูกบอกให้โอนค่าส่งเพิ่ม... สุดท้ายถูกบล็อก..."
        />
        <button
          type="button"
          className={`csr-mic ${dictation.listening ? 'on' : ''}`}
          onClick={dictation.toggle}
          title={dictation.supported ? (dictation.listening ? 'หยุดฟัง' : 'พูดให้พิมพ์') : 'เบราว์เซอร์นี้ไม่รองรับการพูด'}
          disabled={!dictation.supported}
        >
          {dictation.listening ? <><span className="csr-mic-dot" /> กำลังฟัง... แตะเพื่อหยุด</> : <>🎤 พูดให้พิมพ์</>}
        </button>
        {interim && <div className="csr-interim">{interim}</div>}
      </div>
      {!dictation.supported && <p className="csr-hint" style={{ color: 'var(--amber-500)' }}>เบราว์เซอร์นี้ไม่รองรับการพูดเป็นข้อความ — แนะนำ Chrome หรือ Edge</p>}
      <p className="csr-hint" style={{ textAlign: 'right' }}>{detail.length.toLocaleString()}/5,000</p>

      {/* ── หลักฐาน ── */}
      <h3 className="csr-sec"><span className="csr-sec-ic"><Icon name="camera" size={15} /></span> หลักฐาน</h3>
      <p className="csr-hint" style={{ marginBottom: 4 }}>ก่อนอัปรูป ปกปิดข้อมูลส่วนตัวของคุณเอง เช่น ชื่อ เบอร์ ไลน์ — บทสนทนาต้องเห็นตั้งแต่ต้นจนจบ</p>
      <MultiImagePick
        label="รูปแชทบทสนทนา (เรียงตามลำดับเหตุการณ์)" required
        hint="อย่างน้อย 3 รูป แนะนำ 5 รูปขึ้นไป — ใช้ปุ่ม ↑↓ จัดลำดับรูปได้"
        items={chatImgs} setItems={setChatImgs}
      />
      <MultiImagePick
        label="สลิปโอนเงิน" required
        hint="รูปสลิปอย่างน้อย 1 รูป ไม่ต้องปิดชื่อตัวเองหรือ QR — ใช้ตรวจสอบเวลาโอน"
        items={slipImgs} setItems={setSlipImgs}
      />
      <MultiImagePick
        label="เอกสารแจ้งความ (ไม่มีไม่ต้องแนบ)"
        items={policeDocs} setItems={setPoliceDocs}
        accept="image/*,.pdf"
      />

      {/* ── ติดต่อกลับ ── */}
      <h3 className="csr-sec"><span className="csr-sec-ic"><Icon name="phone" size={15} /></span> ข้อมูลติดต่อกลับ (เก็บเป็นความลับ ไม่เผยแพร่)</h3>
      <p className="csr-hint" style={{ marginBottom: 12 }}>ใช้กรณีทีมงานต้องการหลักฐานเพิ่ม หรือคนขายขอคืนเงินให้คุณ — ทีมงานติดต่อทางอีเมลเท่านั้น หากมีคนโทรอ้างเป็นทีมงาน นั่นคือมิจฉาชีพ</p>
      <div className="csr-grid">
        <div className="csr-field">
          <label>อีเมลของฉัน</label>
          <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="my_mail@gmail.com" />
        </div>
        <div className="csr-field">
          <label>เบอร์มือถือ</label>
          <input value={contactPhone} onChange={e => setContactPhone(e.target.value.replace(/\D/g, '').slice(0, 15))} placeholder="0891234567" inputMode="tel" />
        </div>
        <div className="csr-field csr-span2">
          <label>ไลน์ไอดี (ไม่มีไม่ต้องกรอก)</label>
          <input value={contactLine} onChange={e => setContactLine(e.target.value)} maxLength={100} placeholder="ไลน์ไอดี" />
        </div>
      </div>

      <label className="csr-agree">
        <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
        <span>ข้าพเจ้ายืนยันว่าข้อมูลทั้งหมดเป็นความจริง และรับทราบว่าหากนำเข้าข้อมูลอันเป็นเท็จ ต้องรับผิดชอบทางกฎหมาย</span>
      </label>

      {error && <p className="rv-error" style={{ marginTop: 12 }}>{error}</p>}
      {progress && <p className="csr-progress">{progress}</p>}
      <button type="button" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 14 }} disabled={sending} onClick={submit}>
        {sending ? (progress || 'กำลังส่งรายงาน...') : '🚨 ส่งรายงานคนโกง'}
      </button>
    </div>
  );
}

export default ScamReportForm;
