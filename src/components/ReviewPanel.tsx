'use client';
import React, { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { authHeaders } from '@/lib/supabase';

type Role = 'buyer' | 'seller' | 'middleman' | 'platform';

const ROLE_LABEL: Record<Role, string> = {
  buyer: 'ผู้ซื้อ', seller: 'ผู้ขาย', middleman: 'คนกลาง', platform: 'แพลตฟอร์มคนกลาง',
};
const QUICK_TAGS: Record<Role, string[]> = {
  seller:    ['ส่งของไว', 'สินค้าตรงปก', 'แพ็คดี', 'สื่อสารดี', 'ตรงเวลา'],
  middleman: ['ตรวจละเอียด', 'รวดเร็ว', 'มืออาชีพ', 'อธิบายชัดเจน', 'เป็นกลางดี'],
  buyer:     ['โอนไว', 'สื่อสารดี', 'ให้ความร่วมมือดี', 'ยืนยันไว', 'นัดหมายชัดเจน'],
  platform:  ['ใช้งานง่าย', 'รู้สึกปลอดภัย', 'ติดต่อทีมงานง่าย', 'ขั้นตอนชัดเจน', 'จะใช้อีกแน่นอน'],
};
const RATING_LABEL: Record<number, string> = {
  1: 'ควรปรับปรุง', 2: 'ยังไม่ดีพอ', 3: 'พอใช้', 4: 'ดีมาก', 5: 'ยอดเยี่ยม',
};
const ROLE_LABEL_SHORT: Record<string, string> = {
  buyer: 'ผู้ซื้อ', seller: 'ผู้ขาย', middleman: 'คนกลาง', platform: 'แพลตฟอร์ม',
};
const ROLE_AVATAR_BG: Record<string, string> = {
  buyer: 'var(--accent)', seller: '#6841d9', middleman: 'var(--green-500)', platform: 'var(--ink)',
};

interface DealParties {
  id: string;
  buyer_id: string; buyer_name: string;
  seller_id: string; seller_name: string;
  middleman_id: string; middleman_name: string;
}
interface RowState { rating: number; tags: string[] }
interface AllReviewItem {
  reviewer_name: string;
  reviewer_role: string;
  target_role: string;
  rating: number;
  tags: string[];
}

// ── StarDisplay: แสดงดาวแบบอ่านอย่างเดียว ─────────────────────────────────
function StarDisplay({ rating, size = 18 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24"
          fill={n <= rating ? '#d97706' : 'none'}
          stroke={n <= rating ? 'none' : '#c8a000'}
          strokeWidth={1.5}>
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      ))}
    </span>
  );
}

