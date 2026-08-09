export type ServiceControlKey =
  | 'tradeOnline'
  | 'tradeSimple'
  | 'meetupGuarantee'
  | 'meetupSafeZone'
  | 'consign'
  | 'onsite'
  | 'marketplace'
  | 'sellerRegistration'
  | 'middlemanRegistration'
  | 'siteMaintenance'
  | 'slipAutoVerify';

export type ServiceControlEntry = {
  enabled: boolean;
  note: string;
  /** วันเวลาเปิดให้บริการอีกครั้ง — ใช้กับ siteMaintenance */
  reopenAt?: string;
  /** มูลค่าดีลสูงกว่านี้ → บังคับแมนนวล — ใช้กับ slipAutoVerify */
  amountThreshold?: number | null;
};

export type ServiceControlMap = Record<ServiceControlKey, ServiceControlEntry>;

/** siteMaintenance.enabled = true → ปิดปรับปรุงทั้งเว็บ */
export const SITE_MAINTENANCE_DEFAULT_NOTE =
  'เว็บไซต์ปิดปรับปรุงชั่วคราว — กรุณากลับมาทำรายการต่อหลังเปิดให้บริการ';

export const SERVICE_CONTROL_DEFAULTS: ServiceControlMap = {
  tradeOnline: { enabled: true, note: '' },
  tradeSimple: { enabled: true, note: '' },
  meetupGuarantee: { enabled: true, note: '' },
  meetupSafeZone: { enabled: true, note: '' },
  consign: { enabled: true, note: '' },
  onsite: { enabled: true, note: '' },
  marketplace: { enabled: true, note: '' },
  sellerRegistration: { enabled: true, note: '' },
  middlemanRegistration: { enabled: true, note: '' },
  siteMaintenance: { enabled: false, note: SITE_MAINTENANCE_DEFAULT_NOTE, reopenAt: '' },
  slipAutoVerify: { enabled: true, note: '', amountThreshold: null },
};

export const SERVICE_CONTROL_CATALOG: Array<{
  key: ServiceControlKey;
  title: string;
  description: string;
  group: string;
}> = [
  {
    key: 'tradeOnline',
    title: 'ซื้อขายผ่านกลาง (ออนไลน์)',
    description: 'เปิด/ปิดการสร้างดีลซื้อขายผ่านกลางแบบปกติ (หน้า /deal/create)',
    group: 'ซื้อขายผ่านกลาง',
  },
  {
    key: 'tradeSimple',
    title: 'ซื้อขายผ่านกลางแบบง่าย',
    description: 'เปิด/ปิด flow ส่งตรงถึงผู้ซื้อที่ใช้วิดีโอเป็นหลักฐานแทนการตรวจหน้างาน',
    group: 'ซื้อขายผ่านกลาง',
  },
  {
    key: 'meetupGuarantee',
    title: 'นัดรับรับประกันการเดินทาง',
    description: 'เปิด/ปิดบริการนัดรับที่ให้ทั้งสองฝ่ายวางเงินประกันการเดินทาง',
    group: 'นัดรับผ่านกลาง',
  },
  {
    key: 'meetupSafeZone',
    title: 'นัดรับ Safe Zone',
    description: 'เปิด/ปิดบริการนัดรับในจุดปลอดภัยที่มีคนกลางดูแลสถานที่นัดพบ',
    group: 'นัดรับผ่านกลาง',
  },
  {
    key: 'marketplace',
    title: 'โซนตลาด (ประกาศซื้อขาย)',
    description: 'เปิด/ปิดการลงประกาศขาย/ประมูลจากหน้าร้านผู้ขาย — แยกจากบริการซื้อขายผ่านกลาง',
    group: 'บริการเสริม',
  },
  {
    key: 'consign',
    title: 'ฝากขายผ่านกลาง',
    description: 'เปิด/ปิดหน้าฝากขายและ flow ที่เกี่ยวข้องกับการให้คนกลางช่วยขายแทน',
    group: 'บริการเสริม',
  },
  {
    key: 'onsite',
    title: 'บริการนัดออนไซต์',
    description: 'เปิด/ปิดการสร้างคำขอให้ผู้เชี่ยวชาญหรือคนกลางออกไปตรวจถึงสถานที่จริง',
    group: 'บริการเสริม',
  },
  {
    key: 'sellerRegistration',
    title: 'สมัครเป็นผู้ขาย',
    description: 'เปิด/ปิดการยื่นสมัครผู้ขายใหม่จากหน้า public',
    group: 'การสมัครสมาชิก',
  },
  {
    key: 'middlemanRegistration',
    title: 'สมัครเป็นคนกลาง',
    description: 'เปิด/ปิดการยื่นสมัครคนกลางใหม่จากหน้า public',
    group: 'การสมัครสมาชิก',
  },
];

