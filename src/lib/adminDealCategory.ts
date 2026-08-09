/** หมวดดีลในแอดมิน — แยกจากประกาศขายที่ยังไม่เริ่มซื้อขาย */

export type AdminDealCategory = 'trade' | 'market' | 'meetup' | 'consign' | 'onsite';

export const ADMIN_DEAL_CATEGORIES: { k: AdminDealCategory; label: string; desc: string }[] = [
  { k: 'trade', label: 'ดีลซื้อขาย', desc: 'ดีลที่ผู้ซื้อ/ผู้ขายสร้างส่งให้กัน หรือซื้อขายผ่านคนกลาง' },
  { k: 'market', label: 'ตลาดและประมูล', desc: 'สินค้าจากตลาดที่มีผู้เริ่มซื้อขายแล้ว' },
  { k: 'meetup', label: 'ประกันเดินทาง/มัดจำ', desc: 'ดีลรับประกันการเดินทางและมัดจำสินค้า' },
  { k: 'consign', label: 'ฝากขาย', desc: 'ฝากขายผ่านคนกลาง (เตรียมไว้ — ยังไม่มีรายการ)' },
  { k: 'onsite', label: 'ออนไซต์', desc: 'งานนัดตรวจสอบถึงที่' },
];

/** สถานะที่ถือว่าเป็นแค่ประกาศ — ยังไม่เข้าแอดมินดีล */
export const LISTING_ONLY_STATUSES = ['posted', 'waiting_seller', 'waiting_buyer'] as const;

export type DealCategoryInput = {
  source?: string | null;
  status: string;
  deal_type?: string | null;
};

export function isBareListing(deal: DealCategoryInput): boolean {
  return deal.source === 'listing' && (LISTING_ONLY_STATUSES as readonly string[]).includes(deal.status);
}

export function getDealCategory(deal: DealCategoryInput): AdminDealCategory | null {
  if (isBareListing(deal)) return null;
  if (deal.deal_type === 'meetup') return 'meetup';
  if (deal.source === 'listing') return 'market';
  return 'trade';
}

export function dealMatchesCategory(deal: DealCategoryInput, category: AdminDealCategory): boolean {
  if (category === 'consign' || category === 'onsite') return false;
  if (isBareListing(deal)) return false;
  return getDealCategory(deal) === category;
}

export function parseAdminDealCategory(raw: string | null | undefined): AdminDealCategory {
  if (raw === 'market' || raw === 'meetup' || raw === 'consign' || raw === 'onsite') return raw;
  return 'trade';
}

/** แมปแท็บสถานะ → งานออนไซต์ */
export type AdminStatusTab =
  | 'active'
  | 'confirm_pay'
  | 'pay_seller'
  | 'refund_pending'
  | 'middleman_fee'
  | 'meetup_refund'
  | 'disputed'
  | 'completed';

export function getAdminCategoryLabel(category: AdminDealCategory | null): string {
  if (!category) return 'ดีลซื้อขาย';
  return ADMIN_DEAL_CATEGORIES.find(c => c.k === category)?.label || 'ดีลซื้อขาย';
}

/** ลิงก์หน้าแอดมินดีล — ตรงหมวด + แท็บสถานะ */
export function adminDealsPagePath(category: AdminDealCategory | null, tab: AdminStatusTab): string {
  const cat = category || 'trade';
  return `/admin/deals?category=${cat}&tab=${tab}`;
}

export type OnsiteJobRow = {
  status: string;
  report_notes?: string | null;
  middleman_deposit?: string | number | null;
};

export function onsiteMatchesTab(job: OnsiteJobRow, tab: AdminStatusTab): boolean {
  const notes = String(job.report_notes || '');
  const refunded = notes.includes('คืนมัดจำแล้ว');
  switch (tab) {
    case 'active':
      return !['completed', 'cancelled'].includes(job.status);
    case 'confirm_pay':
      return job.status === 'quoted' || job.status === 'accepted';
    case 'pay_seller':
      return job.status === 'in_progress';
    case 'refund_pending':
      return job.status === 'cancelled' && !refunded;
    case 'middleman_fee':
      return job.status === 'completed' && !!job.middleman_deposit && !notes.includes('โอนค่าบริการแล้ว');
    case 'meetup_refund':
      return (job.status === 'cancelled' || job.status === 'completed') && !refunded && Number(job.middleman_deposit || 0) > 0;
    case 'disputed':
      return notes.includes('[ข้อพิพาท]');
    case 'completed':
      return job.status === 'completed';
    default:
      return false;
  }
}
