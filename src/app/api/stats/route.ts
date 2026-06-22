import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseServer';
import { toYouTubeEmbedUrl } from '@/lib/youtube';

export const revalidate = 60; // cache 60s — public homepage stats

export async function GET() {
  try {
    const db = getAdminClient();

    const [dealsRes, middlemenRes, platformRes, listingsRes, meetupRes, scamRes, mmReviewRes, sellersRes, membersRes, feeConfigRes] = await Promise.allSettled([
      db.from('deals').select('price', { count: 'exact' }).eq('status', 'completed').limit(1000),
      db.from('middleman_applications').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      db.from('reviews').select('rating', { count: 'exact' }).eq('target_role', 'platform').limit(1000),
      // ประกาศขายที่เปิดอยู่ในตลาด — นับต่อหมวดหมู่
      db.from('deals').select('category', { count: 'exact' }).eq('status', 'posted').eq('source', 'listing').limit(1000),
      // ดีลนัดรับ (ประกันการเดินทาง) ทั้งหมด
      db.from('deals').select('id', { count: 'exact', head: true }).eq('deal_type', 'meetup'),
      // รายชื่อคนโกงที่ตรวจสอบและเผยแพร่แล้ว
      db.from('scam_reports').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      // รีวิวคนกลาง — ใช้คำนวณคะแนนเฉลี่ย
      db.from('reviews').select('rating', { count: 'exact' }).eq('target_role', 'middleman').limit(1000),
      // ผู้ขายที่ผ่านการอนุมัติแล้วในระบบ
      db.from('seller_applications').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      // สมาชิกทั้งหมดที่ลงทะเบียนในระบบ
      db.from('profiles').select('id', { count: 'exact', head: true }),
      // ลิงก์วีดีโอโปรโมตหน้าแรก (ตั้งจากหน้าควบคุมสถานะบริการ)
      db.from('fee_config').select('promo_video_url').eq('id', true).maybeSingle(),
    ]);

    const completedDeals = dealsRes.status === 'fulfilled' ? (dealsRes.value.count || 0) : 0;
    const protectedValue = dealsRes.status === 'fulfilled'
      ? (dealsRes.value.data || []).reduce((s, d) => s + (Number(d.price) || 0), 0)
      : 0;
    const middlemen = middlemenRes.status === 'fulfilled' ? (middlemenRes.value.count || 0) : 0;
    const sellers = sellersRes.status === 'fulfilled' ? (sellersRes.value.count || 0) : 0;
    const totalMembers = membersRes.status === 'fulfilled' ? (membersRes.value.count || 0) : 0;

    let satisfaction = 0, reviewCount = 0;
    if (platformRes.status === 'fulfilled') {
      const ratings = (platformRes.value.data || []).map(d => Number(d.rating) || 0).filter(Boolean);
      reviewCount = platformRes.value.count || 0;
      if (ratings.length) satisfaction = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length / 5) * 1000) / 10;
    }

    // นับประกาศต่อหมวด (ค่าจริงจากประกาศที่เปิดอยู่เท่านั้น)
    const categories: Record<string, number> = {};
    let listingTotal = 0;
    if (listingsRes.status === 'fulfilled') {
      listingTotal = listingsRes.value.count || 0;
      for (const d of listingsRes.value.data || []) {
        const c = (d.category || '').trim() || 'อื่นๆ';
        categories[c] = (categories[c] || 0) + 1;
      }
    }

    const meetupDeals = meetupRes.status === 'fulfilled' ? (meetupRes.value.count || 0) : 0;
    const scamRecords = scamRes.status === 'fulfilled' ? (scamRes.value.count || 0) : 0;

    let middlemanRating = 0, middlemanReviews = 0;
    if (mmReviewRes.status === 'fulfilled') {
      const ratings = (mmReviewRes.value.data || []).map(d => Number(d.rating) || 0).filter(Boolean);
      middlemanReviews = mmReviewRes.value.count || 0;
      if (ratings.length) middlemanRating = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
    }

    // กันพลาด: เผื่อมีลิงก์ YouTube รูปแบบ watch?v=/youtu.be ตกค้างจากก่อนแก้ไข ให้แปลงเป็น embed URL เสมอ
    const promoVideoUrl = feeConfigRes.status === 'fulfilled'
      ? toYouTubeEmbedUrl(feeConfigRes.value.data?.promo_video_url || '')
      : '';

    return NextResponse.json({
      completedDeals, protectedValue, middlemen, satisfaction, reviewCount,
      categories, listingTotal, meetupDeals, scamRecords, middlemanRating, middlemanReviews,
      sellers, totalMembers, promoVideoUrl,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
