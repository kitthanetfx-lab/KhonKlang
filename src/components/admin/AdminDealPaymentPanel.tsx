'use client';

import { authHeaders } from '@/lib/supabase';
import type { FeeConfig } from '@/lib/fees';
import {
  computeDealPaymentBreakdown,
  type DealPaymentBreakdown,
  type PriceStateInput,
} from '@/lib/dealPaymentBreakdown';

export type AdminDealPaymentDeal = {
  id: string;
  status?: string;
  deal_type?: string | null;
  price?: number | null;
  shipping_cost?: number | null;
  fee_payer?: string | null;
  source?: string | null;
  buyer_id?: string | null;
  reject_reason?: string | null;
  payment_slip_file_id?: string | null;
  payment_slip_verified_at?: string | null;
};

function PayRow({
  label,
  amount,
  bold,
  muted,
  total,
}: {
  label: string;
  amount: number;
  bold?: boolean;
  muted?: boolean;
  total?: boolean;
}) {
  return (
    <div className={`flex justify-between items-baseline gap-3 ${muted ? 'text-gray-400' : total ? 'text-emerald-900 dark:text-emerald-100' : 'text-gray-600 dark:text-gray-300'}`}>
      <span className={total ? 'font-bold text-sm' : ''}>{label}</span>
      <span className={`font-mono tabular-nums ${total ? 'text-xl font-extrabold tracking-tight' : bold ? 'text-lg font-bold text-gray-900 dark:text-gray-100' : 'font-semibold'}`}>
        ฿{amount.toLocaleString()}
      </span>
    </div>
  );
}

export function adminCanEditShipping(deal: AdminDealPaymentDeal): boolean {
  return deal.deal_type === 'simple'
    && !['completed', 'cancelled'].includes(String(deal.status || ''));
}

export function adminPaymentBreakdown(
  deal: AdminDealPaymentDeal,
  priceState: PriceStateInput,
  fees: FeeConfig,
): DealPaymentBreakdown | null {
  if (deal.deal_type === 'meetup') return null;
  return computeDealPaymentBreakdown(deal, priceState, fees);
}

type Props = {
  deal: AdminDealPaymentDeal;
  priceState?: PriceStateInput;
  fees: FeeConfig;
  onUpdated?: () => void | Promise<void>;
  variant?: 'admin' | 'deal';
};

