'use client';

import Link from 'next/link';
import { Icon } from '@/components/Icon';
import {
  AppPage,
  AppHeader,
  AppFeed,
  AppLoading,
  AppEmpty,
  AppSheet,
  AppStickyBar,
} from '@/components/mobile';

const CATS = [
  'มือถือ & ไอที', 'แบรนด์เนม', 'รถ & ยานพาหนะ', 'ไอดีเกม & ดิจิทัล', 'พระเครื่อง',
  'อาร์ตทอย & ของสะสม', 'เหมาสวน & เกษตร', 'ค้าส่ง & OEM โรงงาน', 'เครื่องจักร & อสังหาฯ', 'อื่นๆ',
];

const PROVINCES = [
  'กระบี่', 'กรุงเทพมหานคร', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร', 'ขอนแก่น', 'จันทบุรี',
  'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท', 'ชัยภูมิ', 'ชุมพร', 'เชียงราย', 'เชียงใหม่', 'ตรัง',
  'ตราด', 'ตาก', 'นครนายก', 'นครปฐม', 'นครพนม', 'นครราชสีมา', 'นครศรีธรรมราช', 'นครสวรรค์',
  'นนทบุรี', 'นราธิวาส', 'น่าน', 'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์',
  'ปราจีนบุรี', 'ปัตตานี', 'พระนครศรีอยุธยา', 'พะเยา', 'พังงา', 'พัทลุง', 'พิจิตร',
  'พิษณุโลก', 'เพชรบุรี', 'เพชรบูรณ์', 'แพร่', 'ภูเก็ต', 'มหาสารคาม', 'มุกดาหาร',
  'แม่ฮ่องสอน', 'ยโสธร', 'ยะลา', 'ร้อยเอ็ด', 'ระนอง', 'ระยอง', 'ราชบุรี', 'ลพบุรี',
  'ลำปาง', 'ลำพูน', 'เลย', 'ศรีสะเกษ', 'สกลนคร', 'สงขลา', 'สตูล', 'สมุทรปราการ',
  'สมุทรสงคราม', 'สมุทรสาคร', 'สระแก้ว', 'สระบุรี', 'สิงห์บุรี', 'สุโขทัย', 'สุพรรณบุรี',
  'สุราษฎร์ธานี', 'สุรินทร์', 'หนองคาย', 'หนองบัวลำภู', 'อ่างทอง', 'อำนาจเจริญ',
  'อุดรธานี', 'อุตรดิตถ์', 'อุทัยธานี', 'อุบลราชธานี',
];

const MODE_INFO: Record<string, { label: string; cls: string; desc: string }> = {
  middleman: { label: '🛡️ ผ่านคนกลาง', cls: 'badge-green', desc: 'พักเงินกับระบบ ปลอดภัยทั้งสองฝ่าย' },
  direct: { label: '⚡ ซื้อปกติ', cls: 'badge-gray', desc: 'ติดต่อซื้อขายกันโดยตรง' },
  both: { label: '🤝 ได้ทั้งสองแบบ', cls: 'badge-blue', desc: 'แล้วแต่ตกลงกับผู้ขาย' },
};

export interface WantedPost {
  id: string;
  user_id: string;
  user_name: string;
  title: string;
  detail: string;
  budget_min: number;
  budget_max: number;
  category: string;
  province: string;
  buy_mode: string;
  contact: string;
  status: string;
  created_at: string;
}

export type WantedAppProps = {
  loading: boolean;
  myId: string;
  filtered: WantedPost[];
  search: string;
  onSearch: (v: string) => void;
  cat: string;
  onCat: (v: string) => void;
  province: string;
  onProvince: (v: string) => void;
  mode: string;
  onMode: (v: string) => void;
  showForm: boolean;
  onToggleForm: () => void;
  onLoginToPost: () => void;
  fTitle: string;
  onFTitle: (v: string) => void;
  fDetail: string;
  onFDetail: (v: string) => void;
  fBudgetMin: string;
  onFBudgetMin: (v: string) => void;
  fBudgetMax: string;
  onFBudgetMax: (v: string) => void;
  fCat: string;
  onFCat: (v: string) => void;
  fProvince: string;
  onFProvince: (v: string) => void;
  fMode: 'middleman' | 'direct' | 'both';
  onFMode: (v: 'middleman' | 'direct' | 'both') => void;
  fContact: string;
  onFContact: (v: string) => void;
  posting: boolean;
  formError: string;
  onSubmitPost: () => void;
  contactOpen: string;
  onContactOpen: (id: string) => void;
  onOfferToSell: (p: WantedPost) => void;
  onClosePost: (id: string) => void;
  budgetText: (p: WantedPost) => string;
  timeAgo: (iso: string) => string;
};

