import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient, verifyUser, HttpError } from '@/lib/supabaseServer';
import { notifyUsers } from '../../_lib/notify';
import { syncDealLedger, readFeesConfig } from '../../_lib/financeLedger';
import { getTierCreditLimit } from '@/lib/financeLedger';
import { computeDealFees } from '@/lib/fees';
import { getLogisticsProviderLabel } from '@/lib/logistics';

// หา user id ของแอดมินทั้งหมด เพื่อแจ้งเตือนเรื่องเงิน/ข้อพิพาท
async function getAdminIds(db: SupabaseClient): Promise<string[]> {
  const { data } = await db.from('profiles').select('id').eq('role', 'admin').limit(200);
  return (data || []).map(r => r.id as string);
}

// เครดิตประกันคนกลางตามเทียร์ (วางตอนทุกฝ่ายตกลงราคา/อนุมัติดีล)
async function getMmDeposit(db: SupabaseClient, uid: string): Promise<number> {
  const [{ data: profile }, fees] = await Promise.all([
    db.from('profiles').select('middleman_tier, middleman_tier_intent').eq('id', uid).maybeSingle(),
    readFeesConfig(db),
  ]);
  const tier = profile?.middleman_tier || profile?.middleman_tier_intent || 'Bronze';
  return getTierCreditLimit(fees, tier);
}

