type JsonRecord = Record<string, unknown>;

export interface DealPriceState {
  proposedPrice?: number;
  proposedFeePayer?: 'buyer' | 'seller' | 'split';
  proposedBy?: 'seller' | 'buyer' | 'middleman';
  proposalKind?: 'current' | 'reprice';
  agreed?: boolean;
  sellerAgreed?: boolean;
  buyerAgreed?: boolean;
  middlemanAgreed?: boolean;
  mmDepositHeld?: number;
  feePayer?: 'buyer' | 'seller' | 'split';
  evidenceDoneSeller?: boolean;
  evidenceDoneBuyer?: boolean;
  evidenceDoneMiddleman?: boolean;
  sellerFeeSlip?: string;
  // บัญชี/สถานะการโอนเงิน "ออก" จากศูนย์กลาง — จ่ายคืนผู้ขายเมื่อจบดีล / คืนเงินผู้ซื้อเมื่อยกเลิก
  payoutSentAt?: string;
  payoutNote?: string;
  refundSentAt?: string;
  refundNote?: string;
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRecord(value?: string): JsonRecord {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return isJsonRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function asStringUnion<T extends string>(value: unknown, allowed: readonly T[]) {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : undefined;
}

function normalizeDealPriceState(value: JsonRecord): DealPriceState {
  return {
    proposedPrice: asNumber(value.proposedPrice),
    proposedFeePayer: asStringUnion(value.proposedFeePayer, ['buyer', 'seller', 'split'] as const),
    proposedBy: asStringUnion(value.proposedBy, ['seller', 'buyer', 'middleman'] as const),
    proposalKind: asStringUnion(value.proposalKind, ['current', 'reprice'] as const),
    agreed: asBoolean(value.agreed),
    sellerAgreed: asBoolean(value.sellerAgreed),
    buyerAgreed: asBoolean(value.buyerAgreed),
    middlemanAgreed: asBoolean(value.middlemanAgreed),
    mmDepositHeld: asNumber(value.mmDepositHeld),
    feePayer: asStringUnion(value.feePayer, ['buyer', 'seller', 'split'] as const),
    evidenceDoneSeller: asBoolean(value.evidenceDoneSeller),
    evidenceDoneBuyer: asBoolean(value.evidenceDoneBuyer),
    evidenceDoneMiddleman: asBoolean(value.evidenceDoneMiddleman),
    sellerFeeSlip: typeof value.sellerFeeSlip === 'string' ? value.sellerFeeSlip : undefined,
    payoutSentAt: typeof value.payoutSentAt === 'string' ? value.payoutSentAt : undefined,
    payoutNote: typeof value.payoutNote === 'string' ? value.payoutNote : undefined,
    refundSentAt: typeof value.refundSentAt === 'string' ? value.refundSentAt : undefined,
    refundNote: typeof value.refundNote === 'string' ? value.refundNote : undefined,
  };
}

export function readDealPriceState(input: { priceData?: string; meetupData?: string }): DealPriceState {
  const direct = parseRecord(input.priceData);
  if (Object.keys(direct).length > 0) return normalizeDealPriceState(direct);

  const fallback = parseRecord(input.meetupData);
  return isJsonRecord(fallback.priceState) ? normalizeDealPriceState(fallback.priceState) : {};
}

export function writeDealPriceState(priceState: DealPriceState, meetupData?: string) {
  const fallback = parseRecord(meetupData);
  if (Object.keys(priceState).length > 0) fallback.priceState = priceState;
  else delete fallback.priceState;

  return {
    priceData: JSON.stringify(priceState),
    meetupDataFallback: Object.keys(fallback).length > 0 ? JSON.stringify(fallback) : '',
  };
}
