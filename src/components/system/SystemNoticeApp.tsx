'use client';

import Link from 'next/link';
import { AppPage, AppFeed } from '@/components/mobile';

type Props = {
  message: string;
  reopenLabel?: string;
};

export function MaintenanceApp({ message, reopenLabel }: Props) {
  return (
    <AppPage withBottomNav={false}>
      <AppFeed>
        <div className="sys-app-card">
          <div className="sys-app-ic">🛠️</div>
          <span className="badge badge-amber">ปิดปรับปรุงชั่วคราว</span>
          <h1>เว็บไซต์ปิดให้บริการชั่วคราว</h1>
          <p>{message}</p>
          {reopenLabel && <p className="sys-app-reopen">คาดว่าจะเปิดอีกครั้ง: {reopenLabel}</p>}
          <Link href="/" className="btn btn-primary btn-block">ลองใหม่อีกครั้ง</Link>
        </div>
      </AppFeed>
    </AppPage>
  );
}

export function StatusApp({
  status,
  onLogout,
  onToggleDev,
}: {
  status: 'pending' | 'approved';
  onLogout: () => void;
  onToggleDev: (s: 'pending' | 'approved') => void;
}) {
  return (
    <AppPage withBottomNav={false}>
      <AppFeed>
        <div className="sys-app-dev">
          <button type="button" className={status === 'pending' ? 'is-on' : ''} onClick={() => onToggleDev('pending')}>Pending</button>
          <button type="button" className={status === 'approved' ? 'is-on' : ''} onClick={() => onToggleDev('approved')}>Approved</button>
        </div>
        <div className="sys-app-card">
          {status === 'pending' ? (
            <>
              <div className="sys-app-ic">⏳</div>
              <h1>กำลังตรวจสอบข้อมูล</h1>
              <p>แอดมินกำลังตรวจสอบหลักฐานการสมัครของคุณ กรุณารอประมาณ 24–48 ชั่วโมง</p>
            </>
          ) : (
            <>
              <div className="sys-app-ic">✅</div>
              <h1>อนุมัติแล้ว!</h1>
              <p>บัญชีของคุณพร้อมใช้งานแล้ว</p>
              <Link href="/profile" className="btn btn-primary btn-block">ไปที่โปรไฟล์</Link>
            </>
          )}
          <button type="button" className="btn btn-ghost btn-block" onClick={onLogout}>ออกจากระบบ</button>
        </div>
      </AppFeed>
    </AppPage>
  );
}
