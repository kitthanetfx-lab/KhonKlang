'use client';

import { supabase } from '@/lib/supabase';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { InAppBanner } from '@/components/InAppBanner';
import { detectInApp } from '@/lib/inApp';
import { isGlanghubApp, nativeGoogleIdToken, isUserCancelled } from '@/lib/nativeAuth';

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const msg = searchParams.get('msg');

  const errorMessages: Record<string, string> = {
    line_cancelled: 'ยกเลิกการเข้าสู่ระบบด้วย LINE',
    line_failed: `LINE login ล้มเหลว${msg ? ': ' + decodeURIComponent(msg) : ''}`,
    oauth_failed: `เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่${msg ? ' (' + decodeURIComponent(msg) + ')' : ''}`,
  };

  const returnTo = searchParams.get('returnTo') || '/';

  const handleLogin = async (provider: 'google') => {
    const safeReturn = returnTo.startsWith('/') ? returnTo : '/';
    // แอปมือถือกลางฮับ: Google ห้าม OAuth ใน WebView → ใช้ Native Google Sign-In (จบในแอป)
    if (isGlanghubApp()) {
      try {
        const idToken = await nativeGoogleIdToken();
        const { error: idErr } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
        if (idErr) throw idErr;
        window.location.assign(`/auth/oauth/complete?returnTo=${encodeURIComponent(safeReturn)}`);
      } catch (e) {
        if (!isUserCancelled(e)) {
          console.error('Native Google login error:', e);
          alert('เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่ หรือเข้าสู่ระบบด้วย LINE แทน');
        }
      }
      return;
    }
    // Google ปฏิเสธ OAuth ในเบราว์เซอร์ภายในแอป (LINE/Messenger) — แนะนำ LINE login หรือเปิดเบราว์เซอร์หลัก
    if (detectInApp()) {
      alert('Google ไม่อนุญาตให้ล็อกอินผ่านเบราว์เซอร์ใน LINE/Messenger\n\nแนะนำ: เข้าสู่ระบบด้วย LINE (ใช้ได้เลย) หรือกด "เปิดในเบราว์เซอร์" จากแถบด้านบน');
      return;
    }
    try {
      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/oauth/complete?returnTo=${encodeURIComponent(safeReturn)}`,
        },
      });
    } catch (e) {
      console.error('Error logging in:', e);
    }
  };

  return (
    <>
    <InAppBanner />
    <main className="login-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="login-card">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Link href="/" className="login-back">← กลับหน้าหลัก</Link>
        </div>

        {error && (
          <div style={{ position: 'relative', zIndex: 1, marginBottom: 16, padding: '10px 16px', background: '#fdeef1', border: '1px solid #fbd5dd', borderRadius: 'var(--r-md)', color: '#b22441', fontSize: 14 }}>
            ⚠️ {errorMessages[error] || error}
          </div>
        )}

        <div className="login-logo-wrap">
          <div className="login-logo-mark">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.5l7.5 2.8v5.2c0 4.7-3.2 8.1-7.5 9.5-4.3-1.4-7.5-4.8-7.5-9.5V5.3L12 2.5z" />
              <path d="M8.6 12l2.2 2.2 4.6-4.8" />
            </svg>
          </div>
        </div>

        <h1 className="login-title">กลางฮับ</h1>
        <p className="login-sub">ซื้อขายปลอดภัย ผ่านคนกลางที่เชื่อถือได้<br />ทุกดีลมีคนดูแล ทุกเงินมีระบบคุ้มครอง</p>

        <div className="login-btns">
          <a href={`/api/auth/line?returnTo=${encodeURIComponent(returnTo)}`} className="btn btn-line btn-block" data-skip-global-loading style={{ fontSize: 15, padding: '14px 24px', textDecoration: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white" style={{ flexShrink: 0 }}>
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
            </svg>
            เข้าสู่ระบบด้วย LINE
          </a>

          <div className="login-divider">หรือ</div>

          <button onClick={() => handleLogin('google')} className="btn btn-google btn-block" style={{ fontSize: 15, padding: '14px 24px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            เข้าสู่ระบบด้วย Google
          </button>
        </div>

        <div className="login-trust">
          <div className="login-trust-item">🔒 ปลอดภัย</div>
          <div className="login-trust-item">✅ ผ่านการรับรอง</div>
          <div className="login-trust-item">🛡️ ระบบ Escrow</div>
        </div>

        <div className="login-footer">
          โดยการเข้าสู่ระบบ คุณยอมรับ <Link href="/privacy">นโยบายความเป็นส่วนตัว</Link>
          <br />และ <a href="/terms">เงื่อนไขการให้บริการ</a> ของเรา
        </div>
      </div>
    </main>
    </>
  );
}

export default function Login() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
