#!/usr/bin/env node
// ============================================================================
// transform.mjs
// ============================================================================
// Pure local transform: reads supabase/migration/.data/*.json (produced by
// export-appwrite.mjs) and writes supabase/migration/.transformed/*.json —
// one file per Supabase table, rows ready for import-supabase.mjs.
// Touches neither Appwrite nor Supabase. Safe to re-run as many times as you
// want while you tune the mapping.
//
// IMPORTANT ASSUMPTION (flagged in supabase/SCHEMA_DESIGN.md open question #2):
// every profile gets its Supabase UUID generated HERE, now, before any
// auth.users row exists. The later auth-migration step (LINE/Google/Facebook,
// not built yet) MUST create each Supabase auth user with that exact same
// UUID (Supabase's admin "create user" endpoint accepts a caller-supplied
// `id` — this is the documented pattern for migrating users off
// Firebase/Auth0/etc). If that turns out not to work when you actually build
// the auth step, profiles.id needs to be decoupled from auth.users.id (add a
// separate auth_user_id column, rewrite RLS to join through it) — flag it
// back before doing the auth migration, don't discover it after data is in.
//
// Usage:
//   node supabase/migration/transform.mjs
// ============================================================================

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IN_DIR = join(__dirname, '.data');
const OUT_DIR = join(__dirname, '.transformed');

// ---- small helpers ---------------------------------------------------------

async function loadJson(name, fallback = []) {
  try {
    return JSON.parse(await readFile(join(IN_DIR, `${name}.json`), 'utf8'));
  } catch {
    console.warn(`  ! could not read ${name}.json — run export-appwrite.mjs first? Using empty fallback.`);
    return fallback;
  }
}

function parseJsonSafe(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v) {
  return v === true || v === 'true';
}

function isoOrNull(v) {
  return v ? new Date(v).toISOString() : null;
}

function dealCode(id) {
  // Exact port of src/lib/dealNumber.ts — DO NOT change this independently
  // of that file, or new deal numbers will diverge from old ones.
  if (!id) return '-';
  return `KKL-${String(id).slice(-8).toUpperCase()}`;
}

const warnings = [];
function warn(msg) {
  warnings.push(msg);
  console.warn(`  ! ${msg}`);
}

