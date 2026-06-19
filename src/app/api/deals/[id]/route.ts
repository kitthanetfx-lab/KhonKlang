import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Databases, ID, Users, Query } from 'node-appwrite';
import { notifyUsers } from '../../_lib/notify';

const DB_ID  = 'khonklang_db';
const COL_DEALS = 'deals';
const COL_MSGS  = 'messages';

function getAdminClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Databases(client);
}

// หา user id ของแอดมินทั้งหมด (prefs.role === 'admin') เพื่อแจ้งเตือนเรื่องเงิน/ข้อพิพาท
async function getAdminIds(): Promise<string[]> {
  try {
    const c = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);
    const res = await new Users(c).list([Query.limit(100)]);
    return res.users.filter(u => (u.prefs as Record<string, unknown> | undefined)?.role === 'admin').map(u => u.$id);
  } catch { return []; }
}

// เครดิตประกันคนกลางตามเทียร์ (วางตอนคนกลางอนุมัติดีล)
async function getMmDeposit(uid: string): Promise<number> {
  try {
    const c = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);
    const u = await new Users(c).get(uid);
    const tier = String((u.prefs as Record<string, unknown> | undefined)?.middlemanTierIntent || 'Bronze');
    const d: Record<string, number> = { Bronze: 1000, Silver: 5000, Gold: 20000, Platinum: 50000 };
    return d[tier] || 1000;
  } catch { return 1000; }
}

