import { NextRequest, NextResponse } from 'next/server';
import { Databases, Query, ID, Users } from 'node-appwrite';
import { verifyAdmin, getAdminClient, DB_ID } from '../../admin/_lib';
import { notifyUsers } from '../../_lib/notify';
import { readDealPriceState, writeDealPriceState, type DealPriceState } from '@/lib/dealPriceState';
import { verifySlipByUrl } from '@/lib/slipok';
import { getBankInfoMap, type BankInfo } from '@/lib/bankInfo';
import { readFeesConfig, syncDealLedger, syncFinanceProjection, type LedgerDoc } from '../../_lib/financeLedger';

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '';
const PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
const slipUrl = (bucket: string, fileId: string) => `${ENDPOINT}/storage/buckets/${bucket}/files/${fileId}/view?project=${PROJECT}`;

const COL_DEALS = 'deals';
const COL_MSGS = 'messages';
const COL_LEDGER = 'finance_ledger';

type TxnStatus = 'pending' | 'confirmed' | 'refund_pending' | 'refunded';
type Row = {
  key: string;
  source: string;
  refId: string;
  dealNumber?: string;
  title: string;
  payer: string;
  payerName: string;
  purpose: string;
  expected: number;
  fileId: string;
  bucket: string;
  status: string;
  dealType?: string;
  txnStatus: TxnStatus;
  note?: string;
  fees?: { lines: Array<{ label: string; amount: number }>; total: number };
  canApprove?: boolean;
  approveLink?: string;
  bank?: BankInfo | null;
};

