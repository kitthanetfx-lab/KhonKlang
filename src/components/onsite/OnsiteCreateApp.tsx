'use client';

type Props = {
  itemDescription: string;
  onItemDescription: (v: string) => void;
  itemPrice: string;
  onItemPrice: (v: string) => void;
  sellerProvince: string;
  onSellerProvince: (v: string) => void;
  sellerLocation: string;
  onSellerLocation: (v: string) => void;
  sellerContact: string;
  onSellerContact: (v: string) => void;
  maxBudget: string;
  onMaxBudget: (v: string) => void;
  provinces: string[];
  error: string;
  loading: boolean;
  disabled: boolean;
  onSubmit: () => void;
};

/** สร้างคำขอ onsite — UI มือถือใหม่ ไม่ใช้ markup desktop */
export function OnsiteCreateApp(p: Props) {
  return (
    <div className="onsite-app-form">
      {p.error && <div className="onsite-app-alert">{p.error}</div>}

      <label className="onsite-app-field">
        <span>รายละเอียดสินค้าที่ต้องการตรวจ *</span>
        <textarea
          value={p.itemDescription}
          onChange={e => p.onItemDescription(e.target.value)}
          rows={3}
          placeholder="เช่น Honda Civic 2018 สีขาว ต้องการตรวจสภาพเครื่องยนต์"
        />
      </label>

      <label className="onsite-app-field">
        <span>ราคาสินค้าที่ตกลง (บาท)</span>
        <input type="number" value={p.itemPrice} onChange={e => p.onItemPrice(e.target.value)} placeholder="350000" />
      </label>

      <label className="onsite-app-field">
        <span>จังหวัดที่ตั้งสินค้า *</span>
        <select value={p.sellerProvince} onChange={e => p.onSellerProvince(e.target.value)}>
          <option value="">เลือกจังหวัด…</option>
          {p.provinces.map(pr => <option key={pr} value={pr}>{pr}</option>)}
        </select>
      </label>

      <label className="onsite-app-field">
        <span>ที่อยู่ / สถานที่นัดพบ *</span>
        <textarea
          value={p.sellerLocation}
          onChange={e => p.onSellerLocation(e.target.value)}
          rows={2}
          placeholder="ตลาดนัดรถยนต์ ถ.พหลโยธิน…"
        />
      </label>

      <label className="onsite-app-field">
        <span>เบอร์ติดต่อผู้ขาย</span>
        <input value={p.sellerContact} onChange={e => p.onSellerContact(e.target.value)} placeholder="081-234-5678" />
      </label>

      <label className="onsite-app-field">
        <span>งบค่าบริการสูงสุด (บาท)</span>
        <input type="number" value={p.maxBudget} onChange={e => p.onMaxBudget(e.target.value)} placeholder="1000" />
        {p.maxBudget && <small>คนกลางจะเสนอราคาภายในงบที่เหมาะสม</small>}
      </label>

      <button
        type="button"
        className="onsite-app-submit"
        onClick={p.onSubmit}
        disabled={p.loading || p.disabled}
      >
        {p.loading ? 'กำลังสร้างคำขอ…' : '📋 ส่งคำขอหาคนกลาง'}
      </button>
    </div>
  );
}

export default OnsiteCreateApp;
