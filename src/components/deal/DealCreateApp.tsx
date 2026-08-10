'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { SubPageApp } from '@/components/mobile';
import { DealFlowBrand } from '@/components/DealFlowBrand';
import { computeDealFees } from '@/lib/fees';

const CATS = ['สินค้าทั่วไป', 'อิเล็กทรอนิกส์', 'เสื้อผ้า', 'ยานพาหนะ', 'อสังหาริมทรัพย์', 'บริการ', 'อื่นๆ'];

type RoleOption = {
  key: 'seller' | 'buyer';
  image: string;
  imageAlt: string;
  desc: string;
};

type Props = {
  title: string;
  backHref?: string;
  role: 'seller' | 'buyer';
  roleOptions: readonly RoleOption[];
  onRoleChange: (role: 'seller' | 'buyer') => void;
  formTitle: string;
  onTitleChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  price: string;
  onPriceChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  isSimple: boolean;
  feeBreakdown: ReturnType<typeof computeDealFees>;
  error: string;
  loading: boolean;
  serviceEnabled: boolean;
  onSubmit: () => void;
  right?: ReactNode;
};

export function DealCreateApp({
  title,
  backHref = '/',
  role,
  roleOptions,
  onRoleChange,
  formTitle,
  onTitleChange,
  description,
  onDescriptionChange,
  price,
  onPriceChange,
  category,
  onCategoryChange,
  isSimple,
  feeBreakdown,
  error,
  loading,
  serviceEnabled,
  onSubmit,
  right,
}: Props) {
  return (
    <SubPageApp title={title} backHref={backHref} right={right} withBottomNav accent="default">
      <div className="deal-create-app">
        <DealFlowBrand docked />

        <div className="app-field">
          <span>คุณเป็น...</span>
          <div className="deal-create-app-roles">
            {roleOptions.map(option => (
              <button
                key={option.key}
                type="button"
                className={`deal-create-app-role${role === option.key ? ' is-on' : ''}`}
                onClick={() => onRoleChange(option.key)}
                aria-pressed={role === option.key}
              >
                <span className="deal-create-app-role-media">
                  <Image
                    src={option.image}
                    alt={option.imageAlt}
                    fill
                    className="deal-create-app-role-image"
                    sizes="(max-width: 767px) 50vw, 240px"
                  />
                </span>
              </button>
            ))}
          </div>
        </div>

        <label className="app-field">
          <span>ชื่อสินค้า / บริการ *</span>
          <input
            type="text"
            value={formTitle}
            onChange={e => onTitleChange(e.target.value)}
            placeholder="เช่น iPhone 15 Pro Max 256GB สภาพ 9/10"
          />
        </label>

        <label className="app-field">
          <span>รายละเอียด</span>
          <textarea
            value={description}
            onChange={e => onDescriptionChange(e.target.value)}
            rows={3}
            placeholder="สภาพ อุปกรณ์ที่แถม เงื่อนไขต่างๆ..."
          />
        </label>

        <div className="deal-create-app-row">
          <label className="app-field">
            <span>ราคา (บาท) *</span>
            <input type="number" value={price} onChange={e => onPriceChange(e.target.value)} min="0" placeholder="0" />
          </label>
          <label className="app-field">
            <span>หมวดหมู่</span>
            <select value={category} onChange={e => onCategoryChange(e.target.value)}>
              <option value="">เลือก...</option>
              {CATS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>

        {Number(price) > 0 && (
          <div className="deal-create-app-fees app-card">
            <div className="deal-create-app-fees-title">
              💸 ค่าบริการโดยประมาณ ({isSimple ? 'ซื้อขายแบบง่าย' : 'ซื้อขายผ่านกลาง'})
            </div>
            {feeBreakdown.lines.map(l => (
              <div key={l.label} className="deal-create-app-fee-line">
                <span>{l.label}</span>
                <span>฿{l.amount.toLocaleString()}</span>
              </div>
            ))}
            <div className="deal-create-app-fee-total">
              <span>รวมค่าบริการ</span>
              <span>฿{feeBreakdown.total.toLocaleString()}</span>
            </div>
            <p className="deal-create-app-fee-note">* {feeBreakdown.note} · อัตราตามที่ระบบกำหนด</p>
          </div>
        )}

        {error && <p className="deal-create-app-error">⚠️ {error}</p>}

        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || !serviceEnabled}
          className="btn btn-primary btn-block deal-create-app-submit"
        >
          {loading ? 'กำลังสร้าง...' : 'สร้างดีล & รับลิงก์แชร์'}
        </button>
        <p className="deal-create-app-hint">หลังสร้าง คัดลอกลิงก์จากหน้าดีลและส่งให้อีกฝ่าย</p>
      </div>
    </SubPageApp>
  );
}

export default DealCreateApp;