function getUserFromJwt(jwt: string) {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);
  return new Account(c).get();
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Public GET — no auth required so anyone with the link can view
    const databases = getAdminClient();
    const deal = await databases.getDocument(DB_ID, COL_DEALS, id);
    // Self-heal: ทั้งสองฝ่าย (และคนกลางถ้ามี) ยอมรับครบแล้วแต่สถานะค้างที่ขั้นยอมรับ
    // (เกิดได้จาก race ตอนสองฝ่ายกดยอมรับพร้อมกัน) → ดันไปขั้นโอนเงินให้อัตโนมัติ
    if (['buyer_joined', 'terms_pending'].includes(String(deal.status))
      && deal.sellerAcceptedTerms && deal.buyerAcceptedTerms
      && (!deal.middlemanId || deal.middlemanAcceptedTerms)) {
      try {
        const fixed = await databases.updateDocument(DB_ID, COL_DEALS, id, { status: 'payment_pending' });
        return NextResponse.json({ deal: fixed });
      } catch { /* ถ้าแก้ไม่ได้ก็คืนค่าเดิม */ }
    }
    return NextResponse.json({ deal });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = await getUserFromJwt(jwt);
    const uid = currentUser.$id;
    const body = await req.json();
    const { action } = body;

    const databases = getAdminClient();
    const deal = await databases.getDocument(DB_ID, COL_DEALS, id);

    const isSeller    = deal.sellerId    === uid;
    const isMiddleman = deal.middlemanId === uid;
    const isBuyer     = deal.buyerId     === uid;

    let updates: Record<string, unknown> = {};
    let systemMsg = '';
    let writeChatMsg = true; // บางเหตุการณ์ (เช่น เข้ามาดูห้อง) แจ้งเตือนอย่างเดียว ไม่ลงแชท

    switch (action) {
      case 'join_as_buyer': {
        if (!['posted','waiting_buyer'].includes(deal.status))
          return NextResponse.json({ error: 'Deal not available' }, { status: 400 });
        if (isSeller || isMiddleman)
          return NextResponse.json({ error: 'ไม่สามารถเป็นผู้ซื้อได้' }, { status: 400 });
        if (deal.buyerId)
          return NextResponse.json({ error: 'มีผู้ซื้อแล้ว' }, { status: 400 });
        const newStatus = deal.sellerId ? 'buyer_joined' : 'waiting_seller';
        updates = { buyerId: uid, buyerName: currentUser.name || '', status: newStatus };
        systemMsg = `${currentUser.name} เข้าร่วมเป็นผู้ซื้อ`;
        break;
      }
      case 'join_as_seller': {
        if (!['posted','waiting_seller'].includes(deal.status))
          return NextResponse.json({ error: 'Deal not available' }, { status: 400 });
        if (isBuyer || isMiddleman)
          return NextResponse.json({ error: 'ไม่สามารถเป็นผู้ขายได้' }, { status: 400 });
        if (deal.sellerId)
          return NextResponse.json({ error: 'มีผู้ขายแล้ว' }, { status: 400 });
        const newSt = deal.buyerId ? 'buyer_joined' : 'waiting_buyer';
        updates = { sellerId: uid, sellerName: currentUser.name || '', status: newSt };
        systemMsg = `${currentUser.name} เข้าร่วมเป็นผู้ขาย`;
        break;
      }
      case 'select_middleman': {
        if (!isBuyer)
          return NextResponse.json({ error: 'ผู้ซื้อเท่านั้นที่เลือกคนกลางได้' }, { status: 403 });
        if (!body.middlemanId || !body.middlemanName)
          return NextResponse.json({ error: 'Missing middlemanId' }, { status: 400 });
        // กฎสำคัญ: ผู้ซื้อ/ผู้ขาย/คนกลาง ในดีลเดียวกันต้องเป็นคนละคนเสมอ
        if (body.middlemanId === deal.buyerId)
          return NextResponse.json({ error: 'ผู้ซื้อไม่สามารถเป็นคนกลางในดีลของตัวเองได้' }, { status: 400 });
        if (body.middlemanId === deal.sellerId)
          return NextResponse.json({ error: 'ผู้ขายไม่สามารถเป็นคนกลางในดีลที่ตัวเองขายได้' }, { status: 400 });
        updates = { middlemanId: body.middlemanId, middlemanName: body.middlemanName, status: 'terms_pending' };
        systemMsg = `ผู้ซื้อเลือก ${body.middlemanName} เป็นคนกลาง`;
        break;
      }
      case 'accept_terms': {
        if (isSeller)    updates.sellerAcceptedTerms    = true;
        if (isMiddleman) updates.middlemanAcceptedTerms = true;
        if (isBuyer)     updates.buyerAcceptedTerms     = true;
        const sc = isSeller    ? true : deal.sellerAcceptedTerms;
        const mc = isMiddleman ? true : deal.middlemanAcceptedTerms;
        const bc = isBuyer     ? true : deal.buyerAcceptedTerms;
        const hasMm = !!deal.middlemanId;
        if (sc && bc && (!hasMm || mc)) {
          updates.status = 'payment_pending';
          systemMsg = 'ทุกฝ่ายยอมรับเงื่อนไขแล้ว — รอผู้ซื้อโอนเงิน';
        } else {
          const who = isSeller ? 'ผู้ขาย' : isMiddleman ? 'คนกลาง' : 'ผู้ซื้อ';
          systemMsg = `${who} ยอมรับเงื่อนไขแล้ว`;
        }
        break;
      }
      case 'upload_payment': {
        if (!isBuyer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        updates = { paymentSlipFileId: body.fileId, status: 'payment_uploaded' };
        systemMsg = 'ผู้ซื้ออัปโหลดหลักฐานการโอนเงินแล้ว';
        break;
      }
      case 'confirm_payment': {
        if (!isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        updates = { status: 'packing', middlemanConfirmedPayment: true };
        systemMsg = 'คนกลางยืนยันรับเงินแล้ว — ผู้ขายเริ่มแพ็คสินค้า';
        break;
      }
      case 'add_evidence': {
        const { evidenceType, fileId, fileName, content } = body;
        const existing = (() => { try { return JSON.parse(deal.evidenceData || '[]'); } catch { return []; } })();
        existing.push({
          type: evidenceType,
          fileId: fileId || '',
          fileName: fileName || '',
          content: content ? String(content).slice(0, 200) : '',
          uploadedBy: uid,
          uploaderName: currentUser.name || '',
          at: new Date().toISOString(),
        });
        // Trim to last 20 evidence items to avoid field size overflow
        const trimmed = existing.slice(-20);
        updates.evidenceData = JSON.stringify(trimmed);
        const label: Record<string, string> = {
          packing: 'วิดีโอแพ็คของ', testing: 'วิดีโอทดสอบสินค้า',
          receive: 'วิดีโอรับสินค้า', check: 'วิดีโอตรวจสินค้า',
          chat: 'หลักฐานจากแชท', chat_text: 'ข้อความแชท', call: 'วิดีโอคอลที่บันทึก',
        };
        systemMsg = `เก็บ${label[evidenceType] || evidenceType}เป็นหลักฐานแล้ว`;
        break;
      }
      case 'seller_done_packing': {
        if (!isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (deal.dealType === 'simple') {
          // โหมดง่าย: ผู้ขายส่งตรงถึงผู้ซื้อ ไม่ผ่านคนกลางบุคคล
          updates = { status: 'shipped_to_buyer', trackingToBuyer: body.trackingNumber || '' };
          systemMsg = `ผู้ขายจัดส่งสินค้าให้ผู้ซื้อโดยตรงแล้ว (เลขพัสดุ: ${body.trackingNumber || '-'}) — ผู้ซื้ออย่าลืมถ่ายวิดีโอก่อนแกะกล่อง`;
        } else {
          updates = { status: 'shipped_to_middleman', trackingToMiddleman: body.trackingNumber || '' };
          systemMsg = `ผู้ขายจัดส่งสินค้าแล้ว (เลขพัสดุ: ${body.trackingNumber || '-'})`;
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
        updates = { buyerConfirmedCheck: true };
        systemMsg = 'ผู้ซื้อยืนยันว่าสินค้าไม่มีปัญหา';
        break;
      }
      case 'middleman_ship_to_buyer': {
        if (!isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (!deal.buyerConfirmedCheck) return NextResponse.json({ error: 'รอผู้ซื้อยืนยันก่อน' }, { status: 400 });
        updates = { status: 'shipped_to_buyer', trackingToBuyer: body.trackingNumber || '' };
        systemMsg = `คนกลางจัดส่งให้ผู้ซื้อแล้ว (เลขพัสดุ: ${body.trackingNumber || '-'})`;
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
        updates = { status: 'cancelled', rejectReason: body.reason || '' };
        systemMsg = `ยกเลิกดีล${body.reason ? ': ' + body.reason : ''}`;
        break;
      }
      case 'dispute': {
        updates = { status: 'disputed', rejectReason: body.reason || '' };
        systemMsg = `แจ้งปัญหา: ${body.reason || 'ไม่ระบุ'}`;
        break;
      }
      case 'start_call': {
        // ใครก็ตามที่ล็อกอินและเปิดคอลในดีลนี้ (รวมถึงคนที่มาจากลิงก์แชร์) → แจ้งผู้ร่วมดีลทุกคน
        const isParty = isSeller || isMiddleman || isBuyer;
        systemMsg = `📹 ${currentUser.name || 'ผู้ใช้'}${isParty ? '' : ' (ผู้สนใจจากลิงก์แชร์)'} เข้าร่วมวิดีโอคอล — กดเข้าร่วมได้เลย`;
        break;
      }
      case 'meetup_set_location': {
        // แต่ละฝ่ายระบุที่อยู่ของตัวเอง (ตำบล/อำเภอ/จังหวัด) — ใช้ตกลงจุดนัดพบ
        if (deal.dealType !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const loc = body.loc || {};
        const clean = {
          province: String(loc.province || '').slice(0, 60),
          amphoe: String(loc.amphoe || '').slice(0, 80),
          tambon: String(loc.tambon || '').slice(0, 80),
        };
        if (!clean.province || !clean.amphoe || !clean.tambon)
          return NextResponse.json({ error: 'กรุณาเลือกที่อยู่ให้ครบถึงระดับตำบล' }, { status: 400 });
        const md = (() => { try { return JSON.parse(deal.meetupData || '{}'); } catch { return {}; } })();
        if (md.buyerSlip || md.sellerSlip) return NextResponse.json({ error: 'วางเงินประกันแล้ว แก้ที่อยู่ไม่ได้' }, { status: 400 });
        if (isBuyer) md.buyerLoc = clean; else md.sellerLoc = clean;
        updates.meetupData = JSON.stringify(md);
        systemMsg = `📍 ${isBuyer ? 'ผู้ซื้อ' : 'ผู้ขาย'}ระบุที่อยู่แล้ว: ต.${clean.tambon} อ.${clean.amphoe} จ.${clean.province}`;
        break;
      }
      case 'meetup_propose': {
        // ต่อรองยอดประกัน: ฝ่ายหนึ่งเสนอยอดใหม่ → อีกฝ่ายต้องกดยอมรับจึงมีผล
        if (deal.dealType !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const amount = Math.round(Number(body.amount));
        if (!(amount >= 50 && amount <= 999999999)) return NextResponse.json({ error: 'ยอดประกันไม่ถูกต้อง (ขั้นต่ำ ฿50)' }, { status: 400 });
        const md = (() => { try { return JSON.parse(deal.meetupData || '{}'); } catch { return {}; } })();
        if (md.buyerSlip || md.sellerSlip) return NextResponse.json({ error: 'มีการวางเงินประกันแล้ว เปลี่ยนยอดไม่ได้ — ติดต่อทีมงานหากจำเป็น' }, { status: 400 });
        md.pendingDeposit = amount;
        md.pendingBy = isBuyer ? 'buyer' : 'seller';
        // ข้อเสนออาจพ่วงจุดนัดพบมาด้วย เช่น "ผู้ขายเดินทางไปหาผู้ซื้อ" หรือ "เจอกันที่ปั๊ม ปตท. วังน้อย"
        if (body.meetLabel) md.pendingMeetLabel = String(body.meetLabel).slice(0, 200);
        updates.meetupData = JSON.stringify(md);
        systemMsg = `💰 ${isBuyer ? 'ผู้ซื้อ' : 'ผู้ขาย'}เสนอ${md.pendingMeetLabel ? `จุดนัด "${md.pendingMeetLabel}" + ` : 'เปลี่ยน'}เงินประกัน ฿${amount.toLocaleString()}/ฝ่าย — รออีกฝ่ายกดยอมรับ`;
        break;
      }
      case 'meetup_respond': {
        if (deal.dealType !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const md = (() => { try { return JSON.parse(deal.meetupData || '{}'); } catch { return {}; } })();
        if (!md.pendingDeposit) return NextResponse.json({ error: 'ไม่มีข้อเสนอที่รอการตอบรับ' }, { status: 400 });
        const meSide = isBuyer ? 'buyer' : 'seller';
        if (body.accept) {
          if (md.pendingBy === meSide) return NextResponse.json({ error: 'ผู้เสนอกดยอมรับเองไม่ได้ — ต้องให้อีกฝ่ายยอมรับ' }, { status: 400 });
          md.deposit = md.pendingDeposit;
          if (md.pendingMeetLabel) md.meetLabel = md.pendingMeetLabel;
          systemMsg = `✅ ตกลงกันแล้ว${md.meetLabel ? `: ${md.meetLabel}` : ''} — เงินประกัน ฿${Number(md.pendingDeposit).toLocaleString()}/ฝ่าย วางเงินได้เลย`;
        } else {
          systemMsg = md.pendingBy === meSide
            ? `↩️ ${meSide === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย'}ยกเลิกข้อเสนอ`
            : `❌ ${meSide === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย'}ปฏิเสธข้อเสนอ ฿${Number(md.pendingDeposit).toLocaleString()} — เสนอใหม่หรือคุยกันในแชทได้`;
        }
        delete md.pendingDeposit;
        delete md.pendingBy;
        delete md.pendingMeetLabel;
        updates.meetupData = JSON.stringify(md);
        break;
      }
      case 'meetup_deposit': {
        // รับประกันเดินทาง: แต่ละฝ่ายอัปสลิปวางเงินประกัน+ค่าบริการ
        if (deal.dealType !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (!body.fileId) return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
        const md = (() => { try { return JSON.parse(deal.meetupData || '{}'); } catch { return {}; } })();
        if (!md.deposit) return NextResponse.json({ error: 'ต้องตกลงจุดนัดพบและยอดประกันกับอีกฝ่ายก่อนวางเงิน' }, { status: 400 });
        if (isBuyer) md.buyerSlip = body.fileId; else md.sellerSlip = body.fileId;
        updates.meetupData = JSON.stringify(md);
        if (md.buyerSlip && md.sellerSlip) {
          updates.status = 'meetup_ready';
          systemMsg = '✅ ทั้งสองฝ่ายวางเงินประกันแล้ว — นัดเจอกันได้เลย เมื่อเจอกันสำเร็จกดยืนยันทั้งคู่เพื่อรับเงินประกันคืน';
        } else {
          systemMsg = `${isBuyer ? 'ผู้ซื้อ' : 'ผู้ขาย'}วางเงินประกันเดินทางแล้ว — รออีกฝ่าย`;
        }
        break;
      }
      case 'meetup_depart': {
        // กดเริ่มออกเดินทาง — แจ้งอีกฝ่ายทันที (โอนเสร็จไม่ได้แปลว่าออกเดินทางเลย)
        if (deal.dealType !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (deal.status !== 'meetup_ready') return NextResponse.json({ error: 'ต้องวางเงินประกันครบทั้งสองฝ่ายก่อน' }, { status: 400 });
        const md = (() => { try { return JSON.parse(deal.meetupData || '{}'); } catch { return {}; } })();
        if (isBuyer) md.buyerDepartedAt = new Date().toISOString();
        else md.sellerDepartedAt = new Date().toISOString();
        updates.meetupData = JSON.stringify(md);
        systemMsg = `🚗 ${isBuyer ? 'ผู้ซื้อ' : 'ผู้ขาย'}เริ่มออกเดินทางแล้ว — มุ่งหน้าสู่จุดนัดพบ`;
        break;
      }
      case 'meetup_position': {
        // อัปเดตตำแหน่งระหว่างเดินทาง (เงียบ — ไม่ลงแชท ไม่แจ้งเตือน อีกฝ่ายเห็นในแผงนัดรับ)
        if (deal.dealType !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const lat = Number(body.lat), lng = Number(body.lng);
        if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
          return NextResponse.json({ error: 'พิกัดไม่ถูกต้อง' }, { status: 400 });
        const md = (() => { try { return JSON.parse(deal.meetupData || '{}'); } catch { return {}; } })();
        const pos = { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5, at: new Date().toISOString() };
        if (isBuyer) md.buyerPos = pos; else md.sellerPos = pos;
        updates.meetupData = JSON.stringify(md);
        // ไม่ตั้ง systemMsg — อัปเดตเงียบ
        break;
      }
      case 'meetup_met': {
        if (deal.dealType !== 'meetup') return NextResponse.json({ error: 'ดีลนี้ไม่ใช่รับประกันเดินทาง' }, { status: 400 });
        if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (deal.status !== 'meetup_ready') return NextResponse.json({ error: 'ต้องวางเงินประกันครบทั้งสองฝ่ายก่อน' }, { status: 400 });
        const md = (() => { try { return JSON.parse(deal.meetupData || '{}'); } catch { return {}; } })();
        if (isBuyer) md.buyerMet = true; else md.sellerMet = true;
        updates.meetupData = JSON.stringify(md);
        if (md.buyerMet && md.sellerMet) {
          updates.status = 'completed';
          systemMsg = '🎉 นัดเจอสำเร็จทั้งสองฝ่าย! บริษัท คนกลาง จำกัด จะโอนเงินประกันคืนให้ทั้งคู่เต็มจำนวน (หักเฉพาะค่าบริการ)';
        } else {
          systemMsg = `${isBuyer ? 'ผู้ซื้อ' : 'ผู้ขาย'}ยืนยันว่านัดเจอสำเร็จ — รออีกฝ่ายยืนยัน`;
        }
        break;
      }
      case 'visit': {
        // มีคนเปิดห้องดีล (รวมคนคลิกลิงก์แชร์) → แจ้งผู้ร่วมดีลคนอื่น ไม่ลงข้อความในแชท
        const roleLabel = isSeller ? 'ผู้ขาย' : isBuyer ? 'ผู้ซื้อ' : isMiddleman ? 'คนกลาง' : 'ผู้สนใจจากลิงก์แชร์';
        systemMsg = `👀 ${currentUser.name || 'ผู้ใช้'} (${roleLabel}) เข้ามาดูห้องดีล`;
        writeChatMsg = false;
        break;
      }
      case 'price_propose': {
        // เสนอราคาสินค้า + ผู้จ่ายค่าบริการ → รีเซ็ต รอทุกฝ่ายกดตกลงใหม่ (เปลี่ยนได้ก่อนชำระเงิน)
        if (!isSeller && !isBuyer && !isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (!['posted', 'waiting_seller', 'waiting_buyer', 'buyer_joined', 'terms_pending', 'payment_pending'].includes(deal.status))
          return NextResponse.json({ error: 'ดีลเลยขั้นตอนตกลงราคาแล้ว' }, { status: 400 });
        const price = Math.round(Number(body.price));
        const feePayer = ['buyer', 'seller', 'split'].includes(body.feePayer) ? body.feePayer : 'buyer';
        if (!(price >= 1 && price <= 999999999)) return NextResponse.json({ error: 'ราคาไม่ถูกต้อง' }, { status: 400 });
        const pd = (() => { try { return JSON.parse(deal.priceData || '{}'); } catch { return {}; } })();
        const who = isSeller ? 'seller' : isBuyer ? 'buyer' : 'middleman';
        pd.proposedPrice = price; pd.proposedFeePayer = feePayer; pd.proposedBy = who; pd.agreed = false;
        pd.sellerAgreed = isSeller; pd.buyerAgreed = isBuyer; pd.middlemanAgreed = isMiddleman;
        updates.priceData = JSON.stringify(pd);
        const fpLabel = feePayer === 'buyer' ? 'ผู้ซื้อจ่าย' : feePayer === 'seller' ? 'ผู้ขายจ่าย' : 'หารครึ่ง';
        systemMsg = `💬 ${who === 'seller' ? 'ผู้ขาย' : who === 'buyer' ? 'ผู้ซื้อ' : 'คนกลาง'}เสนอราคา ฿${price.toLocaleString()} · ค่าบริการ: ${fpLabel} — รอทุกฝ่ายกดตกลง`;
        break;
      }
      case 'price_agree': {
        if (!isSeller && !isBuyer && !isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const pd = (() => { try { return JSON.parse(deal.priceData || '{}'); } catch { return {}; } })();
        if (!pd.proposedPrice) return NextResponse.json({ error: 'ยังไม่มีข้อเสนอราคาให้ตกลง' }, { status: 400 });
        if (isSeller) pd.sellerAgreed = true;
        if (isBuyer) pd.buyerAgreed = true;
        if (isMiddleman) pd.middlemanAgreed = true;
        const hasMm = !!deal.middlemanId;
        const allAgreed = pd.sellerAgreed && pd.buyerAgreed && (!hasMm || pd.middlemanAgreed);
        if (allAgreed) {
          pd.agreed = true; pd.feePayer = pd.proposedFeePayer;
          updates.price = pd.proposedPrice;
          updates.feePayer = pd.proposedFeePayer;
          if (hasMm) pd.mmDepositHeld = await getMmDeposit(String(deal.middlemanId));
          const fpLabel = pd.feePayer === 'buyer' ? 'ผู้ซื้อจ่าย' : pd.feePayer === 'seller' ? 'ผู้ขายจ่าย' : 'หารครึ่ง';
          systemMsg = `✅ ทุกฝ่ายตกลงราคา ฿${Number(pd.proposedPrice).toLocaleString()} · ค่าบริการ: ${fpLabel} แล้ว${hasMm ? ` (คนกลางวางเครดิตประกัน ฿${Number(pd.mmDepositHeld).toLocaleString()})` : ''}`;
        } else {
          const who = isSeller ? 'ผู้ขาย' : isBuyer ? 'ผู้ซื้อ' : 'คนกลาง';
          systemMsg = `${who}${isMiddleman ? ' อนุมัติดีล + วางเครดิตประกัน' : ' ตกลงราคา'}แล้ว — รอฝ่ายอื่น`;
        }
        updates.priceData = JSON.stringify(pd);
        break;
      }
      case 'evidence_done': {
        // แต่ละฝ่ายยืนยันว่าเก็บหลักฐาน (แชต/วิดีโอคอล/รูป) เรียบร้อยแล้ว ก่อนเข้าขั้นโอนเงิน
        if (!isSeller && !isBuyer && !isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const pd = (() => { try { return JSON.parse(deal.priceData || '{}'); } catch { return {}; } })();
        if (isSeller) pd.evidenceDoneSeller = true;
        if (isBuyer) pd.evidenceDoneBuyer = true;
        if (isMiddleman) pd.evidenceDoneMiddleman = true;
        const hasMm = !!deal.middlemanId;
        const allDone = pd.evidenceDoneSeller && pd.evidenceDoneBuyer && (!hasMm || pd.evidenceDoneMiddleman);
        updates.priceData = JSON.stringify(pd);
        systemMsg = allDone ? '📁 ทุกฝ่ายยืนยันเก็บหลักฐานเรียบร้อย — เข้าสู่ขั้นตอนโอนเงินได้' : `${isSeller ? 'ผู้ขาย' : isBuyer ? 'ผู้ซื้อ' : 'คนกลาง'}ยืนยันเก็บหลักฐานแล้ว — รอฝ่ายอื่น`;
        break;
      }
      case 'seller_fee_paid': {
        // ผู้ขายโอนค่าบริการส่วนของตัวเองทันที (แยกจากยอดสินค้า) แล้วอัปสลิป
        if (!isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (!body.fileId) return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
        const pd = (() => { try { return JSON.parse(deal.priceData || '{}'); } catch { return {}; } })();
        pd.sellerFeeSlip = String(body.fileId);
        updates.priceData = JSON.stringify(pd);
        systemMsg = 'ผู้ขายโอนค่าบริการส่วนของตนแล้ว — รอศูนย์กลางตรวจสอบ';
        break;
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    let updated = Object.keys(updates).length > 0
      ? await databases.updateDocument(DB_ID, COL_DEALS, id, updates)
      : deal;

    // กัน race ตอนยอมรับเงื่อนไข: ถ้าหลังอัปเดตแล้วทุกฝ่ายยอมรับครบแต่สถานะยังค้าง → ดันไปขั้นโอนเงินทันที
    if (['buyer_joined', 'terms_pending'].includes(String(updated.status))
      && updated.sellerAcceptedTerms && updated.buyerAcceptedTerms
      && (!updated.middlemanId || updated.middlemanAcceptedTerms)) {
      try {
        updated = await databases.updateDocument(DB_ID, COL_DEALS, id, { status: 'payment_pending' });
        if (!systemMsg || /ยอมรับเงื่อนไขแล้ว$/.test(systemMsg)) systemMsg = 'ทุกฝ่ายยอมรับเงื่อนไขแล้ว — รอผู้ซื้อโอนเงิน';
      } catch { /* ปล่อยผ่าน */ }
    }

    if (systemMsg) {
      if (writeChatMsg) {
        await databases.createDocument(DB_ID, COL_MSGS, ID.unique(), {
          dealId: id, senderId: 'system', senderName: 'ระบบ',
          role: 'system', type: 'system', content: systemMsg, fileId: '', fileName: '',
          createdAt: new Date().toISOString(),
        }).catch(() => {});
      }

      // แจ้งเตือนทุกฝ่ายในดีล ยกเว้นคนที่กดเอง — กระดิ่งใน Nav จะเด้งให้รู้ทันที
      // (กรณีเลือกคนกลาง: คนกลางได้แจ้งเตือนเฉพาะตัวด้านล่าง จึงตัดออกจากรอบนี้กันแจ้งซ้ำ)
      const recipients = [updated.sellerId, updated.buyerId, updated.middlemanId]
        .filter((x): x is string => typeof x === 'string' && !!x && x !== uid)
        .filter(x => !(action === 'select_middleman' && x === updated.middlemanId));
      if (recipients.length) {
        const title =
          action === 'start_call' ? `📹 วิดีโอคอล: ${updated.title || 'ดีล'}` :
          action === 'visit' ? `👀 มีคนเข้ามาดูห้องดีล: ${updated.title || ''}` :
          `ดีล: ${updated.title || 'ไม่มีชื่อ'}`;
        await notifyUsers(databases, recipients, {
          title,
          body: systemMsg,
          link: action === 'start_call' ? `/deal/${id}?call=1` : `/deal/${id}`,
        });
      }

      // แจ้งคนกลางแบบเจาะจงเมื่อถูกเลือก — ให้รู้ชัดว่า "คุณ" ถูกเลือก ไม่ใช่แค่ความเคลื่อนไหวของดีล
      if (action === 'select_middleman' && updated.middlemanId && updated.middlemanId !== uid) {
        await notifyUsers(databases, [updated.middlemanId as string], {
          title: '🤝 คุณถูกเลือกเป็นคนกลาง!',
          body: `ดีล "${updated.title || 'ไม่มีชื่อ'}" มูลค่า ฿${Number(updated.price || 0).toLocaleString()} — เข้าไปยอมรับเงื่อนไขเพื่อเริ่มงานได้เลย`,
          link: `/deal/${id}`,
        });
      }

      // แจ้งเตือนแอดมินเมื่อมีเงินเข้า/ข้อพิพาท — ให้รู้ทันทีว่าต้องเข้าไปตรวจ
      if (action === 'upload_payment' || action === 'dispute') {
        const admins = await getAdminIds();
        if (admins.length) {
          const isPay = action === 'upload_payment';
          await notifyUsers(databases, admins, {
            title: isPay ? `💰 มีการโอนเงินรอตรวจสอบ: ${updated.title || 'ดีล'}` : `⚠️ มีข้อพิพาท: ${updated.title || 'ดีล'}`,
            body: isPay
              ? `ผู้ซื้อโอนเงิน ฿${Number(updated.price || 0).toLocaleString()} แล้ว — เข้าไปตรวจสอบและอนุมัติที่หน้าการเงิน`
              : `${systemMsg} — เข้าไปจัดการที่หน้าดีล & ข้อพิพาท`,
            link: isPay ? '/admin/finance' : '/admin/deals',
          });
        }
      }
    }

    return NextResponse.json({ deal: updated });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
