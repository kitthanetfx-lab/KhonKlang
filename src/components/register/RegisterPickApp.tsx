'use client';

import Link from 'next/link';
import Image from 'next/image';
import { AppPage } from '@/components/mobile/AppPage';
import { AppHeader } from '@/components/mobile/AppHeader';
import { AppFeed } from '@/components/mobile/AppStates';
import type { useServiceControls } from '@/lib/useServiceControls';

type Props = {
  controls: ReturnType<typeof useServiceControls>;
};

/** หน้าเลือกประเภทสมัคร — progressive disclosure · action ชัด */
export function RegisterPickApp({ controls }: Props) {
  return (
    <AppPage withBottomNav={false}>
      <AppHeader title="เลือกประเภทการสมัคร" backHref="/" />
      <AppFeed>
        <div className="reg-pick-app">
        <div className="reg-pick-app-brand">
          <Image src="/logo.png" alt="กลางฮับ" width={72} height={72} priority />
          <p>คุณต้องการเข้าร่วมแพลตฟอร์มในฐานะอะไร?</p>
        </div>

        <div className={`reg-pick-app-card${!controls.isEnabled('sellerRegistration') ? ' is-muted' : ''}`}>
          <div className="reg-pick-app-head">
            <span className="reg-pick-app-icon" style={{ background: '#eef4ff' }}>🛒</span>
            <div>
              <strong>สมัครเป็นผู้ขาย</strong>
              <span>ลงขายในตลาด + คุ้มครอง Escrow</span>
            </div>
          </div>
          <ul className="reg-pick-app-feats">
            <li>ลงประกาศได้ไม่จำกัด</li>
            <li>Dashboard จัดการดีล</li>
          </ul>
          <div className="reg-pick-app-cta">
            <span>ค่าสมาชิก ฿199/ปี</span>
            {controls.isEnabled('sellerRegistration')
              ? <Link href="/register/seller">สมัครเลย →</Link>
              : <span className="reg-pick-app-off">{controls.message('sellerRegistration')}</span>}
          </div>
        </div>

        <div className={`reg-pick-app-card${!controls.isEnabled('middlemanRegistration') ? ' is-muted' : ''}`}>
          <div className="reg-pick-app-head">
            <span className="reg-pick-app-icon" style={{ background: '#e9faf2' }}>🤝</span>
            <div>
              <strong>สมัครเป็นคนกลาง</strong>
              <span>ดูแลธุรกรรม สร้างรายได้</span>
            </div>
          </div>
          <ul className="reg-pick-app-feats">
            <li>4 ระดับ Bronze–Platinum</li>
            <li>รับงานได้ทุกที่</li>
          </ul>
          <div className="reg-pick-app-cta">
            <span>เงินประกัน ฿1,000–50,000</span>
            {controls.isEnabled('middlemanRegistration')
              ? <Link href="/register/middleman">สมัครเลย →</Link>
              : <span className="reg-pick-app-off">{controls.message('middlemanRegistration')}</span>}
          </div>
        </div>

        <p className="reg-pick-app-foot">
          มีบัญชีแล้ว? <Link href="/login">เข้าสู่ระบบ</Link>
        </p>
        </div>
      </AppFeed>
    </AppPage>
  );
}

export default RegisterPickApp;
