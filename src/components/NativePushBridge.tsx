'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isGlanghubApp } from '@/lib/nativeAuth';
import {
  initNativePushRegistration,
  setPushNavigateHandler,
  unregisterPushToken,
} from '@/lib/nativePush';

/** เปิดใช้ push notification ในแอปมือถือ — ลงทะเบียน token + นำทางเมื่อกดแจ้งเตือน */
export function NativePushBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isGlanghubApp()) return;
    setPushNavigateHandler((path) => router.push(path));
    return () => setPushNavigateHandler(() => {});
  }, [router]);

  useEffect(() => {
    if (!isGlanghubApp()) return;

    let active = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active || !data.session) return;
      await initNativePushRegistration();
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT') {
        await unregisterPushToken();
        return;
      }
      if (session) await initNativePushRegistration();
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return null;
}
