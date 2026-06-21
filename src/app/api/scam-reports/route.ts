import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser, verifyAdmin } from '@/lib/supabaseServer';

/** normalize เป็น blob ค้นหา: ตัวพิมพ์เล็ก + เลขล้วนของบัญชี/เบอร์ (ตัดขีด/เว้นวรรค) */
function buildSearchBlob(parts: string[]) {
  const text = parts.filter(Boolean).join(' ').toLowerCase();
  const digits = parts.filter(Boolean).map((p) => p.replace(/\D/g, '')).filter((d) => d.length >= 6).join(' ');
  return (text + ' ' + digits).slice(0, 2500);
}

export async function GET(req: NextRequest) {
  try {
    const db = getAdminClient();
    const q = (req.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
    if (!q || q.length < 3) return NextResponse.json({ error: 'กรุณาพิมพ์คำค้นอย่างน้อย 3 ตัวอักษร' }, { status: 400 });

    const qDigits = q.replace(/\D/g, '');
    const { data } = await db
      .from('scam_reports')
      .select('*')
      .neq('status', 'rejected')
      .order('created_at', { ascending: false })
      .limit(1000);

    const hits = (data || []).filter((d) => {
      const blob = (d.search_blob || '') as string;
      return blob.includes(q) || (qDigits.length >= 6 && blob.includes(qDigits));
    }).slice(0, 30);

    // ส่งเฉพาะ field ที่ควรเปิดเผย — ไม่ส่งข้อมูลติดต่อกลับของผู้รายงาน
    const results = hits.map((d) => ({
      id: d.id, firstName: d.first_name, lastName: d.last_name,
      bankAccounts: d.bank_accounts, product: d.product, amount: d.amount,
      transferDate: d.transfer_date, sellerPage: d.seller_page, province: d.province,
      detail: String(d.detail || '').slice(0, 600),
      chatImageIds: d.chat_image_ids, slipImageIds: d.slip_image_ids,
      sourceName: d.source_name, status: d.status, createdAt: d.created_at,
    }));
    return NextResponse.json({ results, total: results.length });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();
    const body = await req.json();

    // ── โหมด import (แอดมินเท่านั้น): rows = [{firstName,lastName,acct,bank,phone,detail,sourceName}] ──
    if (Array.isArray(body.rows)) {
      await verifyAdmin(req);
      let ok = 0;
      for (const row of body.rows.slice(0, 200)) {
        const firstName = String(row.firstName || '').trim().slice(0, 120);
        if (!firstName) continue;
        const lastName = String(row.lastName || '').trim().slice(0, 120);
        const acct = String(row.acct || '').trim().slice(0, 30);
        const bank = String(row.bank || '').trim().slice(0, 80);
        const phone = String(row.phone || '').trim().slice(0, 30);
        const { error } = await db.from('scam_reports').insert({
          reporter_id: me.id,
          first_name: firstName, last_name: lastName,
          bank_accounts: acct ? [{ acct, bank }] : [],
          search_blob: buildSearchBlob([firstName, lastName, acct, phone, String(row.detail || '')]),
          detail: String(row.detail || '').slice(0, 5000) || 'นำเข้าจากแหล่งภายนอก ไม่มีรายละเอียดเพิ่มเติม',
          source_name: String(row.sourceName || body.sourceName || 'นำเข้าจากแหล่งภายนอก').slice(0, 150),
          status: 'approved',
        });
        if (!error) ok += 1;
      }
      return NextResponse.json({ ok: true, imported: ok });
    }

    // ── รายงานปกติจากฟอร์ม ──
    const firstName = String(body.firstName || '').trim().slice(0, 120);
    const lastName = String(body.lastName || '').trim().slice(0, 120);
    if (!firstName) return NextResponse.json({ error: 'กรุณากรอกชื่อคนขาย' }, { status: 400 });
    const accounts: { acct: string; bank: string }[] = (Array.isArray(body.bankAccounts) ? body.bankAccounts : [])
      .map((a: { acct?: string; bank?: string }) => ({ acct: String(a.acct || '').replace(/[^\d-]/g, '').slice(0, 30), bank: String(a.bank || '').slice(0, 80) }))
      .filter((a: { acct: string }) => a.acct.replace(/\D/g, '').length >= 6)
      .slice(0, 10);
    if (accounts.length === 0) return NextResponse.json({ error: 'กรุณากรอกบัญชีธนาคารอย่างน้อย 1 บัญชี (หากไม่รู้ให้กรอก 0000000)' }, { status: 400 });
    const detail = String(body.detail || '').trim().slice(0, 5000);
    if (detail.length < 30) return NextResponse.json({ error: 'กรุณาบรรยายรายละเอียดอย่างน้อย 30 ตัวอักษร' }, { status: 400 });
    const slipImageIds: string[] = (Array.isArray(body.slipImageIds) ? body.slipImageIds : []).slice(0, 5);
    if (slipImageIds.length === 0) return NextResponse.json({ error: 'กรุณาแนบสลิปโอนเงินอย่างน้อย 1 รูป' }, { status: 400 });
    const chatImageIds: string[] = (Array.isArray(body.chatImageIds) ? body.chatImageIds : []).slice(0, 20);

    const { data: doc, error } = await db.from('scam_reports').insert({
      reporter_id: me.id,
      first_name: firstName, last_name: lastName,
      id_card: String(body.idCard || '').replace(/\D/g, '').slice(0, 13),
      bank_accounts: accounts,
      search_blob: buildSearchBlob([
        firstName, lastName,
        ...accounts.map((a) => a.acct),
        String(body.sellerPage || ''), String(body.contactPhoneOfSeller || ''), detail.slice(0, 500),
      ]),
      product: String(body.product || '').slice(0, 200),
      amount: Math.max(0, Math.round(Number(body.amount) || 0)),
      transfer_date: String(body.transferDate || '').slice(0, 30),
      seller_page: String(body.sellerPage || '').slice(0, 300),
      province: String(body.province || '').slice(0, 100),
      detail,
      chat_image_ids: chatImageIds,
      police_doc_ids: (Array.isArray(body.policeDocIds) ? body.policeDocIds : []).slice(0, 5),
      slip_image_ids: slipImageIds,
      contact_email: String(body.contactEmail || '').slice(0, 200),
      contact_phone: String(body.contactPhone || '').slice(0, 30),
      contact_line: String(body.contactLine || '').slice(0, 100),
      status: 'pending_review',
    }).select('id').single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ report: { id: doc.id } });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message || String(err) }, { status: e.status || 500 });
  }
}

/** แอดมินอนุมัติ/ปฏิเสธรายงาน */
export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const { id, action } = await req.json();
    if (!id || !['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    const { data: updated, error } = await db.from('scam_reports').update({
      status: action === 'approve' ? 'approved' : 'rejected',
    }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ report: updated });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message || String(err) }, { status: e.status || 500 });
  }
}
