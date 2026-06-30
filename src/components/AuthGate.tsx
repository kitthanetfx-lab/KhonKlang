'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isProfileComplete, REQUIRED_PROFILE_FIELDS } from '@/lib/profileComplete';

/**
 * บังคับให้ต้องล็อกอินก่อนเข้าใช้งานเว็บไซต์ทุกหน้า (ยกเว้นหน้าที่อยู่ใน allowlist
 * ด้านล่าง เช่น หน้าล็อกอินเอง และหน้า bridge ของ OAuth ที่ยังไม่มี session ระหว่างขั้นตอน)
 *
 * นอกจากนี้ยังบังคับให้กรอกข้อมูลโปรไฟล์ที่จำเป็น (ชื่อ-นามสกุล-เบอร์โทร-บัญชีธนาคาร)
 * ให้ครบก่อนเข้าใช้งานหน้าอื่น ๆ ของเว็บไซต์ — ถ้ายังไม่ครบจะถูกบังคับไปหน้า /profile
 * เสมอไม่ว่าจะพยายามไปหน้าไหนก็ตาม (กดย้อนกลับ/พิมพ์ URL เองก็ไม่สามารถหลุดออกไปได้)
 *
 * หมายเหตุสถาปัตยกรรม: โปรเจกต์นี้ใช้ @supabase/supabase-js (ไม่ใช่ @supabase/ssr)
 * และเก็บ session ไว้ใน localStorage ของ browser เท่านั้น ไม่มี cookie ที่ middleware.ts
 * (ฝั่ง server) จะอ่านได้ ฉะนั้นการบังคับล็อกอิน/กรอกโปรไฟล์ต้องทำฝั่ง client แบบนี้
 */

const PUBLIC_PATHS = [
  '/login',
  '/auth/oauth/complete',
  '/auth/line/complete',
  '/privacy',
  '/terms',
];

// หน้าที่ยังเข้าได้แม้โปรไฟล์ยังไม่ครบ (หน้ากรอกโปรไฟล์เอง + หน้าออกจากระบบที่อาจอยู่ใน flow เดิม)
const PROFILE_EXEMPT_PATHS = ['/profile'];

function isPublicPath(path: string) {
  return PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'));
}
function isProfileExemptPath(path: string) {
  return PROFILE_EXEMPT_PATHS.some(p => path === p || path.startsWith(p + '/'));
}

interface GateState {
  /** false = ยังกรอกข้อมูลบังคับไม่ครบ — หน้า /profile ต้องบังคับโหมดกรอกข้อมูลและซ่อนทางออกทั้งหมด */
  profileComplete: boolean;
}
const ProfileGateContext = createContext<GateState>({ profileComplete: true });
/** ให้ component ลูก (เช่น HomeButton) เช็คว่าควรซ่อนตัวเองหรือไม่ระหว่างบังคับกรอกโปรไฟล์ */
export function useProfileGate() {
  return useContext(ProfileGateContext);
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [profileComplete, setProfileComplete] = useState(true);

  useEffect(() => {
    let active = true;

    async function check() {
      if (isPublicPath(pathname)) {
        if (active) { setAuthed(true); setChecked(true); }
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) {
        router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      if (active) setAuthed(true);

      const { data: profile } = await supabase
        .from('profiles')
        .select(REQUIRED_PROFILE_FIELDS.join(','))
        .eq('id', data.session.user.id)
        .maybeSingle();
      if (!active) return;

      const complete = isProfileComplete(profile as Record<string, unknown> | null);
      setProfileComplete(complete);

      if (!complete && !isProfileExemptPath(pathname)) {
        router.replace('/profile');
        return;
      }
      setChecked(true);
    }

    check();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session && !isPublicPath(pathname)) {
        router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
      }
    });

    return () => { active = false; sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!checked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 14 }}>
        กำลังตรวจสอบสิทธิ์เข้าใช้งาน...
      </div>
    );
  }

  if (!authed) return null;

  return (
    <ProfileGateContext.Provider value={{ profileComplete }}>
      {children}
    </ProfileGateContext.Provider>
  );
}
