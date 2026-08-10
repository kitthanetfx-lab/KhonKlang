'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { Handshake, Loader2, AlertTriangle, CheckCircle2, ExternalLink, RotateCcw, Trash2, Banknote, XCircle } from 'lucide-react';
import { dealCode } from '@/lib/dealNumber';
import { FeeConfig, FEE_DEFAULTS, computeDealFees, computeSimpleDealShare, simpleCreatorSide, SIMPLE_CREATOR_SIDE_LABEL, type SimpleDealShareBreakdown } from '@/lib/fees';
import { splitDealFeeComponents } from '@/lib/financeLedger';
import { buildTrackingUrl, getLogisticsProviderLabel } from '@/lib/logistics';
import { ADMIN_DEAL_CATEGORIES, type AdminDealCategory, parseAdminDealCategory } from '@/lib/adminDealCategory';

const fileUrl = (id: string) => fileViewUrl(DEAL_BUCKET, id);

interface DealMeetup {
  deposit: number; refunded_at?: string; buyer_met: boolean; seller_met: boolean;
  buyer_slip?: string; seller_slip?: string;
  buyer_slip_verified_at?: string; seller_slip_verified_at?: string;
  refund_outcome?: 'buyer_all' | 'seller_all' | 'both' | 'frozen';
  buyer_refund_slip?: string; seller_refund_slip?: string;
  refund_decision_note?: string;
}
interface DealPriceState {
  proposed_fee_payer?: 'buyer' | 'seller' | 'split';
  seller_fee_slip?: string; seller_fee_slip_verified_at?: string; payout_slip_file_id?: string; refund_slip_file_id?: string;
  middleman_fee_sent_at?: string; middleman_fee_slip_file_id?: string;
}
interface BankInfo { bankName: string; bankAcct: string; bankOwner: string; }
interface Deal {
  id: string; title: string; price: number; status: string; deal_type?: string;
  buyer_name: string; seller_name: string; middleman_name: string; middleman_id?: string;
  buyer_id?: string; seller_id?: string;
  creator_id?: string;
  creatorProfile?: { display_name?: string; seller_status?: string; middleman_status?: string } | null;
  reject_reason: string; created_at: string;
  fee_payer?: 'buyer' | 'seller' | 'split';
  payment_slip_file_id?: string; payment_slip_verified_at?: string;
  tracking_to_middleman?: string; tracking_to_middleman_provider?: string;
  tracking_to_buyer?: string; tracking_to_buyer_provider?: string;
  meetup?: DealMeetup | null;
  priceState?: DealPriceState | null;
  evidence?: EvidenceItem[];
  reviews?: DealReview[];
  buyerBank?: BankInfo | null;
  sellerBank?: BankInfo | null;
  middlemanBank?: BankInfo | null;
}

interface EvidenceItem {
  id: string;
  type: string;
  file_id: string;
  file_name?: string;
  uploader_name?: string;
  uploaded_by?: string;
}

interface DealReview {
  id: string;
  reviewer_name?: string;
  reviewer_role: string;
  target_role: string;
  rating: number;
  tags?: string[];
  comment?: string;
  created_at: string;
}

interface OnsiteJob {
  id: string;
  item_description: string;
  item_price?: string;
  max_budget?: string;
  status: string;
  buyer_name?: string;
  seller_province?: string;
  seller_location?: string;
  middleman_name?: string;
  middleman_tier?: string;
  middleman_deposit?: string;
  travel_fee?: string;
  service_fee?: string;
  report_notes?: string;
  created_at: string;
}

const ONSITE_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  open: { label: 'เปิดรับงาน', cls: 'bg-green-100 text-green-700' },
  quoted: { label: 'มีใบเสนอราคา', cls: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'รับงานแล้ว', cls: 'bg-indigo-100 text-indigo-700' },
  in_progress: { label: 'กำลังทำงาน', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: 'เสร็จสมบูรณ์', cls: 'bg-teal-100 text-teal-700' },
  cancelled: { label: 'ยกเลิก', cls: 'bg-gray-100 text-gray-600' },
};

const CATEGORY_KEYS = new Set(ADMIN_DEAL_CATEGORIES.map(c => c.k));

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  disputed:   { label: 'มีปัญหา/ข้อพิพาท', cls: 'bg-red-100 text-red-700' },
  completed:  { label: 'เสร็จสมบูรณ์', cls: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'ยกเลิก', cls: 'bg-gray-100 text-gray-600' },
  meetup_ready: { label: 'พร้อมนัดเจอ', cls: 'bg-blue-100 text-blue-700' },
  payment_pending: { label: 'รอโอนเงิน', cls: 'bg-amber-100 text-amber-700' },
  payment_uploaded: { label: 'รอศูนย์กลางยืนยันรับเงิน', cls: 'bg-amber-100 text-amber-700' },
};

const TABS = [
  { k: 'active', label: 'กำลังดำเนินการ' },
  { k: 'confirm_pay', label: '⚡ ยืนยันรับเงิน' },
  { k: 'pay_seller', label: '💰 โอนเงินค่าสินค้า' },
  { k: 'refund_pending', label: '🔄 คืนเงินผู้ซื้อ' },
  { k: 'middleman_fee', label: '💼 โอนเงินค่าคนกลาง' },
  { k: 'meetup_refund', label: '💸 คืนเงินประกัน' },
  { k: 'disputed', label: '⚠️ ข้อพิพาท' },
  { k: 'completed', label: 'สำเร็จ' },
];

const TAB_KEYS = new Set(TABS.map(t => t.k));

