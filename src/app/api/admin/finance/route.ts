import { NextRequest, NextResponse } from 'next/server';
import { Databases, Query, ID, Users } from 'node-appwrite';
import * as XLSX from 'xlsx';
import { readFile } from 'node:fs/promises';
import { verifyAdmin, getAdminClient, DB_ID } from '../../admin/_lib';
import { notifyUsers } from '../../_lib/notify';
import { readDealPriceState, writeDealPriceState, type DealPriceState } from '@/lib/dealPriceState';
import { verifySlipByUrl } from '@/lib/slipok';
import { getBankInfoMap, type BankInfo } from '@/lib/bankInfo';
import {
  FINANCE_LEDGER_COLLECTION_ID,
  readFeesConfig,
  syncDealLedger,
  syncFinanceProjection,
  type LedgerDoc,
} from '../../_lib/financeLedger';

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '';
const PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
const slipUrl = (bucket: string, fileId: string) => `${ENDPOINT}/storage/buckets/${bucket}/files/${fileId}/view?project=${PROJECT}`;

// #region debug-point A:reporter
async function reportDebug(hypothesisId: string, location: string, msg: string, data: Record<string, unknown> = {}, traceId = '') {
  let url = 'http://127.0.0.1:7777/event';
  let sessionId = 'admin-api-500';
  try {
    const env = await readFile('.dbg/admin-api-500.env', 'utf8');
    url = env.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || url;
    sessionId = env.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || sessionId;
  } catch {}
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, runId: 'pre-fix', hypothesisId, location, msg: `[DEBUG] ${msg}`, data, traceId, ts: Date.now() }),
  }).catch(() => {});
}
// #endregion

const COL_DEALS = 'deals';
const COL_MSGS = 'messages';
const COL_LEDGER = FINANCE_LEDGER_COLLECTION_ID;

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

const COL_SELLER_APPS = 'seller_applications';
const COL_MIDDLEMAN_APPS = 'middleman_applications';
const COL_ONSITE = 'onsite_jobs';
const SEARCH_SCAN_LIMIT = 5000;
const SEARCH_BATCH_SIZE = 200;

