import { dealCode } from '@/lib/dealNumber';
import type { FeeConfig, FeeLine } from '@/lib/fees';

export type LedgerDirection = 'incoming' | 'outgoing' | 'hold' | 'internal';
export type LedgerStatus =
  | 'expected'
  | 'pending_review'
  | 'confirmed'
  | 'scheduled'
  | 'paid'
  | 'held'
  | 'released'
  | 'forfeited'
  | 'refunded'
  | 'cancelled'
  | 'void';

export type LedgerEntryType =
  | 'buyer_payment'
  | 'seller_fee_payment'
  | 'seller_payout'
  | 'buyer_refund'
  | 'meetup_buyer_deposit'
  | 'meetup_seller_deposit'
  | 'meetup_buyer_fee'
  | 'meetup_seller_fee'
  | 'meetup_buyer_refund'
  | 'meetup_seller_refund'
  | 'platform_fee'
  | 'middleman_fee_gross'
  | 'platform_cut'
  | 'middleman_fee_net'
  | 'middleman_credit_hold'
  | 'seller_registration'
  | 'middleman_registration'
  | 'onsite_service_fee'
  | 'onsite_travel_fee'
  | 'middleman_deposit';

export type LedgerReferenceType = 'deal' | 'seller_application' | 'middleman_application' | 'onsite_job' | 'middleman_deposit';
export type LedgerOwnerType = 'platform' | 'buyer' | 'seller' | 'middleman' | 'system';

export interface LedgerFeeComponent {
  platformFee: number;
  middlemanGrossFee: number;
  platformCutFromMiddleman: number;
  middlemanNetFee: number;
  totalFee: number;
}

export interface MiddlemanWalletSnapshot {
  middlemanId: string;
  middlemanName: string;
  tier: string;
  creditLimit: number;
  availableCredit: number;
  heldCredit: number;
  releasedCredit: number;
  penaltyCredit: number;
  activeDealCount: number;
  updatedAt: string;
}

export function financeReferenceCode(referenceType: LedgerReferenceType, referenceId: string, dealId?: string) {
  if (referenceType === 'deal') return dealCode(dealId || referenceId);
  if (referenceType === 'seller_application') return `SELLER-${referenceId.slice(-8).toUpperCase()}`;
  if (referenceType === 'middleman_application') return `MM-${referenceId.slice(-8).toUpperCase()}`;
  if (referenceType === 'middleman_deposit') return `DEP-${referenceId.slice(-8).toUpperCase()}`;
  return `ONSITE-${referenceId.slice(-8).toUpperCase()}`;
}

export function getTierCreditLimit(config: FeeConfig, tier: string) {
  switch (String(tier || 'Bronze')) {
    case 'Silver':
      return Number(config.depositSilver) || 0;
    case 'Gold':
      return Number(config.depositGold) || 0;
    case 'Platinum':
      return Number(config.depositPlatinum) || 0;
    default:
      return Number(config.depositBronze) || 0;
  }
}

export function splitDealFeeComponents(config: FeeConfig, lines: FeeLine[]): LedgerFeeComponent {
  const middlemanGrossFee = lines
    .filter(line => line.label === 'ค่าบริการคนกลาง')
    .reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const totalFee = lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const platformBase = Math.max(totalFee - middlemanGrossFee, 0);
  const platformCutFromMiddleman = middlemanGrossFee > 0
    ? Math.round((middlemanGrossFee * (Number(config.platformCutPercent) || 0)) / 100)
    : 0;
  return {
    platformFee: platformBase + platformCutFromMiddleman,
    middlemanGrossFee,
    platformCutFromMiddleman,
    middlemanNetFee: Math.max(middlemanGrossFee - platformCutFromMiddleman, 0),
    totalFee,
  };
}

export function splitFeeByPayer(totalFee: number, feePayer: string) {
  const normalized = feePayer === 'buyer' || feePayer === 'seller' || feePayer === 'split' ? feePayer : 'split';
  const sellerShare = normalized === 'seller'
    ? totalFee
    : normalized === 'split'
      ? (totalFee - Math.round(totalFee / 2))
      : 0;
  return {
    buyerShare: Math.max(totalFee - sellerShare, 0),
    sellerShare: Math.max(sellerShare, 0),
    feePayer: normalized as 'buyer' | 'seller' | 'split',
  };
}
