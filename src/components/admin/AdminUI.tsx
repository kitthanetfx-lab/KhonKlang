'use client';

import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { MarketplaceGpBreakdown, AuctionGpBreakdown } from '@/lib/fees';

/* ── Page shell ── */

export function AdminPage({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`admin-page ${className}`.trim()}>{children}</div>;
}

export function AdminPageHeader({
  icon,
  title,
  subtitle,
  onSave,
  saving,
  saved,
  dirty,
  saveLabel = 'บันทึก',
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  onSave?: () => void;
  saving?: boolean;
  saved?: boolean;
  dirty?: boolean;
  saveLabel?: string;
}) {
  return (
    <header className="admin-page__head">
      <div>
        <h1>{icon}{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {onSave && (
        <div className="admin-page__actions">
          {dirty && !saved && (
            <span className="admin-page__dirty"><AlertTriangle size={14} /> ยังไม่ได้บันทึก</span>
          )}
          <button type="button" onClick={onSave} disabled={saving || !dirty} className="admin-btn admin-btn--primary">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {saveLabel}
          </button>
          {saved && !dirty && (
            <span className="admin-page__saved"><CheckCircle2 size={14} /> บันทึกแล้ว</span>
          )}
        </div>
      )}
    </header>
  );
}

export function AdminTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; desc?: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <nav className="admin-tabs" role="tablist">
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          className={`admin-tab${active === t.id ? ' active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          <span className="admin-tab__label">{t.label}</span>
          {t.desc && <span className="admin-tab__desc">{t.desc}</span>}
        </button>
      ))}
    </nav>
  );
}

export function AdminAlert({ type = 'error', children }: { type?: 'error' | 'success' | 'warn'; children: React.ReactNode }) {
  return <div className={`admin-alert admin-alert--${type}`}>{children}</div>;
}

export function AdminStickyBar({
  onSave,
  saving,
  saved,
  dirty,
  label = 'บันทึกการเปลี่ยนแปลง',
}: {
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  dirty: boolean;
  label?: string;
}) {
  if (!dirty && !saved) return null;
  return (
    <div className="admin-sticky-bar">
      <div className="admin-sticky-bar__inner">
        <span className="admin-sticky-bar__hint">
          {dirty ? '⚠️ มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก' : '✓ บันทึกเรียบร้อยแล้ว'}
        </span>
        <button type="button" onClick={onSave} disabled={saving || !dirty} className="admin-btn admin-btn--primary">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
          {label}
        </button>
      </div>
    </div>
  );
}

/* ── Cards ── */

export function AdminCard({
  title,
  icon,
  hint,
  featured,
  children,
  className = '',
}: {
  title: string;
  icon?: React.ReactNode;
  hint?: string;
  featured?: 'blue' | 'indigo' | 'purple' | 'amber';
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`admin-card${featured ? ` admin-card--featured admin-card--${featured}` : ''} ${className}`.trim()}>
      <header className="admin-card__head">
        {icon && <span className="admin-card__icon">{icon}</span>}
        <div>
          <h2>{title}</h2>
          {hint && <p>{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

export function AdminFieldGrid({ wide, children }: { wide?: boolean; children: React.ReactNode }) {
  return <div className={`admin-fields${wide ? ' admin-fields--wide' : ''}`}>{children}</div>;
}

export function AdminFieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="admin-field-row">
      <span className="admin-field-row__label">{label}</span>
      <div className="admin-field-row__fields">{children}</div>
    </div>
  );
}

export function AdminField({
  label,
  unit,
  value,
  onChange,
  type = 'number',
  min,
  max,
  step,
  placeholder,
  error,
  hint,
  disabled,
}: {
  label: string;
  unit?: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: 'number' | 'text' | 'date';
  min?: number;
  max?: number;
  step?: number | string;
  placeholder?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`admin-field${error ? ' admin-field--error' : ''}`}>
      <span className="admin-field__label">{label}</span>
      <div className="admin-field__input-wrap">
        <input
          type={type}
          inputMode={type === 'number' ? 'decimal' : undefined}
          min={min}
          max={max}
          step={step}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
          className="admin-field__input"
        />
        {unit && <span className="admin-field__unit">{unit}</span>}
      </div>
      {hint && !error && <span className="admin-field__hint">{hint}</span>}
      {error && <span className="admin-field__error">{error}</span>}
    </label>
  );
}

export function AdminPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="admin-pills">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          className={`admin-pill${value === o.value ? ' active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AdminGpPreview({ preview, examplePrice = 100 }: { preview: MarketplaceGpBreakdown; examplePrice?: number }) {
  return (
    <div className="admin-gp-preview">
      <div className="admin-gp-preview__title">ตัวอย่างคำนวณ (ผู้ขายตั้ง ฿{examplePrice.toLocaleString()})</div>
      <div className="gp-preview-box">
        <div className="gp-preview-row gp-preview-row--muted">
          <span>GP {preview.gpPercent}%</span>
          <span>+฿{preview.gpAmount.toLocaleString()}</span>
        </div>
        <div className="gp-preview-row">
          <span>ลูกค้าเห็นในตลาด</span>
          <strong>฿{preview.displayPrice.toLocaleString()}</strong>
        </div>
        <div className="gp-preview-row gp-preview-row--accent">
          <span>ผู้ขายได้ (ราคา + คืน {preview.commissionPercent}% ของ GP)</span>
          <strong>฿{preview.sellerReceive.toLocaleString()}</strong>
        </div>
        <div className="gp-preview-row gp-preview-row--total">
          <span>แพลตฟอร์มได้</span>
          <strong>฿{preview.platformKeep.toLocaleString()}</strong>
        </div>
      </div>
    </div>
  );
}

export function AdminAuctionGpPreview({ preview, examplePrice = 100 }: { preview: AuctionGpBreakdown; examplePrice?: number }) {
  return (
    <div className="admin-gp-preview">
      <div className="admin-gp-preview__title">ตัวอย่างปิดประมูลที่ ฿{examplePrice.toLocaleString()}</div>
      <div className="gp-preview-box">
        <div className="gp-preview-row">
          <span>ผู้ชนะจ่าย (ราคาปิด)</span>
          <strong>฿{preview.finalPrice.toLocaleString()}</strong>
        </div>
        <div className="gp-preview-row gp-preview-row--muted">
          <span>หัก GP {preview.gpPercent}%</span>
          <span>−฿{preview.gpAmount.toLocaleString()}</span>
        </div>
        <div className="gp-preview-row gp-preview-row--accent">
          <span>คืนผู้ขาย ({preview.commissionPercent}% ของ GP)</span>
          <strong>+฿{preview.sellerCommission.toLocaleString()}</strong>
        </div>
        <div className="gp-preview-row gp-preview-row--total">
          <span>ผู้ขายได้รับสุทธิ</span>
          <strong>฿{preview.sellerReceive.toLocaleString()}</strong>
        </div>
        <div className="gp-preview-row gp-preview-row--muted">
          <span>แพลตฟอร์มได้</span>
          <strong>฿{preview.platformKeep.toLocaleString()}</strong>
        </div>
      </div>
    </div>
  );
}

export function AdminSectionNote({ children }: { children: React.ReactNode }) {
  return <div className="admin-section-note">{children}</div>;
}

export function AdminLoading() {
  return (
    <div className="admin-loading">
      <Loader2 size={28} className="animate-spin" />
      <span>กำลังโหลด...</span>
    </div>
  );
}
