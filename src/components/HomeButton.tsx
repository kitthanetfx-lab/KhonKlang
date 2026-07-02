'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';
import { useAppPreferences } from './AppPreferences';

/** ปุ่มลอย "กลับหน้าหลัก" — แสดงทุกหน้า (ยกเว้นหน้าแรกเองและหลังบ้าน /admin) */
export function HomeButton() {
  const { locale } = useAppPreferences();
  const pathname = usePathname();
  if (!pathname || pathname === '/' || pathname.startsWith('/admin')) return null;

  return (
    <Link href="/" className="home-fab" aria-label={locale === 'th' ? 'กลับหน้าหลัก' : 'Back to home'} title={locale === 'th' ? 'กลับหน้าหลัก' : 'Back to home'}>
      <Icon name="home" size={24} />
    </Link>
  );
}

export default HomeButton;
