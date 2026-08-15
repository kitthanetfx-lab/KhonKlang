export interface NavItem {
  icon: string;
  tint: string;
  t: string;
  d: string;
  href: string;
}

export function getNavRegister(locale: 'th' | 'en'): NavItem[] {
  if (locale === 'en') {
    return [
      { icon: 'users', tint: '', t: 'Become a Seller', d: 'Open your store and sell with escrow-backed trust', href: '/register/seller' },
      { icon: 'handCoins', tint: 'green', t: 'Become a Middleman', d: 'Take escrow jobs and earn from your reputation', href: '/register/middleman' },
    ];
  }
  return [
    { icon: 'users', tint: '', t: 'สมัครเป็นผู้ขาย', d: 'เปิดร้าน ขายของอย่างมั่นใจ มีเครดิตการันตี', href: '/register/seller' },
    { icon: 'handCoins', tint: 'green', t: 'สมัครเป็นคนกลาง', d: 'รับงานคนกลาง สร้างรายได้จากความน่าเชื่อถือ', href: '/register/middleman' },
  ];
}

export function getNavServices(locale: 'th' | 'en'): NavItem[] {
  if (locale === 'en') {
    return [
      { icon: 'shieldCheck', tint: '', t: 'Escrow Trade', d: 'Hold funds safely in the system until both sides are protected', href: '/service/trade' },
      { icon: 'mapPin', tint: 'green', t: 'Meetup Escrow', d: 'Meet at a safe point with a middleman supervising', href: '/service/meetup' },
      { icon: 'store', tint: 'violet', t: 'Consign with Escrow', d: 'Consign items for middleman-assisted sales', href: '/service/consign' },
      { icon: 'car', tint: 'amber', t: 'On-site Service', d: 'Experts inspect items at your location', href: '/service/onsite' },
    ];
  }
  return [
    { icon: 'shieldCheck', tint: '', t: 'ซื้อขายผ่านกลาง', d: 'พักเงินไว้กับระบบ ปลอดภัยทั้งสองฝ่าย', href: '/service/trade' },
    { icon: 'mapPin', tint: 'green', t: 'นัดรับผ่านกลาง', d: 'นัดเจอในจุดปลอดภัย มีคนกลางดูแล', href: '/service/meetup' },
    { icon: 'store', tint: 'violet', t: 'ฝากขายผ่านกลาง', d: 'ฝากของให้คนกลางช่วยขายให้', href: '/service/consign' },
    { icon: 'car', tint: 'amber', t: 'บริการนัดออนไซต์', d: 'ช่างผู้เชี่ยวชาญตรวจสอบถึงที่', href: '/service/onsite' },
  ];
}

export function getNavMarket(locale: 'th' | 'en'): NavItem[] {
  if (locale === 'en') {
    return [
      { icon: 'store', tint: 'violet', t: 'Buy & Sell', d: 'Browse marketplace listings', href: '/marketplace' },
      { icon: 'scale', tint: 'amber', t: 'Auctions', d: 'Bid on auction items', href: '/marketplace?zone=auction' },
    ];
  }
  return [
    { icon: 'store', tint: 'violet', t: 'ขายสินค้า', d: 'ดูสินค้าในตลาด', href: '/marketplace' },
      { icon: 'scale', tint: 'amber', t: 'ประมูล', d: 'ประมูลสินค้า', href: '/marketplace?zone=auction' },
  ];
}

export function getNavScam(locale: 'th' | 'en'): NavItem[] {
  if (locale === 'en') {
    return [
      { icon: 'search', tint: '', t: 'Scam Check', d: 'Search scam records', href: '/check-scam' },
      { icon: 'bell', tint: 'amber', t: 'Report Scammer', d: 'Report a scammer to protect others', href: '/check-scam?tab=report' },
    ];
  }
  return [
    { icon: 'search', tint: '', t: 'เช็คคนโกง', d: 'ค้นหาข้อมูลคนโกง', href: '/check-scam' },
      { icon: 'bell', tint: 'amber', t: 'รายงานคนโกง', d: 'แจ้งรายงานคนโกง', href: '/check-scam?tab=report' },
  ];
}

export function getProfileItems(locale: 'th' | 'en'): NavItem[] {
  if (locale === 'en') {
    return [
      { icon: 'user', tint: '', t: 'Profile', d: 'View and edit your account details', href: '/profile' },
      { icon: 'wallet', tint: 'green', t: 'Wallet', d: 'Top up, pay auction deposits, and withdraw', href: '/wallet' },
      { icon: 'clock', tint: 'amber', t: 'My Deals / History', d: 'All transactions and message history', href: '/orders' },
      { icon: 'store', tint: '', t: 'My Shop', d: 'Manage your shop and listings', href: '/dashboard/seller' },
      { icon: 'handCoins', tint: 'green', t: 'Middleman Board', d: 'See deals currently under your care', href: '/dashboard/middleman' },
    ];
  }
  return [
    { icon: 'user', tint: '', t: 'เข้าสู่โปรไฟล์', d: 'ดูและแก้ไขข้อมูลบัญชี', href: '/profile' },
    { icon: 'wallet', tint: 'green', t: 'กระเป๋าเงิน', d: 'เติมเงิน มัดจำประมูล และถอนออก', href: '/wallet' },
    { icon: 'clock', tint: 'amber', t: 'ดีลของฉัน / ประวัติ', d: 'ประวัติซื้อขายทุกบทบาท + กล่องข้อความ', href: '/orders' },
    { icon: 'store', tint: '', t: 'ร้านของฉัน', d: 'ตั้งค่าร้านและลงขายสินค้า', href: '/dashboard/seller' },
    { icon: 'handCoins', tint: 'green', t: 'บอร์ดคนกลาง', d: 'ดูดีลที่กำลังดูแลอยู่', href: '/dashboard/middleman' },
  ];
}

export type MainNavKey = 'register' | 'service' | 'market' | 'scam';

export function getMainNavMenus(locale: 'th' | 'en') {
  const th = locale === 'th';
  return [
    {
      key: 'register' as MainNavKey,
      label: th ? 'สมัคร' : 'Join',
      icon: 'users',
      tone: 'orange',
      hrefPrefix: '/register',
      items: getNavRegister(locale),
    },
    {
      key: 'service' as MainNavKey,
      label: th ? 'บริการ' : 'Services',
      icon: 'shieldCheck',
      tone: 'cyan',
      hrefPrefix: '/service',
      items: getNavServices(locale),
    },
    {
      key: 'market' as MainNavKey,
      label: th ? 'ตลาด' : 'Market',
      icon: 'store',
      tone: 'purple',
      hrefPrefix: '/marketplace',
      items: getNavMarket(locale),
    },
    {
      key: 'scam' as MainNavKey,
      label: th ? 'เช็คคนโกง' : 'Scam',
      icon: 'search',
      tone: 'rose',
      hrefPrefix: '/check-scam',
      items: getNavScam(locale),
    },
  ];
}
