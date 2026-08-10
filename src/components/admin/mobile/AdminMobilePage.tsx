'use client';

import type { ReactNode } from 'react';

/**
 * ห่อเนื้อหา admin บนมือถือ — ปรับ table/grid เป็น card stack ผ่าน CSS
 * ใช้ใน admin/layout หรือแต่ละหน้า
 */
export function AdminMobilePage({ children }: { children: ReactNode }) {
  return <div className="admin-mobile-page">{children}</div>;
}

export default AdminMobilePage;