/** สรุปยอดชำระมุมมองแอดมิน — ใช้ร่วมทุกหน้าที่เปิดดีล */
export function AdminDealPaymentPanel({
  deal,
  priceState,
  fees,
  onUpdated,
  variant = 'admin',
}: Props) {
  const bd = adminPaymentBreakdown(deal, priceState, fees);
  if (!bd) return null;

  const canEditShipping = adminCanEditShipping(deal);
  const wrapClass = variant === 'deal'
    ? 'rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs space-y-2'
    : 'mt-2 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-900/40 dark:border-slate-700 px-3 py-2.5 text-xs space-y-2';

  async function saveShipping(next: number) {
    const headers = await authHeaders();
    const r = await fetch('/api/admin/deals', {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deal.id, action: 'update_shipping_cost', shippingCost: next }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert(data.error || 'บันทึกไม่สำเร็จ');
      return;
    }
    await onUpdated?.();
  }

  return (
    <div className={wrapClass}>
      <p className="font-semibold text-slate-800 dark:text-slate-100">
        {bd.isMarketplace ? '🛒 สรุปยอดชำระ (ตลาด/ประมูล)' : '💰 สรุปยอดชำระ'}
      </p>

      {deal.reject_reason && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-700">
          ⚠️ {deal.reject_reason}
        </p>
      )}

      {(deal.payment_slip_file_id || bd.sellerServiceDue > 0) && (
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className={`rounded-full px-2 py-0.5 ${deal.payment_slip_verified_at ? 'bg-green-100 text-green-800' : deal.payment_slip_file_id ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
            สลิปผู้ซื้อ: {deal.payment_slip_verified_at ? '✅ ผ่าน' : deal.payment_slip_file_id ? '⏳ รอตรวจ' : '—'}
          </span>
          {bd.sellerServiceDue > 0 && (
            <span className="rounded-full px-2 py-0.5 bg-violet-100 text-violet-800">
              ค่าบริการผู้ขาย: ฿{bd.sellerServiceDue.toLocaleString()} (แยกสลิป)
            </span>
          )}
        </div>
      )}

      <div className="space-y-1 rounded-lg border border-sky-200 bg-sky-50/80 dark:bg-sky-950/20 dark:border-sky-900 px-2.5 py-2">
        <p className="font-semibold text-sky-900 dark:text-sky-100">ยอดผู้ซื้อโอนเข้าศูนย์กลาง (สินค้า + ขนส่ง)</p>
        <p className="text-[11px] text-sky-800/80 dark:text-sky-300/80">ค่าขนส่งไม่ใช่ค่าบริการ — ผู้ซื้อโอนเสมอ · ผู้ขายได้รับเมื่อดีลสำเร็จ</p>
        <PayRow label="ค่าสินค้า" amount={bd.productPrice} />
        <div className="flex justify-between items-center gap-3">
          <span className={bd.shippingCost === 0 ? 'text-gray-400' : 'text-gray-600 dark:text-gray-300'}>ค่าขนส่ง</span>
          <div className="flex items-center gap-2">
            {canEditShipping && (
              <button
                type="button"
                className="text-[11px] text-blue-600 hover:underline"
                onClick={async () => {
                  const v = window.prompt('แก้ค่าขนส่ง (บาท)', String(deal.shipping_cost ?? bd.shippingCost ?? 0));
                  if (v === null) return;
                  await saveShipping(Math.max(0, Math.round(Number(v) || 0)));
                }}
              >
                แก้ไข
              </button>
            )}
            <span className={`font-mono tabular-nums font-semibold ${bd.shippingCost === 0 ? 'text-gray-400' : ''}`}>
              ฿{bd.shippingCost.toLocaleString()}
            </span>
          </div>
        </div>
        {bd.shippingCost === 0 && deal.deal_type === 'simple' && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1">
            ⚠️ ค่าขนส่งเป็น 0 — ถ้าผู้ซื้อโอนเกินราคาสินค้า ให้ตรวจว่าตั้งค่าขนส่งตอนสร้างดีลครบหรือไม่
          </p>
        )}
        {bd.buyerServiceShare > 0 && (
          <PayRow label="+ ค่าบริการส่วนผู้ซื้อ" amount={bd.buyerServiceShare} />
        )}
      </div>

      {!bd.isMarketplace && (
        <div className="space-y-1 rounded-lg border border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-950/40 px-2.5 py-2">
          <p className="font-semibold text-slate-700 dark:text-slate-200">ค่าบริการระบบ (ไม่รวมขนส่ง)</p>
          <PayRow label="ค่าบริการ (รวม)" amount={bd.serviceFeeTotal} />
          {bd.serviceFeeLines.map(line => (
            <div key={line.label} className="flex justify-between gap-3 pl-3 text-gray-500">
              <span>↳ {line.label}</span>
              <span className="font-mono tabular-nums">฿{line.amount.toLocaleString()}</span>
            </div>
          ))}
          <p className="text-gray-600 dark:text-gray-300 pt-0.5">
            ผู้จ่ายค่าบริการ: <span className="font-semibold">{bd.feePayerLabel}</span>
          </p>
          <div className="flex justify-between gap-3 text-gray-500">
            <span>↳ ส่วนผู้ซื้อ</span>
            <span className="font-mono tabular-nums">฿{bd.buyerServiceShare.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-3 text-gray-500">
            <span>↳ ส่วนผู้ขาย (โอนแยก)</span>
            <span className="font-mono tabular-nums">฿{bd.sellerServiceShare.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/80 dark:bg-emerald-950/20 dark:border-emerald-900 px-3 py-3">
        <p className="font-bold text-sm text-emerald-800 dark:text-emerald-200">ยอดที่ต้องโอน / ตรวจสลิป</p>
        <PayRow label="ผู้ซื้อ → ศูนย์กลาง" amount={bd.buyerTotalDue} total />
        {!bd.isMarketplace && bd.sellerServiceDue > 0 && (
          <PayRow label="ผู้ขาย → ค่าบริการ (แยกสลิป)" amount={bd.sellerServiceDue} bold />
        )}
        {!bd.isMarketplace && (
          <p className="text-[11px] text-emerald-700/90 dark:text-emerald-300/90 leading-relaxed pl-0.5">
            = สินค้า ฿{bd.productPrice.toLocaleString()}
            {bd.shippingCost > 0 ? ` + ขนส่ง ฿${bd.shippingCost.toLocaleString()}` : ''}
            {bd.buyerServiceShare > 0 ? ` + ค่าบริการฝั่งผู้ซื้อ ฿${bd.buyerServiceShare.toLocaleString()}` : ''}
          </p>
        )}
        {!bd.isMarketplace && (
          <div className="mt-2 pt-2 border-t border-emerald-200/80 dark:border-emerald-800/60">
            <PayRow label="ผู้ขายได้รับสุทธิเมื่อสำเร็จ" amount={bd.sellerNetOnSuccess} total />
            {bd.shippingCost > 0 && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 pl-0.5">
                = สินค้า ฿{bd.productPrice.toLocaleString()} + ขนส่ง ฿{bd.shippingCost.toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** แถบย่อด้านบน — แสดงยอดผู้ซื้อโอนที่ถูกต้อง (ไม่ใช่แค่ราคาสินค้า) */
export function AdminDealPaymentBadge({
  deal,
  priceState,
  fees,
}: {
  deal: AdminDealPaymentDeal;
  priceState?: PriceStateInput;
  fees: FeeConfig;
}) {
  const bd = adminPaymentBreakdown(deal, priceState, fees);
  if (!bd) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-sm">
      <span className="font-mono text-gray-500">สินค้า ฿{bd.productPrice.toLocaleString()}</span>
      {bd.shippingCost > 0 && (
        <span className="font-mono text-gray-500">+ ขนส่ง ฿{bd.shippingCost.toLocaleString()}</span>
      )}
      <span className="font-mono font-bold text-green-600">ผู้ซื้อโอน ฿{bd.buyerTotalDue.toLocaleString()}</span>
    </span>
  );
}
