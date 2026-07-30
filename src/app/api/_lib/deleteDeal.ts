import type { SupabaseClient } from '@supabase/supabase-js';

/** ลบดีลถาวรพร้อมไฟล์ storage และ child tables — ใช้ร่วมกันระหว่างแอดมินกับ cron */
export async function deleteDealById(db: SupabaseClient, id: string) {
  const { data: deal, error: getErr } = await db.from('deals').select('*').eq('id', id).maybeSingle();
  if (getErr) throw new Error(getErr.message);
  if (!deal) return false;

  const [mu, ps, ev, im] = await Promise.all([
    db.from('deal_meetup').select('buyer_slip,seller_slip,buyer_refund_slip,seller_refund_slip').eq('deal_id', id).maybeSingle(),
    db.from('deal_price_state').select('seller_fee_slip,payout_slip_file_id,refund_slip_file_id,middleman_fee_slip_file_id').eq('deal_id', id).maybeSingle(),
    db.from('deal_evidence').select('file_id').eq('deal_id', id),
    db.from('deal_images').select('file_id').eq('deal_id', id),
  ]);
  const filePaths = [
    deal.payment_slip_file_id,
    mu.data?.buyer_slip, mu.data?.seller_slip, mu.data?.buyer_refund_slip, mu.data?.seller_refund_slip,
    ps.data?.seller_fee_slip, ps.data?.payout_slip_file_id, ps.data?.refund_slip_file_id, ps.data?.middleman_fee_slip_file_id,
    ...((ev.data || []).map(e => e.file_id)),
    ...((im.data || []).map(i => i.file_id)),
  ].filter((p): p is string => typeof p === 'string' && p.length > 0);
  if (filePaths.length) {
    await db.storage.from('deal-files').remove(filePaths);
  }
  await Promise.all([
    db.from('messages').delete().eq('deal_id', id),
    db.from('deal_evidence').delete().eq('deal_id', id),
    db.from('deal_price_state').delete().eq('deal_id', id),
    db.from('deal_meetup').delete().eq('deal_id', id),
    db.from('deal_images').delete().eq('deal_id', id),
    db.from('reviews').delete().eq('deal_id', id),
    db.from('finance_ledger').delete().eq('deal_id', id),
  ]);
  const { error: delErr } = await db.from('deals').delete().eq('id', id);
  if (delErr) throw new Error(`ลบดีลไม่สำเร็จ: ${delErr.message}`);
  return true;
}
