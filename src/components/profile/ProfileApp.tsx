'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppPage } from '@/components/mobile/AppPage';
import { AppHeader } from '@/components/mobile/AppHeader';
import { AppFeed } from '@/components/mobile/AppStates';
import { Icon } from '@/components/Icon';
import { THAI_BANKS } from '@/lib/banks';

const PROVINCES = ['กระบี่','กรุงเทพมหานคร','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท','ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก','นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช','นครสวรรค์','นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พะเยา','พังงา','พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','ภูเก็ต','มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน','ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี','ลพบุรี','ลำปาง','ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ','สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู','อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี'];

export type ProfileEditAddr = {
  houseNo: string;
  moo: string;
  road: string;
  provinceName: string;
  amphoreName: string;
  tambonName: string;
  postalCode: string;
};

export type ProfileAppProps = {
  locked: boolean;
  editing: boolean;
  saving: boolean;
  displayName: string;
  email: string;
  avatarUrl: string;
  initials: string;
  roleLabel: string;
  roleCls: string;
  sellerApproved: boolean;
  middlemanApproved: boolean;
  sellerStatus: string;
  middlemanStatus: string;
  prefs: Record<string, string>;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  lineLinked: boolean;
  editFirst: string;
  editLast: string;
  editPhone: string;
  editAddr: ProfileEditAddr;
  editBankName: string;
  editBankAcct: string;
  editBankOwner: string;
  editBankQr: string;
  qrUploading: boolean;
  qrUrl: (id: string) => string;
  amphoes: string[];
  tambons: [string, string][];
  loadingAmph: boolean;
  loadingTamb: boolean;
  error: string;
  saveOk: boolean;
  wallet: {
    tier: string;
    credit_limit: number;
    available_credit: number;
    held_credit: number;
    released_credit: number;
    penalty_credit: number;
    active_deal_count: number;
    updated_at: string;
  } | null;
  ledger: Array<{ entry_key: string; purpose: string; amount: number; status: string; deal_number?: string }>;
  ledgerStatusMap: Record<string, string>;
  baht: (n: number) => string;
  onOpenEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onLogout: () => void;
  onPdpaDelete: () => void;
  onEditFirst: (v: string) => void;
  onEditLast: (v: string) => void;
  onEditPhone: (v: string) => void;
  onEditBankName: (v: string) => void;
  onEditBankAcct: (v: string) => void;
  onEditBankOwner: (v: string) => void;
  onClearBankQr: () => void;
  onUploadBankQr: (file: File) => void;
  onProvince: (name: string) => void;
  onAmphoe: (name: string) => void;
  onTambon: (val: string) => void;
  onEditAddrField: (field: keyof ProfileEditAddr, value: string) => void;
  statusBadge: (status: string) => ReactNode;
};

