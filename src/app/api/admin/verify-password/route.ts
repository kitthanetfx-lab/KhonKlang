import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, HttpError } from '@/lib/supabaseServer';
import {
  ADMIN_TRUST_COOKIE,
  createAdminTrustToken,
  verifyAdminTrustToken,
  setAdminTrustCookie,
  clearAdminTrustCookie,
} from '@/lib/adminTrustedDevice';

/**
 * ชั้นความปลอดภัยที่ 2 สำหรับหน้าแอดมิน
 * - POST: ตรวจรหัส ADMIN_PANEL_PASSWORD แล้วออก cookie จำเครื่อง (ผูก userId + deviceId) 30 วัน
 * - GET:  เช็คว่า cookie จำเครื่องยังใช้ได้กับบัญชี/อุปกรณ์นี้หรือไม่
 * - DELETE: ล้าง cookie จำเครื่อง (ตอนออกจากระบบ)
 */

function cleanDeviceId(raw: unknown): string {
  return String(raw || '').trim().slice(0, 128);
}

export async function GET(req: NextRequest) {
  try {
    const adminId = await verifyAdmin(req);
    const deviceId = cleanDeviceId(req.nextUrl.searchParams.get('deviceId'));
    if (!deviceId) return NextResponse.json({ trusted: false });
    const token = req.cookies.get(ADMIN_TRUST_COOKIE)?.value;
    const trusted = verifyAdminTrustToken(token, adminId, deviceId);
    return NextResponse.json({ trusted });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err), trusted: false }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminId = await verifyAdmin(req);
    const body = await req.json().catch(() => ({}));
    const password = body?.password;
    const deviceId = cleanDeviceId(body?.deviceId);
    const expected = (process.env.ADMIN_PANEL_PASSWORD || '').trim();

    if (!expected) {
      return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า ADMIN_PANEL_PASSWORD บนเซิร์ฟเวอร์' }, { status: 500 });
    }
    if (typeof password !== 'string' || password.trim() !== expected) {
      return NextResponse.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true, remembered: !!deviceId });
    if (deviceId) {
      const token = createAdminTrustToken(adminId, deviceId);
      if (token) setAdminTrustCookie(res, token);
    }
    return res;
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await verifyAdmin(req).catch(() => null);
    const res = NextResponse.json({ ok: true });
    clearAdminTrustCookie(res);
    return res;
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    const res = NextResponse.json({ error: String(err) }, { status });
    clearAdminTrustCookie(res);
    return res;
  }
}