// ---- main -------------------------------------------------------------------

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const [
    deals, messages, dmMessages, ledger, wallets, sellerApps, mmApps, onsiteJobs,
    appConfig, profilesCollection, supportThreads, supportMessages, callSignals,
    notifications, scamReports, wantedPosts, reviews, users,
  ] = await Promise.all([
    loadJson('deals'), loadJson('messages'), loadJson('dm_messages'),
    loadJson('finance_ledger_v2'), loadJson('middleman_wallets_v2'),
    loadJson('seller_applications'), loadJson('middleman_applications'),
    loadJson('onsite_jobs'), loadJson('app_config'), loadJson('profiles'),
    loadJson('support_threads'), loadJson('support_messages'), loadJson('call_signals'),
    loadJson('notifications'), loadJson('scam_reports'), loadJson('wanted_posts'),
    loadJson('reviews'), loadJson('users'),
  ]);

  // ---- id maps: old Appwrite id -> new Supabase uuid -----------------------
  const profileMap = new Map();   // appwrite userId -> uuid
  const dealMap = new Map();
  const sellerAppMap = new Map();
  const mmAppMap = new Map();
  const onsiteMap = new Map();
  const wantedMap = new Map();

  // ============================================================================
  // PROFILES — merge Users.prefs (primary) with the `profiles` collection
  // (fallback for any field prefs left blank), one row per Appwrite user.
  // ============================================================================
  const profilesByUserId = new Map(profilesCollection.map(p => [p.userId, p]));
  const pendingLinkedTo = new Map(); // newId -> raw appwrite linkedTo id, resolved in pass 2

  const outProfiles = users.map(u => {
    const id = randomUUID();
    profileMap.set(u.id, id);
    const prefs = u.prefs || {};
    const fallback = profilesByUserId.get(u.id) || {};
    const pick = (prefsKey, fallbackKey = prefsKey) => prefs[prefsKey] ?? fallback[fallbackKey] ?? null;

    if (prefs.linkedTo) pendingLinkedTo.set(id, prefs.linkedTo);

    const ROLES = ['user', 'seller', 'middleman', 'admin'];
    const STATUSES = ['pending_review', 'approved', 'rejected'];
    const TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum'];

    return {
      id,
      role: ROLES.includes(prefs.role) ? prefs.role : 'user',
      first_name: pick('firstName'),
      last_name: pick('lastName'),
      display_name: prefs.displayName || u.name || null,
      phone: prefs.phone || u.phone || null,
      address: pick('address'),
      email: u.email || fallback.email || null,
      bank_name: prefs.bankName || null,
      bank_acct: prefs.bankAcct || prefs.accountNumber || null,
      bank_owner: prefs.bankOwner || prefs.bankAccountName || null,
      bank_qr_file_id: prefs.bankQrFileId || null,
      seller_status: STATUSES.includes(prefs.sellerStatus) ? prefs.sellerStatus : null,
      middleman_status: STATUSES.includes(prefs.middlemanStatus) ? prefs.middlemanStatus : null,
      middleman_tier_intent: TIERS.includes(prefs.middlemanTierIntent) ? prefs.middlemanTierIntent : null,
      middleman_tier: TIERS.includes(prefs.middlemanTier) ? prefs.middlemanTier : null,
      review_score: num(prefs.reviewScore, 0),
      review_count: num(prefs.reviewCount, 0),
      linked_to: null, // resolved below
      created_at: isoOrNull(u.registration) || new Date().toISOString(),
      legacy_appwrite_id: u.id,
    };
  });
  // pass 2: resolve linked_to now that every profile has a uuid
  for (const p of outProfiles) {
    const rawLinkedTo = pendingLinkedTo.get(p.id);
    if (rawLinkedTo && profileMap.has(rawLinkedTo)) p.linked_to = profileMap.get(rawLinkedTo);
  }

  const profileOf = appwriteId => profileMap.get(appwriteId) || null;

  // ============================================================================
  // DEALS + child tables (deal_price_state, deal_meetup, deal_images, deal_evidence)
  // ============================================================================
  const outDeals = [];
  const outPriceState = [];
  const outMeetup = [];
  const outImages = [];
  const outEvidence = [];

  const DEAL_STATUSES = new Set([
    'posted', 'waiting_seller', 'waiting_buyer', 'buyer_joined', 'terms_pending',
    'payment_pending', 'payment_uploaded', 'packing', 'shipped_to_middleman',
    'middleman_received', 'middleman_checking', 'shipped_to_buyer', 'delivered',
    'meetup_ready', 'completed', 'cancelled', 'disputed',
  ]);
  const FEE_PAYERS = new Set(['buyer', 'seller', 'split']);

  for (const d of deals) {
    const id = randomUUID();
    dealMap.set(d.$id, id);

    if (!DEAL_STATUSES.has(d.status)) warn(`deal ${d.$id}: unknown status "${d.status}", check manually`);

    outDeals.push({
      id,
      deal_number: dealCode(d.$id), // MUST match the code already shown to users — see header comment
      seller_id: profileOf(d.sellerId),
      seller_name: d.sellerName || null,
      middleman_id: profileOf(d.middlemanId),
      middleman_name: d.middlemanName || null,
      buyer_id: profileOf(d.buyerId),
      buyer_name: d.buyerName || null,
      title: d.title,
      description: d.description || null,
      price: num(d.price, 0),
      category: d.category || null,
      condition: d.condition || null,
      location: d.location || null,
      selling_mode: d.sellingMode || 'normal',
      status: DEAL_STATUSES.has(d.status) ? d.status : 'posted',
      source: d.source === 'listing' || d.source === 'private' ? d.source : null,
      deal_type: ['meetup', 'simple'].includes(d.dealType) ? d.dealType : 'normal',
      fee_payer: FEE_PAYERS.has(d.feePayer) ? d.feePayer : null,
      seller_accepted_terms: bool(d.sellerAcceptedTerms),
      middleman_accepted_terms: bool(d.middlemanAcceptedTerms),
      buyer_accepted_terms: bool(d.buyerAcceptedTerms),
      middleman_confirmed_payment: bool(d.middlemanConfirmedPayment),
      buyer_confirmed_check: bool(d.buyerConfirmedCheck),
      payment_slip_file_id: d.paymentSlipFileId || null,
      tracking_to_middleman: d.trackingToMiddleman || null,
      tracking_to_buyer: d.trackingToBuyer || null,
      reject_reason: d.rejectReason || null,
      wanted_post_id: null, // resolved in a second pass below if wantedMap covers it
      created_at: isoOrNull(d.createdAt) || isoOrNull(d.$createdAt) || new Date().toISOString(),
      legacy_appwrite_id: d.$id,
    });

    // priceData (DealPriceState), falling back to meetupData.priceState — mirrors readDealPriceState()
    const meetupRaw = parseJsonSafe(d.meetupData, {});
    const priceState = Object.keys(parseJsonSafe(d.priceData, {})).length
      ? parseJsonSafe(d.priceData, {})
      : (meetupRaw.priceState || {});
    if (Object.keys(priceState).length) {
      outPriceState.push({
        deal_id: id,
        proposed_price: priceState.proposedPrice ?? null,
        proposed_fee_payer: FEE_PAYERS.has(priceState.proposedFeePayer) ? priceState.proposedFeePayer : null,
        proposed_by: ['seller', 'buyer', 'middleman'].includes(priceState.proposedBy) ? priceState.proposedBy : null,
        proposal_kind: ['current', 'reprice'].includes(priceState.proposalKind) ? priceState.proposalKind : null,
        agreed: bool(priceState.agreed),
        seller_agreed: bool(priceState.sellerAgreed),
        buyer_agreed: bool(priceState.buyerAgreed),
        middleman_agreed: bool(priceState.middlemanAgreed),
        mm_deposit_held: num(priceState.mmDepositHeld, 0),
        evidence_done_seller: bool(priceState.evidenceDoneSeller),
        evidence_done_buyer: bool(priceState.evidenceDoneBuyer),
        evidence_done_middleman: bool(priceState.evidenceDoneMiddleman),
        seller_fee_slip: priceState.sellerFeeSlip || null,
        payout_sent_at: isoOrNull(priceState.payoutSentAt),
        payout_slip_file_id: priceState.payoutSlipFileId || null,
        payout_note: priceState.payoutNote || null,
        refund_sent_at: isoOrNull(priceState.refundSentAt),
        refund_slip_file_id: priceState.refundSlipFileId || null,
        refund_note: priceState.refundNote || null,
      });
    }

    // meetupData -> deal_meetup (only meaningful for dealType === 'meetup', but
    // migrate whatever is present regardless, harmless if dealType differs)
    if (Object.keys(meetupRaw).length) {
      const KNOWN = new Set([
        'v', 'buyerLoc', 'sellerLoc', 'meetLabel', 'pendingMeetLabel', 'deposit',
        'buyerDepartedAt', 'sellerDepartedAt', 'buyerPos', 'sellerPos', 'pendingDeposit',
        'pendingBy', 'buyerFee', 'sellerFee', 'buyerSlip', 'sellerSlip', 'buyerMet',
        'sellerMet', 'refundedAt', 'refundNote', 'priceState',
      ]);
      const legacyMeta = Object.fromEntries(Object.entries(meetupRaw).filter(([k]) => !KNOWN.has(k)));
      outMeetup.push({
        deal_id: id,
        buyer_loc: meetupRaw.buyerLoc || null,
        seller_loc: meetupRaw.sellerLoc || null,
        meet_label: meetupRaw.meetLabel || null,
        pending_meet_label: meetupRaw.pendingMeetLabel || null,
        deposit: num(meetupRaw.deposit, 0),
        buyer_departed_at: isoOrNull(meetupRaw.buyerDepartedAt),
        seller_departed_at: isoOrNull(meetupRaw.sellerDepartedAt),
        buyer_pos: meetupRaw.buyerPos || null,
        seller_pos: meetupRaw.sellerPos || null,
        pending_deposit: meetupRaw.pendingDeposit ?? null,
        pending_by: ['buyer', 'seller'].includes(meetupRaw.pendingBy) ? meetupRaw.pendingBy : null,
        buyer_fee: num(meetupRaw.buyerFee, 0),
        seller_fee: num(meetupRaw.sellerFee, 0),
        buyer_slip: meetupRaw.buyerSlip || null,
        seller_slip: meetupRaw.sellerSlip || null,
        buyer_met: bool(meetupRaw.buyerMet),
        seller_met: bool(meetupRaw.sellerMet),
        refunded_at: isoOrNull(meetupRaw.refundedAt),
        refund_note: meetupRaw.refundNote || null,
        legacy_meta: Object.keys(legacyMeta).length ? legacyMeta : null,
      });
    }

    // imageFileIds (JSON array string) -> deal_images
    parseJsonSafe(d.imageFileIds, []).forEach((fileId, position) => {
      outImages.push({ deal_id: id, file_id: fileId, position });
    });

    // evidenceData (JSON array string) -> deal_evidence
    parseJsonSafe(d.evidenceData, []).forEach(ev => {
      outEvidence.push({
        deal_id: id,
        type: ev.type || 'chat',
        file_id: ev.fileId || null,
        file_name: ev.fileName || null,
        content: ev.content || null,
        uploaded_by: profileOf(ev.uploadedBy),
        uploader_name: ev.uploaderName || null,
        created_at: isoOrNull(ev.at) || new Date().toISOString(),
      });
    });
  }

  // ============================================================================
  // WANTED POSTS (built before resolving deals.wanted_post_id, mirrors schema.sql order)
  // ============================================================================
  const outWanted = wantedPosts.map(w => {
    const id = randomUUID();
    wantedMap.set(w.$id, id);
    return {
      id,
      user_id: profileOf(w.userId),
      user_name: w.userName || null,
      title: w.title,
      detail: w.detail || null,
      budget_min: num(w.budgetMin, 0),
      budget_max: num(w.budgetMax, 0),
      category: w.category || null,
      province: w.province || null,
      buy_mode: ['middleman', 'direct', 'both'].includes(w.buyMode) ? w.buyMode : 'middleman',
      contact: w.contact || null,
      status: ['open', 'closed'].includes(w.status) ? w.status : 'open',
      created_at: isoOrNull(w.createdAt) || isoOrNull(w.$createdAt) || new Date().toISOString(),
      legacy_appwrite_id: w.$id,
    };
  });
  // second pass: resolve deals.wanted_post_id if the raw doc carried a wantedPostId-like field
  for (let i = 0; i < deals.length; i += 1) {
    const raw = deals[i];
    const wantedRef = raw.wantedPostId || raw.wantedId || null;
    if (wantedRef && wantedMap.has(wantedRef)) outDeals[i].wanted_post_id = wantedMap.get(wantedRef);
  }

  // ============================================================================
  // MESSAGES / DM_MESSAGES
  // ============================================================================
  const outMessages = messages.map(m => ({
    deal_id: dealMap.get(m.dealId) || null,
    sender_id: m.senderId === 'system' ? null : profileOf(m.senderId),
    sender_name: m.senderName || null,
    role: m.role === 'system' ? 'system' : 'user',
    type: ['text', 'image', 'file', 'system'].includes(m.type) ? m.type : 'text',
    content: m.content || null,
    file_id: m.fileId || null,
    file_name: m.fileName || null,
    created_at: isoOrNull(m.createdAt) || isoOrNull(m.$createdAt) || new Date().toISOString(),
    legacy_appwrite_id: m.$id,
  })).filter(m => {
    if (!m.deal_id) warn(`message ${m.legacy_appwrite_id}: unresolved deal_id, skipped`);
    return !!m.deal_id;
  });

  const outDm = dmMessages.map(m => ({
    from_id: profileOf(m.fromId),
    from_name: m.fromName || null,
    to_id: profileOf(m.toId),
    to_name: m.toName || null,
    content: m.content,
    read: bool(m.read),
    created_at: isoOrNull(m.createdAt) || isoOrNull(m.$createdAt) || new Date().toISOString(),
    legacy_appwrite_id: m.$id,
  })).filter(m => {
    if (!m.from_id || !m.to_id) warn(`dm_message ${m.legacy_appwrite_id}: unresolved from/to id, skipped`);
    return m.from_id && m.to_id;
  });

  // ============================================================================
  // FINANCE LEDGER + MIDDLEMAN WALLETS
  // ============================================================================
  function ownerTypeForEntry(entry) {
    // exact port of ownerTypeForEntry() in src/app/api/admin/finance/route.ts —
    // the Appwrite ledger never actually populated `ownerType`, so on real
    // historical rows this fallback chain IS the data, not just a default.
    if (entry.ownerType && entry.ownerType !== 'system') return entry.ownerType;
    if (entry.ownerId === 'platform') return 'platform';
    if (entry.ownerId === 'system') return 'system';
    switch (entry.entryType) {
      case 'buyer_payment': case 'buyer_refund': case 'meetup_buyer_deposit':
      case 'meetup_buyer_fee': case 'meetup_buyer_refund':
        return 'buyer';
      case 'seller_fee_payment': case 'seller_payout': case 'meetup_seller_deposit':
      case 'meetup_seller_fee': case 'meetup_seller_refund': case 'seller_registration':
        return 'seller';
      case 'middleman_fee_gross': case 'middleman_fee_net': case 'middleman_credit_hold':
      case 'middleman_registration': case 'onsite_service_fee': case 'onsite_travel_fee':
        return 'middleman';
      case 'platform_fee': case 'platform_cut':
        return 'platform';
      default:
        return 'system';
    }
  }

  function resolveLedgerReference(entry) {
    switch (entry.referenceType) {
      case 'deal': return dealMap.get(entry.referenceId) || null;
      case 'seller_application': return sellerAppMap.get(entry.referenceId) || null;
      case 'middleman_application': return mmAppMap.get(entry.referenceId) || null;
      case 'onsite_job': return onsiteMap.get(entry.referenceId) || null;
      default: return null;
    }
  }

  // seller/middleman application maps must exist before this runs — built below,
  // so finance_ledger transform is deferred until after those sections (see end of main()).

  // ============================================================================
  // SELLER / MIDDLEMAN APPLICATIONS
  // ============================================================================
  const outSellerApps = sellerApps.map(a => {
    const id = randomUUID();
    sellerAppMap.set(a.$id, id);
    return {
      id,
      user_id: profileOf(a.userId),
      seller_type: ['individual', 'corporate'].includes(a.sellerType) ? a.sellerType : 'individual',
      full_name_id: a.fullNameId,
      id_number: a.idNumber,
      province: a.province || null,
      address: a.address || null,
      online_link: a.onlineLink || null,
      company_name: a.companyName || null,
      company_reg_num: a.companyRegNum || null,
      bank_acct: a.bankAcct || null,
      bank_name: a.bankName || null,
      bank_owner: a.bankOwner || null,
      company_bank_acct: a.companyBankAcct || null,
      company_bank_name: a.companyBankName || null,
      id_card_file_id: a.idCardFileId || null,
      company_cert_file_id: a.companyCertFileId || null,
      bookbank_file_id: a.bookbankFileId || null,
      slip_file_id: a.slipFileId || null,
      status: ['pending_review', 'approved', 'rejected'].includes(a.status) ? a.status : 'pending_review',
      reject_reason: a.rejectReason || null,
      created_at: isoOrNull(a.$createdAt) || new Date().toISOString(),
      legacy_appwrite_id: a.$id,
    };
  });

  const outMmApps = mmApps.map(a => {
    const id = randomUUID();
    mmAppMap.set(a.$id, id);
    return {
      id,
      user_id: profileOf(a.userId),
      full_name_id: a.fullNameId,
      id_number: a.idNumber,
      deposit_intent: num(a.depositIntent, 0),
      tier: ['Bronze', 'Silver', 'Gold', 'Platinum'].includes(a.tier) ? a.tier : 'Bronze',
      categories: typeof a.categories === 'string' && a.categories ? a.categories.split(',').map(s => s.trim()).filter(Boolean) : [],
      work_province: a.workProvince || null,
      terms: a.terms || null,
      bank_acct: a.bankAcct || null,
      bank_name: a.bankName || null,
      bank_owner: a.bankOwner || null,
      id_card_file_id: a.idCardFileId || null,
      bookbank_file_id: a.bookbankFileId || null,
      slip_file_id: a.slipFileId || null,
      status: ['pending_review', 'approved', 'rejected'].includes(a.status) ? a.status : 'pending_review',
      reject_reason: a.rejectReason || null,
      created_at: isoOrNull(a.$createdAt) || new Date().toISOString(),
      legacy_appwrite_id: a.$id,
    };
  });

  // ============================================================================
  // ONSITE JOBS
  // ============================================================================
  const outOnsite = onsiteJobs.map(j => {
    const id = randomUUID();
    onsiteMap.set(j.$id, id);
    return {
      id,
      buyer_id: profileOf(j.buyerId),
      buyer_name: j.buyerName || null,
      item_description: j.itemDescription,
      item_price: num(j.itemPrice, 0),       // was numeric-as-string in Appwrite
      seller_location: j.sellerLocation,
      seller_province: j.sellerProvince || null,
      seller_contact: j.sellerContact || null,
      max_budget: num(j.maxBudget, 0),
      status: ['open', 'quoted', 'accepted', 'in_progress', 'completed', 'cancelled'].includes(j.status) ? j.status : 'open',
      middleman_id: profileOf(j.middlemanId),
      middleman_name: j.middlemanName || null,
      middleman_tier: ['Bronze', 'Silver', 'Gold', 'Platinum'].includes(j.middlemanTier) ? j.middlemanTier : null,
      middleman_deposit: num(j.middlemanDeposit, 0),
      travel_fee: num(j.travelFee, 0),
      service_fee: num(j.serviceFee, 0),
      estimated_arrival: j.estimatedArrival || null,
      conditions: j.conditions || null,
      quoted_at: isoOrNull(j.quotedAt),
      accepted_at: isoOrNull(j.acceptedAt),
      started_at: isoOrNull(j.startedAt),
      completed_at: isoOrNull(j.completedAt),
      report_notes: j.reportNotes || null,
      created_at: isoOrNull(j.createdAt) || isoOrNull(j.$createdAt) || new Date().toISOString(),
      legacy_appwrite_id: j.$id,
    };
  });

  // ============================================================================
  // FINANCE LEDGER (now that seller/mm/onsite maps exist) + WALLETS
  // ============================================================================
  const outLedger = ledger.map(entry => {
    const referenceId = resolveLedgerReference(entry);
    if (!referenceId) warn(`ledger ${entry.$id}: unresolved reference (${entry.referenceType}:${entry.referenceId}), skipped`);
    return {
      entry_key: entry.entryKey,
      reference_type: entry.referenceType,
      reference_id: referenceId,
      deal_id: dealMap.get(entry.dealId) || null,
      deal_number: entry.dealNumber || null,
      owner_type: ownerTypeForEntry(entry),
      owner_id: (entry.ownerId === 'platform' || entry.ownerId === 'system') ? null : profileOf(entry.ownerId),
      owner_name: entry.ownerName || null,
      entry_type: entry.entryType,
      direction: entry.direction,
      amount: Math.max(0, Math.round(num(entry.amount, 0))),
      status: entry.status,
      title: entry.title || null,
      purpose: entry.purpose || null,
      counterparty_name: entry.counterpartyName || null,
      bucket: entry.bucket || null,
      file_id: entry.fileId || null,
      approve_link: entry.approveLink || null,
      meta: parseJsonSafe(entry.meta, {}),
      active: entry.active !== false,
      created_at: isoOrNull(entry.createdAt) || new Date().toISOString(),
      updated_at: isoOrNull(entry.updatedAt) || new Date().toISOString(),
      legacy_appwrite_id: entry.$id,
    };
  }).filter(e => !!e.reference_id);

  const outWallets = wallets.map(w => ({
    middleman_id: profileOf(w.$id),
    middleman_name: w.middlemanName || null,
    tier: ['Bronze', 'Silver', 'Gold', 'Platinum'].includes(w.tier) ? w.tier : 'Bronze',
    credit_limit: num(w.creditLimit, 0),
    available_credit: num(w.availableCredit, 0),
    held_credit: num(w.heldCredit, 0),
    released_credit: num(w.releasedCredit, 0),
    penalty_credit: num(w.penaltyCredit, 0),
    active_deal_count: num(w.activeDealCount, 0),
    updated_at: isoOrNull(w.updatedAt) || new Date().toISOString(),
    legacy_appwrite_id: w.$id,
  })).filter(w => {
    if (!w.middleman_id) warn(`middleman_wallet ${w.legacy_appwrite_id}: middleman has no matching profile, skipped`);
    return !!w.middleman_id;
  });

  // ============================================================================
  // APP CONFIG -> fee_config (1 row, UPDATE not INSERT) + service_controls (8 rows)
  // ============================================================================
  const feesDoc = appConfig.find(c => c.$id === 'fees');
  const feesData = feesDoc ? parseJsonSafe(feesDoc.data, {}) : {};
  const outFeeConfig = Object.keys(feesData).length ? [{
    escrow_fee_percent: num(feesData.escrowFeePercent, 2.5),
    escrow_fee_min: num(feesData.escrowFeeMin, 20),
    middleman_fee_percent: num(feesData.middlemanFeePercent, 1.5),
    middleman_fee_min: num(feesData.middlemanFeeMin, 30),
    platform_cut_percent: num(feesData.platformCutPercent, 20),
    simple_fee_percent: num(feesData.simpleFeePercent, 2),
    simple_fee_min: num(feesData.simpleFeeMin, 20),
    inspection_fee: num(feesData.inspectionFee, 100),
    packing_fee: num(feesData.packingFee, 50),
    deposit_bronze: num(feesData.depositBronze, 1000),
    deposit_silver: num(feesData.depositSilver, 5000),
    deposit_gold: num(feesData.depositGold, 20000),
    deposit_platinum: num(feesData.depositPlatinum, 50000),
    failed_deal_fee: num(feesData.failedDealFee, 50),
    onsite_base_fee: num(feesData.onsiteBaseFee, 300),
    onsite_per_km: num(feesData.onsitePerKm, 5),
    meetup_fee_percent: num(feesData.meetupFeePercent, 0),
    meetup_fee_min: num(feesData.meetupFeeMin, 50),
    seller_reg_fee: num(feesData.sellerRegFee, 0),
    middleman_reg_fee: num(feesData.middlemanRegFee, 0),
    return_shipping_by: FEE_PAYERS.has(feesData.returnShippingBy) ? feesData.returnShippingBy : 'buyer',
    company_prompt_pay: feesData.companyPromptPay || '',
    company_bank_name: feesData.companyBankName || '',
    company_bank_acct: feesData.companyBankAcct || '',
    company_bank_holder: feesData.companyBankHolder || '',
    company_qr_file_id: feesData.companyQrFileId || '',
  }] : [];

  const controlsDoc = appConfig.find(c => c.$id === 'service_controls');
  const controlsData = controlsDoc ? parseJsonSafe(controlsDoc.data, {}) : {};
  const SERVICE_KEYS = ['tradeOnline', 'tradeSimple', 'meetupGuarantee', 'meetupSafeZone', 'consign', 'onsite', 'sellerRegistration', 'middlemanRegistration'];
  const outServiceControls = SERVICE_KEYS.map(key => ({
    key,
    enabled: controlsData[key]?.enabled !== false,
    note: controlsData[key]?.note || '',
  }));

  // ============================================================================
  // SUPPORT THREADS / MESSAGES / CALL SIGNALS / NOTIFICATIONS / SCAM REPORTS / REVIEWS
  // ============================================================================
  const outSupportThreads = supportThreads.map(t => {
    const customerId = profileOf(t.$id); // doc $id === customerId by convention
    if (!customerId) warn(`support_thread ${t.$id}: no matching profile for customer, skipped`);
    return {
      customer_id: customerId,
      customer_name: t.customerName || null,
      status: t.status === 'closed' ? 'closed' : 'open',
      last_message: t.lastMessage || null,
      last_at: isoOrNull(t.lastAt),
      last_sender: ['customer', 'staff'].includes(t.lastSender) ? t.lastSender : null,
      unread_customer: bool(t.unreadCustomer),
      unread_staff: bool(t.unreadStaff),
      assigned_staff_id: profileOf(t.assignedStaffId),
      assigned_staff_name: t.assignedStaffName || null,
      call_status: t.callStatus || 'idle',
      call_id: t.callId || null,
      call_initiator: ['customer', 'staff'].includes(t.callInitiator) ? t.callInitiator : null,
      call_staff_id: profileOf(t.callStaffId),
      call_staff_name: t.callStaffName || null,
      call_updated_at: isoOrNull(t.callUpdatedAt),
      last_read_by_customer_at: isoOrNull(t.lastReadByCustomerAt),
      last_read_by_staff_at: isoOrNull(t.lastReadByStaffAt),
      created_at: isoOrNull(t.createdAt) || new Date().toISOString(),
      legacy_appwrite_id: t.$id,
    };
  }).filter(t => !!t.customer_id);

  const outSupportMessages = supportMessages.map(m => ({
    thread_id: profileOf(m.threadId),
    sender_id: m.senderId === 'system' ? null : profileOf(m.senderId),
    sender_name: m.senderName || null,
    sender_role: ['customer', 'staff', 'system'].includes(m.senderRole) ? m.senderRole : 'customer',
    content: m.content || null,
    image_url: m.imageUrl || null,
    mime_type: m.mimeType || null,
    created_at: isoOrNull(m.createdAt) || new Date().toISOString(),
    legacy_appwrite_id: m.$id,
  })).filter(m => {
    if (!m.thread_id) warn(`support_message ${m.legacy_appwrite_id}: unresolved thread_id, skipped`);
    return !!m.thread_id;
  });

  const outCallSignals = callSignals.map(s => ({
    thread_id: profileOf(s.threadId),
    call_id: s.callId,
    from_role: ['customer', 'staff'].includes(s.fromRole) ? s.fromRole : 'customer',
    type: ['offer', 'answer', 'candidate', 'hangup', 'debug'].includes(s.type) ? s.type : 'debug',
    data: parseJsonSafe(s.data, null),
    created_at: isoOrNull(s.createdAt) || new Date().toISOString(),
    legacy_appwrite_id: s.$id,
  })).filter(s => {
    if (!s.thread_id) warn(`call_signal ${s.legacy_appwrite_id}: unresolved thread_id, skipped`);
    return !!s.thread_id;
  });

  const outNotifications = notifications.map(n => ({
    user_id: profileOf(n.userId),
    title: n.title || null,
    body: n.body || null,
    link: n.link || null,
    read: bool(n.read),
    created_at: isoOrNull(n.createdAt) || new Date().toISOString(),
    legacy_appwrite_id: n.$id,
  })).filter(n => {
    if (!n.user_id) warn(`notification ${n.legacy_appwrite_id}: unresolved user_id, skipped`);
    return !!n.user_id;
  });

  const outScamReports = scamReports.map(r => ({
    reporter_id: profileOf(r.reporterId),
    first_name: r.firstName,
    last_name: r.lastName || null,
    id_card: r.idCard || null,
    bank_accounts: parseJsonSafe(r.bankAccounts, []),
    search_blob: r.searchBlob || '',
    product: r.product || null,
    amount: num(r.amount, 0),
    transfer_date: r.transferDate || null,
    seller_page: r.sellerPage || null,
    province: r.province || null,
    detail: r.detail,
    chat_image_ids: parseJsonSafe(r.chatImageIds, []),
    police_doc_ids: parseJsonSafe(r.policeDocIds, []),
    slip_image_ids: parseJsonSafe(r.slipImageIds, []),
    contact_email: r.contactEmail || null,
    contact_phone: r.contactPhone || null,
    contact_line: r.contactLine || null,
    source_name: r.sourceName || null,
    status: ['pending_review', 'approved', 'rejected'].includes(r.status) ? r.status : 'pending_review',
    created_at: isoOrNull(r.createdAt) || new Date().toISOString(),
    legacy_appwrite_id: r.$id,
  }));

  const outReviews = reviews.map(r => ({
    deal_id: dealMap.get(r.dealId) || null,
    reviewer_id: profileOf(r.reviewerId),
    reviewer_name: r.reviewerName || null,
    reviewer_role: r.reviewerRole,
    target_id: profileOf(r.targetId),
    target_role: r.targetRole,
    rating: num(r.rating, 0),
    tags: parseJsonSafe(r.tags, []),
    comment: r.comment || null,
    created_at: isoOrNull(r.createdAt) || new Date().toISOString(),
    legacy_appwrite_id: r.$id,
  })).filter(r => {
    if (!r.deal_id || !r.reviewer_id) warn(`review ${r.legacy_appwrite_id}: unresolved deal_id/reviewer_id, skipped`);
    return !!r.deal_id && !!r.reviewer_id;
  });

  // ============================================================================
  // WRITE OUTPUT — table name matches schema.sql exactly
  // ============================================================================
  const tables = {
    profiles: outProfiles,
    wanted_posts: outWanted,
    deals: outDeals,
    deal_price_state: outPriceState,
    deal_meetup: outMeetup,
    deal_images: outImages,
    deal_evidence: outEvidence,
    messages: outMessages,
    dm_messages: outDm,
    seller_applications: outSellerApps,
    middleman_applications: outMmApps,
    onsite_jobs: outOnsite,
    finance_ledger: outLedger,
    middleman_wallets: outWallets,
    fee_config: outFeeConfig,
    service_controls: outServiceControls,
    support_threads: outSupportThreads,
    support_messages: outSupportMessages,
    call_signals: outCallSignals,
    notifications: outNotifications,
    scam_reports: outScamReports,
    reviews: outReviews,
  };

  for (const [name, rows] of Object.entries(tables)) {
    await writeFile(join(OUT_DIR, `${name}.json`), JSON.stringify(rows, null, 2));
    console.log(`  ${name}: ${rows.length} rows`);
  }
  await writeFile(join(OUT_DIR, '_warnings.json'), JSON.stringify(warnings, null, 2));

  console.log(`\n${warnings.length} warning(s) — see supabase/migration/.transformed/_warnings.json`);
  console.log('Next step: node supabase/migration/import-supabase.mjs --dry-run');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
