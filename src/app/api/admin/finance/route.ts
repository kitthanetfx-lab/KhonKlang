import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { verifyAdmin, getAdminClient, HttpError } from '@/lib/supabaseServer';
import { notifyUsers } from '../../_lib/notify';
import { verifySlipByUrl, dealSlipPublicUrl, formatSlipokError } from '@/lib/slipok';
import { getBankInfoMap, type BankInfo } from '@/lib/bankInfo';
import { readFeesConfig, syncDealLedger, syncFinanceProjection } from '../../_lib/financeLedger';

function slipUrl(bucket: 'deal_files' | 'kyc_docs', fileId: string) {
  if (bucket === 'kyc_docs') {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    return `${base}/storage/v1/object/public/kyc-docs/${fileId}`;
  }
  return dealSlipPublicUrl(fileId);
}

interface LedgerRow {
  id: string; entry_key: string; reference_type: string; reference_id: string;
  deal_id: string | null; deal_number: string | null; owner_type: string; owner_id: string | null;
  owner_name: string; entry_type: string; direction: string; amount: number; status: string;
  title: string; purpose: string; counterparty_name: string; bucket: string; file_id: string;
  approve_link: string; meta: Record<string, unknown>; active: boolean; created_at: string; updated_at: string;
}

type TxnStatus = 'pending' | 'confirmed' | 'refund_pending' | 'refunded';
type Row = {
  key: string;
  entryType: string;
  source: string;
  refId: string;
  referenceType: string;
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
  detailUrl: string;
  buyerId?: string;
  buyerName?: string;
  sellerId?: string;
  sellerName?: string;
  middlemanId?: string;
  middlemanName?: string;
  dealStatus?: string;
  price?: number;
  feeAmount?: number;
  imageCount?: number;
  attachmentCount?: number;
  hasSlip?: boolean;
  category?: string;
  condition?: string;
  location?: string;
  description?: string;
};

type FinanceTab = 'incoming' | 'outgoing' | 'summary';
type ReferenceDocMap = Record<string, Record<string, unknown>>;
type ExportFormat = 'csv' | 'xlsx';

const SEARCH_SCAN_LIMIT = 5000;
const SEARCH_BATCH_SIZE = 200;

const ENTRY_TYPE_FILTERS: Record<'incoming' | 'outgoing', Record<string, string[]>> = {
  incoming: {
    all: [
      'buyer_payment', 'seller_fee_payment',
      'meetup_buyer_deposit', 'meetup_seller_deposit', 'meetup_buyer_fee', 'meetup_seller_fee',
      'seller_registration', 'middleman_registration',
    ],
    escrow: ['buyer_payment', 'seller_fee_payment'],
    meetup: ['meetup_buyer_deposit', 'meetup_seller_deposit', 'meetup_buyer_fee', 'meetup_seller_fee'],
    reg: ['seller_registration', 'middleman_registration'],
  },
  outgoing: {
    all: [
      'seller_payout', 'buyer_refund', 'meetup_buyer_refund', 'meetup_seller_refund',
      'middleman_fee_net', 'onsite_service_fee', 'onsite_travel_fee',
    ],
    payout: ['seller_payout', 'middleman_fee_net', 'onsite_service_fee', 'onsite_travel_fee'],
    refund: ['buyer_refund', 'meetup_buyer_refund', 'meetup_seller_refund'],
  },
};

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
  return { lines: normalized, total: normalized.reduce((sum, line) => sum + line.amount, 0) };
}

