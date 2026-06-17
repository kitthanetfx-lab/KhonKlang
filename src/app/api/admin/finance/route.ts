import { NextRequest, NextResponse } from 'next/server';
import { Databases, Query, ID } from 'node-appwrite';
import { verifyAdmin, getAdminClient, DB_ID } from '../../admin/_lib';
import { notifyUsers } from '../../_lib/notify';
import { FEE_DEFAULTS, computeDealFees, FeeConfig } from '@/lib/fees';
import { verifySlipByUrl } from '@/lib/slipok';

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '';
const PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
const slipUrl = (bucket: string, fileId: string) => `${ENDPOINT}/storage/buckets/${bucket}/files/${fileId}/view?project=${PROJECT}`;

const COL_DEALS = 'deals';
const COL_MSGS = 'messages';
const COL_CFG = 'app_config';
const COL_SELLER = 'seller_applications';
const COL_MM = 'middleman_applications';

// สถานะที่ถือว่า "เงินพักอยู่กับศูนย์กลาง"
const HELD = ['payment_uploaded', 'packing', 'shipped_to_middleman', 'middleman_received', 'middleman_checking', 'shipped_to_buyer', 'delivered'];

async function readFees(db: Databases): Promise<FeeConfig> {
  try {
    const d = await db.getDocument(DB_ID, COL_CFG, 'fees') as unknown as { data?: string };
    return { ...FEE_DEFAULTS, ...JSON.parse(d.data || '{}') };
  } catch { return FEE_DEFAULTS; }
}

async function sysMsg(db: Databases, dealId: string, content: string) {
  await db.createDocument(DB_ID, COL_MSGS, ID.unique(), {
    dealId, senderId: 'system', senderName: 'ระบบ', role: 'system', type: 'system',
    content, fileId: '', fileName: '', createdAt: new Date().toISOString(),
  }).catch(() => {});
}

