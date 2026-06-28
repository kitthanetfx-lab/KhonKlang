'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';
import { useProfileGate } from './AuthGate';
import { useAppPreferences } from './AppPreferences';

/** ปุ่มลอย "กลับหน้าหลัก" — แสดงทุกหน้า (ยกเว้นหน้าแรกเองและหลังบ้าน /admin)
 *  และถูกซ่อนระหว่างที่ผู้ใช้ยังต้องกรอกข้อมูลโปรไฟล์บังคับไม่ครบ (ไม่ให้มีทางหนีออกจากหน้า /profile) */
export function HomeButton() {
  const { locale } = useAppPreferences();
  const pathname = usePathname();
  const { profileComplete } = useProfileGate();
  if (!profileComplete) return null;
  if (!pathname || pathname === '/' || pathname.startsWith('/admin')) return null;

  return (
    <Link href="/" className="home-fab" aria-label={locale === 'th' ? 'กลับหน้าหลัก' : 'Back to home'} title={locale === 'th' ? 'กลับหน้าหลัก' : 'Back to home'}>
      <Icon name="home" size={24} />
    </Link>
  );
}

export default HomeButton;