export function ProfileApp(props: ProfileAppProps) {
  const {
    locked, editing, saving, displayName, email, avatarUrl, initials,
    roleLabel, roleCls, sellerApproved, middlemanApproved,
    sellerStatus, middlemanStatus, prefs, firstName, lastName, phone, address,
    lineLinked, editFirst, editLast, editPhone, editAddr,
    editBankName, editBankAcct, editBankOwner, editBankQr, qrUploading, qrUrl,
    amphoes, tambons, loadingAmph, loadingTamb, error, saveOk, wallet, ledger,
    ledgerStatusMap, baht, onOpenEdit, onCancelEdit, onSave, onLogout, onPdpaDelete,
    onEditFirst, onEditLast, onEditPhone, onEditBankName, onEditBankAcct, onEditBankOwner,
    onClearBankQr, onUploadBankQr, onProvince, onAmphoe, onTambon, onEditAddrField,
    statusBadge,
  } = props;

  const headerRight = editing ? (
    <div className="pf-app-head-actions">
      {!locked && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancelEdit}>ยกเลิก</button>
      )}
      <button type="button" className="btn btn-primary btn-sm" onClick={onSave} disabled={saving}>
        {saving ? '...' : 'บันทึก'}
      </button>
    </div>
  ) : (
    <button type="button" className="btn btn-soft btn-sm" onClick={onOpenEdit}>แก้ไข</button>
  );

  return (
    <AppPage withBottomNav={false} className="pf-app">
      <AppHeader
        title={locked ? 'กรอกข้อมูลให้ครบ' : 'โปรไฟล์'}
        backHref={locked ? undefined : '/'}
        right={headerRight}
      />
      <AppFeed>
        <div className="pf-app-hero app-card">
          <div className="pf-app-avatar">
            {avatarUrl
              ? <img src={avatarUrl} alt={displayName || 'avatar'} referrerPolicy="no-referrer" />
              : initials}
          </div>
          <div className="pf-app-hero-tx">
            <div className="pf-app-name">{displayName || 'ผู้ใช้งาน'}</div>
            {email && <div className="pf-app-email">{email}</div>}
            <div className="pf-app-badges">
              <span className={`pf-role-badge ${roleCls}`}>{roleLabel}</span>
              {sellerApproved && <span className="pf-role-badge pf-role-seller">🛒 ผู้ขาย</span>}
              {middlemanApproved && <span className="pf-role-badge pf-role-middleman">🤝 คนกลาง</span>}
            </div>
          </div>
        </div>

        {locked && (
          <div className="pf-app-alert">⚠️ กรอกข้อมูลบัญชีและข้อมูลส่วนตัวให้ครบก่อนใช้งาน — บันทึกสำเร็จแล้วระบบจะพาไปหน้าที่ตั้งใจ</div>
        )}

        <section className="app-card pf-app-section">
          <h2 className="pf-app-section-title">แจ้งเตือน LINE OA (ประมูล)</h2>
          {lineLinked ? (
            <p className="pf-app-ok">✓ ผูก LINE แล้ว — แจ้งเมื่อมีคน overbid แม้ปิดเว็บ</p>
          ) : (
            <>
              <p className="pf-app-muted">เพิ่มเพื่อน OA แล้วเข้าสู่ระบบด้วย LINE เพื่อรับแจ้ง overbid</p>
              <div className="pf-app-btn-row">
                {process.env.NEXT_PUBLIC_LINE_OA_ADD_FRIEND_URL ? (
                  <a className="btn btn-soft btn-sm" href={process.env.NEXT_PUBLIC_LINE_OA_ADD_FRIEND_URL} target="_blank" rel="noreferrer">เพิ่มเพื่อน LINE OA</a>
                ) : null}
                <a className="btn btn-soft btn-sm" href={`/api/auth/line?returnTo=${encodeURIComponent('/profile')}`}>เชื่อม LINE Login</a>
              </div>
            </>
          )}
        </section>

        <section className="app-card pf-app-section">
          <h2 className="pf-app-section-title">บัญชีธนาคาร (รับเงิน)</h2>
          {editing ? (
            <div className="pf-app-form">
              <select className="app-field-select" value={editBankName} onChange={e => onEditBankName(e.target.value)}>
                <option value="">เลือกธนาคาร</option>
                {THAI_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <input className="app-field-input" value={editBankAcct} onChange={e => onEditBankAcct(e.target.value)} placeholder="เลขที่บัญชี" />
              <input className="app-field-input" value={editBankOwner} onChange={e => onEditBankOwner(e.target.value)} placeholder="ชื่อบัญชี" />
              <div className="pf-app-qr-row">
                {editBankQr && <img src={qrUrl(editBankQr)} alt="QR" className="pf-app-qr" />}
                <label className="btn btn-soft btn-sm">
                  {qrUploading ? 'กำลังอัปโหลด...' : editBankQr ? 'เปลี่ยน QR' : 'อัปโหลด QR'}
                  <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onUploadBankQr(f); e.target.value = ''; }} />
                </label>
                {editBankQr && <button type="button" className="btn btn-ghost btn-sm" onClick={onClearBankQr}>ลบรูป</button>}
              </div>
            </div>
          ) : (
            (prefs.bank_acct || prefs.bank_name || prefs.bank_qr_file_id) ? (
              <div className="pf-app-rows">
                {prefs.bank_name && <div className="pf-app-row"><span>ธนาคาร</span><strong>{prefs.bank_name}</strong></div>}
                {prefs.bank_acct && <div className="pf-app-row"><span>เลขบัญชี</span><strong className="mono">{prefs.bank_acct}</strong></div>}
                {prefs.bank_owner && <div className="pf-app-row"><span>ชื่อบัญชี</span><strong>{prefs.bank_owner}</strong></div>}
                {prefs.bank_qr_file_id && <img src={qrUrl(prefs.bank_qr_file_id)} alt="QR" className="pf-app-qr" />}
              </div>
            ) : (
              <p className="pf-app-muted">ยังไม่ได้กรอกบัญชีรับเงิน — กดแก้ไขเพื่อเพิ่ม</p>
            )
          )}
        </section>

        <section className="app-card pf-app-section">
          <h2 className="pf-app-section-title">ข้อมูลส่วนตัว</h2>
          {editing ? (
            <div className="pf-app-form">
              <div className="pf-app-grid-2">
                <label className="app-field">ชื่อ *
                  <input className="app-field-input" value={editFirst} onChange={e => onEditFirst(e.target.value)} placeholder="ชื่อ" />
                </label>
                <label className="app-field">นามสกุล *
                  <input className="app-field-input" value={editLast} onChange={e => onEditLast(e.target.value)} placeholder="นามสกุล" />
                </label>
              </div>
              <label className="app-field">เบอร์โทร *
                <input className="app-field-input" value={editPhone} onChange={e => onEditPhone(e.target.value.replace(/\D/g, ''))} placeholder="0812345678" maxLength={10} inputMode="numeric" />
              </label>
              <div className="pf-app-subtitle">ที่อยู่</div>
              <div className="pf-app-grid-3">
                <input className="app-field-input" value={editAddr.houseNo} onChange={e => onEditAddrField('houseNo', e.target.value)} placeholder="บ้านเลขที่" />
                <input className="app-field-input" value={editAddr.moo} onChange={e => onEditAddrField('moo', e.target.value)} placeholder="หมู่" />
                <input className="app-field-input" value={editAddr.road} onChange={e => onEditAddrField('road', e.target.value)} placeholder="ถนน" />
              </div>
              <select className="app-field-select" value={editAddr.provinceName} onChange={e => onProvince(e.target.value)}>
                <option value="">เลือกจังหวัด</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select className="app-field-select" value={editAddr.amphoreName} onChange={e => onAmphoe(e.target.value)} disabled={!editAddr.provinceName || loadingAmph}>
                <option value="">{loadingAmph ? 'กำลังโหลด...' : editAddr.provinceName ? 'เลือกอำเภอ' : 'เลือกจังหวัดก่อน'}</option>
                {amphoes.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <div className="pf-app-grid-2">
                <select className="app-field-select" value={editAddr.tambonName ? `${editAddr.tambonName}|${editAddr.postalCode}` : ''} onChange={e => onTambon(e.target.value)} disabled={!editAddr.amphoreName || loadingTamb}>
                  <option value="">{loadingTamb ? 'กำลังโหลด...' : editAddr.amphoreName ? 'เลือกตำบล' : 'เลือกอำเภอก่อน'}</option>
                  {tambons.map(([n, z]) => <option key={n} value={`${n}|${z}`}>{n}</option>)}
                </select>
                <input readOnly className="app-field-input pf-app-readonly" value={editAddr.postalCode} placeholder="รหัสไปรษณีย์" />
              </div>
            </div>
          ) : (
            <div className="pf-app-rows">
              <div className="pf-app-row"><span>ชื่อ-นามสกุล</span><strong>{`${firstName} ${lastName}`.trim() || '—'}</strong></div>
              <div className="pf-app-row"><span>อีเมล</span><strong>{email || '—'}</strong></div>
              <div className="pf-app-row"><span>เบอร์โทร</span><strong>{phone || '—'}</strong></div>
              <div className="pf-app-row"><span>ที่อยู่</span><strong>{address || '—'}</strong></div>
            </div>
          )}
          {error && <div className="pf-app-error">⚠️ {error}</div>}
          {saveOk && <div className="pf-app-ok">✅ บันทึกสำเร็จ!</div>}
        </section>

        {editing && (
          <button type="button" className="btn btn-primary btn-block pf-app-save-main" onClick={onSave} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </button>
        )}

        {!locked && (sellerStatus || middlemanStatus) && (
          <section className="app-card pf-app-section">
            <h2 className="pf-app-section-title">สถานะการสมัคร</h2>
            {sellerStatus && <div className="pf-app-row"><span>ผู้ขาย 🛒</span>{statusBadge(sellerStatus)}</div>}
            {middlemanStatus && <div className="pf-app-row"><span>คนกลาง 🤝</span>{statusBadge(middlemanStatus)}</div>}
          </section>
        )}

        {!locked && wallet && (
          <section className="app-card pf-app-section">
            <h2 className="pf-app-section-title">Middleman Credit Wallet</h2>
            <div className="pf-app-rows">
              <div className="pf-app-row"><span>Tier</span><strong>{wallet.tier}</strong></div>
              <div className="pf-app-row"><span>วงเงิน</span><strong>{baht(wallet.credit_limit)}</strong></div>
              <div className="pf-app-row"><span>คงเหลือ</span><strong>{baht(wallet.available_credit)}</strong></div>
              <div className="pf-app-row"><span>Hold</span><strong>{baht(wallet.held_credit)}</strong></div>
            </div>
            {ledger.length > 0 && ledger.slice(0, 4).map(item => (
              <div key={item.entry_key} className="pf-app-row pf-app-row--stack">
                <strong>{item.deal_number || 'รายการเครดิต'}</strong>
                <span>{item.purpose} · {baht(item.amount)} · {ledgerStatusMap[item.status] || item.status}</span>
              </div>
            ))}
          </section>
        )}

        {!locked && (
          <section className="pf-app-links">
            {sellerApproved && (
              <Link href="/dashboard/seller" className="pf-app-link">
                <span>🏪 ร้านของฉัน</span>
                <Icon name="chevronRight" size={18} />
              </Link>
            )}
            {middlemanApproved && (
              <Link href="/dashboard/middleman" className="pf-app-link">
                <span>🤝 บอร์ดคนกลาง</span>
                <Icon name="chevronRight" size={18} />
              </Link>
            )}
            {!sellerStatus && (
              <Link href="/register/seller" className="pf-app-link"><span>🛒 สมัครเป็นผู้ขาย</span><Icon name="chevronRight" size={18} /></Link>
            )}
            {!middlemanStatus && (
              <Link href="/register/middleman" className="pf-app-link"><span>🤝 สมัครเป็นคนกลาง</span><Icon name="chevronRight" size={18} /></Link>
            )}
            <Link href="/check-scam" className="pf-app-link"><span>🛡️ เช็คคนโกง</span><Icon name="chevronRight" size={18} /></Link>
          </section>
        )}

        <button type="button" className="pf-app-logout" onClick={onLogout}><Icon name="logout" size={16} /> ออกจากระบบ</button>
        {!locked && (
          <button type="button" className="pf-app-pdpa" onClick={onPdpaDelete}>🗑️ ขอลบข้อมูลส่วนบุคคล (PDPA)</button>
        )}
      </AppFeed>
    </AppPage>
  );
}

export default ProfileApp;
