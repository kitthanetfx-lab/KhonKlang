import { NextRequest, NextResponse } from 'next/server';
import { verifyUser, getAdminClient, HttpError } from '@/lib/supabaseServer';
import { getUserWallet, ensureUserWallet } from '../_lib/userWallet';
import { WALLET_LEDGER_LABEL } from '@/lib/userWallet';

export async function GET(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();
    const { data: profile } = await db
      .from('profiles')
      .select('display_name, bank_name, bank_acct, bank_owner')
      .eq('id', me.id)
      .maybeSingle();

    await ensureUserWallet(db, me.id, profile?.display_name || me.email || '');
    const [wallet, topupsRes, withdrawalsRes, ledgerRes] = await Promise.all([
      getUserWallet(db, me.id, profile?.display_name || ''),
      db.from('wallet_topups').select('*').eq('user_id', me.id).order('created_at', { ascending: false }).limit(30),
      db.from('wallet_withdrawals').select('*').eq('user_id', me.id).order('created_at', { ascending: false }).limit(30),
      db.from('wallet_ledger').select('*').eq('user_id', me.id).order('created_at', { ascending: false }).limit(50),
    ]);

    const ledger = (ledgerRes.data || []).map(row => ({
      ...row,
      label: WALLET_LEDGER_LABEL[row.type] || row.type,
    }));

    return NextResponse.json({
      wallet,
      topups: topupsRes.data || [],
      withdrawals: withdrawalsRes.data || [],
      ledger,
      bank: {
        bankName: profile?.bank_name || '',
        bankAcct: profile?.bank_acct || '',
        bankOwner: profile?.bank_owner || '',
      },
    });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status });
  }
}
