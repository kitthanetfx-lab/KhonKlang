export type WalletLedgerType =
  | 'topup'
  | 'withdraw_hold'
  | 'withdraw_reject'
  | 'withdraw_paid'
  | 'auction_hold'
  | 'auction_release'
  | 'auction_forfeit'
  | 'auction_forfeit_credit';

export interface UserWalletSnapshot {
  userId: string;
  displayName: string;
  availableBalance: number;
  heldBalance: number;
  updatedAt: string;
}

export interface WalletApplyResult {
  available_balance: number;
  held_balance: number;
  idempotent?: boolean;
}

export const AUCTION_DEPOSIT_PRESETS = [100, 300, 500, 1000] as const;
export const WALLET_TOPUP_PRESETS = [100, 300, 500, 1000, 2000] as const;

export function baht(amount: number) {
  return `฿${Number(amount || 0).toLocaleString()}`;
}

export const WALLET_LEDGER_LABEL: Record<string, string> = {
  topup: 'เติมเงิน',
  withdraw_hold: 'ขอถอนเงิน',
  withdraw_reject: 'คืนเงินจากคำขอถอนที่ถูกปฏิเสธ',
  withdraw_paid: 'ถอนเงินสำเร็จ',
  auction_hold: 'ล็อกมัดจำประมูล',
  auction_release: 'คืนมัดจำประมูล',
  auction_forfeit: 'หักมัดจำประมูล (ไม่รับของ)',
  auction_forfeit_credit: 'รับค่าเสียเวลาจากประมูล',
};
