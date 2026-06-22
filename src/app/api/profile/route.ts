import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const admin = getAdminClient();

    let wallet = null;
    let ledger: Array<Record<string, unknown>> = [];
    const { data: profile } = await admin.from('profiles').select('middleman_status').eq('id', me.id).single();
    if (profile?.middleman_status === 'approved') {
      const { data: w } = await admin.from('middleman_wallets').select('*').eq('middleman_id', me.id).maybeSingle();
      wallet = w || null;
      const { data: entries } = await admin
        .from('finance_ledger')
        .select('*')
        .eq('owner_id', me.id)
        .order('updated_at', { ascending: false })
        .limit(8);
      ledger = entries || [];
    }

    return NextResponse.json({ userId: me.id, wallet, ledger });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const { firstName, lastName, phone, address, bankName, bankAcct, bankOwner, bankQrFileId } = await req.json();
    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อ-นามสกุล' }, { status: 400 });
    }
    if (!phone?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกเบอร์โทรศัพท์' }, { status: 400 });
    }
    // บัญชีธนาคารเป็นข้อมูลบังคับ — ใช้รับเงินจากระบบ escrow จึงต้องมีก่อนใช้งานเว็บไซต์ได้
    if (!bankName?.trim() || !bankAcct?.trim() || !bankOwner?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลบัญชีธนาคารให้ครบ (ธนาคาร, เลขที่บัญชี, ชื่อบัญชี)' }, { status: 400 });
    }

    const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const update: Record<string, string> = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.trim(),
      address: address || '',
      display_name: displayName,
      bank_name: String(bankName).trim().slice(0, 100),
      bank_acct: String(bankAcct).trim().slice(0, 50),
      bank_owner: String(bankOwner).trim().slice(0, 100),
      ...(bankQrFileId !== undefined ? { bank_qr_file_id: String(bankQrFileId).slice(0, 255) } : {}),
    };

    const admin = getAdminClient();
    const { error } = await admin.from('profiles').update(update).eq('id', me.id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Profile PATCH error:', msg);
    return NextResponse.json({ error: msg }, { status });
  }
}