const ENTRY_TYPE_FILTERS: Record<'incoming' | 'outgoing', Record<string, string[]>> = {
  incoming: {
    all: [
      'buyer_payment',
      'seller_fee_payment',
      'meetup_buyer_deposit',
      'meetup_seller_deposit',
      'meetup_buyer_fee',
      'meetup_seller_fee',
      'seller_registration',
      'middleman_registration',
    ],
    escrow: ['buyer_payment', 'seller_fee_payment'],
    meetup: ['meetup_buyer_deposit', 'meetup_seller_deposit', 'meetup_buyer_fee', 'meetup_seller_fee'],
    reg: ['seller_registration', 'middleman_registration'],
  },
  outgoing: {
    all: [
      'seller_payout',
      'buyer_refund',
      'meetup_buyer_refund',
      'meetup_seller_refund',
      'middleman_fee_net',
      'onsite_service_fee',
      'onsite_travel_fee',
    ],
    payout: ['seller_payout', 'middleman_fee_net', 'onsite_service_fee', 'onsite_travel_fee'],
    refund: ['buyer_refund', 'meetup_buyer_refund', 'meetup_seller_refund'],
  },
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

function parseJsonArray(value: unknown) {
  if (typeof value !== 'string' || !value) return [] as unknown[];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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
    referenceCodeForRow(row),
    row.title,
    row.purpose,
    row.payer,
    row.payerName,
    row.buyerName,
    row.sellerName,
    row.middlemanName,
    row.description,
    row.location,
    row.category,
    row.condition,
    row.dealStatus,
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

function countUploads(value: unknown) {
  return parseJsonArray(value).length;
}

function feeAmountForEntry(entry: LedgerDoc, fees?: { lines: Array<{ label: string; amount: number }>; total: number }) {
  if (fees?.total) return fees.total;
  const meta = parseMeta(entry);
  return Number(
    meta.fee
    ?? meta.sellerFeeShare
    ?? meta.buyerFeeShare
    ?? meta.platformCut
    ?? meta.grossFee
    ?? 0,
  ) || 0;
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

async function loadReferenceDocs(
  db: Databases,
  collectionId: string,
  ids: string[],
): Promise<ReferenceDocMap> {
  const docs = await Promise.all(ids.map(async id => {
    try {
      const doc = await db.getDocument(DB_ID, collectionId, id);
      return [id, doc as unknown as Record<string, unknown>] as const;
    } catch {
      return null;
    }
  }));
  return Object.fromEntries(docs.filter((row): row is readonly [string, Record<string, unknown>] => !!row));
}

async function loadReferenceContext(db: Databases, ledger: LedgerDoc[]) {
  const dealIds = Array.from(new Set(ledger.filter(entry => entry.referenceType === 'deal').map(entry => entry.referenceId)));
  const sellerAppIds = Array.from(new Set(ledger.filter(entry => entry.referenceType === 'seller_application').map(entry => entry.referenceId)));
  const middlemanAppIds = Array.from(new Set(ledger.filter(entry => entry.referenceType === 'middleman_application').map(entry => entry.referenceId)));
  const onsiteIds = Array.from(new Set(ledger.filter(entry => entry.referenceType === 'onsite_job').map(entry => entry.referenceId)));

  const [deals, sellerApps, middlemanApps, onsiteJobs] = await Promise.all([
    loadReferenceDocs(db, COL_DEALS, dealIds),
    loadReferenceDocs(db, COL_SELLER_APPS, sellerAppIds),
    loadReferenceDocs(db, COL_MIDDLEMAN_APPS, middlemanAppIds),
    loadReferenceDocs(db, COL_ONSITE, onsiteIds),
  ]);

  return { deals, sellerApps, middlemanApps, onsiteJobs };
}

async function fetchLedgerEntries(
  db: Databases,
  entryTypes: string[],
  page: number,
  pageSize: number,
  search: string,
  exportMode = false,
) {
  if (!search && !exportMode) {
    const ledgerRes = await db.listDocuments(DB_ID, COL_LEDGER, [
      Query.equal('active', true),
      Query.equal('entryType', entryTypes),
      Query.orderDesc('updatedAt'),
      Query.limit(pageSize),
      Query.offset((page - 1) * pageSize),
    ]).catch(() => ({ documents: [], total: 0 }));
    const ledger = ledgerRes.documents as unknown as LedgerDoc[];
    return { ledger, total: Number((ledgerRes as { total?: number }).total || 0) };
  }

  const all: LedgerDoc[] = [];
  let offset = 0;
  let total = 0;
  while (offset < SEARCH_SCAN_LIMIT) {
    const res = await db.listDocuments(DB_ID, COL_LEDGER, [
      Query.equal('active', true),
      Query.equal('entryType', entryTypes),
      Query.orderDesc('updatedAt'),
      Query.limit(SEARCH_BATCH_SIZE),
      Query.offset(offset),
    ]).catch(() => ({ documents: [], total: 0 }));
    const documents = res.documents as unknown as LedgerDoc[];
    total = Number((res as { total?: number }).total || total);
    all.push(...documents);
    offset += documents.length;
    if (documents.length < SEARCH_BATCH_SIZE || offset >= total) break;
  }
  return { ledger: all, total: Math.min(total || all.length, SEARCH_SCAN_LIMIT) };
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

function buildRow(
  entry: LedgerDoc,
  bankMap: Record<string, BankInfo | null>,
  refs: Awaited<ReturnType<typeof loadReferenceContext>>,
): Row | null {
  const source = sourceForEntry(entry);
  if (!source) return null;
  const meta = parseMeta(entry);
  const refDoc =
    entry.referenceType === 'deal'
      ? refs.deals[entry.referenceId]
      : entry.referenceType === 'seller_application'
        ? refs.sellerApps[entry.referenceId]
        : entry.referenceType === 'middleman_application'
          ? refs.middlemanApps[entry.referenceId]
          : refs.onsiteJobs[entry.referenceId];
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
  const buyerName = String(refDoc?.buyerName || '');
  const sellerName = String(refDoc?.sellerName || '');
  const middlemanName = String(refDoc?.middlemanName || '');
  const imageCount = countUploads(refDoc?.imageFileIds);
  const evidenceCount = countUploads(refDoc?.evidenceData);
  const price = Number(meta.price ?? refDoc?.price ?? 0) || 0;
  const feeAmount = feeAmountForEntry(entry, fees);
  const detailUrl = approveLinkForEntry(entry);

  return {
    key: entry.entryKey,
    entryType: entry.entryType,
    source,
    refId: entry.referenceId,
    referenceType: entry.referenceType,
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
    approveLink: detailUrl,
    bank,
    detailUrl,
    buyerId: String(refDoc?.buyerId || ''),
    buyerName,
    sellerId: String(refDoc?.sellerId || ''),
    sellerName,
    middlemanId: String(refDoc?.middlemanId || ''),
    middlemanName,
    dealStatus: String(refDoc?.status || meta.dealStatus || ''),
    price,
    feeAmount,
    imageCount,
    attachmentCount: evidenceCount + (entry.fileId ? 1 : 0),
    hasSlip: !!entry.fileId,
    category: String(refDoc?.category || ''),
    condition: String(refDoc?.condition || ''),
    location: String(refDoc?.location || ''),
    description: String(refDoc?.description || refDoc?.itemDescription || ''),
  };
}

function buildSummary(summaryLedger: LedgerDoc[]) {
  const activeLedger = summaryLedger.filter(entry => entry.active !== false);
  const incomingEntries = activeLedger.filter(entry => ENTRY_TYPE_FILTERS.incoming.all.includes(entry.entryType));
  const outgoingEntries = activeLedger.filter(entry => ENTRY_TYPE_FILTERS.outgoing.all.includes(entry.entryType));
  const completedDealIds = new Set(
    activeLedger
      .filter(entry => entry.entryType === 'seller_payout')
      .map(entry => entry.referenceId),
  );
  const completedVolume = activeLedger.reduce((sum, entry) => {
    if (entry.entryType !== 'buyer_payment' || !completedDealIds.has(entry.referenceId)) return sum;
    const meta = parseMeta(entry);
    return sum + (Number(meta.price) || 0);
  }, 0);
  const estRevenue = activeLedger.reduce((sum, entry) => {
    if (!['platform_fee', 'platform_cut', 'meetup_buyer_fee', 'meetup_seller_fee', 'seller_registration', 'middleman_registration'].includes(entry.entryType)) {
      return sum;
    }
    if (entry.status === 'cancelled' || entry.status === 'void') return sum;
    return sum + (Number(entry.amount) || 0);
  }, 0);

  return {
    incomingCount: incomingEntries.length,
    escrowPendingCount: incomingEntries.filter(entry => entry.entryType === 'buyer_payment' && entry.status === 'pending_review').length,
    heldEscrow: activeLedger
      .filter(entry => entry.entryType === 'buyer_payment' && ['pending_review', 'confirmed'].includes(entry.status))
      .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0),
    heldMeetupDeposit: activeLedger
      .filter(entry => ['meetup_buyer_deposit', 'meetup_seller_deposit'].includes(entry.entryType) && entry.status === 'confirmed')
      .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0),
    completedVolume,
    completedCount: completedDealIds.size,
    estRevenue,
    outgoingCount: outgoingEntries.length,
    pendingPayoutAmount: activeLedger
      .filter(entry => ['seller_payout', 'middleman_fee_net', 'onsite_service_fee', 'onsite_travel_fee'].includes(entry.entryType) && entry.status !== 'paid')
      .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0),
    pendingRefundAmount: activeLedger
      .filter(entry => ['buyer_refund', 'meetup_buyer_refund', 'meetup_seller_refund'].includes(entry.entryType) && !['paid', 'refunded'].includes(entry.status))
      .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0),
  };
}

