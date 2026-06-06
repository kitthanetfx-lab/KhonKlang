import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Databases, Users, ID, Query } from 'node-appwrite';

const DB_ID  = 'khonklang_db';
const COL_DEALS = 'deals';
const COL_MSGS  = 'messages';

function getAdminClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return { databases: new Databases(client), users: new Users(client) };
}

function getUserFromJwt(jwt: string) {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);
  return new Account(c).get();
}

// GET /api/deals/[id] — fetch single deal
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await getUserFromJwt(jwt);
    const { databases } = getAdminClient();
    const deal = await databases.getDocument(DB_ID, COL_DEALS, id);
    return NextResponse.json({ deal });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH /api/deals/[id] — step transition
// body: { action, ...data }
// actions: join_as_buyer | accept_terms | upload_evidence | confirm_payment |
//          mark_packing_done | mark_shipped_to_middleman | mark_middleman_received |
//          mark_check_done | mark_shipped_to_buyer | mark_delivered | cancel | dispute
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = await getUserFromJwt(jwt);
    const uid = currentUser.$id;
    const body = await req.json();
    const { action } = body;

    const { databases } = getAdminClient();
    const deal = await databases.getDocument(DB_ID, COL_DEALS, id);

    const isSeller    = deal.sellerId    === uid;
    const isMiddleman = deal.middlemanId === uid;
    const isBuyer     = deal.buyerId     === uid;

    let updates: Record<string, unknown> = {};
    let systemMsg = '';

    switch (action) {
      case 'join_as_buyer': {
        if (deal.status !== 'posted') return NextResponse.json({ error: 'Deal not available' }, { status: 400 });
        if (isSeller || isMiddleman) return NextResponse.json({ error: 'ไม่สามารถเป็นผู้ซื้อได้' }, { status: 400 });
        updates = { buyerId: uid, buyerName: currentUser.name || '', status: 'buyer_joined' };
        systemMsg = `${currentUser.name} เข้าร่วมเป็นผู้ซื้อ`;
        break;
      }
      case 'accept_terms': {
        if (isSeller)    updates.sellerAcceptedTerms    = true;
        if (isMiddleman) updates.middlemanAcceptedTerms = true;
        if (isBuyer)     updates.buyerAcceptedTerms     = true;
        // Check if all accepted -> move to payment_pending
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
        systemMsg = 'ผู้ซื้ออัปโหลดหลักฐานการโอนเงินแล้ว — รอคนกลางยืนยัน';
        break;
      }
      case 'confirm_payment': {
        if (!isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        updates = { status: 'packing', middlemanConfirmedPayment: true };
        systemMsg = 'คนกลางยืนยันรับเงินแล้ว — ผู้ขายเริ่มแพ็คสินค้า';
        break;
      }
      case 'add_evidence': {
        // seller adds packing/testing video; middleman adds receive/check video
        const { evidenceType, fileId, fileName } = body;
        const field = evidenceType + 'Evidence';
        const existing = (() => { try { return JSON.parse(deal[field] || '[]'); } catch { return []; } })();
        existing.push({ fileId, fileName, uploadedBy: uid, at: new Date().toISOString() });
        updates[field] = JSON.stringify(existing);
        const label: Record<string, string> = {
          packing: 'วิดีโอแพ็คของ', testing: 'วิดีโอทดสอบสินค้า',
          receive: 'วิดีโอรับสินค้า', check: 'วิดีโอตรวจสินค้า',
        };
        systemMsg = `อัปโหลด${label[evidenceType] || evidenceType}แล้ว`;
        break;
      }
      case 'seller_done_packing': {
        if (!isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        updates = { status: 'shipped_to_middleman', trackingToMiddleman: body.trackingNumber || '' };
        systemMsg = `ผู้ขายจัดส่งสินค้าแล้ว (เลขพัสดุ: ${body.trackingNumber || '-'})`;
        break;
      }
      case 'middleman_received': {
        if (!isMiddleman) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        updates = { status: 'middleman_checking', middlemanReceivedAt: new Date().toISOString() };
        systemMsg = 'คนกลางรับสินค้าแล้ว — กำลังตรวจสอบ';
        break;
      }
      case 'buyer_confirm_check': {
        if (!isBuyer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        updates = { buyerConfirmedCheck: true };
        systemMsg = 'ผู้ซื้อยืนยันว่าสินค้าไม่มีปัญหา — คนกลางจัดส่งให้ผู้ซื้อ';
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
        updates = { status: 'completed', completedAt: new Date().toISOString() };
        systemMsg = 'ผู้ซื้อรับสินค้าแล้ว — ดีลเสร็จสมบูรณ์ 🎉';
        break;
      }
      case 'cancel': {
        if (!isSeller && !isMiddleman && !isBuyer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        updates = { status: 'cancelled', rejectReason: body.reason || '' };
        systemMsg = `ยกเลิกดีล${body.reason ? ': ' + body.reason : ''}`;
        break;
      }
      case 'dispute': {
        updates = { status: 'disputed', rejectReason: body.reason || '' };
        systemMsg = `แจ้งปัญหา: ${body.reason || 'ไม่ระบุ'}`;
        break;
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const updated = await databases.updateDocument(DB_ID, COL_DEALS, id, updates);

    // Post system message to chat
    if (systemMsg) {
      await databases.createDocument(DB_ID, COL_MSGS, ID.unique(), {
        dealId: id, senderId: 'system', senderName: 'ระบบ',
        role: 'system', type: 'system', content: systemMsg, fileId: '', fileName: '',
        createdAt: new Date().toISOString(),
      }).catch(() => {});
    }

    return NextResponse.json({ deal: updated });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