// ดึงเลขบัญชี/ธนาคารของผู้ใช้ — ใช้แสดงในดีลเพื่อสรุปว่าต้องโอนคืนเข้าบัญชีไหน
async function getBankInfo(db: SupabaseClient, uid?: string | null): Promise<{ bankName: string; bankAcct: string; bankOwner: string } | null> {
  if (!uid) return null;
  const { data: u } = await db.from('profiles').select('bank_name, bank_acct, bank_owner, display_name').eq('id', uid).maybeSingle();
  if (!u) return null;
  const bankName = u.bank_name || '';
  const bankAcct = u.bank_acct || '';
  const bankOwner = u.bank_owner || u.display_name || '';
  if (!bankName && !bankAcct) return null;
  return { bankName, bankAcct, bankOwner };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getAdminClient();
    // Public GET — no auth required so anyone with the link can view
    const { data: deal, error } = await db.from('deals').select('*').eq('id', id).single();
    if (error || !deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });

    let current = deal;
    // Self-heal: ทั้งสองฝ่าย (และคนกลางถ้ามี) ยอมรับครบแล้วแต่สถานะค้างที่ขั้นยอมรับ
    // (เกิดได้จาก race ตอนสองฝ่ายกดยอมรับพร้อมกัน) → ดันไปขั้นคุย/เก็บหลักฐานก่อนโอนเงิน
    if (['buyer_joined', 'terms_pending'].includes(String(deal.status))
      && deal.seller_accepted_terms && deal.buyer_accepted_terms
      && (!deal.middleman_id || deal.middleman_accepted_terms)) {
      const { data: fixed } = await db.from('deals').update({ status: 'payment_pending' }).eq('id', id).select().single();
      if (fixed) current = fixed;
    }

    const [priceStateRes, meetupRes, evidenceRes, imagesRes, buyerBank, sellerBank, middlemanBank] = await Promise.all([
      db.from('deal_price_state').select('*').eq('deal_id', id).maybeSingle(),
      db.from('deal_meetup').select('*').eq('deal_id', id).maybeSingle(),
      db.from('deal_evidence').select('*').eq('deal_id', id).order('created_at', { ascending: true }),
      db.from('deal_images').select('file_id').eq('deal_id', id).order('position', { ascending: true }),
      getBankInfo(db, current.buyer_id),
      getBankInfo(db, current.seller_id),
      getBankInfo(db, current.middleman_id),
    ]);

    // default 'buyer' สำหรับ fee_payer_selection ของทั้งสองฝ่าย (requirement: เริ่มต้นผู้ซื้อจ่าย)
    // ถ้า DB ยังเป็น null (row เก่า หรือยังไม่ได้เลือก) ให้คืนค่า default ออกไป
    const rawPs = priceStateRes.data || {};
    const psWithDefaults = {
      ...rawPs,
      fee_payer_selection_buyer: rawPs.fee_payer_selection_buyer || 'buyer',
      fee_payer_selection_seller: rawPs.fee_payer_selection_seller || 'buyer',
    };

    return NextResponse.json({
      deal: { ...current, images: (imagesRes.data || []).map(r => r.file_id) },
      priceState: psWithDefaults,
      meetup: meetupRes.data || null,
      evidence: evidenceRes.data || [],
      buyerBank, sellerBank, middlemanBank,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const me = await verifyUser(req);
    const db = getAdminClient();
    const { data: meProfile } = await db.from('profiles').select('display_name').eq('id', me.id).maybeSingle();
    const myName = meProfile?.display_name || '';

    const body = await req.json();
    const { action } = body;

    const { data: deal, error: dealErr } = await db.from('deals').select('*').eq('id', id).single();
    if (dealErr || !deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });

    const isSeller    = deal.seller_id    === me.id;
    const isMiddleman = deal.middleman_id === me.id;
    const isBuyer      = deal.buyer_id     === me.id;

    let updates: Record<string, unknown> = {};
    let priceUpdates: Record<string, unknown> = {};
    let meetupUpdates: Record<string, unknown> = {};
    let evidenceInsert: Record<string, unknown> | null = null;
    let replaceChatTranscript = false;
    let systemMsg = '';
    let writeChatMsg = true; // บางเหตุการณ์ (เช่น เข้ามาดูห้อง) แจ้งเตือนอย่างเดียว ไม่ลงแชท

    // โหลด deal_price_state / deal_meetup ตามต้องการ (เฉพาะ action ที่ใช้)
    const needsPriceState = ['select_fee_payer', 'price_propose', 'price_agree', 'evidence_done', 'seller_fee_paid', 'propose_mm_fees', 'accept_mm_fees', 'request_chat_back', 'request_evidence'].includes(action);
    const needsMeetup = action.startsWith('meetup_');
    const [pdRow, mdRow] = await Promise.all([
      needsPriceState ? db.from('deal_price_state').select('*').eq('deal_id', id).maybeSingle().then(r => r.data) : Promise.resolve(null),
      needsMeetup ? db.from('deal_meetup').select('*').eq('deal_id', id).maybeSingle().then(r => r.data) : Promise.resolve(null),
    ]);
    const pd = pdRow || {};
    const md = mdRow || {};

    switch (action) {
      case 'select_fee_payer': {
        // ผู้ซื้อ/ผู้ขายเลือกผู้จ่ายค่าบริการในขั้นตอนที่ 1
        if (!isSeller && !isBuyer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (!['buyer', 'seller', 'split'].includes(body.feePayer)) {
          return NextResponse.json({ error: 'Invalid feePayer' }, { status: 400 });
        }

        // ตั้งค่าฟิลด์สำหรับตัวเอง, คงค่าอีกฝ่ายไว้
        const myField = isSeller ? 'fee_payer_selection_seller' : 'fee_payer_selection_buyer';
        const otherField = isSeller ? 'fee_payer_selection_buyer' : 'fee_payer_selection_seller';
        const mySelection = body.feePayer;
        const otherSelection = pd[otherField];

        // อัปเดต priceState: ตั้งค่าฟิลด์ของตัวเอง, คงอีกฝ่ายไว้
        priceUpdates[myField] = mySelection;
        // ถ้าอีกฝ่ายมีค่าอยู่แล้ว ให้คงไว้
        if (otherSelection) {
          priceUpdates[otherField] = otherSelection;
        }

        // เช็คว่าทั้งสองฝ่ายเลือกเหมือนกันไหม
        if (otherSelection && otherSelection === mySelection) {
          // ตรงกัน -> ตั้งค่า deal.fee_payer
          updates = { fee_payer: mySelection };
          priceUpdates.agreed = true;
          systemMsg = `ทั้งสองฝ่ายตกลงผู้จ่ายค่าบริการแล้ว: ${mySelection === 'buyer' ? 'ผู้ซื้อจ่าย' : mySelection === 'seller' ? 'ผู้ขายจ่าย' : 'หารครึ่ง'}`;
        } else {
          // ยังไม่ตรงกัน -> ล้าง deal.fee_payer ถ้ามี
          updates = { fee_payer: null };
          priceUpdates.agreed = false;
          systemMsg = `${isBuyer ? 'ผู้ซื้อ' : 'ผู้ขาย'}เลือก ${mySelection === 'buyer' ? 'ผู้ซื้อจ่าย' : mySelection === 'seller' ? 'ผู้ขายจ่าย' : 'หารครึ่ง'} — รออีกฝ่ายเลือกให้ตรงกัน`;
        }
        break;
      }
      case 'join_as_buyer': {
        if (!['posted', 'waiting_buyer'].includes(deal.status))
          return NextResponse.json({ error: 'Deal not available' }, { status: 400 });
        if (isSeller || isMiddleman)
          return NextResponse.json({ error: 'ไม่สามารถเป็นผู้ซื้อได้' }, { status: 400 });
        if (deal.buyer_id)
          return NextResponse.json({ error: 'มีผู้ซื้อแล้ว' }, { status: 400 });
        const newStatus = deal.seller_id ? 'buyer_joined' : 'waiting_seller';
        updates = { buyer_id: me.id, buyer_name: myName, status: newStatus };
        systemMsg = `${myName} เข้าร่วมเป็นผู้ซื้อ`;
        break;
      }
      case 'join_as_seller': {
        if (!['posted', 'waiting_seller'].includes(deal.status))
          return NextResponse.json({ error: 'Deal not available' }, { status: 400 });
        if (isBuyer || isMiddleman)
          return NextResponse.json({ error: 'ไม่สามารถเป็นผู้ขายได้' }, { status: 400 });
        if (deal.seller_id)
          return NextResponse.json({ error: 'มีผู้ขายแล้ว' }, { status: 400 });
        const newSt = deal.buyer_id ? 'buyer_joined' : 'waiting_buyer';
        updates = { seller_id: me.id, seller_name: myName, status: newSt };
        systemMsg = `${myName} เข้าร่วมเป็นผู้ขาย`;
        break;
      }
      case 'select_middleman': {
        if (!isBuyer)
          return NextResponse.json({ error: 'ผู้ซื้อเท่านั้นที่เลือกคนกลางได้' }, { status: 403 });
        if (!body.middlemanId || !body.middlemanName)
          return NextResponse.json({ error: 'Missing middlemanId' }, { status: 400 });
        if (body.middlemanId === deal.buyer_id)
          return NextResponse.json({ error: 'ผู้ซื้อไม่สามารถเป็นคนกลางในดีลของตัวเองได้' }, { status: 400 });
        if (body.middlemanId === deal.seller_id)
          return NextResponse.json({ error: 'ผู้ขายไม่สามารถเป็นคนกลางในดีลที่ตัวเองขายได้' }, { status: 400 });
        updates = { middleman_id: body.middlemanId, middleman_name: body.middlemanName, status: 'terms_pending' };
        systemMsg = `ผู้ซื้อเลือก ${body.middlemanName} เป็นคนกลาง`;
        break;
      }
      case 'accept_terms': {
        // Check fee payer selections first
        const currentPd = pd;
        const buyerSel = currentPd.fee_payer_selection_buyer;
        const sellerSel = currentPd.fee_payer_selection_seller;
        
        if (!buyerSel || !sellerSel || buyerSel !== sellerSel) {
          return NextResponse.json({ error: 'ต้องเลือกผู้จ่ายค่าบริการให้ตรงกันทั้งสองฝ่ายก่อนยอมรับเงื่อนไข' }, { status: 400 });
        }
        
        if (isSeller)    updates.seller_accepted_terms    = true;
        if (isMiddleman) updates.middleman_accepted_terms = true;
        if (isBuyer)     updates.buyer_accepted_terms     = true;
        const sc = isSeller    ? true : deal.seller_accepted_terms;
        const mc = isMiddleman ? true : deal.middleman_accepted_terms;
        const bc = isBuyer     ? true : deal.buyer_accepted_terms;
        const hasMm = !!deal.middleman_id;
        if (sc && bc && (!hasMm || mc)) {
          // Set the fee_payer on the deal
          updates.fee_payer = buyerSel;
          updates.status = 'payment_pending';
          systemMsg = 'ทุกฝ่ายยอมรับเงื่อนไขแล้ว — เริ่มคุย 3 ฝ่ายและเก็บหลักฐานได้';
        } else {
          const who = isSeller ? 'ผู้ขาย' : isMiddleman ? 'คนกลาง' : 'ผู้ซื้อ';
          systemMsg = `${who} ยอมรับเงื่อนไขแล้ว`;
        }
        break;
      }
      case 'propose_mm_fees': {
        if (!isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const mmFee = Math.max(0, Math.round(Number(body.mmFee) || 0));
        const inspFee = Math.max(0, Math.round(Number(body.inspectionFee) || 0));
        priceUpdates = { proposed_mm_fee: mmFee, proposed_inspection_fee: inspFee, mm_fee_accepted_seller: false, mm_fee_accepted_buyer: false };
        systemMsg = `คนกลางเสนอค่าบริการ ฿${mmFee.toLocaleString()} และค่าตรวจสอบสินค้า ฿${inspFee.toLocaleString()} — รอผู้ซื้อและผู้ขายยืนยัน`;
        break;
      }
      case 'accept_mm_fees': {
        if (!isSeller && !isBuyer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (isSeller) priceUpdates = { mm_fee_accepted_seller: true };
        if (isBuyer)  priceUpdates = { mm_fee_accepted_buyer:  true };
        const sellerOk = isSeller ? true : !!pd.mm_fee_accepted_seller;
        const buyerOk  = isBuyer  ? true : !!pd.mm_fee_accepted_buyer;
        const who = isSeller ? 'ผู้ขาย' : 'ผู้ซื้อ';
        systemMsg = sellerOk && buyerOk
          ? `ทั้งผู้ซื้อและผู้ขายยอมรับค่าบริการคนกลางแล้ว`
          : `${who} ยอมรับค่าบริการคนกลางแล้ว — รออีกฝ่าย`;
        break;
      }
      case 'upload_payment': {
        // ผู้ซื้ออัปโหลดสลิปโอนเงินค่าสินค้า (และค่ากลางถ้า fee_payer = 'buyer')
        if (!isBuyer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        updates = { payment_slip_file_id: body.fileId, payment_slip_verified_at: null, status: 'payment_uploaded' };
        systemMsg = 'ผู้ซื้ออัปโหลดหลักฐานการโอนเงินแล้ว';
        break;
      }
      case 'upload_middleman_fee': {
        // ผู้ขายอัปโหลดสลิปโอนค่ากลาง (กรณี fee_payer = 'seller' หรือ 'split')
        if (!isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (!body.fileId) return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
        priceUpdates = { seller_fee_slip: String(body.fileId), seller_fee_slip_verified_at: null };
        systemMsg = 'ผู้ขายโอนค่าบริการส่วนของตนแล้ว — รอศูนย์กลางตรวจสอบ';
        break;
      }
      case 'confirm_payment': {
        if (!isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        updates = { status: 'packing', middleman_confirmed_payment: true };
        systemMsg = 'คนกลางยืนยันรับเงินแล้ว — ผู้ขายเริ่มแพ็คสินค้า';
        break;
      }
      case 'add_evidence': {
        // ในขั้น payment_pending (ตรวจหลักฐานก่อนตกลงราคา) → จำกัดเฉพาะผู้ขายเท่านั้นที่อัปโหลดได้
        // ขั้นอื่น (packing/receive/check) ยังอัพได้ตาม role เดิม
        if (deal.status === 'payment_pending' && !isSeller) {
          return NextResponse.json({ error: 'ในขั้นนี้เฉพาะผู้ขายอัปโหลดหลักฐานได้ — ผู้ซื้อ/คนกลางแค่ตรวจและยืนยัน' }, { status: 403 });
        }
        const { evidenceType, fileId, fileName, content } = body;
        // chat_text เก็บประวัติการสนทนาทั้งหมดเป็นหลักฐานชิ้นเดียว (ไม่ใช่ทีละข้อความ) จึงต้องยาวกว่าแคปทั่วไป 200 ตัวอักษร
        const contentCap = evidenceType === 'chat_text' ? 4000 : 200;
        replaceChatTranscript = evidenceType === 'chat_text';
        evidenceInsert = {
          deal_id: id,
          type: evidenceType,
          file_id: fileId || '',
          file_name: fileName || '',
          content: content ? String(content).slice(0, contentCap) : '',
          uploaded_by: me.id,
          uploader_name: myName,
        };
        const label: Record<string, string> = {
          packing: 'วิดีโอแพ็คของ', testing: 'วิดีโอทดสอบสินค้า',
          receive: 'วิดีโอรับสินค้า', check: 'วิดีโอตรวจสินค้า',
          chat: 'หลักฐานจากแชท', chat_text: 'ประวัติการสนทนา', call: 'วิดีโอคอลที่บันทึก',
        };
        systemMsg = `เก็บ${label[evidenceType] || evidenceType}เป็นหลักฐานแล้ว`;
        break;
      }
      case 'seller_done_packing': {
        if (!isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const trackingNumber = String(body.trackingNumber || '').trim();
        const trackingProvider = String(body.trackingProvider || '').trim();
        if (!trackingNumber) return NextResponse.json({ error: 'กรุณากรอกเลขพัสดุ' }, { status: 400 });
        if (!trackingProvider) return NextResponse.json({ error: 'กรุณาเลือกผู้ให้บริการขนส่ง' }, { status: 400 });
        const providerLabel = getLogisticsProviderLabel(trackingProvider);
        if (deal.deal_type === 'simple') {
          updates = {
            status: 'shipped_to_buyer',
            tracking_to_buyer: trackingNumber,
            tracking_to_buyer_provider: trackingProvider,
          };
          systemMsg = `ผู้ขายจัดส่งสินค้าให้ผู้ซื้อโดยตรงแล้ว (${providerLabel}: ${trackingNumber}) — ผู้ซื้ออย่าลืมถ่ายวิดีโอก่อนแกะกล่อง`;
        } else {
          updates = {
            status: 'shipped_to_middleman',
            tracking_to_middleman: trackingNumber,
            tracking_to_middleman_provider: trackingProvider,
          };
          systemMsg = `ผู้ขายจัดส่งสินค้าแล้ว (${providerLabel}: ${trackingNumber})`;
        }
        break;
      }
      case 'middleman_received': {
        if (!isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        updates = { status: 'middleman_checking' };
        systemMsg = 'คนกลางรับสินค้าแล้ว — กำลังตรวจสอบ';
        break;
      }
      case 'buyer_confirm_check': {
        if (!isBuyer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        updates = { buyer_confirmed_check: true };
        systemMsg = 'ผู้ซื้อยืนยันว่าสินค้าไม่มีปัญหา';
        break;
      }
      case 'middleman_ship_to_buyer': {
        if (!isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (!deal.buyer_confirmed_check) return NextResponse.json({ error: 'รอผู้ซื้อยืนยันก่อน' }, { status: 400 });
        const trackingNumber = String(body.trackingNumber || '').trim();
        const trackingProvider = String(body.trackingProvider || '').trim();
        if (!trackingNumber) return NextResponse.json({ error: 'กรุณากรอกเลขพัสดุ' }, { status: 400 });
        if (!trackingProvider) return NextResponse.json({ error: 'กรุณาเลือกผู้ให้บริการขนส่ง' }, { status: 400 });
        const providerLabel = getLogisticsProviderLabel(trackingProvider);
        updates = {
          status: 'shipped_to_buyer',
          tracking_to_buyer: trackingNumber,
          tracking_to_buyer_provider: trackingProvider,
        };
        systemMsg = `คนกลางจัดส่งให้ผู้ซื้อแล้ว (${providerLabel}: ${trackingNumber})`;
        break;
      }
      case 'buyer_received': {
        if (!isBuyer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        updates = { status: 'completed' };
        systemMsg = 'ผู้ซื้อรับสินค้าแล้ว — ดีลเสร็จสมบูรณ์ 🎉';
        break;
      }
      case 'cancel': {
        if (!isSeller && !isMiddleman && !isBuyer)
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        updates = { status: 'cancelled', reject_reason: body.reason || '' };
        systemMsg = `ยกเลิกดีล${body.reason ? ': ' + body.reason : ''}`;
        break;
      }
      case 'dispute': {
        updates = { status: 'disputed', reject_reason: body.reason || '' };
        systemMsg = `แจ้งปัญหา: ${body.reason || 'ไม่ระบุ'}`;
        break;
      }
      case 'start_call': {
        const isParty = isSeller || isMiddleman || isBuyer;
        const mode = body.mode === 'voice' ? 'voice' : 'video';
        // ฝัง caller id + mode ใน content ด้วย prefix 📞| เพื่อให้ client แยก "ฉันโทร" vs "คนอื่นโทรเข้า" ได้
        systemMsg = `📞|caller=${me.id}|mode=${mode}|${myName || 'ผู้ใช้'}${isParty ? '' : ' (ผู้สนใจจากลิงก์แชร์)'} เริ่ม${mode === 'voice' ? 'โทรเสียง' : 'วิดีโอคอล'} — กดเข้าร่วมได้เลย`;
        break;
      }
      case 'end_call': {
        systemMsg = `📞|end|${myName || 'ผู้ใช้'} วางสายแล้ว`;
        break;
      }
      case 'meetup_set_location': {
        if (deal.deal_type !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const loc = body.loc || {};
        const clean = {
          province: String(loc.province || '').slice(0, 60),
          amphoe: String(loc.amphoe || '').slice(0, 80),
          tambon: String(loc.tambon || '').slice(0, 80),
        };
        if (!clean.province || !clean.amphoe || !clean.tambon)
          return NextResponse.json({ error: 'กรุณาเลือกที่อยู่ให้ครบถึงระดับตำบล' }, { status: 400 });
        if (md.buyer_slip || md.seller_slip) return NextResponse.json({ error: 'วางเงินประกันแล้ว แก้ที่อยู่ไม่ได้' }, { status: 400 });
        if (isBuyer) meetupUpdates.buyer_loc = clean; else meetupUpdates.seller_loc = clean;
        systemMsg = `📍 ${isBuyer ? 'ผู้ซื้อ' : 'ผู้ขาย'}ระบุที่อยู่แล้ว: ต.${clean.tambon} อ.${clean.amphoe} จ.${clean.province}`;
        break;
      }
      case 'meetup_propose': {
        if (deal.deal_type !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const amount = Math.round(Number(body.amount));
        if (!(amount >= 50 && amount <= 999999999)) return NextResponse.json({ error: 'ยอดประกันไม่ถูกต้อง (ขั้นต่ำ ฿50)' }, { status: 400 });
        if (md.buyer_slip || md.seller_slip) return NextResponse.json({ error: 'มีการวางเงินประกันแล้ว เปลี่ยนยอดไม่ได้ — ติดต่อทีมงานหากจำเป็น' }, { status: 400 });
        meetupUpdates.pending_deposit = amount;
        meetupUpdates.pending_by = isBuyer ? 'buyer' : 'seller';
        if (body.meetLabel) meetupUpdates.pending_meet_label = String(body.meetLabel).slice(0, 200);
        // แนบการปรับราคา/ค่าบริการมากับข้อเสนอจุดนัด (popup รวมทุกอย่าง)
        let extra = '';
        if (body.price !== undefined && body.price !== null && String(body.price) !== '') {
          const p = Math.round(Number(body.price));
          if (p >= 1 && p <= 999999999) { meetupUpdates.pending_price = p; extra += ` · ราคาใหม่ ฿${p.toLocaleString()}`; }
        } else { meetupUpdates.pending_price = null; }
        if (['buyer', 'seller', 'split'].includes(body.feePayer)) {
          meetupUpdates.pending_fee_payer = body.feePayer;
          extra += ` · ค่าบริการ ${body.feePayer === 'buyer' ? 'ผู้ซื้อจ่าย' : body.feePayer === 'seller' ? 'ผู้ขายจ่าย' : 'หารครึ่ง'}`;
        } else { meetupUpdates.pending_fee_payer = null; }
        systemMsg = `💰 ${isBuyer ? 'ผู้ซื้อ' : 'ผู้ขาย'}เสนอ${body.meetLabel ? `จุดนัด "${String(body.meetLabel).slice(0, 200)}" + ` : 'เปลี่ยน'}เงินประกัน ฿${amount.toLocaleString()}/ฝ่าย${extra} — รออีกฝ่ายกดยอมรับ`;
        break;
      }
      case 'meetup_respond': {
        if (deal.deal_type !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (!md.pending_deposit) return NextResponse.json({ error: 'ไม่มีข้อเสนอที่รอการตอบรับ' }, { status: 400 });
        const meSide = isBuyer ? 'buyer' : 'seller';
        if (body.accept) {
          if (md.pending_by === meSide) return NextResponse.json({ error: 'ผู้เสนอกดยอมรับเองไม่ได้ — ต้องให้อีกฝ่ายยอมรับ' }, { status: 400 });
          meetupUpdates.deposit = md.pending_deposit;
          if (md.pending_meet_label) meetupUpdates.meet_label = md.pending_meet_label;
          // apply การปรับราคา/ค่าบริการที่แนบมากับข้อเสนอ + คำนวณค่าบริการรายฝ่ายใหม่
          let extra = '';
          if (md.pending_price) { updates.price = md.pending_price; extra += ` · ราคา ฿${Number(md.pending_price).toLocaleString()}`; }
          if (md.pending_fee_payer) { updates.fee_payer = md.pending_fee_payer; extra += ` · ค่าบริการ ${md.pending_fee_payer === 'buyer' ? 'ผู้ซื้อจ่าย' : md.pending_fee_payer === 'seller' ? 'ผู้ขายจ่าย' : 'หารครึ่ง'}`; }
          if (md.pending_price || md.pending_fee_payer) {
            const newPrice = Number(md.pending_price || deal.price) || 0;
            const newFeePayer = (md.pending_fee_payer || deal.fee_payer || 'split') as 'buyer' | 'seller' | 'split';
            const cfg = await readFeesConfig(db);
            const totalFee = computeDealFees(cfg, newPrice, 'meetup').total;
            meetupUpdates.buyer_fee = newFeePayer === 'buyer' ? totalFee : newFeePayer === 'split' ? Math.ceil(totalFee / 2) : 0;
            meetupUpdates.seller_fee = newFeePayer === 'seller' ? totalFee : newFeePayer === 'split' ? Math.floor(totalFee / 2) : 0;
          }
          systemMsg = `✅ ตกลงกันแล้ว${md.pending_meet_label ? `: ${md.pending_meet_label}` : ''} — เงินประกัน ฿${Number(md.pending_deposit).toLocaleString()}/ฝ่าย${extra} วางเงินได้เลย`;
        } else {
          systemMsg = md.pending_by === meSide
            ? `↩️ ${meSide === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย'}ยกเลิกข้อเสนอ`
            : `❌ ${meSide === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย'}ปฏิเสธข้อเสนอ ฿${Number(md.pending_deposit).toLocaleString()} — เสนอใหม่หรือคุยกันในแชทได้`;
        }
        meetupUpdates.pending_deposit = null;
        meetupUpdates.pending_by = null;
        meetupUpdates.pending_meet_label = null;
        meetupUpdates.pending_price = null;
        meetupUpdates.pending_fee_payer = null;
        break;
      }
      case 'meetup_deposit': {
        if (deal.deal_type !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (!body.fileId) return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
        if (!md.deposit) return NextResponse.json({ error: 'ต้องตกลงจุดนัดพบและยอดประกันกับอีกฝ่ายก่อนวางเงิน' }, { status: 400 });
        // อัปสลิป + รีเซ็ตผลตรวจของฝ่ายตัวเอง (กรณีอัปใหม่หลังถูกตีกลับ)
        if (isBuyer) { meetupUpdates.buyer_slip = body.fileId; meetupUpdates.buyer_slip_verified_at = null; }
        else { meetupUpdates.seller_slip = body.fileId; meetupUpdates.seller_slip_verified_at = null; }
        const bothSlipped = isBuyer ? (!!md.seller_slip) : (!!md.buyer_slip);
        if (bothSlipped) {
          // ข้อ4/5: วางครบ 2 ฝ่าย → ส่งให้ศูนย์กลางตรวจสลิป (ไม่ข้ามไปนัดเจอทันที)
          updates.status = 'payment_uploaded';
          systemMsg = '✅ ทั้งสองฝ่ายวางเงินประกันแล้ว — รอศูนย์กลางตรวจสลิป เมื่อตรวจครบจะเริ่มขั้นตอนนัดพบทันที';
        } else {
          systemMsg = `${isBuyer ? 'ผู้ซื้อ' : 'ผู้ขาย'}วางเงินประกันเดินทางแล้ว — รออีกฝ่าย`;
        }
        break;
      }
      case 'meetup_depart': {
        if (deal.deal_type !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (deal.status !== 'meetup_ready') return NextResponse.json({ error: 'ต้องวางเงินประกันครบทั้งสองฝ่ายก่อน' }, { status: 400 });
        if (isBuyer) meetupUpdates.buyer_departed_at = new Date().toISOString();
        else meetupUpdates.seller_departed_at = new Date().toISOString();
        systemMsg = `🚗 ${isBuyer ? 'ผู้ซื้อ' : 'ผู้ขาย'}เริ่มออกเดินทางแล้ว — มุ่งหน้าสู่จุดนัดพบ`;
        break;
      }
      case 'meetup_position': {
        if (deal.deal_type !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const lat = Number(body.lat), lng = Number(body.lng);
        if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
          return NextResponse.json({ error: 'พิกัดไม่ถูกต้อง' }, { status: 400 });
        const pos = { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5, at: new Date().toISOString() };
        if (isBuyer) meetupUpdates.buyer_pos = pos; else meetupUpdates.seller_pos = pos;
        // ไม่ตั้ง systemMsg — อัปเดตเงียบ
        break;
      }
      case 'meetup_met': {
        if (deal.deal_type !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (deal.status !== 'meetup_ready') return NextResponse.json({ error: 'ต้องวางเงินประกันครบทั้งสองฝ่ายก่อน' }, { status: 400 });
        if (isBuyer) meetupUpdates.buyer_met = true; else meetupUpdates.seller_met = true;
        const bothMet = isBuyer ? (!!md.seller_met) : (!!md.buyer_met);
        if (bothMet) {
          updates.status = 'completed';
          systemMsg = '🎉 นัดเจอสำเร็จทั้งสองฝ่าย! บริษัท กลางฮับ จำกัด จะโอนเงินประกันคืนให้ทั้งคู่เต็มจำนวน (หักเฉพาะค่าบริการ)';
        } else {
          systemMsg = `${isBuyer ? 'ผู้ซื้อ' : 'ผู้ขาย'}ยืนยันว่านัดเจอสำเร็จ — รออีกฝ่ายยืนยัน`;
        }
        break;
      }
      case 'meetup_ack_departure': {
        // ข้อ5: รับทราบว่าอีกฝ่ายออกเดินทางแล้ว (mutual acknowledge)
        if (deal.deal_type !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (isBuyer) {
          if (!md.seller_departed_at) return NextResponse.json({ error: 'อีกฝ่ายยังไม่ได้ออกเดินทาง' }, { status: 400 });
          meetupUpdates.seller_departed_ack_at = new Date().toISOString();
        } else {
          if (!md.buyer_departed_at) return NextResponse.json({ error: 'อีกฝ่ายยังไม่ได้ออกเดินทาง' }, { status: 400 });
          meetupUpdates.buyer_departed_ack_at = new Date().toISOString();
        }
        systemMsg = `🤝 ${isBuyer ? 'ผู้ซื้อ' : 'ผู้ขาย'}รับทราบว่าอีกฝ่ายออกเดินทางแล้ว`;
        break;
      }
      case 'progress_ping': {
        // ข้อ4: แจ้งเตือนอีกฝ่ายเมื่อเรากดไปขั้นต่อไป + บันทึก chat_done_* ลง priceState
        // (เดิมใช้ system message แต่ message persist ค้างทำให้ step ขึ้นเองโดยไม่ได้กด)
        if (!isSeller && !isBuyer && !isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const whoLabel = isSeller ? 'ผู้ขาย' : isBuyer ? 'ผู้ซื้อ' : 'คนกลาง';
        if (body.stage === 'to_evidence') {
          // บันทึก flag ใน priceState — ใช้แทน hasProgressPing เพื่อกัน stale system message
          priceUpdates = isSeller
            ? { chat_done_seller: true }
            : isBuyer
            ? { chat_done_buyer: true }
            : { chat_done_middleman: true };
          systemMsg = deal.middleman_id
            ? `📋 ${whoLabel}คุย 3 ฝ่ายเสร็จแล้ว — กำลังไปขั้นตรวจหลักฐาน`
            : `📋 ${whoLabel}คุยรายละเอียดเสร็จแล้ว — กำลังไปขั้นตรวจหลักฐาน`;
        }
        else return NextResponse.json({ error: 'Unknown stage' }, { status: 400 });
        break;
      }
      case 'visit': {
        const roleLabel = isSeller ? 'ผู้ขาย' : isBuyer ? 'ผู้ซื้อ' : isMiddleman ? 'คนกลาง' : 'ผู้สนใจจากลิงก์แชร์';
        systemMsg = `👀 ${myName || 'ผู้ใช้'} (${roleLabel}) เข้ามาดูห้องดีล`;
        writeChatMsg = false;
        break;
      }
      case 'price_propose': {
        if (!isSeller && !isBuyer) return NextResponse.json({ error: 'เฉพาะผู้ซื้อหรือผู้ขายที่เสนอราคาใหม่ได้' }, { status: 403 });
        if (!['posted', 'waiting_seller', 'waiting_buyer', 'buyer_joined', 'terms_pending', 'payment_pending'].includes(deal.status))
          return NextResponse.json({ error: 'ดีลเลยขั้นตอนตกลงราคาแล้ว' }, { status: 400 });
        const price = Math.round(Number(body.price));
        if (!(price >= 1 && price <= 999999999)) return NextResponse.json({ error: 'ราคาไม่ถูกต้อง' }, { status: 400 });
        const feePayer = ['buyer', 'seller', 'split'].includes(body.feePayer)
          ? body.feePayer
          : (pd.proposed_fee_payer || deal.fee_payer || 'split');
        const who = isSeller ? 'seller' : isBuyer ? 'buyer' : 'middleman';
        priceUpdates = {
          proposed_price: price, proposed_fee_payer: feePayer, proposed_by: who, proposal_kind: 'reprice', agreed: false,
          seller_agreed: isSeller, buyer_agreed: isBuyer, middleman_agreed: isMiddleman,
        };
        const fpLabel = feePayer === 'buyer' ? 'ผู้ซื้อจ่าย' : feePayer === 'seller' ? 'ผู้ขายจ่าย' : 'หารครึ่ง';
        systemMsg = `💬 ${who === 'seller' ? 'ผู้ขาย' : who === 'buyer' ? 'ผู้ซื้อ' : 'คนกลาง'}เสนอราคา ฿${price.toLocaleString()} · ค่าบริการ: ${fpLabel} — รอทุกฝ่ายกดตกลง`;
        break;
      }
      case 'price_agree': {
        if (!isSeller && !isBuyer && !isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const who = isSeller ? 'seller' : isBuyer ? 'buyer' : 'middleman';
        const requestedFeePayer = ['buyer', 'seller', 'split'].includes(body.feePayer) ? body.feePayer : undefined;
        let proposedPrice = pd.proposed_price;
        let proposedFeePayer = pd.proposed_fee_payer;
        let proposalKind = pd.proposal_kind;
        let proposedBy = pd.proposed_by;
        let sellerAgreed = !!pd.seller_agreed, buyerAgreed = !!pd.buyer_agreed, middlemanAgreed = !!pd.middleman_agreed;

        if (!proposedPrice) {
          proposedFeePayer = requestedFeePayer || (deal.fee_payer || 'split');
          proposedPrice = Number(deal.price) || 0;
          proposalKind = 'current';
          proposedBy = who;
        } else if (requestedFeePayer && requestedFeePayer !== proposedFeePayer) {
          proposedFeePayer = requestedFeePayer;
          proposedBy = who;
          sellerAgreed = isSeller; buyerAgreed = isBuyer; middlemanAgreed = isMiddleman;
          priceUpdates = {
            proposed_price: proposedPrice, proposed_fee_payer: proposedFeePayer, proposed_by: proposedBy, proposal_kind: proposalKind,
            agreed: false, seller_agreed: sellerAgreed, buyer_agreed: buyerAgreed, middleman_agreed: middlemanAgreed,
          };
          const fpLabel = requestedFeePayer === 'buyer' ? 'ผู้ซื้อจ่าย' : requestedFeePayer === 'seller' ? 'ผู้ขายจ่าย' : 'หารครึ่ง';
          systemMsg = `🔁 ${who === 'seller' ? 'ผู้ขาย' : who === 'buyer' ? 'ผู้ซื้อ' : 'คนกลาง'}เปลี่ยนผู้จ่ายค่าบริการเป็น ${fpLabel} — ต้องรอทุกฝ่ายยอมรับใหม่`;
          break;
        }
        if (isSeller) sellerAgreed = true;
        if (isBuyer) buyerAgreed = true;
        if (isMiddleman) middlemanAgreed = true;
        const hasMm = !!deal.middleman_id;
        const allAgreed = sellerAgreed && buyerAgreed && (!hasMm || middlemanAgreed);
        priceUpdates = {
          proposed_price: proposedPrice, proposed_fee_payer: proposedFeePayer, proposed_by: proposedBy, proposal_kind: proposalKind,
          seller_agreed: sellerAgreed, buyer_agreed: buyerAgreed, middleman_agreed: middlemanAgreed, agreed: allAgreed,
        };
        if (allAgreed) {
          updates.price = proposedPrice;
          updates.fee_payer = proposedFeePayer;
          let mmDepositHeld = 0;
          if (hasMm) {
            mmDepositHeld = await getMmDeposit(db, String(deal.middleman_id));
            priceUpdates.mm_deposit_held = mmDepositHeld;
          }
          const fpLabel = proposedFeePayer === 'buyer' ? 'ผู้ซื้อจ่าย' : proposedFeePayer === 'seller' ? 'ผู้ขายจ่าย' : 'หารครึ่ง';
          systemMsg = proposalKind === 'reprice'
            ? `✅ ทุกฝ่ายตกลงราคา ฿${Number(proposedPrice).toLocaleString()} · ค่าบริการ: ${fpLabel} แล้ว${hasMm ? ` (คนกลางวางเครดิตประกัน ฿${Number(mmDepositHeld).toLocaleString()})` : ''} — พร้อมเข้าสู่ขั้นโอนเงิน`
            : `✅ ทุกฝ่ายยืนยันใช้ราคาเดิม ฿${Number(proposedPrice).toLocaleString()} · ค่าบริการ: ${fpLabel} แล้ว${hasMm ? ` (คนกลางวางเครดิตประกัน ฿${Number(mmDepositHeld).toLocaleString()})` : ''} — พร้อมเข้าสู่ขั้นโอนเงิน`;
        } else {
          const whoLabel = isSeller ? 'ผู้ขาย' : isBuyer ? 'ผู้ซื้อ' : 'คนกลาง';
          systemMsg = proposalKind === 'reprice'
            ? `${whoLabel}${isMiddleman ? ' อนุมัติดีล + วางเครดิตประกัน' : ' ตกลงราคานี้'}แล้ว — รอฝ่ายอื่น`
            : `${whoLabel}${isMiddleman ? ' รับรู้ราคาเดิม + อนุมัติดีล' : ' ยืนยันใช้ราคาเดิม'}แล้ว — รอฝ่ายอื่น`;
        }
        break;
      }
      case 'evidence_done': {
        if (!isSeller && !isBuyer && !isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const sellerDone = isSeller ? true : !!pd.evidence_done_seller;
        const buyerDone = isBuyer ? true : !!pd.evidence_done_buyer;
        const middlemanDone = isMiddleman ? true : !!pd.evidence_done_middleman;
        priceUpdates = { evidence_done_seller: sellerDone, evidence_done_buyer: buyerDone, evidence_done_middleman: middlemanDone };
        const hasMm = !!deal.middleman_id;
        const allDone = sellerDone && buyerDone && (!hasMm || middlemanDone);
        systemMsg = allDone ? '📁 ทุกฝ่ายยืนยันเก็บหลักฐานเรียบร้อย — ไปขั้นโอนเงินได้เลย' : `${isSeller ? 'ผู้ขาย' : isBuyer ? 'ผู้ซื้อ' : 'คนกลาง'}ยืนยันเก็บหลักฐานแล้ว — รอฝ่ายอื่น`;
        break;
      }
      case 'request_evidence': {
        // ผู้ซื้อ/คนกลาง ขอหลักฐานเพิ่มจากผู้ขาย → reset evidence_done_* เป็น false (ต้องยืนยันใหม่หลังได้รับหลักฐานเพิ่ม)
        // ผู้ขายห้ามขอเอง (ผู้ขายเป็นฝ่ายอัปโหลด)
        if (!isBuyer && !isMiddleman) return NextResponse.json({ error: 'เฉพาะผู้ซื้อ/คนกลางขอหลักฐานเพิ่มได้' }, { status: 403 });
        const detail = String(body.detail || '').trim().slice(0, 300);
        priceUpdates = { evidence_done_seller: false, evidence_done_buyer: false, evidence_done_middleman: false };
        systemMsg = `🔍 ${isBuyer ? 'ผู้ซื้อ' : 'คนกลาง'} ขอหลักฐานเพิ่ม${detail ? `: ${detail}` : ' — โปรดอัปโหลดเพิ่ม'}`;
        break;
      }
      case 'request_chat_back': {
        // ขอกลับไปหน้าแชท — ต้องให้ทั้งผู้ซื้อและผู้ขาย (และคนกลางถ้ามี) ยินยอมก่อน
        if (!isSeller && !isBuyer && !isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const hasMm2 = !!deal.middleman_id;
        const reqSeller = isSeller ? true : !!pd.chat_back_req_seller;
        const reqBuyer  = isBuyer  ? true : !!pd.chat_back_req_buyer;
        const reqMm     = isMiddleman ? true : !!pd.chat_back_req_middleman;
        const allReq = reqSeller && reqBuyer && (!hasMm2 || reqMm);
        if (allReq) {
          // ทุกฝ่ายยินยอม → ล้าง evidence_done และ chat_back_req ทั้งหมด
          priceUpdates = {
            evidence_done_seller: false, evidence_done_buyer: false, evidence_done_middleman: false,
            chat_back_req_seller: false, chat_back_req_buyer: false, chat_back_req_middleman: false,
          };
          systemMsg = '↩️ ทุกฝ่ายยินยอม — กลับสู่ขั้นตอนคุยกันและเก็บหลักฐานอีกครั้ง';
        } else {
          priceUpdates = {
            chat_back_req_seller: reqSeller,
            chat_back_req_buyer: reqBuyer,
            chat_back_req_middleman: reqMm,
          };
          systemMsg = `${isSeller ? 'ผู้ขาย' : isBuyer ? 'ผู้ซื้อ' : 'คนกลาง'}ขอกลับไปแชทใหม่ — รอฝ่ายอื่นยืนยัน`;
        }
        break;
      }
      case 'seller_fee_paid': {
        if (!isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (!body.fileId) return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
        priceUpdates = { seller_fee_slip: String(body.fileId), seller_fee_slip_verified_at: null };
        systemMsg = 'ผู้ขายโอนค่าบริการส่วนของตนแล้ว — รอศูนย์กลางตรวจสอบ';
        break;
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    let updated = deal;
    if (Object.keys(updates).length > 0) {
      const { data } = await db.from('deals').update(updates).eq('id', id).select().single();
      if (data) updated = data;
    }
    if (Object.keys(priceUpdates).length > 0) {
      await db.from('deal_price_state').upsert({ deal_id: id, ...priceUpdates }, { onConflict: 'deal_id' });
    }
    if (Object.keys(meetupUpdates).length > 0) {
      await db.from('deal_meetup').upsert({ deal_id: id, ...meetupUpdates }, { onConflict: 'deal_id' });
    }
    if (evidenceInsert) {
      if (replaceChatTranscript) {
        const { data: existingChatEvidence } = await db
          .from('deal_evidence')
          .select('id')
          .eq('deal_id', id)
          .eq('type', 'chat_text')
          .order('created_at', { ascending: true });

        const keepId = existingChatEvidence?.[0]?.id;
        if (keepId) {
          await db.from('deal_evidence').update(evidenceInsert).eq('id', keepId);
          const duplicateIds = (existingChatEvidence || []).slice(1).map(row => row.id).filter(Boolean);
          if (duplicateIds.length) {
            await db.from('deal_evidence').delete().in('id', duplicateIds);
          }
        } else {
          await db.from('deal_evidence').insert(evidenceInsert);
        }
      } else {
        await db.from('deal_evidence').insert(evidenceInsert);
      }
    }

    // กัน race ตอนยอมรับเงื่อนไข: ถ้าหลังอัปเดตแล้วทุกฝ่ายยอมรับครบแต่สถานะยังค้าง → ดันไปขั้นคุย/เก็บหลักฐานก่อน
    if (['buyer_joined', 'terms_pending'].includes(String(updated.status))
      && updated.seller_accepted_terms && updated.buyer_accepted_terms
      && (!updated.middleman_id || updated.middleman_accepted_terms)) {
      const { data: fixed } = await db.from('deals').update({ status: 'payment_pending' }).eq('id', id).select().single();
      if (fixed) {
        updated = fixed;
        if (!systemMsg || /ยอมรับเงื่อนไขแล้ว$/.test(systemMsg)) systemMsg = 'ทุกฝ่ายยอมรับเงื่อนไขแล้ว — เริ่มคุย 3 ฝ่ายและเก็บหลักฐานได้';
      }
    }

    if (systemMsg) {
      if (writeChatMsg) {
        await db.from('messages').insert({
          deal_id: id, sender_id: null, sender_name: 'ระบบ',
          role: 'system', type: 'system', content: systemMsg, file_id: '', file_name: '',
        });
      }

      // แจ้งเตือนทุกฝ่ายในดีล ยกเว้นคนที่กดเอง
      const recipients = [updated.seller_id, updated.buyer_id, updated.middleman_id]
        .filter((x): x is string => typeof x === 'string' && !!x && x !== me.id)
        .filter(x => !(action === 'select_middleman' && x === updated.middleman_id));
      if (recipients.length) {
        if (action === 'start_call') {
          // สายเรียกเข้า → high-priority push + VoIP (iOS) + full-screen intent (Android)
          // ฝั่ง native ใช้ data payload (type/dealId/mode/callerName) สร้างหน้าจอรับสายเต็มจอ
          const callMode = body.mode === 'voice' ? 'voice' : 'video';
          await notifyUsers(db, recipients, {
            title: `📞 สายเรียกเข้า: ${updated.title || 'ดีล'}`,
            body: systemMsg,
            link: `/deal/${id}?call=1`,
            kind: 'call',
            data: { type: 'incoming_call', dealId: id, mode: callMode, callerName: myName || 'ผู้ใช้' },
          });
        } else {
          const title =
            action === 'visit' ? `👀 มีคนเข้ามาดูห้องดีล: ${updated.title || ''}` :
            `ดีล: ${updated.title || 'ไม่มีชื่อ'}`;
          // เพิ่มข้อมูล data เพื่อบอกฝั่ง native ว่ามีข้อเสนอใหม่
          const dataPayload: Record<string, string> = { dealId: id };
          if (action === 'price_propose') {
            dataPayload.type = 'price_proposal';
            dataPayload.proposedBy = updated.proposed_by || '';
            dataPayload.proposedPrice = String(updated.proposed_price || '');
            dataPayload.proposedFeePayer = updated.proposed_fee_payer || '';
          } else if (action === 'price_agree') {
            dataPayload.type = 'price_agreement';
          }
          await notifyUsers(db, recipients, {
            title,
            body: systemMsg,
            link: `/deal/${id}`,
            data: dataPayload,
          });
        }
      }

      // แจ้งคนกลางแบบเจาะจงเมื่อถูกเลือก
      if (action === 'select_middleman' && updated.middleman_id && updated.middleman_id !== me.id) {
        await notifyUsers(db, [updated.middleman_id as string], {
          title: '🤝 คุณถูกเลือกเป็นคนกลาง!',
          body: `ดีล "${updated.title || 'ไม่มีชื่อ'}" มูลค่า ฿${Number(updated.price || 0).toLocaleString()} — เข้าไปยอมรับเงื่อนไขเพื่อเริ่มงานได้เลย`,
          link: `/deal/${id}`,
        });
      }

      // แจ้งเตือนแอดมินเมื่อมีเงินเข้า/ข้อพิพาท
      if (action === 'upload_payment' || action === 'dispute') {
        const admins = await getAdminIds(db);
        if (admins.length) {
          const isPay = action === 'upload_payment';
          await notifyUsers(db, admins, {
            title: isPay ? `💰 มีการโอนเงินรอตรวจสอบ: ${updated.title || 'ดีล'}` : `⚠️ มีข้อพิพาท: ${updated.title || 'ดีล'}`,
            body: isPay
              ? `ผู้ซื้อโอนเงิน ฿${Number(updated.price || 0).toLocaleString()} แล้ว — เข้าไปตรวจสอบและอนุมัติที่หน้าการเงิน`
              : `${systemMsg} — เข้าไปจัดการที่หน้าดีล & ข้อพิพาท`,
            link: isPay ? '/admin/finance' : '/admin/deals',
          });
        }
      }
    }

    await syncDealLedger(db, updated as Record<string, unknown>).catch(() => {});
    return NextResponse.json({ deal: updated });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