type Row = Record<string, unknown>;

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = new Databases(getAdminClient());
    const fees = await readFees(db);

    const [dealsRes, sellerRes, mmRes] = await Promise.all([
      db.listDocuments(DB_ID, COL_DEALS, [Query.orderDesc('createdAt'), Query.limit(200)]).catch(() => ({ documents: [] as Row[] })),
      db.listDocuments(DB_ID, COL_SELLER, [Query.equal('status', 'pending_review'), Query.limit(100)]).catch(() => ({ documents: [] as Row[] })),
      db.listDocuments(DB_ID, COL_MM, [Query.equal('status', 'pending_review'), Query.limit(100)]).catch(() => ({ documents: [] as Row[] })),
    ]);
    const deals = dealsRes.documents as Row[];

    const incoming: Row[] = [];

    // 1) ค่าสินค้า escrow — ผู้ซื้อโอน รอตรวจ
    for (const d of deals) {
      if (d.status === 'payment_uploaded') {
        incoming.push({
          key: 'escrow_' + d.$id, source: 'escrow', refId: String(d.$id), title: String(d.title || ''),
          payer: 'ผู้ซื้อ', payerName: String(d.buyerName || ''), purpose: 'ค่าสินค้า',
          expected: Number(d.price) || 0, fileId: String(d.paymentSlipFileId || ''), bucket: 'deal_files',
          status: String(d.status), dealType: String(d.dealType || ''),
          fees: computeDealFees(fees, Number(d.price) || 0, String(d.dealType || '')),
          canApprove: true,
        });
      }
    }

    // 2) เงินประกัน meetup — ผู้ซื้อ + ผู้ขาย
    for (const d of deals) {
      if (d.dealType === 'meetup' && !['completed', 'cancelled'].includes(String(d.status))) {
        let md: Record<string, unknown> = {};
        try { md = JSON.parse(String(d.meetupData || '{}')); } catch {}
        const dep = Number(md.deposit) || 0;
        if (md.buyerSlip) incoming.push({ key: 'mtb_' + d.$id, source: 'meetup', refId: String(d.$id), title: String(d.title || ''), payer: 'ผู้ซื้อ', payerName: String(d.buyerName || ''), purpose: 'เงินประกัน (นัดเจอ)', expected: dep, fileId: String(md.buyerSlip), bucket: 'deal_files', status: String(d.status) });
        if (md.sellerSlip) incoming.push({ key: 'mts_' + d.$id, source: 'meetup', refId: String(d.$id), title: String(d.title || ''), payer: 'ผู้ขาย', payerName: String(d.sellerName || ''), purpose: 'เงินประกัน (นัดเจอ)', expected: dep, fileId: String(md.sellerSlip), bucket: 'deal_files', status: String(d.status) });
      }
    }

    // 3) ค่าสมัคร ผู้ขาย / คนกลาง
    for (const a of sellerRes.documents as Row[]) {
      if (a.slipFileId) incoming.push({ key: 'sreg_' + a.$id, source: 'seller_app', refId: String(a.$id), title: String(a.fullNameId || 'สมัครผู้ขาย'), payer: 'ผู้สมัคร', payerName: String(a.fullNameId || ''), purpose: 'ค่าสมัครผู้ขาย', expected: Number(fees.sellerRegFee) || 0, fileId: String(a.slipFileId), bucket: 'kyc_docs', status: String(a.status), approveLink: '/admin/sellers' });
    }
    for (const a of mmRes.documents as Row[]) {
      if (a.slipFileId) incoming.push({ key: 'mreg_' + a.$id, source: 'middleman_app', refId: String(a.$id), title: String(a.fullNameId || 'สมัครคนกลาง'), payer: 'ผู้สมัคร', payerName: String(a.fullNameId || ''), purpose: 'ค่าสมัครคนกลาง', expected: Number(fees.middlemanRegFee) || 0, fileId: String(a.slipFileId), bucket: 'kyc_docs', status: String(a.status), approveLink: '/admin/middlemen' });
    }

    // สรุปยอด
    const sumPrice = (arr: Row[]) => arr.reduce((s, d) => s + (Number(d.price) || 0), 0);
    const heldDeals = deals.filter(d => HELD.includes(String(d.status)));
    const completed = deals.filter(d => d.status === 'completed');
    let heldMeetupDeposit = 0;
    for (const d of deals) {
      if (d.dealType === 'meetup' && d.status === 'meetup_ready') {
        try { const md = JSON.parse(String(d.meetupData || '{}')); heldMeetupDeposit += (Number(md.deposit) || 0) * 2; } catch {}
      }
    }
    const estRevenue = completed.reduce((s, d) => s + computeDealFees(fees, Number(d.price) || 0, String(d.dealType || '')).total, 0);

    const summary = {
      incomingCount: incoming.length,
      escrowPendingCount: incoming.filter(r => r.source === 'escrow').length,
      heldEscrow: sumPrice(heldDeals),
      heldMeetupDeposit,
      completedVolume: sumPrice(completed),
      completedCount: completed.length,
      estRevenue,
    };
    return NextResponse.json({ incoming, summary, fees });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message ?? 'error' }, { status: e.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = new Databases(getAdminClient());
    const { id, action, note, fileId, bucket, expected } = await req.json();

    // ตรวจสลิปได้กับทุกแหล่ง (รับ fileId + bucket + ยอดที่ควรได้)
    if (action === 'verify_slip') {
      if (!fileId) return NextResponse.json({ error: 'ไม่มีไฟล์สลิป' }, { status: 400 });
      const b = bucket === 'kyc_docs' ? 'kyc_docs' : 'deal_files';
      const result = await verifySlipByUrl(slipUrl(b, String(fileId)));
      const exp = Number(expected) || 0;
      const slipAmount = result.slip?.amount;
      const amountMatch = (slipAmount != null && exp > 0) ? Math.abs(slipAmount - exp) < 0.5 : null;
      return NextResponse.json({ result, expected: exp, amountMatch });
    }

    // อนุมัติ/ปฏิเสธ — เฉพาะค่าสินค้า escrow
    if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
    const deal = await db.getDocument(DB_ID, COL_DEALS, id);
    if (deal.status !== 'payment_uploaded')
      return NextResponse.json({ error: 'ดีลนี้ไม่ได้อยู่สถานะรอตรวจสอบการโอน' }, { status: 400 });

    const recipients = [deal.sellerId, deal.buyerId, deal.middlemanId].filter((x): x is string => typeof x === 'string' && !!x);

    if (action === 'approve_payment') {
      const updated = await db.updateDocument(DB_ID, COL_DEALS, id, { status: 'packing', middlemanConfirmedPayment: true });
      const msg = 'ศูนย์กลางยืนยันรับเงินแล้ว — ผู้ขายเริ่มแพ็คสินค้า';
      await sysMsg(db, id, msg);
      if (recipients.length) await notifyUsers(db, recipients, { title: `ยืนยันรับเงิน: ${deal.title || 'ดีล'}`, body: msg, link: `/deal/${id}` });
      return NextResponse.json({ ok: true, deal: updated });
    }
    if (action === 'reject_payment') {
      const reason = String(note || '').slice(0, 300);
      const updated = await db.updateDocument(DB_ID, COL_DEALS, id, { status: 'payment_pending', paymentSlipFileId: '', rejectReason: `[ปฏิเสธการโอน] ${reason}` });
      const msg = `ศูนย์กลางปฏิเสธหลักฐานการโอน${reason ? ': ' + reason : ''} — กรุณาตรวจสอบและอัปโหลดสลิปใหม่`;
      await sysMsg(db, id, msg);
      if (deal.buyerId) await notifyUsers(db, [deal.buyerId as string], { title: `ตรวจสอบการโอน: ${deal.title || 'ดีล'}`, body: msg, link: `/deal/${id}` });
      return NextResponse.json({ ok: true, deal: updated });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message ?? 'error' }, { status: e.status ?? 500 });
  }
}
