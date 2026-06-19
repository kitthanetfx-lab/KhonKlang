import { NextRequest, NextResponse } from 'next/server';
import { Databases, Query, ID } from 'node-appwrite';
import { verifyAdmin, getAdminClient, DB_ID } from '../../admin/_lib';
import { notifyUsers } from '../../_lib/notify';
import { readDealPriceState, writeDealPriceState, DealPriceState } from '@/lib/dealPriceState';
import { FEE_DEFAULTS, computeDealFees, FeeConfig } from '@/lib/fees';
import { verifySlipByUrl } from '@/lib/slipok';
import { dealCode } from '@/lib/dealNumber';
import { getBankInfoMap, BankInfo } from '@/lib/bankInfo';

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
// สถานะที่ถือว่าการโอนเข้าได้รับการยืนยัน/ตรวจสอบแล้ว (ผ่านขั้นรอตรวจไปแล้ว)
const CONFIRMED_STATUSES = new Set([...HELD, 'completed']);

async function readFees(db: Databases): Promise<FeeConfig> {
  try {
    const d = await db.getDocument(DB_ID, COL_CFG, 'fees') as unknown as { data?: string };
    return { ...FEE_DEFAULTS, ...JSON.parse(d.data || '{}') };
  } catch { return FEE_DEFAULTS; }
}