function sourceForEntry(entry: LedgerRow) {
  switch (entry.entry_type) {
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

function referenceCodeForRow(row: Row) {
  if (row.dealNumber) return row.dealNumber;
  if (row.referenceType === 'seller_application') return `SELLER-${row.refId.slice(-8).toUpperCase()}`;
  if (row.referenceType === 'middleman_application') return `MM-${row.refId.slice(-8).toUpperCase()}`;
  if (row.referenceType === 'onsite_job') return `ONSITE-${row.refId.slice(-8).toUpperCase()}`;
  return `FIN-${row.refId.slice(-8).toUpperCase()}`;
}

function rowSearchText(row: Row) {
  return [
    referenceCodeForRow(row), row.title, row.purpose, row.payer, row.payerName,
    row.buyerName, row.sellerName, row.middlemanName, row.description, row.location,
    row.category, row.condition, row.dealStatus,
  ].join(' ').toLowerCase();
}

function matchesSearch(row: Row, search: string) {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return rowSearchText(row).includes(q);
}

function exportRows(rows: Row[]) {
  return rows.map(row => ({
    referenceCode: referenceCodeForRow(row),
    referenceType: row.referenceType,
    source: row.source,
    title: row.title,
    purpose: row.purpose,
    buyerName: row.buyerName || '',
    sellerName: row.sellerName || '',
    middlemanName: row.middlemanName || '',
    payer: row.payer,
    payerName: row.payerName || '',
    dealStatus: row.dealStatus || row.status || '',
    txnStatus: row.txnStatus || '',
    price: Number(row.price || 0),
    feeAmount: Number(row.feeAmount || 0),
    expected: Number(row.expected || 0),
    imageCount: Number(row.imageCount || 0),
    attachmentCount: Number(row.attachmentCount || 0),
    hasSlip: row.hasSlip ? 'yes' : 'no',
    category: row.category || '',
    condition: row.condition || '',
    location: row.location || '',
    description: row.description || '',
    detailUrl: row.detailUrl,
  }));
}

function feeAmountForEntry(entry: LedgerRow, fees?: { lines: Array<{ label: string; amount: number }>; total: number }) {
  if (fees?.total) return fees.total;
  const meta = entry.meta || {};
  return Number(meta.fee ?? meta.sellerFeeShare ?? meta.buyerFeeShare ?? meta.platformCut ?? meta.grossFee ?? 0) || 0;
}

function txnStatusForEntry(entry: LedgerRow): TxnStatus {
  const isRefund = ['buyer_refund', 'meetup_buyer_refund', 'meetup_seller_refund'].includes(entry.entry_type);
  if (isRefund) {
    if (entry.status === 'paid' || entry.status === 'refunded') return 'refunded';
    if (entry.status === 'scheduled' || entry.status === 'confirmed') return 'refund_pending';
    return 'pending';
  }
  if (entry.direction === 'outgoing') return entry.status === 'paid' ? 'confirmed' : 'pending';
  if (entry.status === 'confirmed' || entry.status === 'paid' || entry.status === 'released') return 'confirmed';
  if (entry.status === 'refunded') return 'refunded';
  return 'pending';
}

function ownerTypeForEntry(entry: LedgerRow) {
  if (entry.owner_type && entry.owner_type !== 'system') return entry.owner_type;
  switch (entry.entry_type) {
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

function payerLabel(entry: LedgerRow) {
  switch (ownerTypeForEntry(entry)) {
    case 'buyer': return 'ผู้ซื้อ';
    case 'seller': return 'ผู้ขาย';
    case 'middleman': return 'คนกลาง';
    case 'platform': return 'ศูนย์กลาง';
    default: return 'ระบบ';
  }
}

async function loadReferenceContext(db: SupabaseClient, ledger: LedgerRow[]) {
  const dealIds = Array.from(new Set(ledger.filter(e => e.reference_type === 'deal').map(e => e.reference_id)));
  const sellerAppIds = Array.from(new Set(ledger.filter(e => e.reference_type === 'seller_application').map(e => e.reference_id)));
  const middlemanAppIds = Array.from(new Set(ledger.filter(e => e.reference_type === 'middleman_application').map(e => e.reference_id)));
  const onsiteIds = Array.from(new Set(ledger.filter(e => e.reference_type === 'onsite_job').map(e => e.reference_id)));

  const [dealsRes, sellerRes, middlemanRes, onsiteRes, imageCountRes, evidenceCountRes] = await Promise.all([
    dealIds.length ? db.from('deals').select('*').in('id', dealIds) : Promise.resolve({ data: [] }),
    sellerAppIds.length ? db.from('seller_applications').select('*').in('id', sellerAppIds) : Promise.resolve({ data: [] }),
    middlemanAppIds.length ? db.from('middleman_applications').select('*').in('id', middlemanAppIds) : Promise.resolve({ data: [] }),
    onsiteIds.length ? db.from('onsite_jobs').select('*').in('id', onsiteIds) : Promise.resolve({ data: [] }),
    dealIds.length ? db.from('deal_images').select('deal_id').in('deal_id', dealIds) : Promise.resolve({ data: [] }),
    dealIds.length ? db.from('deal_evidence').select('deal_id').in('deal_id', dealIds) : Promise.resolve({ data: [] }),
  ]);

  const toMap = (rows: Record<string, unknown>[] | null | undefined): ReferenceDocMap =>
    Object.fromEntries((rows || []).map(r => [String(r.id), r]));
  const countBy = (rows: { deal_id: string }[] | null | undefined) => {
    const m: Record<string, number> = {};
    for (const r of rows || []) m[r.deal_id] = (m[r.deal_id] || 0) + 1;
    return m;
  };

  return {
    deals: toMap(dealsRes.data as Record<string, unknown>[]),
    sellerApps: toMap(sellerRes.data as Record<string, unknown>[]),
    middlemanApps: toMap(middlemanRes.data as Record<string, unknown>[]),
    onsiteJobs: toMap(onsiteRes.data as Record<string, unknown>[]),
    imageCounts: countBy(imageCountRes.data as { deal_id: string }[]),
    evidenceCounts: countBy(evidenceCountRes.data as { deal_id: string }[]),
  };
}

async function fetchLedgerEntries(
  db: SupabaseClient, entryTypes: string[], page: number, pageSize: number, search: string, exportMode = false,
) {
  if (!search && !exportMode) {
    const from = (page - 1) * pageSize;
    const { data, count } = await db.from('finance_ledger').select('*', { count: 'exact' })
      .eq('active', true).in('entry_type', entryTypes)
      .order('updated_at', { ascending: false })
      .range(from, from + pageSize - 1);
    return { ledger: (data || []) as LedgerRow[], total: count || 0 };
  }

  const all: LedgerRow[] = [];
  let offset = 0;
  let total = 0;
  while (offset < SEARCH_SCAN_LIMIT) {
    const { data, count } = await db.from('finance_ledger').select('*', { count: 'exact' })
      .eq('active', true).in('entry_type', entryTypes)
      .order('updated_at', { ascending: false })
      .range(offset, offset + SEARCH_BATCH_SIZE - 1);
    const rows = (data || []) as LedgerRow[];
    total = count || total;
    all.push(...rows);
    offset += rows.length;
    if (rows.length < SEARCH_BATCH_SIZE || offset >= total) break;
  }
  return { ledger: all, total: Math.min(total || all.length, SEARCH_SCAN_LIMIT) };
}

async function sysMsg(db: SupabaseClient, dealId: string, content: string) {
  await db.from('messages').insert({
    deal_id: dealId, sender_id: null, sender_name: 'ระบบ', role: 'system', type: 'system',
    content, file_id: '', file_name: '',
  });
}

function buildRow(
  entry: LedgerRow,
  bankMap: Record<string, BankInfo | null>,
  refs: Awaited<ReturnType<typeof loadReferenceContext>>,
): Row | null {
  const source = sourceForEntry(entry);
  if (!source) return null;
  const meta = entry.meta || {};
  const refDoc =
    entry.reference_type === 'deal' ? refs.deals[entry.reference_id]
    : entry.reference_type === 'seller_application' ? refs.sellerApps[entry.reference_id]
    : entry.reference_type === 'middleman_application' ? refs.middlemanApps[entry.reference_id]
    : refs.onsiteJobs[entry.reference_id];
  const bank = entry.owner_id ? (bankMap[entry.owner_id] ?? null) : null;
  const fees = feeLinesFromMeta(meta);
  const note = typeof meta.payoutNote === 'string' ? meta.payoutNote
    : typeof meta.refundNote === 'string' ? meta.refundNote : undefined;
  const payer = entry.direction === 'outgoing' ? 'ศูนย์กลาง' : payerLabel(entry);
  const payerName = entry.owner_name || '';
  const canApprove = entry.entry_type === 'buyer_payment' && entry.status === 'pending_review';
  const buyerName = String(refDoc?.buyer_name || '');
  const sellerName = String(refDoc?.seller_name || '');
  const middlemanName = String(refDoc?.middleman_name || '');
  const imageCount = entry.reference_type === 'deal' ? (refs.imageCounts[entry.reference_id] || 0) : 0;
  const evidenceCount = entry.reference_type === 'deal' ? (refs.evidenceCounts[entry.reference_id] || 0) : 0;
  const price = Number(meta.price ?? refDoc?.price ?? 0) || 0;
  const feeAmount = feeAmountForEntry(entry, fees);
  const detailUrl = entry.approve_link || '/admin/deals';

  return {
    key: entry.entry_key,
    entryType: entry.entry_type,
    source,
    refId: entry.reference_id,
    referenceType: entry.reference_type,
    dealNumber: entry.deal_number || undefined,
    title: entry.title,
    payer,
    payerName,
    purpose: entry.purpose,
    expected: Number(entry.amount) || 0,
    fileId: entry.file_id || '',
    bucket: entry.bucket || '',
    status: entry.status,
    dealType: typeof meta.dealType === 'string' ? meta.dealType : undefined,
    txnStatus: txnStatusForEntry(entry),
    note,
    fees,
    canApprove,
    approveLink: detailUrl,
    bank,
    detailUrl,
    buyerId: String(refDoc?.buyer_id || ''),
    buyerName,
    sellerId: String(refDoc?.seller_id || ''),
    sellerName,
    middlemanId: String(refDoc?.middleman_id || ''),
    middlemanName,
    dealStatus: String(refDoc?.status || meta.dealStatus || ''),
    price,
    feeAmount,
    imageCount,
    attachmentCount: evidenceCount + (entry.file_id ? 1 : 0),
    hasSlip: !!entry.file_id,
    category: String(refDoc?.category || ''),
    condition: String(refDoc?.condition || ''),
    location: String(refDoc?.location || ''),
    description: String(refDoc?.description || refDoc?.item_description || ''),
  };
}

function buildSummary(summaryLedger: LedgerRow[]) {
  const activeLedger = summaryLedger.filter(entry => entry.active !== false);
  const incomingEntries = activeLedger.filter(entry => ENTRY_TYPE_FILTERS.incoming.all.includes(entry.entry_type));
  const outgoingEntries = activeLedger.filter(entry => ENTRY_TYPE_FILTERS.outgoing.all.includes(entry.entry_type));
  const completedDealIds = new Set(
    activeLedger.filter(entry => entry.entry_type === 'seller_payout').map(entry => entry.reference_id),
  );
  const completedVolume = activeLedger.reduce((sum, entry) => {
    if (entry.entry_type !== 'buyer_payment' || !completedDealIds.has(entry.reference_id)) return sum;
    return sum + (Number(entry.meta?.price) || 0);
  }, 0);
  const estRevenue = activeLedger.reduce((sum, entry) => {
    if (!['platform_fee', 'platform_cut', 'meetup_buyer_fee', 'meetup_seller_fee', 'seller_registration', 'middleman_registration'].includes(entry.entry_type)) return sum;
    if (entry.status === 'cancelled' || entry.status === 'void') return sum;
    return sum + (Number(entry.amount) || 0);
  }, 0);

  return {
    incomingCount: incomingEntries.length,
    escrowPendingCount: incomingEntries.filter(entry => entry.entry_type === 'buyer_payment' && entry.status === 'pending_review').length,
    heldEscrow: activeLedger
      .filter(entry => entry.entry_type === 'buyer_payment' && ['pending_review', 'confirmed'].includes(entry.status))
      .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0),
    heldMeetupDeposit: activeLedger
      .filter(entry => ['meetup_buyer_deposit', 'meetup_seller_deposit'].includes(entry.entry_type) && entry.status === 'confirmed')
      .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0),
    completedVolume,
    completedCount: completedDealIds.size,
    estRevenue,
    outgoingCount: outgoingEntries.length,
    pendingPayoutAmount: activeLedger
      .filter(entry => ['seller_payout', 'middleman_fee_net', 'onsite_service_fee', 'onsite_travel_fee'].includes(entry.entry_type) && entry.status !== 'paid')
      .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0),
    pendingRefundAmount: activeLedger
      .filter(entry => ['buyer_refund', 'meetup_buyer_refund', 'meetup_seller_refund'].includes(entry.entry_type) && !['paid', 'refunded'].includes(entry.status))
      .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0),
  };
}

