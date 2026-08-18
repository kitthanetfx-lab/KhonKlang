'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isProfileComplete, REQUIRED_PROFILE_FIELDS } from '@/lib/profileComplete';

/**
 * บังคับให้ต้องล็อกอินก่อนเข้าใช้งานเว็บไซต์ทุกหน้า (ยกเว้นหน้าที่อยู่ใน allowlist
 * ด้านล่าง เช่น หน้าล็อกอินเอง และหน้า bridge ของ OAuth ที่ยังไม่มี session ระหว่างขั้นตอน)
 *
 * โปรไฟล์ (ชื่อ-นามสกุล-เบอร์โทร-บัญชีธนาคาร) ไม่บังคับกรอกทันทีหลังสมัคร
 * แต่ถ้าพยายามเข้า "หน้าบริการ" ใดๆ (สร้างดีล, สมัครผู้ขาย/คนกลาง, dashboard ฯลฯ)
 * ก่อนกรอกโปรไฟล์ครบ จะถูก redirect ไป /profile?returnTo=<หน้าที่ตั้งใจไป>
 *
 * หมายเหตุ: สลับหน้าภายในแอปที่เคยผ่าน gate แล้วจะไม่รีเช็คทั้งก้อนใหม่
 * (กันหน้า admin/ดีล ถูกเด้งไปล็อกอินหรือโหลดซ้ำตอนคลิกเมนู)
 */

const PUBLIC_PATHS = [
  '/login',
  '/auth/oauth/complete',
  '/auth/line/complete',
  '/privacy',
  '/terms',
];

const PROFILE_REQUIRED_PATHS = [
  '/deal',
  '/register/seller',
  '/register/middleman',
  '/service',
  '/dashboard',
  '/onsite',
  '/orders',
  '/messages',
  '/payment',
  '/cart',
  '/wanted',
  '/admin',
];

function isPublicPath(path: string) {
  return PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'));
}
function isProfileRequiredPath(path: string) {
  return PROFILE_REQUIRED_PATHS.some(p => path === p || path.startsWith(p + '/'));
}

interface GateState {
  profileComplete: boolean;
}
const ProfileGateContext = createContext<GateState>({ profileComplete: true });
export function useProfileGate() {
  return useContext(ProfileGateContext);
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const isPublic = isPublicPath(pathname);
  // หน้า public (เช่น /login) ไม่ต้องรอ effect — กัน flash "กำลังตรวจสอบสิทธิ์..." ตอน logout
  const [checked, setChecked] = useState(isPublic);
  const [authed, setAuthed] = useState(isPublic);
  const [profileComplete, setProfileComplete] = useState(true);
  const checkedRef = useRef(isPublic);
  const authedRef = useRef(isPublic);
  const profileCompleteRef = useRef(true);

  useEffect(() => {
    let active = true;

    async function check() {
      if (isPublicPath(pathname)) {
        if (active) { setAuthed(true); setChecked(true); }
        return;
      }

      // เคยผ่าน gate แล้ว — สลับหน้าไม่ต้อง unload ลูกทั้งหมดใหม่
      if (authedRef.current && checkedRef.current) {
        if (
          !profileCompleteRef.current
          && isProfileRequiredPath(pathname)
          && !pathname.startsWith('/profile')
        ) {
          router.replace(`/profile?returnTo=${encodeURIComponent(pathname)}`);
        }
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) {
        router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      if (active) {
        setAuthed(true);
        authedRef.current = true;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select(REQUIRED_PROFILE_FIELDS.join(','))
        .eq('id', data.session.user.id)
        .maybeSingle();
      if (!active) return;

      const complete = isProfileComplete(profile as Record<string, unknown> | null);
      setProfileComplete(complete);
      profileCompleteRef.current = complete;

      if (!complete && isProfileRequiredPath(pathname)) {
        router.replace(`/profile?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      setChecked(true);
      checkedRef.current = true;
    }

    check();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session && !isPublicPath(pathname)) {
        authedRef.current = false;
        checkedRef.current = false;
        // ไม่ reset checked/authed ก่อน redirect — จะทำให้หน้ากระพริบ loading
        window.location.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
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
