import { Databases, DatabasesIndexType, ID, OrderBy, Permission, Query, Role, Users } from 'node-appwrite';
import { DB_ID } from '../admin/_lib';
import { readDealPriceState } from '@/lib/dealPriceState';
import { FEE_DEFAULTS, computeDealFees, type FeeConfig, type FeeLine } from '@/lib/fees';
import {
  financeReferenceCode,
  getTierCreditLimit,
  splitDealFeeComponents,
  splitFeeByPayer,
  type LedgerDirection,
  type LedgerEntryType,
  type LedgerOwnerType,
  type LedgerReferenceType,
  type LedgerStatus,
  type MiddlemanWalletSnapshot,
} from '@/lib/financeLedger';
import { readJsonConfig } from './appConfig';

const COL_CFG = 'app_config';
export const FINANCE_LEDGER_COLLECTION_ID = 'finance_ledger_v2';
export const MIDDLEMAN_WALLET_COLLECTION_ID = 'middleman_wallets_v2';
const COL_LEDGER = FINANCE_LEDGER_COLLECTION_ID;
const COL_WALLETS = MIDDLEMAN_WALLET_COLLECTION_ID;
const COL_DEALS = 'deals';
const COL_SELLER = 'seller_applications';
const COL_MM = 'middleman_applications';
const COL_ONSITE = 'onsite_jobs';

const HELD_DEAL_STATUSES = new Set([
  'terms_pending',
  'payment_pending',
  'payment_uploaded',
  'packing',
  'shipped_to_middleman',
  'middleman_received',
  'middleman_checking',
  'shipped_to_buyer',
  'delivered',
  'meetup_ready',
  'disputed',
]);
const CONFIRMED_DEAL_STATUSES = new Set([
  'packing',
  'shipped_to_middleman',
  'middleman_received',
  'middleman_checking',
  'shipped_to_buyer',
  'delivered',
  'completed',
]);

type JsonMap = Record<string, unknown>;

export interface LedgerDoc {
  $id?: string;
  entryKey: string;
  referenceType: LedgerReferenceType;
  referenceId: string;
  dealId: string;
  dealNumber: string;
  ownerType: LedgerOwnerType;
  ownerId: string;
  ownerName: string;
  entryType: LedgerEntryType;
  direction: LedgerDirection;
  amount: number;
  status: LedgerStatus;
  title: string;
  purpose: string;
  counterpartyName: string;
  bucket: string;
  fileId: string;
  approveLink: string;
  meta: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

function text(value: unknown, max: number) {
  return String(value ?? '').slice(0, max);
}

function toJson(value: unknown, max = 3800) {
  return JSON.stringify(value || {}).slice(0, max);
}

function parseJsonMap(value: unknown): JsonMap {
  if (typeof value !== 'string' || !value) return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as JsonMap : {};
  } catch {
    return {};
  }
}

function feeSummary(lines: FeeLine[]) {
  return lines.map(line => ({ label: line.label, amount: Number(line.amount) || 0 }));
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function hasCollection(db: Databases, collectionId: string) {
  try {
    await db.getCollection(DB_ID, collectionId);
    return true;
  } catch {
    return false;
  }
}

async function waitForCollection(db: Databases, collectionId: string, maxAttempts = 40) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (await hasCollection(db, collectionId)) return;
    await sleep(500);
  }
  throw new Error(`Finance collection not ready: ${collectionId}`);
}

async function getAttributeStatus(db: Databases, collectionId: string, key: string) {
  try {
    const attr = await db.getAttribute(DB_ID, collectionId, key);
    return (attr as unknown as { status?: string }).status || 'unknown';
  } catch {
    return '';
  }
}

async function hasAttribute(db: Databases, collectionId: string, key: string) {
  return (await getAttributeStatus(db, collectionId, key)) === 'available';
}

async function waitForAttribute(db: Databases, collectionId: string, key: string, maxAttempts = 20) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (await hasAttribute(db, collectionId, key)) return;
    await sleep(500);
  }
  throw new Error(`Finance attribute not ready: ${collectionId}.${key}`);
}