export const SERVICE_CONTROL_GROUPS = Array.from(new Set(SERVICE_CONTROL_CATALOG.map(item => item.group)));

export function getServiceControlMessage(entry: ServiceControlEntry | undefined, fallback?: string) {
  const note = String(entry?.note || '').trim();
  return note || fallback || 'บริการนี้ถูกปิดชั่วคราว กรุณาติดตามประกาศจากทีมงานอีกครั้ง';
}

export function isServiceEnabled(controls: ServiceControlMap | null | undefined, key: ServiceControlKey) {
  if (key === 'siteMaintenance') return !Boolean((controls || SERVICE_CONTROL_DEFAULTS).siteMaintenance?.enabled);
  return Boolean((controls || SERVICE_CONTROL_DEFAULTS)[key]?.enabled);
}

/** เว็บปิดปรับปรุงอยู่หรือไม่ */
export function isSiteInMaintenance(controls: ServiceControlMap | null | undefined): boolean {
  return Boolean((controls || SERVICE_CONTROL_DEFAULTS).siteMaintenance?.enabled);
}

export function getSiteMaintenanceInfo(controls: ServiceControlMap | null | undefined) {
  const entry = (controls || SERVICE_CONTROL_DEFAULTS).siteMaintenance;
  return {
    active: Boolean(entry?.enabled),
    message: String(entry?.note || SITE_MAINTENANCE_DEFAULT_NOTE).trim() || SITE_MAINTENANCE_DEFAULT_NOTE,
    reopenAt: String(entry?.reopenAt || '').trim(),
  };
}

/** slipAutoVerify.enabled = true → โหมดอัตโนมัติ; deal.price เกิน amountThreshold → แมนนวล */
export function shouldAutoVerifySlip(
  controls: ServiceControlMap | null | undefined,
  dealPrice: number,
): boolean {
  const entry = (controls || SERVICE_CONTROL_DEFAULTS).slipAutoVerify;
  if (!entry?.enabled) return false;
  const threshold = entry.amountThreshold;
  if (threshold != null && threshold > 0 && dealPrice > threshold) return false;
  return true;
}

export function getSlipAutoVerifyInfo(controls: ServiceControlMap | null | undefined) {
  const entry = (controls || SERVICE_CONTROL_DEFAULTS).slipAutoVerify;
  return {
    autoMode: Boolean(entry?.enabled),
    manualAbovePrice: entry?.amountThreshold != null && entry.amountThreshold > 0 ? entry.amountThreshold : null,
  };
}

export function sanitizeServiceControls(input: unknown): ServiceControlMap {
  const raw = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  const next = { ...SERVICE_CONTROL_DEFAULTS } as ServiceControlMap;
  for (const key of Object.keys(SERVICE_CONTROL_DEFAULTS) as ServiceControlKey[]) {
    const current = (raw[key] && typeof raw[key] === 'object') ? raw[key] as Record<string, unknown> : {};
    const entry: ServiceControlEntry = {
      enabled: key === 'siteMaintenance' ? current.enabled === true : current.enabled !== false,
      note: String(current.note ?? (key === 'siteMaintenance' ? SITE_MAINTENANCE_DEFAULT_NOTE : '')).slice(0, 500),
    };
    if (key === 'siteMaintenance') {
      entry.reopenAt = String(current.reopenAt ?? '').slice(0, 40);
    }
    if (key === 'slipAutoVerify') {
      const rawThreshold = current.amountThreshold ?? current.amount_threshold;
      const n = Number(rawThreshold);
      entry.amountThreshold = Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
    }
    next[key] = entry;
  }
  return next;
}