export function WantedApp(props: WantedAppProps) {
  const {
    loading, myId, filtered, search, onSearch, cat, onCat, province, onProvince, mode, onMode,
    showForm, onToggleForm, onLoginToPost, fTitle, onFTitle, fDetail, onFDetail,
    fBudgetMin, onFBudgetMin, fBudgetMax, onFBudgetMax, fCat, onFCat, fProvince, onFProvince,
    fMode, onFMode, fContact, onFContact, posting, formError, onSubmitPost,
    contactOpen, onContactOpen, onOfferToSell, onClosePost, budgetText, timeAgo,
  } = props;

  const activeFilters = (cat ? 1 : 0) + (province ? 1 : 0) + (mode ? 1 : 0);

  return (
    <AppPage withBottomNav>
      <AppHeader title="หาสินค้า" backHref="/" />
      <AppFeed>
        <p className="app-lead" style={{ marginTop: 0 }}>ลงประกาศฟรี ผู้ขายทั้งระบบเห็นความต้องการของคุณ</p>

        <form className="wanted-app-search" role="search" onSubmit={e => e.preventDefault()}>
          <Icon name="search" size={18} />
          <input type="search" value={search} onChange={e => onSearch(e.target.value)} placeholder="ค้นหาประกาศ…" enterKeyHint="search" />
        </form>

        <div className="wanted-app-filters">
          <select value={cat} onChange={e => onCat(e.target.value)} aria-label="หมวดหมู่">
            <option value="">ทุกหมวด</option>
            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={province} onChange={e => onProvince(e.target.value)} aria-label="จังหวัด">
            <option value="">ทุกจังหวัด</option>
            {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={mode} onChange={e => onMode(e.target.value)} aria-label="รูปแบบซื้อ">
            <option value="">ทุกรูปแบบ</option>
            <option value="middleman">ผ่านคนกลาง</option>
            <option value="direct">ซื้อปกติ</option>
          </select>
        </div>

        {activeFilters > 0 && (
          <button type="button" className="wanted-app-clear" onClick={() => { onCat(''); onProvince(''); onMode(''); }}>
            ล้างตัวกรอง ({activeFilters})
          </button>
        )}

        {loading && <AppLoading />}
        {!loading && filtered.length === 0 && (
          <AppEmpty action={
            <button type="button" className="btn btn-primary" onClick={myId ? onToggleForm : onLoginToPost}>ลงประกาศแรก</button>
          }>
            ยังไม่มีประกาศที่ตรงเงื่อนไข
          </AppEmpty>
        )}

        <div className="wanted-app-list">
          {filtered.map(p => {
            const m = MODE_INFO[p.buy_mode] || MODE_INFO.middleman;
            const mine = p.user_id === myId;
            return (
              <article key={p.id} className="app-card wanted-app-card">
                <div className="wanted-app-card-head">
                  <span className={`badge ${m.cls}`}>{m.label}</span>
                  {p.category && <span className="badge badge-gray">{p.category}</span>}
                  {p.province && <span className="badge badge-gray">📍 {p.province}</span>}
                  {mine && <span className="badge badge-amber">ของฉัน</span>}
                </div>
                <h3 className="wanted-app-title">{p.title}</h3>
                {p.detail && <p className="wanted-app-detail">{p.detail}</p>}
                <div className="wanted-app-meta">
                  <strong>{budgetText(p)}</strong>
                  <span>{p.user_name} · {timeAgo(p.created_at)}</span>
                </div>
                <div className="wanted-app-actions">
                  {!mine && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => onOfferToSell(p)}>
                      เสนอขายผ่านคนกลาง
                    </button>
                  )}
                  {!mine && (
                    <Link className="btn btn-soft btn-sm" href={`/service/meetup?step=2&role=seller&title=${encodeURIComponent(p.title)}&wantedId=${p.id}&inviteUserId=${p.user_id}`}>
                      🚗 นัดรับ
                    </Link>
                  )}
                  {!mine && (
                    <Link className="btn btn-ghost btn-sm" href={`/messages?to=${p.user_id}&name=${encodeURIComponent(p.user_name || 'สมาชิก')}`}>
                      <Icon name="message" size={15} /> ข้อความ
                    </Link>
                  )}
                  {!mine && p.contact && (p.buy_mode === 'direct' || p.buy_mode === 'both') && (
                    contactOpen === p.id
                      ? <span className="wanted-app-contact">{p.contact}</span>
                      : <button type="button" className="btn btn-ghost btn-sm" onClick={() => onContactOpen(p.id)}>ดูช่องทางติดต่อ</button>
                  )}
                  {mine && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onClosePost(p.id)}>ได้ของแล้ว — ปิด</button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="app-card wanted-app-tip">
          💡 แนะนำปิดดีล<Link href="/service/trade">ผ่านคนกลาง</Link>เพื่อความปลอดภัย
        </div>
        <div className="wanted-app-scroll-pad" aria-hidden />
      </AppFeed>

      <AppStickyBar>
        <button type="button" className="btn btn-primary btn-block btn-lg" onClick={myId ? onToggleForm : onLoginToPost}>
          <Icon name="plus" size={18} /> ลงประกาศหาสินค้า
        </button>
      </AppStickyBar>

      <AppSheet
        open={showForm}
        title="ลงประกาศหาสินค้า"
        onClose={onToggleForm}
        footer={
          <>
            <button type="button" className="btn btn-soft btn-lg" onClick={onToggleForm}>ยกเลิก</button>
            <button type="button" className="btn btn-primary btn-lg" disabled={posting} onClick={onSubmitPost}>
              {posting ? 'กำลังลง…' : 'ลงประกาศ'}
            </button>
          </>
        }
      >
        <label className="app-field">กำลังหาอะไร? *<input value={fTitle} onChange={e => onFTitle(e.target.value)} maxLength={200} placeholder="เช่น iPhone 15 Pro 256GB" /></label>
        <label className="app-field">รายละเอียด<textarea value={fDetail} onChange={e => onFDetail(e.target.value)} rows={3} maxLength={1000} placeholder="สเปก เงื่อนไข ฯลฯ" /></label>
        <div className="wanted-app-form-grid">
          <label className="app-field">งบต่ำสุด<input type="number" min="0" value={fBudgetMin} onChange={e => onFBudgetMin(e.target.value)} placeholder="ไม่ระบุ" /></label>
          <label className="app-field">งบสูงสุด<input type="number" min="0" value={fBudgetMax} onChange={e => onFBudgetMax(e.target.value)} placeholder="ไม่ระบุ" /></label>
        </div>
        <label className="app-field">หมวดหมู่
          <select value={fCat} onChange={e => onFCat(e.target.value)}><option value="">เลือก…</option>{CATS.map(c => <option key={c} value={c}>{c}</option>)}</select>
        </label>
        <label className="app-field">จังหวัด
          <select value={fProvince} onChange={e => onFProvince(e.target.value)}><option value="">ทุกจังหวัด</option>{PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}</select>
        </label>
        <div className="app-field">ต้องการซื้อแบบไหน? *
          <div className="wanted-app-mode-grid">
            {(Object.keys(MODE_INFO) as ('middleman' | 'direct' | 'both')[]).map(m => (
              <button key={m} type="button" className={`wanted-app-mode${fMode === m ? ' is-on' : ''}`} onClick={() => onFMode(m)}>
                <b>{MODE_INFO[m].label}</b><span>{MODE_INFO[m].desc}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="app-field">ช่องทางติดต่อ (ไม่บังคับ)<input value={fContact} onChange={e => onFContact(e.target.value)} maxLength={200} placeholder="LINE / เบอร์โทร" /></label>
        {formError && <p className="app-detail-err">{formError}</p>}
      </AppSheet>
    </AppPage>
  );
}

export default WantedApp;
