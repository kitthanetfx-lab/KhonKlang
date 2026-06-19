'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';

/** ปุ่มลอย "กลับหน้าหลัก" — แสดงทุกหน้า (ยกเว้นหน้าแรกเองและหลังบ้าน /admin) */
export function HomeButton() {
  const pathname = usePathname();
  if (!pathname || pathname === '/' || pathname.startsWith('/admin')) return null;

  return (
    <Link href="/" className="home-fab" aria-label="กลับหน้าหลัก" title="กลับหน้าหลัก">
      <Icon name="home" size={22} />
    </Link>
  );
}

export default HomeButton;