async function buildFinanceResponse(
  db: Databases,
  users: Users,
  params: { tab: FinanceTab; filter: string; page: number; pageSize: number; search: string; exportFormat?: ExportFormat | null },
) {
  const traceId = `finance-get-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let debugStage = 'start';
  const debugInfo: Record<string, unknown> = {
    tab: params.tab,
    filter: params.filter,
    page: params.page,
    pageSize: params.pageSize,
    search: params.search,
    exportFormat: params.exportFormat || '',
  };
  try {
  // #region debug-point A:build-start
  await reportDebug('A', 'src/app/api/admin/finance/route.ts:buildFinanceResponse:start', 'build finance response start', {
    tab: params.tab,
    filter: params.filter,
    page: params.page,
    pageSize: params.pageSize,
    search: params.search,
    exportFormat: params.exportFormat || '',
  }, traceId);
  // #endregion
  debugStage = 'readFeesConfig';
  const fees = await readFeesConfig(db);
  debugStage = 'summaryLedger';
  const summaryLedgerRes = await db.listDocuments(DB_ID, COL_LEDGER, [
    Query.equal('active', true),
    Query.orderDesc('updatedAt'),
    Query.limit(1000),
  ]).catch(() => ({ documents: [] }));
  const summaryLedger = summaryLedgerRes.documents as unknown as LedgerDoc[];
  // #region debug-point B:summary-ledger
  await reportDebug('B', 'src/app/api/admin/finance/route.ts:buildFinanceResponse:summary-ledger', 'fetched summary ledger entries', {
    summaryCount: summaryLedger.length,
  }, traceId);
  // #endregion
  debugInfo.summaryLedgerCount = summaryLedger.length;
  const summary = buildSummary(summaryLedger);

  if (params.tab === 'summary') {
    return {
      rows: [],
      allRows: [],
      summary,
      fees,
      pagination: {
        page: 1,
        pageSize: params.pageSize,
        total: 0,
        hasNext: false,
      },
    };
  }

  const tabKey = params.tab === 'outgoing' ? 'outgoing' : 'incoming';
  const entryTypes = ENTRY_TYPE_FILTERS[tabKey][params.filter] || ENTRY_TYPE_FILTERS[tabKey].all;
  debugInfo.entryTypes = entryTypes;
  debugStage = 'fetchLedgerEntries';
  const base = await fetchLedgerEntries(db, entryTypes, params.page, params.pageSize, params.search, !!params.exportFormat);
  // #region debug-point B:base-ledger
  await reportDebug('B', 'src/app/api/admin/finance/route.ts:buildFinanceResponse:base-ledger', 'fetched base ledger entries', {
    entryTypes,
    ledgerCount: base.ledger.length,
    total: base.total,
  }, traceId);
  // #endregion
  debugInfo.baseLedgerCount = base.ledger.length;
  debugStage = 'loadReferenceContext:base';
  const refs = await loadReferenceContext(db, base.ledger);
  const ownerIds = Array.from(new Set(
    base.ledger
      .map(entry => String(entry.ownerId || ''))
      .filter(ownerId => ownerId && ownerId !== 'platform' && ownerId !== 'system'),
  ));
  debugInfo.baseOwnerIds = ownerIds.length;
  debugStage = 'getBankInfoMap:base';
  const bankMap = await getBankInfoMap(ownerIds);
  debugStage = 'buildRows';
  const allRows = base.ledger
    .map(entry => buildRow(entry, bankMap, refs))
    .filter((row): row is Row => !!row)
    .filter(row => matchesSearch(row, params.search));
  debugInfo.allRowsCount = allRows.length;

  const pagedRows = params.exportFormat
    ? allRows
    : allRows.slice((params.page - 1) * params.pageSize, params.page * params.pageSize);
  const totalRows = params.search || params.exportFormat ? allRows.length : base.total;

  return {
    rows: pagedRows,
    allRows,
    summary,
    fees,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total: totalRows,
      hasNext: params.page * params.pageSize < totalRows,
    },
  };
  } catch (error) {
    Object.assign(error as Record<string, unknown>, {
      debugStage: `buildFinanceResponse:${debugStage}`,
      debugInfo,
    });
    throw error;
  }
}

export async function GET(req: NextRequest) {
  let debugStage = 'entry';
  const debugInfo: Record<string, unknown> = {
    searchParams: req.nextUrl.searchParams.toString(),
  };
  try {
    const traceId = `finance-route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // #region debug-point C:get-entry
    await reportDebug('C', 'src/app/api/admin/finance/route.ts:GET:entry', 'admin finance GET entry', {
      searchParams: req.nextUrl.searchParams.toString(),
    }, traceId);
    // #endregion
    debugStage = 'verifyAdmin';
    await verifyAdmin(req);
    debugStage = 'parseParams';
    const tab = (req.nextUrl.searchParams.get('tab') || 'incoming') as FinanceTab;
    const filter = req.nextUrl.searchParams.get('filter') || 'all';
    const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(20, Number(req.nextUrl.searchParams.get('pageSize')) || 50));
    const search = String(req.nextUrl.searchParams.get('search') || '').trim();
    const exportFormat = req.nextUrl.searchParams.get('format') as ExportFormat | null;
    Object.assign(debugInfo, { tab, filter, page, pageSize, search, exportFormat: exportFormat || '' });
    debugStage = 'getAdminClient';
    const client = getAdminClient();
    debugStage = 'constructServices';
    const db = new Databases(client);
    const users = new Users(client);
    debugStage = 'buildFinanceResponse';
    const data = await buildFinanceResponse(db, users, { tab, filter, page, pageSize, search, exportFormat });

    if (exportFormat === 'csv' || exportFormat === 'xlsx') {
      debugStage = 'export';
      const records = exportRows(data.allRows);
      const worksheet = XLSX.utils.json_to_sheet(records);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Finance');
      const now = new Date().toISOString().slice(0, 10);
      const fileBase = `finance-${tab}-${filter}-${now}`;
      if (exportFormat === 'csv') {
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        return new NextResponse(`\uFEFF${csv}`, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${fileBase}.csv"`,
          },
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

    return NextResponse.json({
      rows: data.rows,
      summary: data.summary,
      fees: data.fees,
      pagination: data.pagination,
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; debugStage?: string; debugInfo?: Record<string, unknown> };
    // #region debug-point D:get-error
    await reportDebug('D', 'src/app/api/admin/finance/route.ts:GET:catch', 'admin finance GET failed', {
      status: e.status ?? 500,
      message: e.message ?? 'error',
      stack: err instanceof Error ? err.stack : String(err),
      debugStage: e.debugStage || debugStage,
      debugInfo: e.debugInfo || debugInfo,
    });
    // #endregion
    return NextResponse.json({
      error: e.message ?? 'error',
      debugStage: e.debugStage || debugStage,
      debugInfo: e.debugInfo || debugInfo,
      debugName: err instanceof Error ? err.name : typeof err,
      debugStack: err instanceof Error ? err.stack : String(err),
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

    if (action === 'refresh_projection') {
      await syncFinanceProjection(db, users);
      return NextResponse.json({ ok: true });
    }

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
        if (!fileId) return NextResponse.json({ error: 'กรุณาแนบสลิปหลักฐานการโอนให้ผู้ขาย' }, { status: 400 });
        pd.payoutSentAt = now;
        pd.payoutSlipFileId = String(fileId);
        pd.payoutNote = String(note || '').slice(0, 300);
      } else {
        if (!fileId) return NextResponse.json({ error: 'กรุณาแนบสลิปหลักฐานการคืนเงินให้ผู้ซื้อ' }, { status: 400 });
        pd.refundSentAt = now;
        pd.refundSlipFileId = String(fileId);
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
