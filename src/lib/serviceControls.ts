export type ServiceControlKey =
  | 'tradeOnline'
  | 'tradeSimple'
  | 'meetupGuarantee'
  | 'meetupSafeZone'
  | 'consign'
  | 'onsite'
  | 'marketplace'
  | 'sellerRegistration'
  | 'middlemanRegistration';

export type ServiceControlEntry = {
  enabled: boolean;
  note: string;
};

export type ServiceControlMap = Record<ServiceControlKey, ServiceControlEntry>;

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
    description: 'เปิด/ปิดการสร้างดีลซื้อขายผ่านกลางแบบปกติและการลงประกาศที่ผูกกับบริการนี้',
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
    description: 'เปิด/ปิดหน้าตลาดประกาศซื้อขายสินค้า — ถ้าปิด ผู้ใช้จะเห็นข้อความแทนที่หน้ารายการสินค้า',
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
  return Boolean((controls || SERVICE_CONTROL_DEFAULTS)[key]?.enabled);
}

export function sanitizeServiceControls(input: unknown): ServiceControlMap {
  const raw = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  const next = { ...SERVICE_CONTROL_DEFAULTS } as ServiceControlMap;
  for (const key of Object.keys(SERVICE_CONTROL_DEFAULTS) as ServiceControlKey[]) {
    const current = (raw[key] && typeof raw[key] === 'object') ? raw[key] as Record<string, unknown> : {};
    next[key] = {
      enabled: current.enabled !== false,
      note: String(current.note ?? '').slice(0, 180),
    };
  }
  return next;
}