async function ensureCollection(db: Databases, collectionId: string, name: string) {
  if (await hasCollection(db, collectionId)) return;
  try {
    await db.createCollection(DB_ID, collectionId, name, [
      Permission.read(Role.users()),
      Permission.write(Role.users()),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    if (!(await hasCollection(db, collectionId)) && !/already exists/i.test(message)) {
      throw new Error(`Unable to create finance collection: ${collectionId}: ${message}`);
    }
  }
  await waitForCollection(db, collectionId, 40);
}

async function ensureStringAttribute(db: Databases, collectionId: string, key: string, size: number, required = false, defaultValue = '') {
  if (await hasAttribute(db, collectionId, key)) return;
  try {
    await db.createStringAttribute(DB_ID, collectionId, key, size, required, defaultValue);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    const status = await getAttributeStatus(db, collectionId, key);
    if (status) {
      await waitForAttribute(db, collectionId, key, 40);
      return;
    }
    throw new Error(`Unable to create finance string attribute: ${collectionId}.${key}: ${message}`);
  }
  await waitForAttribute(db, collectionId, key, 40);
}

async function ensureIntegerAttribute(db: Databases, collectionId: string, key: string, min = 0, max = 999999999, defaultValue = 0) {
  if (await hasAttribute(db, collectionId, key)) return;
  try {
    await db.createIntegerAttribute(DB_ID, collectionId, key, false, min, max, defaultValue);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    const status = await getAttributeStatus(db, collectionId, key);
    if (status) {
      await waitForAttribute(db, collectionId, key, 40);
      return;
    }
    throw new Error(`Unable to create finance integer attribute: ${collectionId}.${key}: ${message}`);
  }
  await waitForAttribute(db, collectionId, key, 40);
}

async function ensureBooleanAttribute(db: Databases, collectionId: string, key: string, defaultValue = false) {
  if (await hasAttribute(db, collectionId, key)) return;
  try {
    await db.createBooleanAttribute(DB_ID, collectionId, key, false, defaultValue);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    const status = await getAttributeStatus(db, collectionId, key);
    if (status) {
      await waitForAttribute(db, collectionId, key, 40);
      return;
    }
    throw new Error(`Unable to create finance boolean attribute: ${collectionId}.${key}: ${message}`);
  }
  await waitForAttribute(db, collectionId, key, 40);
}

async function ensureIndex(db: Databases, collectionId: string, key: string, attrs: string[], orders: OrderBy[]) {
  await db.createIndex(DB_ID, collectionId, key, DatabasesIndexType.Key, attrs, orders).catch(() => {});
}

export async function ensureFinanceCollections(db: Databases) {
  await ensureCollection(db, COL_LEDGER, 'Finance Ledger');
  await ensureCollection(db, COL_WALLETS, 'Middleman Wallets');

  await ensureStringAttribute(db, COL_LEDGER, 'entryKey', 120);
  await ensureStringAttribute(db, COL_LEDGER, 'referenceType', 40);
  await ensureStringAttribute(db, COL_LEDGER, 'referenceId', 255);
  await ensureStringAttribute(db, COL_LEDGER, 'dealId', 255);
  await ensureStringAttribute(db, COL_LEDGER, 'dealNumber', 50);
  await ensureStringAttribute(db, COL_LEDGER, 'ownerType', 30);
  await ensureStringAttribute(db, COL_LEDGER, 'ownerId', 255);
  await ensureStringAttribute(db, COL_LEDGER, 'ownerName', 200);
  await ensureStringAttribute(db, COL_LEDGER, 'entryType', 50);
  await ensureStringAttribute(db, COL_LEDGER, 'direction', 20);
  await ensureIntegerAttribute(db, COL_LEDGER, 'amount');
  await ensureStringAttribute(db, COL_LEDGER, 'status', 30);
  await ensureStringAttribute(db, COL_LEDGER, 'title', 200);
  await ensureStringAttribute(db, COL_LEDGER, 'purpose', 200);
  await ensureStringAttribute(db, COL_LEDGER, 'counterpartyName', 200);
  await ensureStringAttribute(db, COL_LEDGER, 'bucket', 50);
  await ensureStringAttribute(db, COL_LEDGER, 'fileId', 255);
  await ensureStringAttribute(db, COL_LEDGER, 'approveLink', 255);
  await ensureStringAttribute(db, COL_LEDGER, 'meta', 4000);
  await ensureBooleanAttribute(db, COL_LEDGER, 'active', true);
  await ensureStringAttribute(db, COL_LEDGER, 'createdAt', 30);
  await ensureStringAttribute(db, COL_LEDGER, 'updatedAt', 30);

  await ensureStringAttribute(db, COL_WALLETS, 'middlemanId', 255);
  await ensureStringAttribute(db, COL_WALLETS, 'middlemanName', 200);
  await ensureStringAttribute(db, COL_WALLETS, 'tier', 20);
  await ensureIntegerAttribute(db, COL_WALLETS, 'creditLimit');
  await ensureIntegerAttribute(db, COL_WALLETS, 'availableCredit');
  await ensureIntegerAttribute(db, COL_WALLETS, 'heldCredit');
  await ensureIntegerAttribute(db, COL_WALLETS, 'releasedCredit');
  await ensureIntegerAttribute(db, COL_WALLETS, 'penaltyCredit');
  await ensureIntegerAttribute(db, COL_WALLETS, 'activeDealCount');
  await ensureStringAttribute(db, COL_WALLETS, 'updatedAt', 30);

  await Promise.all([
    ensureIndex(db, COL_LEDGER, 'idx_entry_key', ['entryKey'], [OrderBy.Asc]),
    ensureIndex(db, COL_LEDGER, 'idx_ref', ['referenceType', 'referenceId'], [OrderBy.Asc, OrderBy.Asc]),
    ensureIndex(db, COL_LEDGER, 'idx_deal', ['dealId'], [OrderBy.Asc]),
    ensureIndex(db, COL_LEDGER, 'idx_owner', ['ownerId'], [OrderBy.Asc]),
    ensureIndex(db, COL_LEDGER, 'idx_status', ['status'], [OrderBy.Asc]),
    ensureIndex(db, COL_LEDGER, 'idx_updated', ['updatedAt'], [OrderBy.Desc]),
    ensureIndex(db, COL_WALLETS, 'idx_middleman_wallet', ['middlemanId'], [OrderBy.Asc]),
    ensureIndex(db, COL_WALLETS, 'idx_wallet_updated', ['updatedAt'], [OrderBy.Desc]),
  ]);
}

export async function readFeesConfig(db: Databases): Promise<FeeConfig> {
  try {
    const doc = await db.getDocument(DB_ID, COL_CFG, 'fees') as unknown as { data?: string };
    return { ...FEE_DEFAULTS, ...parseJsonMap(doc.data) } as FeeConfig;
  } catch {
    return readJsonConfig(db, 'fees', FEE_DEFAULTS);
  }
}

async function findEntryByKey(db: Databases, entryKey: string) {
  const res = await db.listDocuments(DB_ID, COL_LEDGER, [Query.equal('entryKey', entryKey), Query.limit(1)]).catch(() => ({ documents: [] }));
  return res.documents[0] as unknown as LedgerDoc | undefined;
}

async function listReferenceEntries(db: Databases, referenceType: LedgerReferenceType, referenceId: string) {
  const res = await db.listDocuments(DB_ID, COL_LEDGER, [
    Query.equal('referenceType', referenceType),
    Query.equal('referenceId', referenceId),
    Query.limit(200),
  ]).catch(() => ({ documents: [] }));
  return res.documents as unknown as LedgerDoc[];
}

export async function upsertLedgerEntry(db: Databases, entry: LedgerDoc) {
  await ensureFinanceCollections(db);
  const existing = await findEntryByKey(db, entry.entryKey);
  const payload = {
    entryKey: text(entry.entryKey, 120),
    referenceType: text(entry.referenceType, 40),
    referenceId: text(entry.referenceId, 255),
    dealId: text(entry.dealId, 255),
    dealNumber: text(entry.dealNumber, 50),
    ownerId: text(entry.ownerId, 255),
    ownerName: text(entry.ownerName, 200),
    entryType: text(entry.entryType, 50),
    direction: text(entry.direction, 20),
    amount: Math.max(0, Math.round(Number(entry.amount) || 0)),
    status: text(entry.status, 30),
    title: text(entry.title, 200),
    purpose: text(entry.purpose, 200),
    counterpartyName: text(entry.counterpartyName, 200),
    bucket: text(entry.bucket, 50),
    fileId: text(entry.fileId, 255),
    approveLink: text(entry.approveLink, 255),
    meta: text(entry.meta, 4000),
    active: !!entry.active,
    createdAt: text(entry.createdAt || new Date().toISOString(), 30),
    updatedAt: text(entry.updatedAt || new Date().toISOString(), 30),
  };
  try {
    if (existing?.$id) {
      await db.updateDocument(DB_ID, COL_LEDGER, existing.$id, payload);
      return existing.$id;
    }
    const created = await db.createDocument(DB_ID, COL_LEDGER, ID.unique(), payload);
    return created.$id;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    if (!/Unknown attribute/i.test(message)) throw error;
    await ensureFinanceCollections(db);
    if (existing?.$id) {
      await db.updateDocument(DB_ID, COL_LEDGER, existing.$id, payload);
      return existing.$id;
    }
    const created = await db.createDocument(DB_ID, COL_LEDGER, ID.unique(), payload);
    return created.$id;
  }
}

async function deactivateMissingEntries(db: Databases, referenceType: LedgerReferenceType, referenceId: string, activeKeys: Set<string>) {
  const existing = await listReferenceEntries(db, referenceType, referenceId);
  await Promise.all(existing.map(async entry => {
    if (!entry.$id || activeKeys.has(entry.entryKey)) return;
    await db.updateDocument(DB_ID, COL_LEDGER, entry.$id, {
      active: false,
      status: entry.status === 'paid' || entry.status === 'released' || entry.status === 'refunded' ? entry.status : 'void',
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
  }));
}

async function getMiddlemanTier(users: Users, middlemanId: string) {
  try {
    const user = await users.get(middlemanId);
    const prefs = (user.prefs || {}) as Record<string, string>;
    return prefs.middlemanTierIntent || prefs.middlemanTier || 'Bronze';
  } catch {
    return 'Bronze';
  }
}

async function getMiddlemanName(users: Users, middlemanId: string, fallback = '') {
  try {
    const user = await users.get(middlemanId);
    const prefs = (user.prefs || {}) as Record<string, string>;
    return prefs.displayName || user.name || fallback || middlemanId;
  } catch {
    return fallback || middlemanId;
  }
}

function buildEntry(
  partial: Omit<LedgerDoc, '$id' | 'meta' | 'createdAt' | 'updatedAt'> & { meta?: unknown; createdAt?: string; updatedAt?: string },
): LedgerDoc {
  const now = new Date().toISOString();
  return {
    ...partial,
    meta: typeof partial.meta === 'string' ? partial.meta : toJson(partial.meta),
    createdAt: partial.createdAt || now,
    updatedAt: partial.updatedAt || now,
  };
}

export async function syncDealLedger(db: Databases, users: Users, deal: Record<string, unknown>, feesConfig?: FeeConfig) {
  await ensureFinanceCollections(db);
  const fees = feesConfig || await readFeesConfig(db);
  const pd = readDealPriceState({ priceData: String(deal.priceData || ''), meetupData: String(deal.meetupData || '') });
  const dealId = String(deal.$id || '');
  const dealNumber = financeReferenceCode('deal', dealId, dealId);
  const title = String(deal.title || '');
  const dealType = String(deal.dealType || '');
  const status = String(deal.status || '');
  const price = Number(deal.price) || 0;
  const feePayer = splitFeeByPayer(computeDealFees(fees, price, dealType).total, String(deal.feePayer || pd.feePayer || 'split'));
  const feeBreakdown = computeDealFees(fees, price, dealType);
  const feeParts = splitDealFeeComponents(fees, feeBreakdown.lines);
  const activeKeys = new Set<string>();

  const push = async (entry: LedgerDoc) => {
    activeKeys.add(entry.entryKey);
    await upsertLedgerEntry(db, entry);
  };

  if (dealType === 'meetup') {
    const md = parseJsonMap(deal.meetupData);
    const depositEach = Number(md.deposit ?? Math.max(Number(md.buyerDeposit || 0), Number(md.sellerDeposit || 0))) || 0;
    const buyerFee = Number(md.buyerFee || 0);
    const sellerFee = Number(md.sellerFee || 0);
    const finished = status === 'completed' || status === 'cancelled';
    const buyerDepositStatus: LedgerStatus = !md.buyerSlip ? 'expected' : finished ? (md.refundedAt ? 'refunded' : 'confirmed') : 'confirmed';
    const sellerDepositStatus: LedgerStatus = !md.sellerSlip ? 'expected' : finished ? (md.refundedAt ? 'refunded' : 'confirmed') : 'confirmed';

    if (depositEach > 0 || md.buyerSlip) {
      await push(buildEntry({
        entryKey: `deal:${dealId}:meetup:buyer:deposit`,
        referenceType: 'deal',
        referenceId: dealId,
        dealId,
        dealNumber,
        ownerType: 'buyer',
        ownerId: text(deal.buyerId, 255),
        ownerName: text(deal.buyerName, 200),
        entryType: 'meetup_buyer_deposit',
        direction: 'incoming',
        amount: depositEach,
        status: buyerDepositStatus,
        title,
        purpose: 'เงินประกันการเดินทาง (ผู้ซื้อ)',
        counterpartyName: 'ศูนย์กลาง',
        bucket: 'deal_files',
        fileId: text(md.buyerSlip, 255),
        approveLink: `/deal/${dealId}`,
        active: depositEach > 0 || !!md.buyerSlip,
        meta: { depositEach, fee: buyerFee, totalPaid: depositEach + buyerFee, dealType: 'meetup' },
      }));
    }
    if (buyerFee > 0 || md.buyerSlip) {
      await push(buildEntry({
        entryKey: `deal:${dealId}:meetup:buyer:fee`,
        referenceType: 'deal',
        referenceId: dealId,
        dealId,
        dealNumber,
        ownerType: 'platform',
        ownerId: 'platform',
        ownerName: 'ศูนย์กลาง',
        entryType: 'meetup_buyer_fee',
        direction: 'incoming',
        amount: buyerFee,
        status: !md.buyerSlip ? 'expected' : 'confirmed',
        title,
        purpose: 'ค่าบริการรับประกันการเดินทาง (ผู้ซื้อ)',
        counterpartyName: text(deal.buyerName, 200),
        bucket: 'deal_files',
        fileId: text(md.buyerSlip, 255),
        approveLink: `/deal/${dealId}`,
        active: buyerFee > 0 || !!md.buyerSlip,
        meta: { depositEach, fee: buyerFee, payer: 'buyer' },
      }));
    }
    if (depositEach > 0 || md.sellerSlip) {
      await push(buildEntry({
        entryKey: `deal:${dealId}:meetup:seller:deposit`,
        referenceType: 'deal',
        referenceId: dealId,
        dealId,
        dealNumber,
        ownerType: 'seller',
        ownerId: text(deal.sellerId, 255),
        ownerName: text(deal.sellerName, 200),
        entryType: 'meetup_seller_deposit',
        direction: 'incoming',
        amount: depositEach,
        status: sellerDepositStatus,
        title,
        purpose: 'เงินประกันการเดินทาง (ผู้ขาย)',
        counterpartyName: 'ศูนย์กลาง',
        bucket: 'deal_files',
        fileId: text(md.sellerSlip, 255),
        approveLink: `/deal/${dealId}`,
        active: depositEach > 0 || !!md.sellerSlip,
        meta: { depositEach, fee: sellerFee, totalPaid: depositEach + sellerFee, dealType: 'meetup' },
      }));
    }
    if (sellerFee > 0 || md.sellerSlip) {
      await push(buildEntry({
        entryKey: `deal:${dealId}:meetup:seller:fee`,
        referenceType: 'deal',
        referenceId: dealId,
        dealId,
        dealNumber,
        ownerType: 'platform',
        ownerId: 'platform',
        ownerName: 'ศูนย์กลาง',
        entryType: 'meetup_seller_fee',
        direction: 'incoming',
        amount: sellerFee,
        status: !md.sellerSlip ? 'expected' : 'confirmed',
        title,
        purpose: 'ค่าบริการรับประกันการเดินทาง (ผู้ขาย)',
        counterpartyName: text(deal.sellerName, 200),
        bucket: 'deal_files',
        fileId: text(md.sellerSlip, 255),
        approveLink: `/deal/${dealId}`,
        active: sellerFee > 0 || !!md.sellerSlip,
        meta: { depositEach, fee: sellerFee, payer: 'seller' },
      }));
    }
    if (finished && md.buyerSlip) {
      await push(buildEntry({
        entryKey: `deal:${dealId}:meetup:buyer:refund`,
        referenceType: 'deal',
        referenceId: dealId,
        dealId,
        dealNumber,
        ownerType: 'buyer',
        ownerId: text(deal.buyerId, 255),
        ownerName: text(deal.buyerName, 200),
        entryType: 'meetup_buyer_refund',
        direction: 'outgoing',
        amount: depositEach,
        status: md.refundedAt ? 'paid' : 'scheduled',
        title,
        purpose: 'คืนเงินประกันการเดินทาง (ผู้ซื้อ)',
        counterpartyName: 'ศูนย์กลาง',
        bucket: '',
        fileId: '',
        approveLink: '/admin/deals',
        active: depositEach > 0,
        meta: { refundNote: text(md.refundNote, 300), dealType: 'meetup' },
      }));
    }
    if (finished && md.sellerSlip) {
      await push(buildEntry({
        entryKey: `deal:${dealId}:meetup:seller:refund`,
        referenceType: 'deal',
        referenceId: dealId,
        dealId,
        dealNumber,
        ownerType: 'seller',
        ownerId: text(deal.sellerId, 255),
        ownerName: text(deal.sellerName, 200),
        entryType: 'meetup_seller_refund',
        direction: 'outgoing',
        amount: depositEach,
        status: md.refundedAt ? 'paid' : 'scheduled',
        title,
        purpose: 'คืนเงินประกันการเดินทาง (ผู้ขาย)',
        counterpartyName: 'ศูนย์กลาง',
        bucket: '',
        fileId: '',
        approveLink: '/admin/deals',
        active: depositEach > 0,
        meta: { refundNote: text(md.refundNote, 300), dealType: 'meetup' },
      }));
    }
  } else {
    const buyerPaymentAmount = price + feePayer.buyerShare;
    const sellerFeeAmount = feePayer.sellerShare;
    const buyerPaymentStatus: LedgerStatus = !deal.paymentSlipFileId
      ? (status === 'payment_pending' ? 'expected' : 'void')
      : status === 'payment_uploaded'
        ? 'pending_review'
        : status === 'cancelled' && pd.refundSentAt
          ? 'refunded'
          : CONFIRMED_DEAL_STATUSES.has(status) || status === 'cancelled'
            ? 'confirmed'
            : 'pending_review';

    if (status === 'payment_pending' || deal.paymentSlipFileId || CONFIRMED_DEAL_STATUSES.has(status) || status === 'cancelled') {
      await push(buildEntry({
        entryKey: `deal:${dealId}:buyer_payment`,
        referenceType: 'deal',
        referenceId: dealId,
        dealId,
        dealNumber,
        ownerType: 'buyer',
        ownerId: text(deal.buyerId, 255),
        ownerName: text(deal.buyerName, 200),
        entryType: 'buyer_payment',
        direction: 'incoming',
        amount: buyerPaymentAmount,
        status: buyerPaymentStatus,
        title,
        purpose: 'ค่าสินค้าและค่าบริการส่วนผู้ซื้อ',
        counterpartyName: 'ศูนย์กลาง',
        bucket: 'deal_files',
        fileId: text(deal.paymentSlipFileId, 255),
        approveLink: `/deal/${dealId}`,
        active: buyerPaymentAmount > 0,
        meta: { price, buyerFeeShare: feePayer.buyerShare, lines: feeSummary(feeBreakdown.lines), feePayer: feePayer.feePayer },
      }));
    }

    if (sellerFeeAmount > 0 || pd.sellerFeeSlip) {
      const sellerFeeStatus: LedgerStatus = !pd.sellerFeeSlip
        ? 'expected'
        : status === 'cancelled' && pd.refundSentAt
          ? 'refunded'
          : CONFIRMED_DEAL_STATUSES.has(status) || status === 'cancelled'
            ? 'confirmed'
            : 'pending_review';
      await push(buildEntry({
        entryKey: `deal:${dealId}:seller_fee`,
        referenceType: 'deal',
        referenceId: dealId,
        dealId,
        dealNumber,
        ownerType: 'seller',
        ownerId: text(deal.sellerId, 255),
        ownerName: text(deal.sellerName, 200),
        entryType: 'seller_fee_payment',
        direction: 'incoming',
        amount: sellerFeeAmount,
        status: sellerFeeStatus,
        title,
        purpose: 'ค่าบริการส่วนผู้ขาย',
        counterpartyName: 'ศูนย์กลาง',
        bucket: 'deal_files',
        fileId: text(pd.sellerFeeSlip, 255),
        approveLink: `/deal/${dealId}`,
        active: sellerFeeAmount > 0 || !!pd.sellerFeeSlip,
        meta: { sellerFeeShare: sellerFeeAmount, feePayer: feePayer.feePayer },
      }));
    }

    if (feeParts.platformFee > 0) {
      await push(buildEntry({
        entryKey: `deal:${dealId}:platform_fee`,
        referenceType: 'deal',
        referenceId: dealId,
        dealId,
        dealNumber,
        ownerType: 'platform',
        ownerId: 'platform',
        ownerName: 'ศูนย์กลาง',
        entryType: 'platform_fee',
        direction: 'incoming',
        amount: feeParts.platformFee,
        status: status === 'completed' ? 'confirmed' : status === 'cancelled' ? 'cancelled' : buyerPaymentStatus,
        title,
        purpose: dealType === 'simple' ? 'ค่าธรรมเนียมแพลตฟอร์ม (ซื้อขายผ่านกลางแบบง่าย)' : 'ค่าธรรมเนียมแพลตฟอร์ม',
        counterpartyName: `${text(deal.buyerName, 200)} / ${text(deal.sellerName, 200)}`.trim(),
        bucket: '',
        fileId: '',
        approveLink: `/deal/${dealId}`,
        active: feeParts.platformFee > 0,
        meta: {
          lines: feeSummary(feeBreakdown.lines.filter(line => line.label !== 'ค่าบริการคนกลาง')),
          platformCutFromMiddleman: feeParts.platformCutFromMiddleman,
          dealType,
        },
      }));
    }

    if (feeParts.middlemanGrossFee > 0 && deal.middlemanId) {
      await push(buildEntry({
        entryKey: `deal:${dealId}:middleman_fee_gross`,
        referenceType: 'deal',
        referenceId: dealId,
        dealId,
        dealNumber,
        ownerType: 'middleman',
        ownerId: text(deal.middlemanId, 255),
        ownerName: text(deal.middlemanName, 200),
        entryType: 'middleman_fee_gross',
        direction: 'internal',
        amount: feeParts.middlemanGrossFee,
        status: status === 'completed' ? 'confirmed' : status === 'cancelled' ? 'cancelled' : buyerPaymentStatus,
        title,
        purpose: 'ค่าบริการคนกลาง (ก่อนหักเข้าแอป)',
        counterpartyName: 'ศูนย์กลาง',
        bucket: '',
        fileId: '',
        approveLink: `/deal/${dealId}`,
        active: true,
        meta: { grossFee: feeParts.middlemanGrossFee, dealType },
      }));
      if (feeParts.platformCutFromMiddleman > 0) {
        await push(buildEntry({
          entryKey: `deal:${dealId}:platform_cut`,
          referenceType: 'deal',
          referenceId: dealId,
          dealId,
          dealNumber,
          ownerType: 'platform',
          ownerId: 'platform',
          ownerName: 'ศูนย์กลาง',
          entryType: 'platform_cut',
          direction: 'internal',
          amount: feeParts.platformCutFromMiddleman,
          status: status === 'completed' ? 'confirmed' : status === 'cancelled' ? 'cancelled' : buyerPaymentStatus,
          title,
          purpose: 'ส่วนหักเข้าแอปจากค่าบริการคนกลาง',
          counterpartyName: text(deal.middlemanName, 200),
          bucket: '',
          fileId: '',
          approveLink: `/deal/${dealId}`,
          active: true,
          meta: { grossFee: feeParts.middlemanGrossFee, cutPercent: Number(fees.platformCutPercent) || 0 },
        }));
      }
      await push(buildEntry({
        entryKey: `deal:${dealId}:middleman_fee_net`,
        referenceType: 'deal',
        referenceId: dealId,
        dealId,
        dealNumber,
        ownerType: 'middleman',
        ownerId: text(deal.middlemanId, 255),
        ownerName: text(deal.middlemanName, 200),
        entryType: 'middleman_fee_net',
        direction: 'outgoing',
        amount: feeParts.middlemanNetFee,
        status: status === 'completed' ? 'scheduled' : status === 'cancelled' ? 'cancelled' : 'expected',
        title,
        purpose: 'รายได้สุทธิของคนกลางหลังหักเข้าแอป',
        counterpartyName: 'ศูนย์กลาง',
        bucket: '',
        fileId: '',
        approveLink: `/deal/${dealId}`,
        active: feeParts.middlemanNetFee > 0,
        meta: { grossFee: feeParts.middlemanGrossFee, platformCut: feeParts.platformCutFromMiddleman },
      }));
    }

    if (status === 'completed') {
      // Seller service fees are paid as separate transfers and must not reduce the goods payout.
      const sellerPayoutAmount = Math.max(price, 0);
      await push(buildEntry({
        entryKey: `deal:${dealId}:seller_payout`,
        referenceType: 'deal',
        referenceId: dealId,
        dealId,
        dealNumber,
        ownerType: 'seller',
        ownerId: text(deal.sellerId, 255),
        ownerName: text(deal.sellerName, 200),
        entryType: 'seller_payout',
        direction: 'outgoing',
        amount: sellerPayoutAmount,
        status: pd.payoutSentAt ? 'paid' : 'scheduled',
        title,
        purpose: 'จ่ายคืนผู้ขายเมื่อดีลสำเร็จ',
        counterpartyName: 'ศูนย์กลาง',
        bucket: pd.payoutSlipFileId ? 'deal_files' : '',
        fileId: text(pd.payoutSlipFileId, 255),
        approveLink: `/deal/${dealId}`,
        active: sellerPayoutAmount > 0,
        meta: { payoutNote: text(pd.payoutNote, 300), sellerFeeShare: sellerFeeAmount, goodsPrice: price },
      }));
    }

    if (status === 'cancelled' && deal.paymentSlipFileId) {
      await push(buildEntry({
        entryKey: `deal:${dealId}:buyer_refund`,
        referenceType: 'deal',
        referenceId: dealId,
        dealId,
        dealNumber,
        ownerType: 'buyer',
        ownerId: text(deal.buyerId, 255),
        ownerName: text(deal.buyerName, 200),
        entryType: 'buyer_refund',
        direction: 'outgoing',
        amount: price,
        status: pd.refundSentAt ? 'paid' : 'scheduled',
        title,
        purpose: 'คืนเงินผู้ซื้อเมื่อยกเลิกดีล',
        counterpartyName: 'ศูนย์กลาง',
        bucket: pd.refundSlipFileId ? 'deal_files' : '',
        fileId: text(pd.refundSlipFileId, 255),
        approveLink: `/deal/${dealId}`,
        active: price > 0,
        meta: { refundNote: text(pd.refundNote, 300) },
      }));
    }
  }

  const middlemanId = text(deal.middlemanId, 255);
  if (middlemanId && Number(pd.mmDepositHeld || 0) > 0) {
    const middlemanName = await getMiddlemanName(users, middlemanId, text(deal.middlemanName, 200));
    const holdStatus: LedgerStatus = status === 'completed' || status === 'cancelled'
      ? 'released'
      : status === 'disputed'
        ? 'held'
        : HELD_DEAL_STATUSES.has(status)
          ? 'held'
          : 'expected';
    await push(buildEntry({
      entryKey: `deal:${dealId}:middleman_credit_hold`,
      referenceType: 'deal',
      referenceId: dealId,
      dealId,
      dealNumber,
      ownerType: 'middleman',
      ownerId: middlemanId,
      ownerName: middlemanName,
      entryType: 'middleman_credit_hold',
      direction: 'hold',
      amount: Number(pd.mmDepositHeld) || 0,
      status: holdStatus,
      title,
      purpose: 'เครดิตประกันคนกลางที่ hold ไว้กับดีลนี้',
      counterpartyName: 'ศูนย์กลาง',
      bucket: '',
      fileId: '',
      approveLink: `/deal/${dealId}`,
      active: true,
      meta: { dealStatus: status, disputed: status === 'disputed' },
    }));
    await syncMiddlemanWallet(db, users, middlemanId, middlemanName, undefined, fees);
  }

  await deactivateMissingEntries(db, 'deal', dealId, activeKeys);
}

export async function syncSellerApplicationLedger(db: Databases, app: Record<string, unknown>, feesConfig?: FeeConfig) {
  const fees = feesConfig || await readFeesConfig(db);
  const referenceId = String(app.$id || '');
  const amount = Number(fees.sellerRegFee) || 0;
  const activeKeys = new Set<string>();
  if (amount > 0 || app.slipFileId) {
    const status = String(app.status || '') === 'approved'
      ? 'confirmed'
      : String(app.status || '') === 'rejected'
        ? 'cancelled'
        : 'pending_review';
    const entry = buildEntry({
      entryKey: `seller-app:${referenceId}:registration`,
      referenceType: 'seller_application',
      referenceId,
      dealId: '',
      dealNumber: financeReferenceCode('seller_application', referenceId),
      ownerType: 'seller',
      ownerId: text(app.userId, 255),
      ownerName: text(app.fullNameId, 200),
      entryType: 'seller_registration',
      direction: 'incoming',
      amount,
      status,
      title: text(app.fullNameId || 'สมัครผู้ขาย', 200),
      purpose: 'ค่าสมัครผู้ขาย',
      counterpartyName: 'ศูนย์กลาง',
      bucket: 'kyc_docs',
      fileId: text(app.slipFileId, 255),
      approveLink: '/admin/sellers',
      active: true,
      meta: { sellerType: text(app.sellerType, 50) },
    });
    activeKeys.add(entry.entryKey);
    await upsertLedgerEntry(db, entry);
  }
  await deactivateMissingEntries(db, 'seller_application', referenceId, activeKeys);
}

export async function syncMiddlemanApplicationLedger(
  db: Databases,
  users: Users,
  app: Record<string, unknown>,
  feesConfig?: FeeConfig,
) {
  const fees = feesConfig || await readFeesConfig(db);
  const referenceId = String(app.$id || '');
  const amount = Number(fees.middlemanRegFee) || 0;
  const activeKeys = new Set<string>();
  if (amount > 0 || app.slipFileId) {
    const status = String(app.status || '') === 'approved'
      ? 'confirmed'
      : String(app.status || '') === 'rejected'
        ? 'cancelled'
        : 'pending_review';
    const entry = buildEntry({
      entryKey: `middleman-app:${referenceId}:registration`,
      referenceType: 'middleman_application',
      referenceId,
      dealId: '',
      dealNumber: financeReferenceCode('middleman_application', referenceId),
      ownerType: 'middleman',
      ownerId: text(app.userId, 255),
      ownerName: text(app.fullNameId, 200),
      entryType: 'middleman_registration',
      direction: 'incoming',
      amount,
      status,
      title: text(app.fullNameId || 'สมัครคนกลาง', 200),
      purpose: 'ค่าสมัครคนกลาง',
      counterpartyName: 'ศูนย์กลาง',
      bucket: 'kyc_docs',
      fileId: text(app.slipFileId, 255),
      approveLink: '/admin/middlemen',
      active: true,
      meta: { tier: text(app.tier, 20), depositIntent: Number(app.depositIntent) || 0 },
    });
    activeKeys.add(entry.entryKey);
    await upsertLedgerEntry(db, entry);
  }
  await deactivateMissingEntries(db, 'middleman_application', referenceId, activeKeys);
  if (String(app.status || '') === 'approved' && app.userId) {
    await syncMiddlemanWallet(db, users, text(app.userId, 255), text(app.fullNameId, 200), text(app.tier, 20), fees);
  }
}

export async function syncOnsiteJobLedger(db: Databases, users: Users, job: Record<string, unknown>, feesConfig?: FeeConfig) {
  const fees = feesConfig || await readFeesConfig(db);
  const referenceId = String(job.$id || '');
  const referenceCode = financeReferenceCode('onsite_job', referenceId);
  const status = String(job.status || '');
  const activeKeys = new Set<string>();
  const middlemanId = text(job.middlemanId, 255);
  const middlemanName = middlemanId ? await getMiddlemanName(users, middlemanId, text(job.middlemanName, 200)) : '';
  const travelFee = Number(job.travelFee) || 0;
  const serviceFee = Number(job.serviceFee) || 0;
  const creditHold = Number(job.middlemanDeposit) || 0;

  const push = async (entry: LedgerDoc) => {
    activeKeys.add(entry.entryKey);
    await upsertLedgerEntry(db, entry);
  };

  if (travelFee > 0 && middlemanId) {
    await push(buildEntry({
      entryKey: `onsite:${referenceId}:travel_fee`,
      referenceType: 'onsite_job',
      referenceId,
      dealId: '',
      dealNumber: referenceCode,
      ownerType: 'middleman',
      ownerId: middlemanId,
      ownerName: middlemanName,
      entryType: 'onsite_travel_fee',
      direction: 'outgoing',
      amount: travelFee,
      status: status === 'completed' ? 'scheduled' : status === 'cancelled' ? 'cancelled' : status === 'accepted' || status === 'in_progress' ? 'expected' : 'expected',
      title: text(job.itemDescription || 'งานนัดออนไซต์', 200),
      purpose: 'ค่าเดินทางคนกลาง (งานนัดออนไซต์)',
      counterpartyName: text(job.buyerName, 200),
      bucket: '',
      fileId: '',
      approveLink: `/onsite/${referenceId}`,
      active: true,
      meta: { sellerProvince: text(job.sellerProvince, 80), estimatedArrival: text(job.estimatedArrival, 40) },
    }));
  }
  if (serviceFee > 0 && middlemanId) {
    await push(buildEntry({
      entryKey: `onsite:${referenceId}:service_fee`,
      referenceType: 'onsite_job',
      referenceId,
      dealId: '',
      dealNumber: referenceCode,
      ownerType: 'middleman',
      ownerId: middlemanId,
      ownerName: middlemanName,
      entryType: 'onsite_service_fee',
      direction: 'outgoing',
      amount: serviceFee,
      status: status === 'completed' ? 'scheduled' : status === 'cancelled' ? 'cancelled' : status === 'accepted' || status === 'in_progress' ? 'expected' : 'expected',
      title: text(job.itemDescription || 'งานนัดออนไซต์', 200),
      purpose: 'ค่าบริการตรวจ/นัดออนไซต์ของคนกลาง',
      counterpartyName: text(job.buyerName, 200),
      bucket: '',
      fileId: '',
      approveLink: `/onsite/${referenceId}`,
      active: true,
      meta: { itemPrice: Number(job.itemPrice) || 0 },
    }));
  }
  if (creditHold > 0 && middlemanId) {
    await push(buildEntry({
      entryKey: `onsite:${referenceId}:credit_hold`,
      referenceType: 'onsite_job',
      referenceId,
      dealId: '',
      dealNumber: referenceCode,
      ownerType: 'middleman',
      ownerId: middlemanId,
      ownerName: middlemanName,
      entryType: 'middleman_credit_hold',
      direction: 'hold',
      amount: creditHold,
      status: status === 'accepted' || status === 'in_progress'
        ? 'held'
        : status === 'completed' || status === 'cancelled'
          ? 'released'
          : 'expected',
      title: text(job.itemDescription || 'งานนัดออนไซต์', 200),
      purpose: 'เครดิตประกันคนกลางสำหรับงานนัดออนไซต์',
      counterpartyName: 'ศูนย์กลาง',
      bucket: '',
      fileId: '',
      approveLink: `/onsite/${referenceId}`,
      active: true,
      meta: { travelFee, serviceFee, onsiteStatus: status },
    }));
    await syncMiddlemanWallet(db, users, middlemanId, middlemanName, text(job.middlemanTier, 20), fees);
  }

  await deactivateMissingEntries(db, 'onsite_job', referenceId, activeKeys);
}

export async function syncMiddlemanWallet(
  db: Databases,
  users: Users,
  middlemanId: string,
  fallbackName = '',
  tierHint?: string,
  feesConfig?: FeeConfig,
): Promise<MiddlemanWalletSnapshot> {
  await ensureFinanceCollections(db);
  const fees = feesConfig || await readFeesConfig(db);
  const tier = tierHint || await getMiddlemanTier(users, middlemanId);
  const middlemanName = await getMiddlemanName(users, middlemanId, fallbackName);
  const creditLimit = getTierCreditLimit(fees, tier);
  const entriesRes = await db.listDocuments(DB_ID, COL_LEDGER, [
    Query.equal('ownerId', middlemanId),
    Query.equal('entryType', 'middleman_credit_hold'),
    Query.limit(200),
  ]).catch(() => ({ documents: [] }));
  const entries = entriesRes.documents as unknown as Array<{ amount?: number; status?: string; active?: boolean; entryKey?: string }>;
  const activeHeld = entries.filter(entry => entry.active !== false && entry.status === 'held');
  const heldCredit = activeHeld.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  const releasedCredit = entries
    .filter(entry => entry.status === 'released')
    .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  const penaltyCredit = entries
    .filter(entry => entry.status === 'forfeited')
    .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  const wallet: MiddlemanWalletSnapshot = {
    middlemanId,
    middlemanName,
    tier,
    creditLimit,
    availableCredit: Math.max(creditLimit - heldCredit - penaltyCredit, 0),
    heldCredit,
    releasedCredit,
    penaltyCredit,
    activeDealCount: activeHeld.length,
    updatedAt: new Date().toISOString(),
  };

  try {
    await db.updateDocument(DB_ID, COL_WALLETS, middlemanId, wallet);
  } catch {
    await db.createDocument(DB_ID, COL_WALLETS, middlemanId, wallet).catch(async () => {
      const found = await db.listDocuments(DB_ID, COL_WALLETS, [Query.equal('middlemanId', middlemanId), Query.limit(1)]).catch(() => ({ documents: [] }));
      const docId = found.documents[0]?.$id;
      if (docId) await db.updateDocument(DB_ID, COL_WALLETS, docId, wallet).catch(() => {});
    });
  }

  return wallet;
}

export async function getMiddlemanWallet(db: Databases, users: Users, middlemanId: string) {
  await ensureFinanceCollections(db);
  try {
    const doc = await db.getDocument(DB_ID, COL_WALLETS, middlemanId) as unknown as MiddlemanWalletSnapshot & { $id?: string };
    return doc;
  } catch {
    return syncMiddlemanWallet(db, users, middlemanId);
  }
}

export async function listLedgerEntriesForOwner(db: Databases, ownerId: string) {
  await ensureFinanceCollections(db);
  const res = await db.listDocuments(DB_ID, COL_LEDGER, [
    Query.equal('ownerId', ownerId),
    Query.orderDesc('updatedAt'),
    Query.limit(100),
  ]).catch(() => ({ documents: [] }));
  return res.documents as unknown as LedgerDoc[];
}

export async function syncFinanceProjection(db: Databases, users: Users) {
  await ensureFinanceCollections(db);
  const fees = await readFeesConfig(db);
  const [deals, sellerApps, middlemanApps, onsiteJobs] = await Promise.all([
    db.listDocuments(DB_ID, COL_DEALS, [Query.orderDesc('createdAt'), Query.limit(200)]).then(r => r.documents).catch(() => []),
    db.listDocuments(DB_ID, COL_SELLER, [Query.orderDesc('$createdAt'), Query.limit(200)]).then(r => r.documents).catch(() => []),
    db.listDocuments(DB_ID, COL_MM, [Query.orderDesc('$createdAt'), Query.limit(200)]).then(r => r.documents).catch(() => []),
    db.listDocuments(DB_ID, COL_ONSITE, [Query.orderDesc('$createdAt'), Query.limit(200)]).then(r => r.documents).catch(() => []),
  ]);

  for (const deal of deals as Record<string, unknown>[]) {
    await syncDealLedger(db, users, deal, fees);
  }
  for (const app of sellerApps as Record<string, unknown>[]) {
    await syncSellerApplicationLedger(db, app, fees);
  }
  for (const app of middlemanApps as Record<string, unknown>[]) {
    await syncMiddlemanApplicationLedger(db, users, app, fees);
  }
  for (const job of onsiteJobs as Record<string, unknown>[]) {
    await syncOnsiteJobLedger(db, users, job, fees);
  }

  const middlemanIds = new Set<string>();
  for (const deal of deals as Record<string, unknown>[]) if (deal.middlemanId) middlemanIds.add(String(deal.middlemanId));
  for (const job of onsiteJobs as Record<string, unknown>[]) if (job.middlemanId) middlemanIds.add(String(job.middlemanId));
  for (const app of middlemanApps as Record<string, unknown>[]) if (app.userId && app.status === 'approved') middlemanIds.add(String(app.userId));
  for (const middlemanId of middlemanIds) {
    await syncMiddlemanWallet(db, users, middlemanId, '', undefined, fees);
  }
}
