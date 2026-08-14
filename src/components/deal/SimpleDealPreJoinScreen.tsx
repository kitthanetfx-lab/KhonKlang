'use client';

import { DealProductGallery } from '@/components/deal/DealProductGallery';
import { SimpleDealJoinPanel, simpleDealParticipants } from '@/components/deal/SimpleDealJoinPanel';

type DealSlice = {
  title: string;
  description?: string;
  price: number;
  shipping_cost?: number | null;
  images?: string[];
  warranty_years?: number | null;
  warranty_months?: number | null;
  warranty_days?: number | null;
  fee_payer?: string | null;
  seller_id?: string | null;
  buyer_id?: string | null;
  seller_name?: string;
  buyer_name?: string;
};

type GuestProps = {
  mode: 'guest';
  notLoggedIn: boolean;
  canBeBuyer: boolean;
  canBeSeller: boolean;
  onJoin: (role: 'buyer' | 'seller') => void;
};

type WaitProps = {
  mode: 'wait';
  copied: boolean;
  onCopyLink: () => void;
};

type Props = {
  deal: DealSlice;
} & (GuestProps | WaitProps);

function feePayerLabel(fp?: string | null) {
  if (fp === 'buyer') return 'ผู้ซื้อ';
  if (fp === 'seller') return 'ผู้ขาย';
  if (fp === 'split') return 'หารครึ่ง';
  return '';
}

/** หน้ารอ join ดีลแบบง่าย — จบในหน้าเดียว ไม่ต้องเลื่อน */
export function SimpleDealPreJoinScreen({ deal, ...panelProps }: Props) {
  const waitingFor = !deal.buyer_id ? 'ผู้ซื้อ' : 'ผู้ขาย';
  const participants = simpleDealParticipants(deal);
  const fpLabel = feePayerLabel(deal.fee_payer);
  const showDesc = deal.description && deal.description.trim() !== deal.title.trim();
  const shipCost = Math.max(0, Math.round(Number(deal.shipping_cost) || 0));
  const totalPrice = deal.price + shipCost;

  return (
    <div className="dr-inner simple-deal-prejoin">
      <div className="dr-card simple-deal-prejoin-card">
        <div className="simple-deal-prejoin-head">
          <div className="simple-deal-prejoin-head-text">
            <div className="simple-deal-prejoin-title">{deal.title}</div>
            {showDesc ? <p className="simple-deal-prejoin-desc">{deal.description}</p> : null}
          </div>
          <div className="simple-deal-prejoin-price">
            ฿{totalPrice.toLocaleString()}
            {shipCost > 0 && (
              <span className="simple-deal-prejoin-shipping">รวมขนส่ง</span>
            )}
          </div>
        </div>

        <DealProductGallery
          compact
          images={deal.images}
          warrantyYears={deal.warranty_years}
          warrantyMonths={deal.warranty_months}
          warrantyDays={deal.warranty_days}
        />

        {fpLabel ? (
          <div className="simple-deal-prejoin-fee">
            💸 ผู้จ่ายค่าบริการ: <strong>{fpLabel}</strong>
          </div>
        ) : null}

        <div className="simple-deal-prejoin-divider" aria-hidden />

        {panelProps.mode === 'guest' ? (
          <SimpleDealJoinPanel
            compact
            mode="guest"
            waitingFor={waitingFor}
            participants={participants}
            notLoggedIn={panelProps.notLoggedIn}
            canBeBuyer={panelProps.canBeBuyer}
            canBeSeller={panelProps.canBeSeller}
            onJoin={panelProps.onJoin}
          />
        ) : (
          <SimpleDealJoinPanel
            compact
            mode="wait"
            waitingFor={waitingFor}
            participants={participants}
            copied={panelProps.copied}
            onCopyLink={panelProps.onCopyLink}
          />
        )}
      </div>
    </div>
  );
}
