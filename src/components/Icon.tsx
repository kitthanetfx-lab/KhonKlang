'use client';
import React from 'react';

/* Custom geometric icon set (stroke, 24 viewBox) — ported from prototype */
export const ICON_PATHS: Record<string, React.ReactNode> = {
  shield: <path d="M12 3l7 2.6v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9v-5L12 3z"/>,
  shieldCheck: <><path d="M12 3l7 2.6v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9v-5L12 3z"/><path d="M8.8 11.8l2.2 2.2 4.2-4.4"/></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2.2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>,
  wallet: <><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H17a2 2 0 0 1 2 2v1"/><rect x="3" y="7.5" width="18" height="12.5" rx="2.4"/><circle cx="16.5" cy="13.7" r="1.3"/></>,
  banknote: <><rect x="3" y="6" width="18" height="12" rx="2.2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5h.01M17.5 14.5h.01"/></>,
  coins: <><circle cx="9" cy="9" r="5"/><path d="M14.6 5.2A5 5 0 1 1 15 18.8"/><path d="M7 9h2.2M9 7.1v3.8"/></>,
  package: <><path d="M21 8.3 12 3 3 8.3v7.4L12 21l9-5.3V8.3z"/><path d="M3 8.3 12 13l9-4.7M12 13v8"/></>,
  box: <><path d="M21 8.3 12 3 3 8.3v7.4L12 21l9-5.3V8.3z"/><path d="M3 8.3 12 13l9-4.7M12 13v8M7.5 5.6 16.5 11"/></>,
  truck: <><path d="M3 6.5h11v9H3z"/><path d="M14 9.5h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/></>,
  store: <><path d="M4 10v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8"/><path d="M3.5 10 5 5h14l1.5 5a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0z"/><path d="M9 19v-4.5h6V19"/></>,
  search: <><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  x: <path d="M6 6l12 12M18 6 6 18"/>,
  chevronDown: <path d="m6 9 6 6 6-6"/>,
  chevronRight: <path d="m9 6 6 6-6 6"/>,
  arrowRight: <path d="M4 12h15m-6-6 6 6-6 6"/>,
  arrowUpRight: <path d="M7 17 17 7M8 7h9v9"/>,
  star: <path d="M12 3.5l2.6 5.3 5.9.8-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8-4.3-4.1 5.9-.8z"/>,
  sparkles: <><path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z"/><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></>,
  users: <><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1M20.5 19a5.5 5.5 0 0 0-4-5.3"/></>,
  user: <><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></>,
  check: <path d="M5 12.5l4.5 4.5L19 7"/>,
  checkCircle: <><circle cx="12" cy="12" r="9"/><path d="M8.5 12.2l2.4 2.4 4.6-4.9"/></>,
  badgeCheck: <><path d="M12 2.5l2.3 1.7 2.8-.2 1 2.6 2.4 1.5-.7 2.8.7 2.8-2.4 1.5-1 2.6-2.8-.2L12 21.5l-2.3-1.7-2.8.2-1-2.6L3.5 15.3l.7-2.8-.7-2.8 2.4-1.5 1-2.6 2.8.2z"/><path d="M8.8 12l2.1 2.1 4.3-4.4"/></>,
  phone: <rect x="6" y="2.5" width="12" height="19" rx="2.6"/>,
  smartphone: <><rect x="6" y="2.5" width="12" height="19" rx="2.6"/><path d="M10.5 18.5h3"/></>,
  car: <><path d="M4 16v-3.2L6 8h12l2 4.8V16"/><path d="M3.5 16h17"/><path d="M5 16v1.6M19 16v1.6"/><circle cx="7.5" cy="16" r="1.6"/><circle cx="16.5" cy="16" r="1.6"/></>,
  gem: <><path d="M5 4h14l3 4.5-10 11.5L2 8.5z"/><path d="M2 8.5h20M8 4 5.5 8.5 12 20M16 4l2.5 4.5L12 20"/></>,
  gamepad: <><rect x="2.5" y="7.5" width="19" height="9" rx="4.5"/><path d="M7 11v2.4M5.8 12.2h2.4M15.6 11h.01M18 12.5h.01"/></>,
  sprout: <><path d="M12 21v-7"/><path d="M12 14c0-3 2-5 6-5 0 3-2 5-6 5z"/><path d="M12 14c0-2.6-1.7-4.4-5-4.4 0 2.7 1.7 4.4 5 4.4z"/></>,
  fish: <><path d="M4 12c3-4.5 9-5.5 14-3.5-1 2-1 5 0 7-5 2-11 1-14-3.5z"/><path d="M17.5 8.5 21 6v12l-3.5-2.5M8 12h.01"/></>,
  factory: <><path d="M3 20V9l5 3.5V9l5 3.5V9l5 3.5V20z"/><path d="M3 20h18M7.5 16h2M14.5 16h2"/></>,
  building: <><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10 21v-3h4v3"/></>,
  mapPin: <><path d="M12 21s7-5.6 7-11a7 7 0 0 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></>,
  zap: <path d="M13 3 5 13h6l-1 8 8-10h-6z"/>,
  clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></>,
  camera: <><path d="M4 8h3l1.5-2h7L17 8h3a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 4 8z"/><circle cx="12" cy="13" r="3.4"/></>,
  message: <path d="M4 5h16v11H9l-4 4v-4H4z"/>,
  chat: <><path d="M4 5h16v10H10l-4 3.5V15H4z"/><path d="M8 9h8M8 12h5"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  scale: <><path d="M12 4v16M7 20h10"/><path d="M12 6 5 8m7-2 7 2"/><path d="M5 8 2.8 13a2.5 2.5 0 0 0 4.4 0L5 8zM19 8l-2.2 5a2.5 2.5 0 0 0 4.4 0L19 8z"/></>,
  refresh: <><path d="M3.5 12a8.5 8.5 0 0 1 14.5-6"/><path d="M20.5 12A8.5 8.5 0 0 1 6 18"/><path d="M18 3v3.5h-3.5M6 21v-3.5h3.5"/></>,
  heart: <path d="M12 20S4 15 4 9.2A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 8 2.2C20 15 12 20 12 20z"/>,
  key: <><circle cx="8" cy="14" r="4"/><path d="m11 11 8-8M16 5l2 2M14 7l2 2"/></>,
  filter: <path d="M3 5h18l-7 8v6l-4-2v-4z"/>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1.4"/><rect x="13" y="4" width="7" height="7" rx="1.4"/><rect x="4" y="13" width="7" height="7" rx="1.4"/><rect x="13" y="13" width="7" height="7" rx="1.4"/></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 19a2 2 0 0 0 4 0"/></>,
  logout: <><path d="M14 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8"/><path d="M18 15l3-3-3-3M21 12h-9"/></>,
  upload: <><path d="M12 16V5m-4 4 4-4 4 4"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></>,
  fileCheck: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 15l2 2 4-4"/></>,
  handCoins: <><circle cx="14" cy="7" r="3.2"/><path d="M3 14l3-1 5 1.5a1.6 1.6 0 0 1-.5 3.1H7"/><path d="M11 16l5-1.2 4 1a1.6 1.6 0 0 1 .3 3L15 21l-4-1-4 1H3"/></>,
  trendingUp: <path d="M3 17l6-6 4 4 8-8m0 0h-5m5 0v5"/>,
  film: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  layoutDashboard: <><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></>,
  verified: <><circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.2l2.4 2.4 4.6-4.9"/></>,
  mic: <><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21M9 21h6"/></>,
  micOff: <><path d="M9 9V5a3 3 0 0 1 5.7-1.3M15 12.2V13a3 3 0 0 1-4.6 2.5"/><path d="M5.5 11a6.5 6.5 0 0 0 9.3 5.9"/><path d="M18.5 11a6.5 6.5 0 0 1-1 3.4"/><path d="M12 17.5V21M9 21h6M3 3l18 18"/></>,
  phoneOff: <><path d="M6 2.5h7"/><rect x="6" y="2.5" width="12" height="19" rx="2.6"/><path d="M3 3l18 18"/></>,
  /* ไอคอนหูฟัง customer-care สำหรับปุ่มลอยติดต่อทีมงาน */
  headset: <><path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="3" y="13" width="4.4" height="7.2" rx="2.1"/><rect x="16.6" y="13" width="4.4" height="7.2" rx="2.1"/><path d="M19 17.6v1.6a3 3 0 0 1-3 3h-1.6"/></>,
  /* หูโทรศัพท์แบบทึบ (filled) — ใช้กับปุ่มขอให้โทรกลับ ระบายสีเขียวผ่าน currentColor ของปุ่ม */
  phoneCall: <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.4 21 3 13.6 3 4.7c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8z" fill="currentColor" stroke="none"/>,
  /* รูปภาพ — ใช้กับปุ่มแนบรูป */
  image: <><rect x="3" y="4" width="18" height="16" rx="2.2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m3 16.5 5-5 3.5 3.5L17 9.5l4 4.5"/></>,
  /* บ้าน — ใช้กับปุ่มกลับหน้าหลัก */
  home: <><path d="M3.5 11.5 12 4l8.5 7.5"/><path d="M6 10v9.5a1 1 0 0 0 1 1h3.5v-5.5h3v5.5H17a1 1 0 0 0 1-1V10"/></>,
};

export interface IconProps {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, className = '', style, strokeWidth = 1.8 }: IconProps) {
  const p = ICON_PATHS[name];
  if (!p) return null;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      {p}
    </svg>
  );
}

export default Icon;