function parseMeta(entry: LedgerDoc) {
  try {
    const parsed = JSON.parse(String(entry.meta || '{}'));
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function feeLinesFromMeta(meta: Record<string, unknown>) {
  const lines = Array.isArray(meta.lines) ? meta.lines : [];
  const normalized = lines
    .map(line => {
      if (!line || typeof line !== 'object') return null;
      const row = line as Record<string, unknown>;
      return { label: String(row.label || ''), amount: Number(row.amount) || 0 };
    })
    .filter((line): line is { label: string; amount: number } => !!line && !!line.label);
  if (normalized.length === 0) return undefined;
  return {
    lines: normalized,
    total: normalized.reduce((sum, line) => sum + line.amount, 0),
  };
}

function sourceForEntry(entry: LedgerDoc) {
  switch (entry.entryType) {
    case 'buyer_payment':
    case 'seller_fee_payment':
      return 'escrow';
    case 'meetup_buyer_deposit':
    case 'meetup_seller_deposit':
    case 'meetup_buyer_fee':
    case 'meetup_seller_fee':
      return 'meetup';
    case 'seller_registration':
      return 'seller_app';
    case 'middleman_registration':
      return 'middleman_app';
    case 'seller_payout':
      return 'payout';
    case 'buyer_refund':
      return 'refund';
    case 'meetup_buyer_refund':
    case 'meetup_seller_refund':
      return 'meetup_refund';
    case 'middleman_fee_net':
      return 'middleman_fee';
    case 'onsite_service_fee':
    case 'onsite_travel_fee':
      return 'onsite_payout';
    case 'platform_fee':
    case 'platform_cut':
      return 'platform_revenue';
    default:
      return '';
  }
}

function txnStatusForEntry(entry: LedgerDoc): TxnStatus {
  const isRefund = ['buyer_refund', 'meetup_buyer_refund', 'meetup_seller_refund'].includes(entry.entryType);
  if (isRefund) {
    if (entry.status === 'paid' || entry.status === 'refunded') return 'refunded';
    if (entry.status === 'scheduled' || entry.status === 'confirmed') return 'refund_pending';
    return 'pending';
  }
  if (entry.direction === 'outgoing') {
    return entry.status === 'paid' ? 'confirmed' : 'pending';
  }
  if (entry.status === 'confirmed' || entry.status === 'paid' || entry.status === 'released') return 'confirmed';
  if (entry.status === 'refunded') return 'refunded';
  return 'pending';
}

function ownerTypeForEntry(entry: LedgerDoc) {
  if (entry.ownerType && entry.ownerType !== 'system') return entry.ownerType;
  if (entry.ownerId === 'platform') return 'platform';
  if (entry.ownerId === 'system') return 'system';
  switch (entry.entryType) {
    case 'buyer_payment':
    case 'buyer_refund':
    case 'meetup_buyer_deposit':
    case 'meetup_buyer_fee':
    case 'meetup_buyer_refund':
      return 'buyer';
    case 'seller_fee_payment':
    case 'seller_payout':
    case 'meetup_seller_deposit':
    case 'meetup_seller_fee':
    case 'meetup_seller_refund':
    case 'seller_registration':
      return 'seller';
    case 'middleman_fee_gross':
    case 'middleman_fee_net':
    case 'middleman_credit_hold':
    case 'middleman_registration':
    case 'onsite_service_fee':
    case 'onsite_travel_fee':
      return 'middleman';
    case 'platform_fee':
    case 'platform_cut':
      return 'platform';
    default:
      return 'system';
  }
}

function payerLabel(entry: LedgerDoc) {
  switch (ownerTypeForEntry(entry)) {
    case 'buyer':
      return 'ผู้ซื้อ';
    case 'seller':
      return 'ผู้ขาย';
    case 'middleman':
      return 'คนกลาง';
    case 'platform':
      return 'ศูนย์กลาง';
    default:
      return 'ระบบ';
  }
}

function approveLinkForEntry(entry: LedgerDoc) {
  if (entry.referenceType === 'deal') return `/deal/${entry.referenceId}`;
  if (entry.referenceType === 'seller_application') return '/admin/sellers';
  if (entry.referenceType === 'middleman_application') return '/admin/middlemen';
  return `/onsite/${entry.referenceId}`;
}

async function hasDealAttribute(db: Databases, key: string) {
  try {
    const attr = await db.getAttribute(DB_ID, COL_DEALS, key);
    return (attr as unknown as { status?: string }).status === 'available';
  } catch {
    return false;
  }
}

async function sysMsg(db: Databases, dealId: string, content: string) {
  await db.createDocument(DB_ID, COL_MSGS, ID.unique(), {
    dealId, senderId: 'system', senderName: 'ระบบ', role: 'system', type: 'system',
    content, fileId: '', fileName: '', createdAt: new Date().toISOString(),
  }).catch(() => {});
}

function buildRow(entry: LedgerDoc, bankMap: Record<string, BankInfo | null>): Row | null {
  const source = sourceForEntry(entry);
  if (!source) return null;
  const meta = parseMeta(entry);
  const bank = entry.ownerId && entry.ownerId !== 'platform' ? (bankMap[entry.ownerId] ?? null) : null;
  const fees = feeLinesFromMeta(meta);
  const note = typeof meta.payoutNote === 'string'
    ? meta.payoutNote
    : typeof meta.refundNote === 'string'
      ? meta.refundNote
      : undefined;
  const payer = entry.direction === 'outgoing' ? 'ศูนย์กลาง' : payerLabel(entry);
  const payerName = entry.ownerName || '';
  const canApprove = entry.entryType === 'buyer_payment' && entry.status === 'pending_review';

  return {
    key: entry.entryKey,
    source,
    refId: entry.referenceId,
    dealNumber: entry.dealNumber || undefined,
    title: entry.title,
    payer,
    payerName,
    purpose: entry.purpose,
    expected: Number(entry.amount) || 0,
    fileId: entry.fileId || '',
    bucket: entry.bucket || '',
    status: entry.status,
    dealType: typeof meta.dealType === 'string' ? meta.dealType : undefined,
    txnStatus: txnStatusForEntry(entry),
    note,
    fees,
    canApprove,
    approveLink: approveLinkForEntry(entry),
    bank,
  };
}

export async function GET(req: NextRequest) {
  // #region debug-point admin-finance-500
  let debugStage = 'get:start';
  const debugInfo: Record<string, unknown> = {};
  let debugDb: Databases | null = null;
  // #endregion
  try {
    // #region debug-point admin-finance-500
    debugStage = 'get:verifyAdmin';
    // #endregion
    await verifyAdmin(req);
    const client = getAdminClient();
    const db = new Databases(client);
    debugDb = db;
    const users = new Users(client);
    // #region debug-point admin-finance-500
    debugStage = 'get:syncFinanceProjection';
    // #endregion
    await syncFinanceProjection(db, users);
    // #region debug-point admin-finance-500
    debugStage = 'get:readFeesConfig';
    // #endregion
    const fees = await readFeesConfig(db);

    // #region debug-point admin-finance-500
    debugStage = 'get:listLedger';
    // #endregion
    const ledgerRes = await db.listDocuments(DB_ID, COL_LEDGER, [
      Query.equal('active', true),
      Query.orderDesc('updatedAt'),
      Query.limit(500),
    ]).catch(() => ({ documents: [] }));
    const ledger = ledgerRes.documents as unknown as LedgerDoc[];
    // #region debug-point admin-finance-500
    debugInfo.ledgerCount = ledger.length;
    debugStage = 'get:bankOwnerIds';
    // #endregion
    const ownerIds = Array.from(new Set(
      ledger
        .map(entry => String(entry.ownerId || ''))
        .filter(ownerId => ownerId && ownerId !== 'platform' && ownerId !== 'system'),
    ));
    // #region debug-point admin-finance-500
    debugInfo.ownerIdCount = ownerIds.length;
    debugStage = 'get:getBankInfoMap';
    // #endregion
    const bankMap = await getBankInfoMap(ownerIds);

    // #region debug-point admin-finance-500
    debugStage = 'get:buildIncoming';
    // #endregion
    const incoming = ledger
      .filter(entry => entry.direction === 'incoming' || entry.entryType === 'platform_fee' || entry.entryType === 'platform_cut')
      .map(entry => buildRow(entry, bankMap))
      .filter((row): row is Row => !!row);

    // #region debug-point admin-finance-500
    debugInfo.incomingCount = incoming.length;
    debugStage = 'get:buildOutgoing';
    // #endregion
    const outgoing = ledger
      .filter(entry => entry.direction === 'outgoing')
      .map(entry => buildRow(entry, bankMap))
      .filter((row): row is Row => !!row);

    // #region debug-point admin-finance-500
    debugInfo.outgoingCount = outgoing.length;
    debugStage = 'get:summary';
    // #endregion
    const completedDealIds = new Set(
      ledger
        .filter(entry => entry.entryType === 'seller_payout' && entry.active !== false)
        .map(entry => entry.referenceId),
    );
    const completedVolume = ledger.reduce((sum, entry) => {
      if (entry.entryType !== 'buyer_payment' || !completedDealIds.has(entry.referenceId)) return sum;
      const meta = parseMeta(entry);
      return sum + (Number(meta.price) || 0);
    }, 0);
    const estRevenue = ledger.reduce((sum, entry) => {
      if (!['platform_fee', 'platform_cut', 'meetup_buyer_fee', 'meetup_seller_fee', 'seller_registration', 'middleman_registration'].includes(entry.entryType)) {
        return sum;
      }
      if (entry.status === 'cancelled' || entry.status === 'void') return sum;
      return sum + (Number(entry.amount) || 0);
    }, 0);

    const summary = {
      incomingCount: incoming.length,
      escrowPendingCount: incoming.filter(row => row.canApprove).length,
      heldEscrow: ledger
        .filter(entry => entry.entryType === 'buyer_payment' && ['pending_review', 'confirmed'].includes(entry.status))
        .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0),
      heldMeetupDeposit: ledger
        .filter(entry => ['meetup_buyer_deposit', 'meetup_seller_deposit'].includes(entry.entryType) && entry.status === 'confirmed')
        .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0),
      completedVolume,
      completedCount: completedDealIds.size,
      estRevenue,
      outgoingCount: outgoing.length,
      pendingPayoutAmount: outgoing
        .filter(row => ['payout', 'middleman_fee', 'onsite_payout'].includes(row.source) && row.txnStatus === 'pending')
        .reduce((sum, row) => sum + row.expected, 0),
      pendingRefundAmount: outgoing
        .filter(row => ['refund', 'meetup_refund'].includes(row.source) && row.txnStatus !== 'refunded')
        .reduce((sum, row) => sum + row.expected, 0),
    };

    // #region debug-point admin-finance-500
    debugStage = 'get:done';
    // #endregion
    return NextResponse.json({ incoming, outgoing, summary, fees });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (debugDb && /Unknown attribute/i.test(String(e.message || ''))) {
      try {
        const attrs = await debugDb.listAttributes(DB_ID, 'finance_ledger');
        debugInfo.ledgerAttributes = (attrs.attributes || []).map((attr: { key?: string; status?: string; type?: string }) => ({
          key: String(attr.key || ''),
          status: String(attr.status || ''),
          type: String(attr.type || ''),
        }));
      } catch (schemaErr) {
        debugInfo.ledgerAttributesError = String(schemaErr || '');
      }
      try {
        const walletAttrs = await debugDb.listAttributes(DB_ID, 'middleman_wallets');
        debugInfo.walletAttributes = (walletAttrs.attributes || []).map((attr: { key?: string; status?: string; type?: string }) => ({
          key: String(attr.key || ''),
          status: String(attr.status || ''),
          type: String(attr.type || ''),
        }));
      } catch (schemaErr) {
        debugInfo.walletAttributesError = String(schemaErr || '');
      }
    }
    return NextResponse.json({
      error: e.message ?? 'error',
      debugStage,
      debugInfo,
      debugName: err instanceof Error ? err.name : 'unknown',
      debugStack: err instanceof Error ? String(err.stack || '').slice(0, 1200) : '',
    }, { status: e.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const client = getAdminClient();
    const db = new Databases(client);
    const users = new Users(client);
    const { id, action, note, fileId, bucket, expected } = await req.json();

    if (action === 'verify_slip') {
      if (!fileId) return NextResponse.json({ error: 'ไม่มีไฟล์สลิป' }, { status: 400 });
      const b = bucket === 'kyc_docs' ? 'kyc_docs' : 'deal_files';
      const result = await verifySlipByUrl(slipUrl(b, String(fileId)));
      const exp = Number(expected) || 0;
      const slipAmount = result.slip?.amount;
      const amountMatch = (slipAmount != null && exp > 0) ? Math.abs(slipAmount - exp) < 0.5 : null;
      return NextResponse.json({ result, expected: exp, amountMatch });
    }

    if (action === 'mark_payout_sent' || action === 'mark_refund_sent') {
      if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
      const deal = await db.getDocument(DB_ID, COL_DEALS, id);
      if (action === 'mark_payout_sent' && deal.status !== 'completed') {
        return NextResponse.json({ error: 'ดีลนี้ยังไม่ปิด — ยังจ่ายคืนผู้ขายไม่ได้' }, { status: 400 });
      }
      if (action === 'mark_refund_sent' && deal.status !== 'cancelled') {
        return NextResponse.json({ error: 'ดีลนี้ไม่ได้ถูกยกเลิก' }, { status: 400 });
      }

      const supportsPriceData = await hasDealAttribute(db, 'priceData');
      const pd: DealPriceState = readDealPriceState({ priceData: String(deal.priceData || ''), meetupData: String(deal.meetupData || '') });
      const now = new Date().toISOString();
      if (action === 'mark_payout_sent') {
        pd.payoutSentAt = now;
        pd.payoutNote = String(note || '').slice(0, 300);
      } else {
        pd.refundSentAt = now;
        pd.refundNote = String(note || '').slice(0, 300);
      }
      const serialized = writeDealPriceState(pd, String(deal.meetupData || ''));
      const updates: Record<string, unknown> = supportsPriceData ? { priceData: serialized.priceData } : { meetupData: serialized.meetupDataFallback };
      await db.updateDocument(DB_ID, COL_DEALS, id, updates);

      const msg = action === 'mark_payout_sent'
        ? `ศูนย์กลางโอนเงินคืนผู้ขายแล้ว${pd.payoutNote ? ': ' + pd.payoutNote : ''}`
        : `ศูนย์กลางโอนเงินคืนผู้ซื้อแล้ว${pd.refundNote ? ': ' + pd.refundNote : ''}`;
      await sysMsg(db, id, msg);
      const recipients = [deal.sellerId, deal.buyerId, deal.middlemanId].filter((x): x is string => typeof x === 'string' && !!x);
      if (recipients.length) {
        await notifyUsers(db, recipients, { title: `การเงิน: ${deal.title || 'ดีล'}`, body: msg, link: `/deal/${id}` });
      }
      const refreshedDeal = await db.getDocument(DB_ID, COL_DEALS, id);
      await syncDealLedger(db, users, refreshedDeal as unknown as Record<string, unknown>);
      return NextResponse.json({ ok: true });
    }

    if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
    const deal = await db.getDocument(DB_ID, COL_DEALS, id);
    if (deal.status !== 'payment_uploaded') {
      return NextResponse.json({ error: 'ดีลนี้ไม่ได้อยู่สถานะรอตรวจสอบการโอน' }, { status: 400 });
    }

    const recipients = [deal.sellerId, deal.buyerId, deal.middlemanId].filter((x): x is string => typeof x === 'string' && !!x);

    if (action === 'approve_payment') {
      const updated = await db.updateDocument(DB_ID, COL_DEALS, id, { status: 'packing', middlemanConfirmedPayment: true });
      const msg = 'ศูนย์กลางยืนยันรับเงินแล้ว — ผู้ขายเริ่มแพ็คสินค้า';
      await sysMsg(db, id, msg);
      if (recipients.length) {
        await notifyUsers(db, recipients, { title: `ยืนยันรับเงิน: ${deal.title || 'ดีล'}`, body: msg, link: `/deal/${id}` });
      }
      await syncDealLedger(db, users, updated as unknown as Record<string, unknown>);
      return NextResponse.json({ ok: true, deal: updated });
    }
    if (action === 'reject_payment') {
      const reason = String(note || '').slice(0, 300);
      const updated = await db.updateDocument(DB_ID, COL_DEALS, id, {
        status: 'payment_pending',
        paymentSlipFileId: '',
        rejectReason: `[ปฏิเสธการโอน] ${reason}`,
      });
      const msg = `ศูนย์กลางปฏิเสธหลักฐานการโอน${reason ? ': ' + reason : ''} — กรุณาตรวจสอบและอัปโหลดสลิปใหม่`;
      await sysMsg(db, id, msg);
      if (deal.buyerId) {
        await notifyUsers(db, [deal.buyerId as string], { title: `ตรวจสอบการโอน: ${deal.title || 'ดีล'}`, body: msg, link: `/deal/${id}` });
      }
      await syncDealLedger(db, users, updated as unknown as Record<string, unknown>);
      return NextResponse.json({ ok: true, deal: updated });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message ?? 'error' }, { status: e.status ?? 500 });
  }
}