// ── AllReviewsSummary: สรุปคะแนนจากทุกฝ่าย ────────────────────────────────
function AllReviewsSummary({ byReviewer }: { byReviewer: Record<string, AllReviewItem[]> }) {
  const reviewerRoles = Object.keys(byReviewer);
  if (reviewerRoles.length === 0) return null;
  return (
    <div className="dr-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="dr-card-title">⭐ คะแนนที่ได้รับจากทุกฝ่าย</div>
      {reviewerRoles.map(reviewerRole => {
        const items = byReviewer[reviewerRole];
        const bg = ROLE_AVATAR_BG[reviewerRole] || 'var(--muted)';
        const reviewerName = items[0]?.reviewer_name || ROLE_LABEL_SHORT[reviewerRole] || reviewerRole;
        return (
          <div key={reviewerRole} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: '12px 14px', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: bg, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                {reviewerName.slice(0, 1)}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>{reviewerName}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{ROLE_LABEL_SHORT[reviewerRole] || reviewerRole}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', minWidth: 80 }}>→ {ROLE_LABEL_SHORT[item.target_role] || item.target_role}</div>
                  <StarDisplay rating={item.rating} size={16} />
                  <span style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600 }}>{item.rating}/5</span>
                  {item.tags && item.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {item.tags.map(tag => (
                        <span key={tag} style={{ fontSize: 11, background: '#f0f5ff', color: 'var(--accent)', border: '1px solid #c7d9ff', borderRadius: 999, padding: '2px 8px' }}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ReviewPanel: ฟอร์มให้คะแนน + แสดงสรุปรีวิวทุกฝ่าย ────────────────────
export function ReviewPanel({ deal, myRole, headers, onReviewed }: { deal: DealParties; myRole: Role | 'guest' | ''; headers: Record<string, string>; onReviewed?: () => void }) {
  const [reviewed, setReviewed] = useState<boolean | null>(null);
  const [allReviews, setAllReviews] = useState<AllReviewItem[] | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const isParty = myRole === 'buyer' || myRole === 'seller' || myRole === 'middleman';

  // Who do I review? Everyone in the deal except me, plus the platform.
  const targets: { role: Role; name: string }[] = [];
  if (isParty) {
    if (myRole !== 'buyer' && deal.buyer_id) targets.push({ role: 'buyer', name: deal.buyer_name || 'ผู้ซื้อ' });
    if (myRole !== 'seller' && deal.seller_id) targets.push({ role: 'seller', name: deal.seller_name || 'ผู้ขาย' });
    if (myRole !== 'middleman' && deal.middleman_id) targets.push({ role: 'middleman', name: deal.middleman_name || 'คนกลาง' });
    targets.push({ role: 'platform', name: 'คนกลาง (เว็บไซต์/แอป)' });
  }

  useEffect(() => {
    if (!isParty) return;
    // ถ้ายังไม่มี auth — แสดงฟอร์มทันที (สมมติยังไม่ได้รีวิว)
    if (!headers.Authorization) {
      setReviewed(false);
      setAllReviews([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      fetch(`/api/reviews?dealId=${deal.id}`, { headers }).then(r => r.json()),
      fetch(`/api/reviews?dealId=${deal.id}&all=true`, { headers }).then(r => r.json()).catch(() => ({ items: [] })),
    ]).then(([d1, d2]) => {
      if (!cancelled) {
        const alreadyReviewed = !!d1.reviewed;
        setReviewed(alreadyReviewed);
        setAllReviews(d2.items || []);
        if (alreadyReviewed) onReviewed?.();
      }
    }).catch(() => { if (!cancelled) { setReviewed(false); setAllReviews([]); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal.id, isParty, headers.Authorization]);

  if (!isParty) return null;
  // ถ้ายัง loading (reviewed === null) แสดง skeleton เพื่อไม่ให้ผู้ใช้เห็นหน้าว่าง
  if (reviewed === null) {
    return (
      <div className="dr-card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
        <div style={{ fontSize: 14 }}>⏳ กำลังโหลดข้อมูลรีวิว...</div>
      </div>
    );
  }

  // จัด allReviews เป็นกลุ่มตาม reviewer_role
  const byReviewer: Record<string, AllReviewItem[]> = {};
  (allReviews || []).forEach(rv => {
    if (!byReviewer[rv.reviewer_role]) byReviewer[rv.reviewer_role] = [];
    byReviewer[rv.reviewer_role].push(rv);
  });
  const hasAnyReview = (allReviews || []).length > 0;

  if (reviewed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="dr-card rv-thanks">
          <span className="rv-thanks-ic"><Icon name="badgeCheck" size={22} /></span>
          <div><b>ขอบคุณสำหรับรีวิว</b><span>คะแนนของคุณช่วยให้ชุมชนซื้อขายปลอดภัยขึ้น</span></div>
        </div>
        {hasAnyReview && <AllReviewsSummary byReviewer={byReviewer} />}
      </div>
    );
  }

  const getRow = (role: string): RowState => rows[role] || { rating: 0, tags: [] };
  const setRating = (role: string, rating: number) => setRows(r => ({ ...r, [role]: { ...getRow(role), rating } }));
  const toggleTag = (role: string, tag: string) => setRows(r => {
    const cur = getRow(role);
    const tags = cur.tags.includes(tag) ? cur.tags.filter(t => t !== tag) : [...cur.tags, tag];
    return { ...r, [role]: { ...cur, tags } };
  });

  const allRated = targets.every(t => getRow(t.role).rating > 0);

  async function submit() {
    if (!allRated || sending) return;
    setSending(true); setError('');
    try {
      const freshHdrs = await authHeaders();
      const submitHdrs = Object.keys(freshHdrs).length ? freshHdrs : headers;
      const items = targets.map(t => ({
        targetRole: t.role,
        rating: getRow(t.role).rating,
        tags: getRow(t.role).tags,
        comment: t.role === 'platform' ? comment : '',
      }));
      const r = await fetch('/api/reviews', {
        method: 'POST',
        headers: { ...submitHdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, items }),
      });
      const d = await r.json();
      if (r.ok) { setReviewed(true); onReviewed?.(); }
      else setError(d.error || 'บันทึกรีวิวไม่สำเร็จ');
    } catch { setError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'); }
    finally { setSending(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {hasAnyReview && <AllReviewsSummary byReviewer={byReviewer} />}
      <div className="dr-card rv-card">
        <div className="dr-card-title">⭐ ให้คะแนนดีลนี้</div>
        <p className="rv-lead">แตะดาวเพื่อให้คะแนน — ใช้เวลาไม่ถึง 10 วินาที</p>

        {targets.map(t => {
          const st = getRow(t.role);
          return (
            <div key={t.role} className="rv-row">
              <div className="rv-row-head">
                <span className={`rv-av ${t.role}`}>{t.role === 'platform' ? <Icon name="shieldCheck" size={16} /> : (t.name || '?').slice(0, 1)}</span>
                <div className="rv-who">
                  <b>{t.name}</b>
                  <span>{ROLE_LABEL[t.role]}</span>
                </div>
                <div className="rv-stars" role="radiogroup" aria-label={`ให้คะแนน ${t.name}`}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n} type="button"
                      className={`rv-star ${st.rating >= n ? 'on' : ''}`}
                      role="radio" aria-checked={st.rating === n} aria-label={`${n} ดาว`}
                      onClick={() => setRating(t.role, n)}
                    >
                      <Icon name="star" size={22} />
                    </button>
                  ))}
                </div>
              </div>
              {st.rating > 0 && (
                <>
                  <div className="rv-rating-meta">
                    <span className="rv-rating-pill">{st.rating} / 5 ดาว</span>
                    <span className="rv-rating-text">{RATING_LABEL[st.rating]}</span>
                  </div>
                  <div className="rv-tag-wrap">
                    <div className="rv-tag-title">เหตุผลที่อยากแนะนำ</div>
                    <div className="rv-tags">
                      {QUICK_TAGS[t.role].map(tag => (
                        <button key={tag} type="button" className={`rv-tag ${st.tags.includes(tag) ? 'on' : ''}`} onClick={() => toggleTag(t.role, tag)}>
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}

        <div className="rv-comment-wrap">
          <div className="rv-comment-title">ข้อเสนอแนะเพิ่มเติม</div>
          <div className="rv-comment-sub">เขียนถึงทีมงานหรือประสบการณ์ใช้งานเพิ่มเติมได้</div>
          <textarea
            className="rv-comment"

            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="พิมพ์ข้อเสนอแนะถึงทีมงานหรือสิ่งที่อยากให้ปรับปรุง (ไม่บังคับ)"
            rows={5}
            maxLength={1000}
          />
        </div>

        {error && <p className="rv-error">{error}</p>}
        <button type="button" className="btn btn-primary btn-block" disabled={!allRated || sending} onClick={submit}>
          {sending ? 'กำลังบันทึก...' : allRated ? 'ส่งรีวิว' : 'แตะดาวให้ครบทุกรายการก่อนส่ง'}
        </button>
      </div>
    </div>
  );
}

export default ReviewPanel;
