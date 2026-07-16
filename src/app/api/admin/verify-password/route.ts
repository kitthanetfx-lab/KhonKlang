import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, HttpError } from '@/lib/supabaseServer';

/**
 * ชั้นความปลอดภัยที่ 2 สำหรับหน้าแอดมิน — นอกเหนือจากต้องล็อกอินและมี role
 * เป็น admin แล้ว ยังต้องกรอกรหัสผ่านชุดนี้ (ตั้งค่าใน env: ADMIN_PANEL_PASSWORD
 * ไม่ใช่ NEXT_PUBLIC_ เพราะไม่ควรถูกฝังไปกับ JS bundle ฝั่ง client) ทุกครั้งที่
 * เข้าหน้า /admin ใหม่ (ไม่เก็บสถานะไว้ที่ไหน ต้องกรอกใหม่ทุกครั้งที่รีเฟรช/เข้าใหม่)
 *
 * เรียก verifyAdmin(req) ก่อนเสมอ — กันไม่ให้ endpoint นี้ถูกใช้ brute-force
 * รหัสผ่านจากคนที่ยังไม่ได้ล็อกอินเป็น admin ตั้งแต่แรก
 */
export async function POST(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const { password } = await req.json();
    // trim ทั้งสองฝั่ง — กันเคสวางค่าใน Vercel แล้วมีช่องว่าง/ขึ้นบรรทัดใหม่ติดท้ายมาโดยไม่รู้ตัว
    const expected = (process.env.ADMIN_PANEL_PASSWORD || '').trim();

    if (!expected) {
      // ยังไม่ได้ตั้งค่า env — ไม่บล็อกแอดมินออกจากระบบตัวเอง แต่แจ้งเตือนชัดเจน
      return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า ADMIN_PANEL_PASSWORD บนเซิร์ฟเวอร์' }, { status: 500 });
    }
    if (typeof password !== 'string' || password.trim() !== expected) {
      return NextResponse.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
