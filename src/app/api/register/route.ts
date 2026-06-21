import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser } from '@/lib/supabaseServer';

// ─── GET: ตรวจสอบว่า user นี้มีโปรไฟล์ตรงกับคนในระบบหรือเปล่า (auto-link ข้ามช่องทาง login) ───
export async function GET(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const admin = getAdminClient();
    const { data: mine } = await admin.from('profiles').select('*').eq('id', me.id).single();
    if (!mine) return NextResponse.json({ matched: false });

    const userName = mine.display_name || '';
    const userEmail = mine.email || '';
    const isSyntheticEmail = !userEmail || userEmail.includes('@line.khonklang.app');

    let matched = null;
    if (!isSyntheticEmail) {
      const { data } = await admin.from('profiles').select('*').eq('email', userEmail).neq('id', me.id).limit(1);
      matched = data?.[0] || null;
    }
    if (!matched && userName) {
      const { data } = await admin.from('profiles').select('*').eq('display_name', userName).neq('id', me.id).limit(1);
      matched = data?.[0] || null;
    }
    if (!matched) return NextResponse.json({ matched: false });

    const update = {
      first_name: matched.first_name || '',
      last_name: matched.last_name || '',
      email: matched.email || userEmail,
      phone: matched.phone || '',
      address: matched.address || '',
      role: matched.role || 'user',
      display_name: matched.display_name || userName,
      linked_to: matched.id,
    };
    await admin.from('profiles').update(update).eq('id', me.id);

    return NextResponse.json({ matched: true, profile: update });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Register GET error:', msg);
    return NextResponse.json({ matched: false, error: msg });
  }
}

// ─── POST: บันทึกข้อมูลผู้ใช้ใหม่ ───
export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const { firstName, lastName, email, phone, address, role } = await req.json();
    if (!firstName || !lastName || !phone) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }

    const admin = getAdminClient();
    const displayName = `${firstName} ${lastName}`.trim();
    const update: Record<string, string> = {
      first_name: firstName,
      last_name: lastName,
      email: email || '',
      phone,
      address: address || '',
      role: role || 'user',
      display_name: displayName,
    };

    let linked = false;
    try {
      let existing = null;
      const byPhone = await admin.from('profiles').select('*').eq('phone', phone).neq('id', me.id).limit(1);
      existing = byPhone.data?.[0] || null;

      if (!existing && email && !email.includes('@line.khonklang.app')) {
        const byEmail = await admin.from('profiles').select('*').eq('email', email).neq('id', me.id).limit(1);
        existing = byEmail.data?.[0] || null;
      }
      if (!existing) {
        const byName = await admin.from('profiles').select('*').eq('display_name', displayName).neq('id', me.id).limit(1);
        existing = byName.data?.[0] || null;
      }

      if (existing) {
        update.first_name = existing.first_name || firstName;
        update.last_name = existing.last_name || lastName;
        update.email = existing.email || email || '';
        update.address = existing.address || address || '';
        update.role = existing.role || role || 'user';
        update.display_name = existing.display_name || displayName;
        (update as Record<string, unknown>).linked_to = existing.id;
        linked = true;
      }
    } catch (dbErr) {
      console.error('DB error (non-fatal):', dbErr);
    }

    const { error } = await admin.from('profiles').update(update).eq('id', me.id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, linked });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Register POST error:', msg);
    return NextResponse.json({ error: msg }, { status });
  }
}