async function buildFinanceResponse(
  db: SupabaseClient,
  params: { tab: FinanceTab; filter: string; page: number; pageSize: number; search: string; exportFormat?: ExportFormat | null },
) {
  const fees = await readFeesConfig(db);
  const { data: summaryData } = await db.from('finance_ledger').select('*').eq('active', true).order('updated_at', { ascending: false }).limit(1000);
  const summaryLedger = (summaryData || []) as LedgerRow[];
  const summary = buildSummary(summaryLedger);

  if (params.tab === 'summary') {
    return { rows: [], allRows: [], summary, fees, pagination: { page: 1, pageSize: params.pageSize, total: 0, hasNext: false } };
  }

  const tabKey = params.tab === 'outgoing' ? 'outgoing' : 'incoming';
  const entryTypes = ENTRY_TYPE_FILTERS[tabKey][params.filter] || ENTRY_TYPE_FILTERS[tabKey].all;
  const base = await fetchLedgerEntries(db, entryTypes, params.page, params.pageSize, params.search, !!params.exportFormat);
  const refs = await loadReferenceContext(db, base.ledger);
  const ownerIds = Array.from(new Set(base.ledger.map(entry => entry.owner_id || '').filter(Boolean)));
  const bankMap = await getBankInfoMap(db, ownerIds);
  const allRows = base.ledger
    .map(entry => buildRow(entry, bankMap, refs))
    .filter((row): row is Row => !!row)
    .filter(row => matchesSearch(row, params.search));

  const pagedRows = params.exportFormat ? allRows : allRows.slice((params.page - 1) * params.pageSize, params.page * params.pageSize);
  const totalRows = params.search || params.exportFormat ? allRows.length : base.total;

  return {
    rows: pagedRows, allRows, summary, fees,
    pagination: { page: params.page, pageSize: params.pageSize, total: totalRows, hasNext: params.page * params.pageSize < totalRows },
  };
}

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const tab = (req.nextUrl.searchParams.get('tab') || 'incoming') as FinanceTab;
    const filter = req.nextUrl.searchParams.get('filter') || 'all';
    const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(20, Number(req.nextUrl.searchParams.get('pageSize')) || 50));
    const search = String(req.nextUrl.searchParams.get('search') || '').trim();
    const exportFormat = req.nextUrl.searchParams.get('format') as ExportFormat | null;
    const db = getAdminClient();
    const data = await buildFinanceResponse(db, { tab, filter, page, pageSize, search, exportFormat });

    if (exportFormat === 'csv' || exportFormat === 'xlsx') {
      const records = exportRows(data.allRows);
      const worksheet = XLSX.utils.json_to_sheet(records);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Finance');
      const now = new Date().toISOString().slice(0, 10);
      const fileBase = `finance-${tab}-${filter}-${now}`;
      if (exportFormat === 'csv') {
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        return new NextResponse(`﻿${csv}`, {
          headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${fileBase}.csv"` },
        });
      }
      const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      return new NextResponse(xlsxBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileBase}.xlsx"`,
        },
      });
    }

    return NextResponse.json({ rows: data.rows, summary: data.summary, fees: data.fees, pagination: data.pagination });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const { id, action, note, fileId, bucket, expected } = await req.json();

    if (action === 'refresh_projection') {
      await syncFinanceProjection(db);
      return NextResponse.json({ ok: true });
    }

    if (action === 'verify_slip') {
      if (!fileId) return NextResponse.json({ error: 'ไม่มีไฟล์สลิป' }, { status: 400 });
      const b = bucket === 'kyc_docs' ? 'kyc_docs' : 'deal_files';
      const result = await verifySlipByUrl(slipUrl(b, String(fileId)));
      const formatted = { ...result, message: formatSlipokError(result.code, result.message) };
      const exp = Number(expected) || 0;
      const slipAmount = result.slip?.amount;
      const amountMatch = (slipAmount != null && exp > 0) ? Math.abs(slipAmount - exp) < 0.5 : null;
      return NextResponse.json({ result: formatted, expected: exp, amountMatch });
    }

    if (action === 'mark_payout_sent' || action === 'mark_refund_sent' || action === 'mark_middleman_fee_sent') {
      if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
      const { data: deal } = await db.from('deals').select('*').eq('id', id).single();
      if (!deal) return NextResponse.json({ error: 'ไม่พบดีล' }, { status: 404 });
      if (action === 'mark_payout_sent' && deal.status !== 'completed') {
        return NextResponse.json({ error: 'ดีลนี้ยังไม่ปิด — ยังจ่ายคืนผู้ขายไม่ได้' }, { status: 400 });
      }
      if (action === 'mark_refund_sent' && deal.status !== 'cancelled') {
        return NextResponse.json({ error: 'ดีลนี้ไม่ได้ถูกยกเลิก' }, { status: 400 });
      }
      if (action === 'mark_middleman_fee_sent') {
        if (deal.status !== 'completed') return NextResponse.json({ error: 'ดีลนี้ยังไม่ปิด — ยังจ่ายค่าบริการคนกลางไม่ได้' }, { status: 400 });
        if (!deal.middleman_id) return NextResponse.json({ error: 'ดีลนี้ไม่มีคนกลาง' }, { status: 400 });
      }

      const now = new Date().toISOString();
      const priceUpdates: Record<string, unknown> = {};
      let msg = '';
      if (action === 'mark_payout_sent') {
        if (!fileId) return NextResponse.json({ error: 'กรุณาแนบสลิปหลักฐานการโอนให้ผู้ขาย' }, { status: 400 });
        const payoutNote = String(note || '').slice(0, 300);
        priceUpdates.payout_sent_at = now;
        priceUpdates.payout_slip_file_id = String(fileId);
        priceUpdates.payout_note = payoutNote;
        msg = `ศูนย์กลางโอนเงินคืนผู้ขายแล้ว${payoutNote ? ': ' + payoutNote : ''}`;
      } else if (action === 'mark_refund_sent') {
        if (!fileId) return NextResponse.json({ error: 'กรุณาแนบสลิปหลักฐานการคืนเงินให้ผู้ซื้อ' }, { status: 400 });
        const refundNote = String(note || '').slice(0, 300);
        priceUpdates.refund_sent_at = now;
        priceUpdates.refund_slip_file_id = String(fileId);
        priceUpdates.refund_note = refundNote;
        msg = `ศูนย์กลางโอนเงินคืนผู้ซื้อแล้ว${refundNote ? ': ' + refundNote : ''}`;
      } else {
        if (!fileId) return NextResponse.json({ error: 'กรุณาแนบสลิปหลักฐานการโอนค่าบริการให้คนกลาง' }, { status: 400 });
        const feeNote = String(note || '').slice(0, 300);
        priceUpdates.middleman_fee_sent_at = now;
        priceUpdates.middleman_fee_slip_file_id = String(fileId);
        priceUpdates.middleman_fee_note = feeNote;
        msg = `ศูนย์กลางโอนค่าบริการให้คนกลางแล้ว${feeNote ? ': ' + feeNote : ''}`;
      }
      await db.from('deal_price_state').upsert({ deal_id: id, ...priceUpdates }, { onConflict: 'deal_id' });

      await sysMsg(db, id, msg);
      const recipients = [deal.seller_id, deal.buyer_id, deal.middleman_id].filter((x): x is string => typeof x === 'string' && !!x);
      if (recipients.length) await notifyUsers(db, recipients, { title: `การเงิน: ${deal.title || 'ดีล'}`, body: msg, link: `/deal/${id}` });
      await syncDealLedger(db, deal as Record<string, unknown>);
      return NextResponse.json({ ok: true });
    }

    if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
    const { data: deal } = await db.from('deals').select('*').eq('id', id).single();
    if (!deal) return NextResponse.json({ error: 'ไม่พบดีล' }, { status: 404 });
    const { data: priceState } = await db.from('deal_price_state').select('*').eq('deal_id', id).maybeSingle();
    const feePayer = String(priceState?.proposed_fee_payer || deal.fee_payer || 'split');
    const sellerSlipRequired = deal.deal_type !== 'meetup' && (feePayer === 'seller' || feePayer === 'split');
    if (deal.status !== 'payment_uploaded') {
      return NextResponse.json({ error: 'ดีลนี้ไม่ได้อยู่สถานะรอตรวจสอบการโอน' }, { status: 400 });
    }

    const recipients = [deal.seller_id, deal.buyer_id, deal.middleman_id].filter((x): x is string => typeof x === 'string' && !!x);

    if (action === 'approve_payment') {
      if (!deal.payment_slip_file_id) return NextResponse.json({ error: 'ยังไม่มีสลิปผู้ซื้อให้ตรวจ' }, { status: 400 });
      if (!deal.payment_slip_verified_at) return NextResponse.json({ error: 'กรุณาตรวจสลิปผู้ซื้อก่อนอนุมัติ' }, { status: 400 });
      if (sellerSlipRequired) {
        if (!priceState?.seller_fee_slip) return NextResponse.json({ error: 'ยังไม่มีสลิปค่าบริการของผู้ขาย' }, { status: 400 });
        if (!priceState?.seller_fee_slip_verified_at) return NextResponse.json({ error: 'กรุณาตรวจสลิปค่าบริการของผู้ขายก่อนอนุมัติ' }, { status: 400 });
      }
      const { data: updated } = await db.from('deals').update({ status: 'packing', middleman_confirmed_payment: true }).eq('id', id).select().single();
      const msg = 'ศูนย์กลางยืนยันรับเงินแล้ว — ผู้ขายเริ่มแพ็คสินค้า';
      await sysMsg(db, id, msg);
      if (recipients.length) await notifyUsers(db, recipients, { title: `ยืนยันรับเงิน: ${deal.title || 'ดีล'}`, body: msg, link: `/deal/${id}` });
      await syncDealLedger(db, updated as Record<string, unknown>);
      return NextResponse.json({ ok: true, deal: updated });
    }
    if (action === 'reject_payment') {
      const reason = String(note || '').slice(0, 300);
      const { data: updated } = await db.from('deals').update({
        status: 'payment_pending', payment_slip_file_id: '', payment_slip_verified_at: null, reject_reason: `[ปฏิเสธการโอน] ${reason}`,
      }).eq('id', id).select().single();
      const msg = `ศูนย์กลางปฏิเสธหลักฐานการโอน${reason ? ': ' + reason : ''} — กรุณาตรวจสอบและอัปโหลดสลิปใหม่`;
      await sysMsg(db, id, msg);
      if (deal.buyer_id) await notifyUsers(db, [deal.buyer_id], { title: `ตรวจสอบการโอน: ${deal.title || 'ดีล'}`, body: msg, link: `/deal/${id}` });
      await syncDealLedger(db, updated as Record<string, unknown>);
      return NextResponse.json({ ok: true, deal: updated });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