function AdminDealsInner() {
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const categoryFromUrl = searchParams.get('category');
  const [category, setCategory] = useState<AdminDealCategory>(() => {
    const parsed = parseAdminDealCategory(categoryFromUrl);
    return CATEGORY_KEYS.has(parsed) ? parsed : 'trade';
  });
  const [tab, setTab] = useState(() => (tabFromUrl && TAB_KEYS.has(tabFromUrl) ? tabFromUrl : 'active'));
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [onsiteJobs, setOnsiteJobs] = useState<OnsiteJob[] | null>(null);
  const [acting, setActing] = useState('');
  const [fees, setFees] = useState<FeeConfig>(FEE_DEFAULTS);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const loadCounts = useCallback(async (cat: AdminDealCategory) => {
    try {
      const headers = await authHeaders();
      const r = await fetch(`/api/admin/deals?filter=counts&category=${cat}`, { headers });
      const d = await r.json();
      if (d.counts) setCounts(d.counts);
    } catch { /* ไม่ต้อง alert */ }
  }, []);

  useEffect(() => {
    void loadCounts(category);
    const t = window.setInterval(() => void loadCounts(category), 30000);
    return () => window.clearInterval(t);
  }, [loadCounts, category]);

  useEffect(() => {
    const parsed = parseAdminDealCategory(categoryFromUrl);
    if (categoryFromUrl && CATEGORY_KEYS.has(parsed)) setCategory(parsed);
  }, [categoryFromUrl]);

  useEffect(() => { fetch('/api/fees').then(r => r.json()).then(d => { if (d.fees) setFees(d.fees); }).catch(() => {}); }, []);

  function middlemanNetFee(d: Deal) {
    const fb = computeDealFees(fees, d.price, d.deal_type);
    const parts = splitDealFeeComponents(fees, fb.lines);
    return parts.middlemanNetFee;
  }

  function simpleShareOf(d: Deal): SimpleDealShareBreakdown | null {
    if (d.deal_type !== 'simple') return null;
    return computeSimpleDealShare(fees, d.price, {
      sellerStatus: d.creatorProfile?.seller_status,
      middlemanStatus: d.creatorProfile?.middleman_status,
    });
  }

  function renderSimpleSharePanel(d: Deal) {
    const share = simpleShareOf(d);
    if (!share) return null;
    const creatorSide = simpleCreatorSide(d);
    const creatorSideLabel = SIMPLE_CREATOR_SIDE_LABEL[creatorSide];
    return (
      <div className="mt-2 rounded-xl border border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-900 px-3 py-2 text-xs space-y-1">
        <p className="font-semibold text-orange-800 dark:text-orange-200">💼 ค่าสินค้า + คอมมิชชั่น</p>
        {d.creator_id && (
          <p className="text-gray-600 dark:text-gray-300">
            ผู้สร้างดีล: <span className="font-semibold">{creatorSideLabel}</span>
            {d.creatorProfile?.display_name ? ` · ${d.creatorProfile.display_name}` : ''}
          </p>
        )}
        <p className="text-gray-600 dark:text-gray-300">ค่าสินค้า: <span className="font-mono font-semibold">฿{Number(d.price || 0).toLocaleString()}</span></p>
        {share.creatorEligible ? (
          share.shareTier > 0 ? (
            <p className="text-emerald-700 dark:text-emerald-300">
              คอมมิชชั่น ชั้น {share.shareTier} ({share.shareTierMultiplier}× ค่ากลาง · {share.sharePercent}%):{' '}
              <span className="font-mono font-semibold">฿{share.creatorShare.toLocaleString()}</span>
            </p>
          ) : (
            <p className="text-gray-500">คอมมิชชั่น: ค่าบริการ ฿{share.totalFee.toLocaleString()} ยังไม่ถึงชั้นขั้นต่ำ</p>
          )
        ) : (
          <p className="text-gray-500">คอมมิชชั่น: ไม่มีสิทธิ์ (ผู้สร้างดีลยังไม่ลงทะเบียนผู้ขาย+คนกลางครบ)</p>
        )}
      </div>
    );
  }

  function formatDealCreatedAt(iso?: string) {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return iso;
    }
  }

  const load = useCallback(async (filter: string, cat: AdminDealCategory) => {
    setDeals(null);
    setOnsiteJobs(null);
    try {
      const headers = await authHeaders();
      const r = await fetch(`/api/admin/deals?filter=${filter}&category=${cat}`, { headers });
      const d = await r.json();
      if (d.kind === 'onsite') setOnsiteJobs(d.documents || []);
      else setDeals(d.documents || []);
    } catch {
      setDeals([]);
      setOnsiteJobs([]);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(tab, category); }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, category, load]);

  async function act(id: string, action: string, promptMsg?: string) {
    let note = '';
    if (promptMsg) { const v = window.prompt(promptMsg); if (v === null) return; note = v; }
    setActing(id);
    try {
      const headers = await authHeaders();
      const r = await fetch('/api/admin/deals', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, note }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) load(tab, category);
      else alert(d.error || `บันทึกไม่สำเร็จ (${r.status})`);
    } finally { setActing(''); }
  }

  // ข้อ3: ลบดีลถาวร (พร้อมไฟล์สลิป + ข้อมูลทุกตาราง)
  async function del(id: string) {
    if (!window.confirm('ลบดีลนี้ถาวร?\nจะลบข้อมูลและรูปสลิปทั้งหมดที่เกี่ยวข้อง — กู้คืนไม่ได้')) return;
    setActing(id);
    try {
      const headers = await authHeaders();
      const r = await fetch('/api/admin/deals', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'delete_deal' }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { load(tab, category); loadCounts(category); } else alert(d.error || `ลบไม่สำเร็จ (${r.status})`);
    } finally { setActing(''); }
  }

  // ข้อ5: ศูนย์กลางตรวจสลิปเงินประกันรายฝ่าย
  async function verifySlip(id: string, side: 'buyer' | 'seller', ok: boolean) {
    let note = '';
    if (!ok) { const v = window.prompt(`เหตุผลที่สลิป${side === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย'}ไม่ถูกต้อง (ระบบจะถอยให้อีกฝ่ายวางใหม่):`); if (v === null) return; note = v; }
    setActing(id);
    try {
      const headers = await authHeaders();
      const r = await fetch('/api/admin/deals', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'verify_meetup_slip', whichSlip: side, ok, note }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { load(tab, category); loadCounts(category); } else alert(d.error || `บันทึกไม่สำเร็จ (${r.status})`);
    } finally { setActing(''); }
  }

  function needsSellerFeeSlip(d: Deal) {
    const feePayer = d.priceState?.proposed_fee_payer || d.fee_payer || 'split';
    return d.deal_type !== 'meetup' && (feePayer === 'seller' || feePayer === 'split');
  }

  async function verifyNormalSlip(id: string, side: 'buyer' | 'seller', ok: boolean) {
    let note = '';
    if (!ok) {
      const v = window.prompt(`เหตุผลที่สลิป${side === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย'}ไม่ถูกต้อง:`);
      if (v === null) return;
      note = v;
    }
    setActing(id);
    try {
      const headers = await authHeaders();
      const r = await fetch('/api/admin/deals', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'verify_payment_slip', whichSlip: side, ok, note }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { load(tab, category); loadCounts(category); } else alert(d.error || `บันทึกไม่สำเร็จ (${r.status})`);
    } finally { setActing(''); }
  }

  function pickSlipFile() {
    return new Promise<File | null>(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,.pdf';
      input.onchange = () => resolve(input.files?.[0] || null);
      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  async function markMoneySent(id: string, action: 'mark_payout_sent' | 'mark_refund_sent' | 'mark_middleman_fee_sent') {
    setActing(id);
    try {
      const file = await pickSlipFile();
      if (!file) return;
      const promptMsg = action === 'mark_payout_sent'
        ? 'โอนเงินให้ผู้ขายแล้ว — ใส่บันทึกช่วยจำ (เช่น เลขอ้างอิงการโอน) ได้ถ้าต้องการ:'
        : action === 'mark_refund_sent'
        ? 'คืนเงินให้ผู้ซื้อแล้ว — ใส่บันทึกช่วยจำ (เช่น เลขอ้างอิงการโอน) ได้ถ้าต้องการ:'
        : 'โอนค่าบริการให้คนกลางแล้ว — ใส่บันทึกช่วยจำ (เช่น เลขอ้างอิงการโอน) ได้ถ้าต้องการ:';
      const note = window.prompt(promptMsg, '');
      if (note === null) return;
      const headers = await authHeaders();
      const form = new FormData();
      form.append('file', file);
      const upRes = await fetch('/api/upload-deal', { method: 'POST', headers, body: form });
      const upData = await upRes.json();
      if (!upRes.ok) { alert(upData.error || 'อัปโหลดสลิปไม่สำเร็จ'); return; }
      const r = await fetch('/api/admin/finance', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, note, fileId: upData.fileId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { alert(d.error || 'บันทึกไม่สำเร็จ'); return; }
      load(tab, category);
    } finally { setActing(''); }
  }

  async function markMeetupRefund(id: string, outcome: 'buyer_all' | 'seller_all' | 'both' | 'frozen', whichSlip?: 'buyer' | 'seller') {
    setActing(id);
    try {
      let fileId = '';
      let note = '';
      if (outcome === 'frozen') {
        const v = window.prompt('เหตุผลที่อยัดเงินประกัน (เช่น กรณีพิพาท):');
        if (v === null) return;
        note = v;
      } else {
        const file = await pickSlipFile();
        if (!file) return;
        const slipTarget = outcome === 'buyer_all' ? 'ผู้ซื้อ (ทั้งหมด)'
          : outcome === 'seller_all' ? 'ผู้ขาย (ทั้งหมด)'
          : whichSlip === 'buyer' ? 'ผู้ซื้อ (แยกฝ่าย)'
          : 'ผู้ขาย (แยกฝ่าย)';
        const v = window.prompt(`สลิปโอนเงินให้${slipTarget} — ใส่บันทึก (เช่น เลขอ้างอิง) ได้ถ้าต้องการ:`, '');
        if (v === null) return;
        note = v;
        const headers = await authHeaders();
        const form = new FormData(); form.append('file', file);
        const upRes = await fetch('/api/upload-deal', { method: 'POST', headers, body: form });
        const upData = await upRes.json();
        if (!upRes.ok) { alert(upData.error || 'อัปโหลดสลิปไม่สำเร็จ'); return; }
        fileId = upData.fileId;
      }
      const headers = await authHeaders();
      const r = await fetch('/api/admin/deals', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'mark_meetup_refund', outcome, fileId: fileId || undefined, whichSlip, note }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { alert(data.error || 'บันทึกไม่สำเร็จ'); return; }
      load(tab, category);
    } finally { setActing(''); }
  }

  function statusBadge(d: Deal) {
    if (d.status === 'completed' && d.deal_type === 'meetup' && !d.meetup?.refund_outcome) {
      return { label: '⏳ รอตัดสินคืนเงินประกัน', cls: 'bg-amber-100 text-amber-700' };
    }
    if (d.status === 'completed' && d.deal_type !== 'meetup' && !d.priceState?.payout_slip_file_id) {
      return { label: '⏳ รอโอนเงินให้ผู้ขาย', cls: 'bg-amber-100 text-amber-700' };
    }
    if (d.status === 'cancelled' && d.deal_type !== 'meetup' && d.payment_slip_file_id && !d.priceState?.refund_slip_file_id) {
      return { label: '⏳ รอคืนเงินผู้ซื้อ', cls: 'bg-amber-100 text-amber-700' };
    }
    return STATUS_LABEL[d.status] || { label: d.status, cls: 'bg-gray-100 text-gray-600' };
  }

  function refundInfo(d: Deal) {
    if (d.deal_type !== 'meetup' || !d.meetup) return null;
    const md = d.meetup;
    const OUTCOME_LABEL: Record<string, string> = {
      buyer_all: 'โอนให้ผู้ซื้อทั้งหมด', seller_all: 'โอนให้ผู้ขายทั้งหมด',
      both: 'คืนให้ทั้งสองฝ่าย', frozen: 'อายัดไว้',
    };
    return {
      deposit: md.deposit || 0,
      refundedAt: md.refunded_at,
      bothMet: md.buyer_met && md.seller_met,
      outcome: md.refund_outcome,
      outcomeLabel: md.refund_outcome ? OUTCOME_LABEL[md.refund_outcome] : undefined,
      buyerSlipDone: !!md.buyer_refund_slip,
      sellerSlipDone: !!md.seller_refund_slip,
    };
  }

  function slipsOf(d: Deal): { label: string; fileId: string }[] {
    const slips: { label: string; fileId: string }[] = [];
    if (d.payment_slip_file_id) slips.push({ label: 'สลิปผู้ซื้อ (ค่าสินค้า)', fileId: d.payment_slip_file_id });
    const pd = d.priceState;
    if (pd?.seller_fee_slip) slips.push({ label: 'สลิปผู้ขาย (ค่าบริการ)', fileId: pd.seller_fee_slip });
    if (pd?.payout_slip_file_id) slips.push({ label: 'สลิปศูนย์กลางโอนให้ผู้ขาย', fileId: pd.payout_slip_file_id });
    if (pd?.refund_slip_file_id) slips.push({ label: 'สลิปศูนย์กลางคืนให้ผู้ซื้อ', fileId: pd.refund_slip_file_id });
    if (pd?.middleman_fee_slip_file_id) slips.push({ label: 'สลิปศูนย์กลางโอนค่าบริการให้คนกลาง', fileId: pd.middleman_fee_slip_file_id });
    if (d.deal_type === 'meetup' && d.meetup) {
      if (d.meetup.buyer_slip) slips.push({ label: 'สลิปผู้ซื้อ (เงินประกัน)', fileId: d.meetup.buyer_slip });
      if (d.meetup.seller_slip) slips.push({ label: 'สลิปผู้ขาย (เงินประกัน)', fileId: d.meetup.seller_slip });
      if (d.meetup.buyer_refund_slip) slips.push({ label: 'สลิปคืนเงินประกันให้ผู้ซื้อ', fileId: d.meetup.buyer_refund_slip });
      if (d.meetup.seller_refund_slip) slips.push({ label: 'สลิปคืนเงินประกันให้ผู้ขาย', fileId: d.meetup.seller_refund_slip });
    }
    return slips;
  }

  function parcelTrackingOf(d: Deal): Array<{ label: string; provider: string; trackingNumber: string; url: string }> {
    const rows: Array<{ label: string; provider: string; trackingNumber: string; url: string }> = [];
    if (d.tracking_to_middleman) {
      rows.push({
        label: 'ผู้ขาย → คนกลาง',
        provider: getLogisticsProviderLabel(d.tracking_to_middleman_provider),
        trackingNumber: d.tracking_to_middleman,
        url: buildTrackingUrl(d.tracking_to_middleman_provider, d.tracking_to_middleman),
      });
    }
    if (d.tracking_to_buyer) {
      rows.push({
        label: `${d.deal_type === 'simple' ? 'ผู้ขาย' : 'คนกลาง'} → ผู้ซื้อ`,
        provider: getLogisticsProviderLabel(d.tracking_to_buyer_provider),
        trackingNumber: d.tracking_to_buyer,
        url: buildTrackingUrl(d.tracking_to_buyer_provider, d.tracking_to_buyer),
      });
    }
    return rows;
  }

  function parcelEvidenceOf(d: Deal) {
    const typeLabel: Record<string, string> = {
      packing: 'หลักฐานแพ็คสินค้า',
      receive: 'หลักฐานรับสินค้า',
      testing: 'หลักฐานทดสอบสินค้า',
      check: 'หลักฐานตรวจสินค้า',
      inspection: 'หลักฐานตรวจสินค้า',
      chat: 'หลักฐานจากแชท',
      call: 'บันทึกวิดีโอคอล',
      meet: 'หลักฐานการเจอกัน',
      other: 'หลักฐาน',
      chat_text: 'ประวัติการสนทนา',
    };
    const partyLabel = (item: EvidenceItem) => {
      if (item.uploaded_by && item.uploaded_by === (d as Deal & { buyer_id?: string }).buyer_id) return 'ผู้ซื้อ';
      if (item.uploaded_by && item.uploaded_by === (d as Deal & { seller_id?: string }).seller_id) return 'ผู้ขาย';
      if (item.uploader_name) return item.uploader_name;
      return 'ไม่ระบุ';
    };
    return (d.evidence || [])
      .filter(item => !!item.file_id)
      .map(item => ({
        ...item,
        label: `${typeLabel[item.type] || 'หลักฐาน'} (${partyLabel(item)})`,
      }));
  }

  function reviewSummaryOf(d: Deal) {
    const reviews = d.reviews || [];
    const count = reviews.length;
    const average = count ? reviews.reduce((sum, item) => sum + (Number(item.rating) || 0), 0) / count : 0;
    return { reviews, count, average: Number(average.toFixed(1)) };
  }

  function roleLabel(role: string) {
    if (role === 'buyer') return 'ผู้ซื้อ';
    if (role === 'seller') return 'ผู้ขาย';
    if (role === 'middleman') return 'คนกลาง';
    if (role === 'platform') return 'แพลตฟอร์ม';
    return role || '-';
  }

  async function onsiteAct(id: string, action: string, promptMsg: string) {
    const note = window.prompt(promptMsg);
    if (note === null) return;
    setActing(id);
    try {
      const headers = await authHeaders();
      const r = await fetch('/api/admin/onsite-jobs', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, note }),
      });
      if (r.ok) { load(tab, category); loadCounts(category); }
    } finally { setActing(''); }
  }

  const activeCategoryMeta = ADMIN_DEAL_CATEGORIES.find(c => c.k === category);
  const isOnsite = category === 'onsite';
  const isLoading = isOnsite ? onsiteJobs === null : deals === null;
  const isEmpty = isOnsite ? (onsiteJobs !== null && onsiteJobs.length === 0) : (deals !== null && deals.length === 0);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-1">
        <Handshake size={22} className="text-blue-600" />
        <h1 className="text-xl font-bold">ดีล & ข้อพิพาท</h1>
      </div>
      <p className="text-sm text-gray-500 mb-4">แยกหมวดดีล — ประกาศขายที่ยังไม่เริ่มซื้อขายจะไม่แสดงที่นี่</p>

      <div className="flex gap-2 mb-4 flex-wrap">
        {ADMIN_DEAL_CATEGORIES.map(c => (
          <button key={c.k} type="button" onClick={() => { setCategory(c.k); setTab('active'); }}
            className={`px-3 py-2 rounded-xl text-sm font-semibold transition-all ${category === c.k ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'}`}>
            {c.label}
          </button>
        ))}
      </div>
      {activeCategoryMeta && <p className="text-xs text-gray-500 mb-4">{activeCategoryMeta.desc}</p>}

      <div className="flex gap-2 mb-5 flex-wrap">
        {TABS.map(t => {
          const cnt = counts[t.k] ?? 0;
          const isActive = tab === t.k;
          return (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`relative px-4 py-2 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'}`}>
              {t.label}
              {cnt > 0 && (
                <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold leading-none ${isActive ? 'bg-white text-blue-600' : 'bg-red-500 text-white'}`}>
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>}
      {isEmpty && (
        <div className="text-center py-16 text-gray-400"><CheckCircle2 size={36} className="mx-auto mb-2 opacity-40" /><p>ไม่มีรายการในหมวดนี้</p></div>
      )}

      {isOnsite && onsiteJobs && onsiteJobs.length > 0 && (
        <div className="space-y-3">
          {onsiteJobs.map(j => {
            const st = ONSITE_STATUS_LABEL[j.status] || { label: j.status, cls: 'bg-gray-100 text-gray-600' };
            const canCancel = !['completed', 'cancelled'].includes(j.status);
            return (
              <div key={j.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
                <div className="bg-orange-50 dark:bg-orange-950/30 border-b border-orange-100 dark:border-orange-900 px-4 py-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-orange-700 uppercase tracking-wide mb-1">① ข้อมูลงานออนไซต์</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                        {j.seller_province && <span className="text-xs text-gray-500">📍 {j.seller_province}</span>}
                        {Number(j.max_budget) > 0 && <span className="font-mono text-sm font-bold text-green-600">งบ ฿{Number(j.max_budget).toLocaleString()}</span>}
                      </div>
                      <p className="font-semibold mt-1 text-gray-900 dark:text-gray-100">{j.item_description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        ผู้ว่าจ้าง: {j.buyer_name || '-'}{j.middleman_name ? ` · คนกลาง: ${j.middleman_name}` : ' · ยังไม่มีคนกลางรับงาน'}
                        · สร้างเมื่อ: {formatDealCreatedAt(j.created_at)}
                      </p>
                    </div>
                    <Link href={`/onsite/${j.id}`} target="_blank" className="text-xs text-blue-600 hover:underline flex items-center gap-1 shrink-0">
                      <ExternalLink size={12} /> เปิดงาน
                    </Link>
                  </div>
                </div>
                {(Number(j.middleman_deposit) > 0 || Number(j.travel_fee) > 0 || Number(j.service_fee) > 0) && (
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <p className="text-[11px] font-bold text-orange-700 uppercase tracking-wide mb-2">② ค่าบริการ + มัดจำ</p>
                    <p className="text-xs text-gray-600">
                      มัดจำคนกลาง ฿{Number(j.middleman_deposit || 0).toLocaleString()} · ค่าเดินทาง ฿{Number(j.travel_fee || 0).toLocaleString()} · ค่าบริการ ฿{Number(j.service_fee || 0).toLocaleString()}
                    </p>
                  </div>
                )}
                {j.report_notes && (
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">③ บันทึก</p>
                    <p className="text-xs text-gray-600">📝 {j.report_notes}</p>
                  </div>
                )}
                <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
                  {canCancel && (
                    <button onClick={() => onsiteAct(j.id, 'cancel', 'เหตุผลยกเลิกงาน + คืนเงินผู้ว่าจ้าง:')} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 flex items-center gap-1 disabled:opacity-50">
                      {acting === j.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} ยกเลิก + คืนเงิน
                    </button>
                  )}
                  {j.status === 'in_progress' && (
                    <button onClick={() => onsiteAct(j.id, 'complete', 'หมายเหตุการปิดงานแทน:')} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 flex items-center gap-1 disabled:opacity-50">
                      {acting === j.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} ปิดงานแทน
                    </button>
                  )}
                  <button onClick={() => onsiteAct(j.id, 'mark_refunded', 'หมายเหตุการคืนมัดจำ:')} disabled={!!acting}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50">
                    <RotateCcw size={14} /> บันทึกคืนมัดจำ
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isOnsite && deals && deals.length > 0 && (
      <div className="space-y-3">
        {(deals || []).map(d => {
          const st = statusBadge(d);
          const refund = refundInfo(d);
          const slips = slipsOf(d);
          const trackingRows = parcelTrackingOf(d);
          const parcelEvidence = parcelEvidenceOf(d);
          const reviewSummary = reviewSummaryOf(d);
          const sellerFeeNeeded = needsSellerFeeSlip(d);
          const buyerSlipVerified = !!d.payment_slip_verified_at;
          const sellerSlipVerified = sellerFeeNeeded ? !!d.priceState?.seller_fee_slip_verified_at : true;
          const canConfirmPayment = !!d.payment_slip_file_id && buyerSlipVerified && sellerSlipVerified;
          // refund (คืนเงินประกัน) ทำได้เฉพาะตอนดีลจบแล้ว (เจอกันเสร็จ = completed) เท่านั้น
          const refundStage = d.deal_type === 'meetup' && d.status === 'completed';
          // ตรวจสลิปเงินประกัน: meetup ที่ยังไม่จบ มีสลิปอย่างน้อย 1 ฝ่าย และยังตรวจไม่ครบ
          const needsSlipVerify = d.deal_type === 'meetup'
            && !['completed', 'cancelled'].includes(d.status)
            && (!!d.meetup?.buyer_slip || !!d.meetup?.seller_slip)
            && !(d.meetup?.buyer_slip_verified_at && d.meetup?.seller_slip_verified_at);
          return (
            <div key={d.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">① ข้อมูลดีล</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 font-mono">{dealCode(d.id)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                      {d.deal_type === 'meetup' && <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">นัดรับ</span>}
                      {d.deal_type === 'simple' && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">แบบง่าย</span>}
                      <span className="font-mono text-sm font-bold text-green-600">฿{Number(d.price || 0).toLocaleString()}</span>
                    </div>
                    <p className="font-semibold mt-1.5 text-gray-900 dark:text-gray-100">{d.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      ผู้ขาย: {d.seller_name || '-'} · ผู้ซื้อ: {d.buyer_name || '-'} {d.middleman_name ? `· คนกลาง: ${d.middleman_name}` : ''}
                      · สร้างเมื่อ: {formatDealCreatedAt(d.created_at)}
                    </p>
                    {d.reject_reason && <p className="text-xs text-red-500 mt-1">เหตุ: {d.reject_reason}</p>}
                    {refund && (
                      <p className="text-xs mt-1 text-gray-500">
                        เงินประกัน ฿{refund.deposit.toLocaleString()}/ฝ่าย · {refund.bothMet ? 'เจอกันสำเร็จ' : 'ยังไม่ครบ'} ·
                        {refund.refundedAt ? <span className="text-green-600"> ✅ คืนเงินแล้ว</span> : <span className="text-amber-600"> ⏳ ยังไม่คืนเงิน</span>}
                      </p>
                    )}
                  </div>
                  <Link href={`/deal/${d.id}`} target="_blank" className="text-xs text-blue-600 hover:underline flex items-center gap-1 shrink-0">
                    <ExternalLink size={12} /> เปิดดีล
                  </Link>
                </div>
              </div>

              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <p className="text-[11px] font-bold text-orange-700 uppercase tracking-wide mb-2">② ค่าสินค้า + คอมมิชชั่น / บัญชีโอน</p>
                {renderSimpleSharePanel(d)}
                {refund && refundStage && !refund.refundedAt && refund.outcome !== 'frozen' && (
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs space-y-1">
                    <p className="font-semibold text-amber-800">
                      💰 ยอดโอนคืน: ฝ่ายละ ฿{refund.deposit.toLocaleString()}
                      {!refund.outcome && <span className="ml-1 text-amber-600">(รวม ฿{(refund.deposit * 2).toLocaleString()})</span>}
                    </p>
                    {d.buyerBank?.bankAcct
                      ? <p className="text-blue-700">🛍️ ผู้ซื้อ: <span className="font-mono font-semibold">{d.buyerBank.bankName} {d.buyerBank.bankAcct}</span></p>
                      : <p className="text-red-600">⚠️ ผู้ซื้อยังไม่ผูกบัญชีธนาคาร</p>}
                    {d.sellerBank?.bankAcct
                      ? <p className="text-blue-700">🛒 ผู้ขาย: <span className="font-mono font-semibold">{d.sellerBank.bankName} {d.sellerBank.bankAcct}</span></p>
                      : <p className="text-red-600">⚠️ ผู้ขายยังไม่ผูกบัญชีธนาคาร</p>}
                  </div>
                )}
                {d.deal_type !== 'meetup' && (d.status === 'completed' || d.status === 'disputed') && !d.priceState?.payout_slip_file_id && (
                  d.sellerBank?.bankAcct
                    ? <p className="text-xs mt-2 text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1 inline-block">🏦 โอนให้ผู้ขาย: {d.sellerBank.bankName} {d.sellerBank.bankAcct}</p>
                    : <p className="text-xs mt-2 text-red-500 bg-red-50 border border-red-100 rounded-lg px-2 py-1 inline-block">⚠️ ผู้ขายยังไม่ผูกบัญชีธนาคาร</p>
                )}
                {d.deal_type !== 'meetup' && (d.status === 'cancelled' || d.status === 'disputed') && !d.priceState?.refund_slip_file_id && (
                  d.buyerBank?.bankAcct
                    ? <p className="text-xs mt-2 text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1 inline-block">🏦 คืนให้ผู้ซื้อ: {d.buyerBank.bankName} {d.buyerBank.bankAcct}</p>
                    : <p className="text-xs mt-2 text-red-500 bg-red-50 border border-red-100 rounded-lg px-2 py-1 inline-block">⚠️ ผู้ซื้อยังไม่ผูกบัญชีธนาคาร</p>
                )}
                {d.status === 'completed' && d.middleman_id && !d.priceState?.middleman_fee_sent_at && middlemanNetFee(d) > 0 && (
                  d.middlemanBank?.bankAcct
                    ? <p className="text-xs mt-2 text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1 inline-block">🏦 โอนค่าคนกลาง ฿{middlemanNetFee(d).toLocaleString()}: {d.middlemanBank.bankName} {d.middlemanBank.bankAcct}</p>
                    : <p className="text-xs mt-2 text-red-500 bg-red-50 border border-red-100 rounded-lg px-2 py-1 inline-block">⚠️ คนกลางยังไม่ผูกบัญชีธนาคาร</p>
                )}
              </div>

              {slips.length > 0 && (
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide mb-2">③ สลิปชำระเงิน</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {slips.map(s => (
                    <a key={s.fileId} href={fileUrl(s.fileId)} target="_blank" rel="noreferrer" className="block">
                      <img src={fileUrl(s.fileId)} alt={s.label} className="w-full h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">{s.label}</p>
                    </a>
                  ))}
                  </div>
                </div>
              )}

              {(trackingRows.length > 0 || parcelEvidence.length > 0) && (
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-blue-50/40 dark:bg-blue-950/20">
                  <p className="text-[11px] font-bold text-blue-800 uppercase tracking-wide mb-2">④ ข้อมูลพัสดุ + หลักฐาน</p>
                  {trackingRows.length > 0 && (
                    <div className="grid gap-2 mb-3">
                      {trackingRows.map(row => (
                        <div key={`${d.id}-${row.label}-${row.trackingNumber}`} className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs text-gray-700">
                          <div className="font-semibold text-gray-900">{row.label}</div>
                          <div className="mt-1">ผู้ให้บริการ: <span className="font-semibold">{row.provider}</span></div>
                          <div>เลขพัสดุ: <span className="font-mono font-semibold">{row.trackingNumber}</span></div>
                          {row.url && (
                            <a href={row.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-blue-600 hover:underline">
                              <ExternalLink size={12} /> เช็คพัสดุ
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {parcelEvidence.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {parcelEvidence.map(item => (
                        <a key={item.id} href={fileUrl(item.file_id)} target="_blank" rel="noreferrer" className="block">
                          {item.file_name?.match(/\.(mp4|mov|avi|webm)$/i) ? (
                            <video src={fileUrl(item.file_id)} className="w-full h-20 object-cover rounded-lg border border-blue-100 bg-white" />
                          ) : (
                            <img src={fileUrl(item.file_id)} alt={item.label} className="w-full h-20 object-cover rounded-lg border border-blue-100 bg-white" />
                          )}
                          <p className="text-[10px] text-gray-500 mt-1 leading-4">{item.label}</p>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {reviewSummary.count > 0 && (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-xs font-semibold text-amber-900">คะแนนรีวิวหลังจบดีล</p>
                      <p className="text-[11px] text-amber-700">ข้อมูลนี้ถูกเก็บอยู่ในตาราง reviews ของระบบ</p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 shadow-sm">
                      <span className="text-amber-500 text-lg leading-none">★★★★★</span>
                      <span className="text-sm font-bold text-amber-900">{reviewSummary.average}</span>
                      <span className="text-xs text-gray-500">({reviewSummary.count})</span>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    {reviewSummary.reviews.map(rv => (
                      <div key={rv.id} className="rounded-xl border border-amber-100 bg-white p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                {'★'.repeat(rv.rating)}{'☆'.repeat(5 - rv.rating)}
                              </span>
                              <span className="text-xs text-gray-500">{roleLabel(rv.reviewer_role)} → {roleLabel(rv.target_role)}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">โดย {rv.reviewer_name || '-'} · {new Date(rv.created_at).toLocaleDateString('th-TH')}</p>
                          </div>
                        </div>
                        {!!rv.tags?.length && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {rv.tags.map(tag => (
                              <span key={`${rv.id}-${tag}`} className="px-2 py-1 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {rv.comment && (
                          <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 whitespace-pre-wrap">
                            {rv.comment}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
                {d.status === 'disputed' && (
                  <>
                    <button onClick={() => act(d.id, 'resolve_dispute', 'บันทึกผลการตัดสิน (ปล่อยเงินให้ผู้ขาย/ดำเนินการต่อ):')} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-1 disabled:opacity-50">
                      {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} ตัดสินให้จบ
                    </button>
                    <button onClick={() => act(d.id, 'cancel_refund', 'เหตุผลยกเลิก + คืนเงินผู้ซื้อ:')} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 flex items-center gap-1 disabled:opacity-50">
                      <RotateCcw size={14} /> ยกเลิก + คืนเงินผู้ซื้อ
                    </button>
                  </>
                )}
                {d.status === 'payment_uploaded' && d.deal_type !== 'meetup' && (
                  <>
                    <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1.5 w-full">
                      🤖 ระบบตรวจสลิปอัตโนมัติเมื่ออัปโหลด — ผ่านแล้วจะแจ้ง LINE และอนุมัติเมื่อครบทุกใบ
                    </p>
                    {buyerSlipVerified ? (
                      <span className="text-xs px-2 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200">✅ สลิปผู้ซื้อถูกต้อง</span>
                    ) : d.payment_slip_file_id ? (
                      <span className="inline-flex gap-1">
                        <button onClick={() => verifyNormalSlip(d.id, 'buyer', true)} disabled={!!acting}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-1 disabled:opacity-50">
                          <CheckCircle2 size={14} /> สลิปผู้ซื้อถูกต้อง
                        </button>
                        <button onClick={() => verifyNormalSlip(d.id, 'buyer', false)} disabled={!!acting}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 flex items-center gap-1 disabled:opacity-50">
                          ❌ ไม่ถูกต้อง
                        </button>
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-lg bg-gray-50 text-gray-500 border border-gray-200">⏳ ผู้ซื้อยังไม่อัปสลิป</span>
                    )}
                    {sellerFeeNeeded ? (
                      sellerSlipVerified ? (
                        <span className="text-xs px-2 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200">✅ สลิปผู้ขายถูกต้อง</span>
                      ) : d.priceState?.seller_fee_slip ? (
                        <span className="inline-flex gap-1">
                          <button onClick={() => verifyNormalSlip(d.id, 'seller', true)} disabled={!!acting}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-1 disabled:opacity-50">
                            <CheckCircle2 size={14} /> สลิปผู้ขายถูกต้อง
                          </button>
                          <button onClick={() => verifyNormalSlip(d.id, 'seller', false)} disabled={!!acting}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 flex items-center gap-1 disabled:opacity-50">
                            ❌ ไม่ถูกต้อง
                          </button>
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-lg bg-gray-50 text-gray-500 border border-gray-200">⏳ ผู้ขายยังไม่อัปสลิปค่าบริการ</span>
                      )
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">ℹ️ ดีลนี้ไม่ต้องมีสลิปค่าบริการฝั่งผู้ขาย</span>
                    )}
                    {canConfirmPayment ? (
                      <button onClick={() => act(d.id, 'confirm_payment', 'หมายเหตุ (เช่น เลขอ้างอิงสลิป) — เว้นว่างได้:')} disabled={!!acting}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-1 disabled:opacity-50">
                        {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        ยืนยันรับเงิน — เริ่มแพ็ค
                      </button>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">⏳ ตรวจสลิปที่อัปโหลดให้ครบก่อนเริ่มแพ็ค</span>
                    )}
                  </>
                )}
                {/* ข้อ5: meetup รอตรวจสลิป — ปุ่มตรวจถูกต้อง/ไม่ถูกต้อง รายฝ่าย */}
                {needsSlipVerify && (
                  <div className="flex flex-wrap gap-2 items-center">
                    {(['buyer', 'seller'] as const).map(side => {
                      const slip = side === 'buyer' ? d.meetup?.buyer_slip : d.meetup?.seller_slip;
                      const verified = side === 'buyer' ? d.meetup?.buyer_slip_verified_at : d.meetup?.seller_slip_verified_at;
                      const lbl = side === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย';
                      if (verified) return <span key={side} className="text-xs px-2 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200">✅ สลิป{lbl} ถูกต้อง</span>;
                      if (!slip) return <span key={side} className="text-xs px-2 py-1 rounded-lg bg-gray-50 text-gray-500 border border-gray-200">⏳ {lbl} ยังไม่อัปสลิป</span>;
                      return (
                        <span key={side} className="inline-flex gap-1">
                          <button onClick={() => verifySlip(d.id, side, true)} disabled={!!acting}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-1 disabled:opacity-50">
                            <CheckCircle2 size={14} /> สลิป{lbl} ถูกต้อง
                          </button>
                          <button onClick={() => verifySlip(d.id, side, false)} disabled={!!acting}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 flex items-center gap-1 disabled:opacity-50">
                            ❌ ไม่ถูกต้อง
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                {refund && refundStage && !refund.outcome && (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => markMeetupRefund(d.id, 'buyer_all')} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50">
                      {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} โอนให้ผู้ซื้อทั้งหมด
                    </button>
                    <button onClick={() => markMeetupRefund(d.id, 'seller_all')} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50">
                      {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} โอนให้ผู้ขายทั้งหมด
                    </button>
                    <button onClick={() => markMeetupRefund(d.id, 'both', 'buyer')} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 flex items-center gap-1 disabled:opacity-50">
                      {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} โอนให้ทั้งคู่ (สลิปผู้ซื้อ)
                    </button>
                    <button onClick={() => markMeetupRefund(d.id, 'both', 'seller')} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 flex items-center gap-1 disabled:opacity-50">
                      {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} โอนให้ทั้งคู่ (สลิปผู้ขาย)
                    </button>
                    <button onClick={() => markMeetupRefund(d.id, 'frozen')} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-600 text-white hover:bg-gray-700 flex items-center gap-1 disabled:opacity-50">
                      {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />} อายัดไว้ก่อน
                    </button>
                  </div>
                )}
                {refund && refund.outcome === 'both' && !refund.refundedAt && (
                  <div className="flex flex-wrap gap-2">
                    {!refund.buyerSlipDone && (
                      <button onClick={() => markMeetupRefund(d.id, 'both', 'buyer')} disabled={!!acting}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 flex items-center gap-1 disabled:opacity-50">
                        {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} แนบสลิปผู้ซื้อ
                      </button>
                    )}
                    {!refund.sellerSlipDone && (
                      <button onClick={() => markMeetupRefund(d.id, 'both', 'seller')} disabled={!!acting}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 flex items-center gap-1 disabled:opacity-50">
                        {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} แนบสลิปผู้ขาย
                      </button>
                    )}
                  </div>
                )}
                {refund && refund.outcome && (refund.refundedAt || refund.outcome === 'frozen') && (
                  <span className="text-xs px-2 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200">
                    ✅ {refund.outcomeLabel}{refund.refundedAt ? '' : ' (อายัด — ยังไม่คืน)'}
                  </span>
                )}
                {d.status === 'completed' && d.deal_type !== 'meetup' && !d.priceState?.payout_slip_file_id && (
                  <button onClick={() => markMoneySent(d.id, 'mark_payout_sent')} disabled={!!acting}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-1 disabled:opacity-50">
                    {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} โอนเงินให้ผู้ขายแล้ว — แนบสลิป
                  </button>
                )}
                {d.status === 'cancelled' && d.deal_type !== 'meetup' && d.payment_slip_file_id && !d.priceState?.refund_slip_file_id && (
                  <button onClick={() => markMoneySent(d.id, 'mark_refund_sent')} disabled={!!acting}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50">
                    {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} คืนเงินให้ผู้ซื้อแล้ว — แนบสลิป
                  </button>
                )}
                {d.status === 'completed' && d.middleman_id && !d.priceState?.middleman_fee_sent_at && middlemanNetFee(d) > 0 && (
                  <button onClick={() => markMoneySent(d.id, 'mark_middleman_fee_sent')} disabled={!!acting}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1 disabled:opacity-50">
                    {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} โอนค่าคนกลางแล้ว — แนบสลิป
                  </button>
                )}
                {/* ข้อ3: ลบดีลถาวร — ทุกดีล (ชิดขวา) */}
                <button onClick={() => del(d.id)} disabled={!!acting} title="ลบดีลถาวร (รวมรูปสลิป)"
                  className="ml-auto px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 flex items-center gap-1 disabled:opacity-50">
                  {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} ลบดีล
                </button>
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}

export default function AdminDeals() {
  return (
    <Suspense fallback={<div className="w-full py-10 text-center text-gray-500">กำลังโหลด...</div>}>
      <AdminDealsInner />
    </Suspense>
  );
}
