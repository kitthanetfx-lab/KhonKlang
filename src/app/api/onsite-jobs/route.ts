import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser } from '@/lib/supabaseServer';
import { readServiceControlsConfig } from '../_lib/appConfig';

// GET /api/onsite-jobs?role=buyer|middleman&province=X&status=open
export async function GET(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();
    const { searchParams } = req.nextUrl;
    const role = searchParams.get('role') || 'buyer';
    const province = searchParams.get('province') || '';
    const status = searchParams.get('status') || '';

    let query;
    if (role === 'buyer') {
      query = db.from('onsite_jobs').select('*').eq('buyer_id', me.id).order('created_at', { ascending: false }).limit(50);
    } else {
      // middleman sees open jobs + their own assigned jobs
      query = db.from('onsite_jobs').select('*').order('created_at', { ascending: false }).limit(100);
      if (province) query = query.eq('seller_province', province);
      if (status) query = query.eq('status', status);
      else query = query.eq('status', 'open');
    }

    const { data } = await query;
    return NextResponse.json({ jobs: data || [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/onsite-jobs — buyer creates a job
export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();
    const body = await req.json();
    const { itemDescription, itemPrice, sellerLocation, sellerProvince, sellerContact, maxBudget } = body;
    if (!itemDescription || !sellerLocation)
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });

    const services = await readServiceControlsConfig(db);
    if (!services.onsite.enabled) {
      return NextResponse.json({ error: services.onsite.note || 'บริการนัดออนไซต์ถูกปิดชั่วคราว' }, { status: 403 });
    }

    const { data: profile } = await db.from('profiles').select('display_name').eq('id', me.id).maybeSingle();

    const { data: doc, error } = await db.from('onsite_jobs').insert({
      buyer_id: me.id,
      buyer_name: profile?.display_name || '',
      item_description: itemDescription,
      item_price: Number(itemPrice) || 0,
      seller_location: sellerLocation,
      seller_province: sellerProvince || '',
      seller_contact: sellerContact || '',
      max_budget: Number(maxBudget) || 0,
      status: 'open',
    }).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ job: doc });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