async function hasDealAttribute(db: Databases, key: string) {
  try {
    const attr = await db.getAttribute(DB_ID, COL_DEALS, key);
    return (attr as unknown as { status?: string }).status === 'available';
  } catch { return false; }
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

    // ดึงเลขบัญชี/คิวอาร์โค๊ดของผู้ใช้ทุกคนที่เกี่ยวกับดีลล่วงหน้า (จากหน้าโปรไฟล์ ถ้ามีกรอกไว้)
    // เพื่อให้รู้ว่าต้องโอนเงินคืน/จ่ายเข้าบัญชีไหน โดยไม่ต้องไปเปิดหาเอง
    const bankIds = deals.flatMap(d => [String(d.buyerId || ''), String(d.sellerId || ''), String(d.middlemanId || '')]);
    const bankMap = await getBankInfoMap(bankIds);
    const bankOf = (uid: unknown): BankInfo | null => bankMap[String(uid || '')] ?? null;

    const incoming: Row[] = [];

    // คำนวณส่วนค่าบริการของผู้ซื้อ/ผู้ขายตามผู้รับผิดชอบ
    const feeShares = (price: number, dealType: string, feePayer: string) => {
      const fb = computeDealFees(fees, price, dealType);
      const fp = feePayer || 'split';
      const sellerShare = fp === 'seller' ? fb.total : fp === 'split' ? (fb.total - Math.round(fb.total / 2)) : 0;
      return { total: fb.total, buyerShare: fb.total - sellerShare, sellerShare, lines: fb.lines };
    };

    const outgoing: Row[] = [];

    // 1) ค่าสินค้า escrow — ผู้ซื้อโอน (ราคา + ค่าบริการส่วนผู้ซื้อ) — แสดงทั้งรอตรวจและที่ยืนยันแล้ว เพื่อให้มีสถานะติดตามได้ครบ
    for (const d of deals) {
      const dStatus = String(d.status || '');
      const pd = readDealPriceState({ priceData: String(d.priceData || ''), meetupData: String(d.meetupData || '') });

      if (d.paymentSlipFileId && (dStatus === 'payment_uploaded' || CONFIRMED_STATUSES.has(dStatus))) {
        const sh = feeShares(Number(d.price) || 0, String(d.dealType || ''), String(d.feePayer || pd.feePayer || 'split'));
        const txnStatus = dStatus === 'payment_uploaded' ? 'pending' : 'confirmed';
        incoming.push({
          key: 'escrow_' + d.$id, source: 'escrow', refId: String(d.$id), dealNumber: dealCode(String(d.$id)), title: String(d.title || ''),
          payer: 'ผู้ซื้อ', payerName: String(d.buyerName || ''), purpose: 'ค่าสินค้า',
          expected: (Number(d.price) || 0) + sh.buyerShare, fileId: String(d.paymentSlipFileId || ''), bucket: 'deal_files',
          status: dStatus, dealType: String(d.dealType || ''), txnStatus,
          fees: {
            lines: sh.buyerShare > 0
              ? [{ label: 'ราคาสินค้า', amount: Number(d.price) || 0 }, { label: 'ค่าบริการ (ส่วนผู้ซื้อ)', amount: sh.buyerShare }]
              : [{ label: 'ราคาสินค้า', amount: Number(d.price) || 0 }],
            total: (Number(d.price) || 0) + sh.buyerShare,
          },
          canApprove: dStatus === 'payment_uploaded',
          bank: bankOf(d.buyerId),
        });
      }

      // 1b) ค่าบริการส่วนของผู้ขาย — ผู้ขายโอนแยก
      if (pd.sellerFeeSlip) {
        const sh = feeShares(Number(d.price) || 0, String(d.dealType || ''), String(d.feePayer || pd.feePayer || 'split'));
        if (sh.sellerShare > 0) {
          const txnStatus = dStatus === 'cancelled'
            ? (pd.refundSentAt ? 'refunded' : 'refund_pending')
            : (CONFIRMED_STATUSES.has(dStatus) ? 'confirmed' : 'pending');
          incoming.push({
            key: 'sellerfee_' + d.$id, source: 'escrow', refId: String(d.$id), dealNumber: dealCode(String(d.$id)), title: `ค่าบริการ (ผู้ขาย): ${String(d.title || '')}`,
            payer: 'ผู้ขาย', payerName: String(d.sellerName || ''), purpose: 'ค่าบริการส่วนผู้ขาย',
            expected: sh.sellerShare, fileId: String(pd.sellerFeeSlip), bucket: 'deal_files',
            status: dStatus, dealType: String(d.dealType || ''), txnStatus,
            fees: { lines: [{ label: 'ค่าบริการ (ส่วนผู้ขาย)', amount: sh.sellerShare }], total: sh.sellerShare },
            bank: bankOf(d.sellerId),
          });
        }
      }

      // 1c) จ่ายคืนผู้ขายเมื่อปิดดีลสำเร็จ / คืนเงินผู้ซื้อเมื่อยกเลิกดีลที่จ่ายเงินไปแล้ว — เงินออก
      if (String(d.dealType || '') !== 'meetup') {
        if (dStatus === 'completed') {
          const sh = feeShares(Number(d.price) || 0, String(d.dealType || ''), String(d.feePayer || pd.feePayer || 'split'));
          const sellerNet = Math.max((Number(d.price) || 0) - sh.sellerShare, 0);
          outgoing.push({
            key: 'payout_' + d.$id, source: 'payout', refId: String(d.$id), dealNumber: dealCode(String(d.$id)), title: String(d.title || ''),
            payer: 'ศูนย์กลาง', payerName: String(d.sellerName || ''), purpose: 'จ่ายคืนผู้ขาย (ปิดดีล)',
            expected: sellerNet, fileId: '', bucket: '', status: dStatus, dealType: String(d.dealType || ''),
            txnStatus: pd.payoutSentAt ? 'confirmed' : 'pending', note: pd.payoutNote || '',
            bank: bankOf(d.sellerId),
          });
        } else if (dStatus === 'cancelled' && d.paymentSlipFileId) {
          outgoing.push({
            key: 'refund_' + d.$id, source: 'refund', refId: String(d.$id), dealNumber: dealCode(String(d.$id)), title: String(d.title || ''),
            payer: 'ศูนย์กลาง', payerName: String(d.buyerName || ''), purpose: 'คืนเงินผู้ซื้อ (ยกเลิกดีล)',
            expected: Number(d.price) || 0, fileId: '', bucket: '', status: dStatus, dealType: String(d.dealType || ''),
            txnStatus: pd.refundSentAt ? 'confirmed' : 'pending', note: pd.refundNote || '',
            bank: bankOf(d.buyerId),
          });
        }
      }
    }

    // 2) เงินประกัน meetup — ผู้ซื้อ + ผู้ขาย (รวมประวัติ ไม่ใช่เฉพาะที่ยังไม่จบ)
    for (const d of deals) {
      if (d.dealType === 'meetup') {
        const dStatus = String(d.status || '');
        let md: Record<string, unknown> = {};
        try { md = JSON.parse(String(d.meetupData || '{}')); } catch {}
        const dep = Number(md.deposit) || 0;
        const finished = dStatus === 'completed' || dStatus === 'cancelled';
        const txnStatus = finished ? (md.refundedAt ? 'refunded' : 'refund_pending') : 'confirmed';
        if (md.buyerSlip) incoming.push({ key: 'mtb_' + d.$id, source: 'meetup', refId: String(d.$id), dealNumber: dealCode(String(d.$id)), title: String(d.title || ''), payer: 'ผู้ซื้อ', payerName: String(d.buyerName || ''), purpose: 'เงินประกัน (นัดเจอ)', expected: dep, fileId: String(md.buyerSlip), bucket: 'deal_files', status: dStatus, txnStatus, fees: { lines: [{ label: 'เงินประกัน', amount: dep }], total: dep }, bank: bankOf(d.buyerId) });
        if (md.sellerSlip) incoming.push({ key: 'mts_' + d.$id, source: 'meetup', refId: String(d.$id), dealNumber: dealCode(String(d.$id)), title: String(d.title || ''), payer: 'ผู้ขาย', payerName: String(d.sellerName || ''), purpose: 'เงินประกัน (นัดเจอ)', expected: dep, fileId: String(md.sellerSlip), bucket: 'deal_files', status: dStatus, txnStatus, fees: { lines: [{ label: 'เงินประกัน', amount: dep }], total: dep }, bank: bankOf(d.sellerId) });

        if (finished && (md.buyerSlip || md.sellerSlip)) {
          outgoing.push({
            key: 'mrefund_' + d.$id, source: 'meetup_refund', refId: String(d.$id), dealNumber: dealCode(String(d.$id)), title: String(d.title || ''),
            payer: 'ศูนย์กลาง', payerName: `${String(d.buyerName || '')} + ${String(d.sellerName || '')}`, purpose: 'คืนเงินประกันนัดเจอ (ทั้งสองฝ่าย)',
            expected: dep * ((md.buyerSlip ? 1 : 0) + (md.sellerSlip ? 1 : 0)), fileId: '', bucket: '', status: dStatus, dealType: 'meetup',
            txnStatus: md.refundedAt ? 'confirmed' : 'pending', note: String(md.refundNote || ''), approveLink: '/admin/deals',
          });
        }
      }
    }

    // 3) ค่าสมัคร ผู้ขาย / คนกลาง (รอตรวจ)
    for (const a of sellerRes.documents as Row[]) {
      if (a.slipFileId) incoming.push({ key: 'sreg_' + a.$id, source: 'seller_app', refId: String(a.$id), dealNumber: dealCode(String(a.$id)), title: String(a.fullNameId || 'สมัครผู้ขาย'), payer: 'ผู้สมัคร', payerName: String(a.fullNameId || ''), purpose: 'ค่าสมัครผู้ขาย', expected: Number(fees.sellerRegFee) || 0, fileId: String(a.slipFileId), bucket: 'kyc_docs', status: String(a.status), txnStatus: 'pending', approveLink: '/admin/sellers', fees: { lines: [{ label: 'ค่าสมัครผู้ขาย', amount: Number(fees.sellerRegFee) || 0 }], total: Number(fees.sellerRegFee) || 0 } });
    }
    for (const a of mmRes.documents as Row[]) {
      if (a.slipFileId) incoming.push({ key: 'mreg_' + a.$id, source: 'middleman_app', refId: String(a.$id), dealNumber: dealCode(String(a.$id)), title: String(a.fullNameId || 'สมัครคนกลาง'), payer: 'ผู้สมัคร', payerName: String(a.fullNameId || ''), purpose: 'ค่าสมัครคนกลาง', expected: Number(fees.middlemanRegFee) || 0, fileId: String(a.slipFileId), bucket: 'kyc_docs', status: String(a.status), txnStatus: 'pending', approveLink: '/admin/middlemen', fees: { lines: [{ label: 'ค่าสมัครคนกลาง', amount: Number(fees.middlemanRegFee) || 0 }], total: Number(fees.middlemanRegFee) || 0 } });
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
      escrowPendingCount: incoming.filter(r => r.source === 'escrow' && r.txnStatus === 'pending').length,
      heldEscrow: sumPrice(heldDeals),
      heldMeetupDeposit,
      completedVolume: sumPrice(completed),
      completedCount: completed.length,
      estRevenue,
      outgoingCount: outgoing.length,
      pendingPayoutAmount: outgoing.filter(r => r.source === 'payout' && r.txnStatus === 'pending').reduce((s, r) => s + (Number(r.expected) || 0), 0),
      pendingRefundAmount: outgoing.filter(r => r.source !== 'payout' && r.txnStatus === 'pending').reduce((s, r) => s + (Number(r.expected) || 0), 0),
    };
    return NextResponse.json({ incoming, outgoing, summary, fees });
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

    // บันทึกว่าโอนเงิน "ออก" จากศูนย์กลางแล้ว — จ่ายคืนผู้ขาย (ปิดดีล) หรือคืนเงินผู้ซื้อ (ยกเลิกดีล)
    if (action === 'mark_payout_sent' || action === 'mark_refund_sent') {
      if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
      const deal = await db.getDocument(DB_ID, COL_DEALS, id);
      if (action === 'mark_payout_sent' && deal.status !== 'completed')
        return NextResponse.json({ error: 'ดีลนี้ยังไม่ปิด — ยังจ่ายคืนผู้ขายไม่ได้' }, { status: 400 });
      if (action === 'mark_refund_sent' && deal.status !== 'cancelled')
        return NextResponse.json({ error: 'ดีลนี้ไม่ได้ถูกยกเลิก' }, { status: 400 });

      const supportsPriceData = await hasDealAttribute(db, 'priceData');
      const pd: DealPriceState = readDealPriceState({ priceData: String(deal.priceData || ''), meetupData: String(deal.meetupData || '') });
      const now = new Date().toISOString();
      if (action === 'mark_payout_sent') { pd.payoutSentAt = now; pd.payoutNote = String(note || '').slice(0, 300); }
      else { pd.refundSentAt = now; pd.refundNote = String(note || '').slice(0, 300); }
      const serialized = writeDealPriceState(pd, String(deal.meetupData || ''));
      const updates: Record<string, unknown> = supportsPriceData ? { priceData: serialized.priceData } : { meetupData: serialized.meetupDataFallback };
      await db.updateDocument(DB_ID, COL_DEALS, id, updates);

      const msg = action === 'mark_payout_sent'
        ? `ศูนย์กลางโอนเงินคืนผู้ขายแล้ว${pd.payoutNote ? ': ' + pd.payoutNote : ''}`
        : `ศูนย์กลางโอนเงินคืนผู้ซื้อแล้ว${pd.refundNote ? ': ' + pd.refundNote : ''}`;
      await sysMsg(db, id, msg);
      const recipients = [deal.sellerId, deal.buyerId, deal.middlemanId].filter((x): x is string => typeof x === 'string' && !!x);
      if (recipients.length) await notifyUsers(db, recipients, { title: `การเงิน: ${deal.title || 'ดีล'}`, body: msg, link: `/deal/${id}` });
      return NextResponse.json({ ok: true });
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
