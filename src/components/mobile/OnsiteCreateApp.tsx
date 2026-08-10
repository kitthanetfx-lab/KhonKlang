'use client';

import Link from 'next/link';
import { OnsiteAppShell } from './OnsiteAppShell';

type Props = {
  provinces: string[];
  itemDescription: string;
  setItemDescription: (v: string) => void;
  itemPrice: string;
  setItemPrice: (v: string) => void;
  sellerLocation: string;
  setSellerLocation: (v: string) => void;
  sellerProvince: string;
  setSellerProvince: (v: string) => void;
  sellerContact: string;
  setSellerContact: (v: string) => void;
  maxBudget: string;
  setMaxBudget: (v: string) => void;
  loading: boolean;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
  onBack?: () => void;
};

export function OnsiteCreateApp(p: Props) {
  return (
    <OnsiteAppShell title="สร้างคำขอลงพื้นที่" subtitle="ให้คนกลางไปตรวจสอบสินค้าแทนคุณ" onBack={p.onBack}>
      <form className="onsite-app-form" onSubmit={p.onSubmit}>
        <label className="app-field">
          <span>รายละเอียดสินค้า <em>*</em></span>
          <textarea value={p.itemDescription} onChange={e => p.setItemDescription(e.target.value)} rows={3} required placeholder="ยี่ห้อ รุ่น สภาพ จุดที่ต้องตรวจ..." />
        </label>
        <label className="app-field">
          <span>ราคาที่ผู้ขายเสนอ (บาท)</span>
          <input type="number" value={p.itemPrice} onChange={e => p.setItemPrice(e.target.value)} placeholder="เช่น 15000" />
        </label>
        <label className="app-field">
          <span>ที่อยู่/สถานที่ <em>*</em></span>
          <input value={p.sellerLocation} onChange={e => p.setSellerLocation(e.target.value)} required placeholder="ที่อยู่หรือจุดนัดพบ" />
        </label>
        <label className="app-field">
          <span>จังหวัด <em>*</em></span>
          <select value={p.sellerProvince} onChange={e => p.setSellerProvince(e.target.value)} required>
            <option value="">เลือกจังหวัด</option>
            {p.provinces.map(pr => <option key={pr} value={pr}>{pr}</option>)}
          </select>
        </label>
        <label className="app-field">
          <span>เบอร์ติดต่อผู้ขาย</span>
          <input value={p.sellerContact} onChange={e => p.setSellerContact(e.target.value)} placeholder="08x-xxx-xxxx" />
        </label>
        <label className="app-field">
          <span>งบสูงสุดที่ยอมจ่าย (บาท) <em>*</em></span>
          <input type="number" value={p.maxBudget} onChange={e => p.setMaxBudget(e.target.value)} required placeholder="รวมค่าบริการ+เดินทาง" />
        </label>
        {p.error && <p className="app-field-error">{p.error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={p.loading}>
          {p.loading ? 'กำลังส่งคำขอ…' : 'ส่งคำขอลงพื้นที่'}
        </button>
        <Link href="/service/onsite" className="onsite-app-link-back">← กลับหน้าบริการ</Link>
      </form>
    </OnsiteAppShell>
  );
}
