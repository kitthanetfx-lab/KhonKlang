import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser } from '@/lib/supabaseServer';

/**
 * Sync โปรไฟล์ข้ามช่องทาง login — ผู้ใช้อีเมลเดียวกัน (LINE/Google/Facebook
 * สร้างคนละ auth user ใน Supabase) คือสมาชิกคนเดียวกัน โปรไฟล์ที่กรอกไว้
 * ต้องเหมือนกันทุกบัญชี วิธี: หาทุก profile ที่อีเมลตรงกัน → เลือกตัวที่
 * อัปเดตล่าสุด/กรอกครบสุด → ทาทับให้ทุกบัญชี (รวม linked_to ของตัวเอง)
 */

const SYNC_COLUMNS = [
  'first_name', 'last_name', 'display_name', 'phone', 'address',
  'bank_name', 'bank_acct', 'bank_owner', 'bank_qr_file_id',
  'role', 'seller_status', 'middleman_status',
] as const;

type Row = Record<string, string | null> & { id: string; updated_at?: string };

function filledCount(row: Row) {
  return SYNC_COLUMNS.filter(k => (row[k] || '').toString().trim()).length;
}

export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    if (!me.email) return NextResponse.json({ synced: false, reason: 'no-email' });

    const admin = getAdminClient();
    const { data: accounts } = await admin
      .from('profiles')
      .select(['id', 'updated_at', ...SYNC_COLUMNS].join(', '))
      .eq('email', me.email)
      .limit(10);

    const rows = (accounts || []) as unknown as Row[];
    if (rows.length < 2) return NextResponse.json({ synced: false, reason: 'single-account' });

    const best = [...rows].sort((a, b) => {
      const ta = a.updated_at || '', tb = b.updated_at || '';
      if (ta !== tb) return tb.localeCompare(ta);
      return filledCount(b) - filledCount(a);
    })[0];

    const subset: Partial<Row> = {};
    for (const k of SYNC_COLUMNS) if (best[k]) subset[k] = best[k];
    if (Object.keys(subset).length === 0) return NextResponse.json({ synced: false, reason: 'empty-profile' });

    let updatedMe = false;
    await Promise.all(rows.map(async row => {
      const differs = SYNC_COLUMNS.some(k => (subset[k] || '') !== (row[k] || '') && subset[k]);
      if (!differs) return;
      await admin.from('profiles').update(subset).eq('id', row.id);
      if (row.id === me.id) updatedMe = true;
    }));

    return NextResponse.json({ synced: true, updated: updatedMe, accounts: rows.length });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
