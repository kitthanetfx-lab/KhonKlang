'use client';
import React, { useEffect, useRef, useState } from 'react';
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
interface RowState { rating: number; tags: string[]; comment?: string }
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
export function ReviewPanel({
  deal, myRole, headers,
  onReviewed, onRatedChange, onSubmitError,
  externalSubmitTrigger,
  variant = 'default',
}: {
  deal: DealParties;
  myRole: Role | 'guest' | '';
  headers: Record<string, string>;
  onReviewed?: () => void;
  onRatedChange?: (allRated: boolean) => void;
  onSubmitError?: () => void;
  externalSubmitTrigger?: number;
  /** simple = ดีลแบบง่าย: ไม่มีแท็กเหตุผล มีกล่องติชมต่อการ์ด */
  variant?: 'default' | 'simple';
}) {
  const isParty = myRole === 'buyer' || myRole === 'seller' || myRole === 'middleman';
  const isSimple = variant === 'simple';

  // ── State ──────────────────────────────────────────────────────────────────
  const [reviewed, setReviewed] = useState<boolean | null>(null);
  const [allReviews, setAllReviews] = useState<AllReviewItem[] | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // ── Computed (safe before hooks because these are not hooks) ───────────────
  const targets: { role: Role; name: string }[] = [];
  if (isParty) {
    if (myRole !== 'buyer' && deal.buyer_id) targets.push({ role: 'buyer', name: deal.buyer_name || 'ผู้ซื้อ' });
    if (myRole !== 'seller' && deal.seller_id) targets.push({ role: 'seller', name: deal.seller_name || 'ผู้ขาย' });
    if (myRole !== 'middleman' && deal.middleman_id) targets.push({ role: 'middleman', name: deal.middleman_name || 'คนกลาง' });
    targets.push({ role: 'platform', name: 'คนกลาง (เว็บไซต์/แอป)' });
  }
  const getRow = (role: string): RowState => rows[role] || { rating: 0, tags: [] };
  const allRated = targets.length > 0 && targets.every(t => getRow(t.role).rating > 0);

  // ── Submit (ใช้ ref เพื่อให้ effect เรียกเวอร์ชันล่าสุดเสมอ) ───────────────
  async function submit() {
    if (!allRated || sending) return;
    setSending(true); setError('');
    try {
      const freshHdrs = await authHeaders();
      const submitHdrs = Object.keys(freshHdrs).length ? freshHdrs : headers;
      const items = targets.map(t => ({
        targetRole: t.role,
        rating: getRow(t.role).rating,
        tags: isSimple ? [] : getRow(t.role).tags,
        comment: isSimple
          ? String(getRow(t.role).comment || '').slice(0, 1000)
          : (t.role === 'platform' ? comment : ''),
      }));
      const r = await fetch('/api/reviews', {
        method: 'POST',
        headers: { ...submitHdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, items }),
      });
      const d = await r.json();
      if (r.ok) { setReviewed(true); onReviewed?.(); }
      else { setError(d.error || 'บันทึกรีวิวไม่สำเร็จ'); onSubmitError?.(); }
    } catch { setError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'); onSubmitError?.(); }
    finally { setSending(false); }
  }
  // ref เก็บ submit ล่าสุดเสมอ (แก้ stale-closure ใน effect)
  const submitRef = useRef(submit);
  submitRef.current = submit;

  // ── Effects ────────────────────────────────────────────────────────────────
  // 1) โหลดสถานะรีวิว
  useEffect(() => {
    if (!isParty) return;
    if (!headers.Authorization) { setReviewed(false); setAllReviews([]); return; }
    let cancelled = false;
    Promise.all([
      fetch(`/api/reviews?dealId=${deal.id}`, { headers }).then(r => r.json()),
      fetch(`/api/reviews?dealId=${deal.id}&all=true`, { headers }).then(r => r.json()).catch(() => ({ items: [] })),
    ]).then(([d1, d2]) => {
      if (!cancelled) {
        const already = !!d1.reviewed;
        setReviewed(already);
        setAllReviews(d2.items || []);
        if (already) onReviewed?.();
      }
    }).catch(() => { if (!cancelled) { setReviewed(false); setAllReviews([]); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal.id, isParty, headers.Authorization]);

  // 2) แจ้งพ่อเมื่อ allRated เปลี่ยน
  useEffect(() => {
    if (isParty && reviewed === false) onRatedChange?.(allRated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRated, isParty, reviewed]);

  // 3) รับ trigger จากพ่อ → ส่งรีวิว
  const prevTrigger = useRef(0);
  useEffect(() => {
    if (!externalSubmitTrigger || externalSubmitTrigger === prevTrigger.current) return;
    prevTrigger.current = externalSubmitTrigger;
    submitRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSubmitTrigger]);

  // ── Conditional returns (หลัง hooks ทั้งหมด) ──────────────────────────────
  if (!isParty) return null;
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

  // ── รีวิวแล้ว: แสดงขอบคุณ + สรุปทุกฝ่าย ──────────────────────────────────
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

  // ── ฟอร์มให้คะแนน (ไม่มีปุ่มส่ง — พ่อเป็นคนกดแทน) ───────────────────────
  const setRating = (role: string, rating: number) => setRows(r => ({ ...r, [role]: { ...getRow(role), rating } }));
  const setRowComment = (role: string, value: string) => setRows(r => ({ ...r, [role]: { ...getRow(role), comment: value } }));
  const toggleTag = (role: string, tag: string) => setRows(r => {
    const cur = getRow(role);
    const tags = cur.tags.includes(tag) ? cur.tags.filter(t => t !== tag) : [...cur.tags, tag];
    return { ...r, [role]: { ...cur, tags } };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {hasAnyReview && <AllReviewsSummary byReviewer={byReviewer} />}
      <div className={`dr-card rv-card${isSimple ? ' rv-card--simple' : ''}`}>
        <div className="rv-card-head">
          <div className="dr-card-title">⭐ ให้คะแนนดีลนี้</div>
          <p className="rv-lead">
            {isSimple ? 'แตะดาวให้คะแนน แล้วกดปุ่มสีเขียวด้านล่าง' : 'แตะดาวแต่ละการ์ด → เลือกแท็ก (ถ้ามี) → กดบันทึกด้านล่าง'}
          </p>
        </div>

        <div className={`rv-grid${isSimple ? ' rv-grid--simple' : ''}`}>
          {targets.map(t => {
            const st = getRow(t.role);
            return (
              <div key={t.role} className={`rv-row${isSimple ? ' rv-row--simple' : ''}`}>
                <div className="rv-row-head">
                  <span className={`rv-av ${t.role}`}>{t.role === 'platform' ? <Icon name="shieldCheck" size={14} /> : (t.name || '?').slice(0, 1)}</span>
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
                        <Icon name="star" size={18} />
                      </button>
                    ))}
                  </div>
                </div>
                {st.rating > 0 && (
                  <>
                    <div className="rv-rating-meta">
                      <span className="rv-rating-pill">{st.rating}/5</span>
                      <span className="rv-rating-text">{RATING_LABEL[st.rating]}</span>
                    </div>
                    {isSimple ? (
                      <label className="rv-row-comment">
                        <span className="rv-row-comment-label">💬 ข้อความถึง{t.name} <span className="rv-optional">ไม่บังคับ</span></span>
                        <textarea
                          className="rv-comment rv-comment--inline"
                          value={st.comment || ''}
                          onChange={e => setRowComment(t.role, e.target.value)}
                          placeholder="เขียนติชมสั้นๆ..."
                          rows={2}
                          maxLength={1000}
                        />
                      </label>
                    ) : (
                      <div className="rv-tag-wrap">
                        <div className="rv-tag-title">แตะเลือกเหตุผล</div>
                        <div className="rv-tags">
                          {QUICK_TAGS[t.role].map(tag => (
                            <button key={tag} type="button" className={`rv-tag ${st.tags.includes(tag) ? 'on' : ''}`} onClick={() => toggleTag(t.role, tag)}>
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {!isSimple && (
          <label className="rv-comment-wrap">
            <span className="rv-comment-title">💬 ข้อเสนอแนะถึงทีมงาน <span className="rv-optional">ไม่บังคับ</span></span>
            <textarea
              className="rv-comment"
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="เช่น อยากให้ปรับขั้นตอน / ความเร็ว / การใช้งาน..."
              rows={2}
              maxLength={1000}
            />
          </label>
        )}

        {error && <p className="rv-error">{error}</p>}
      </div>
    </div>
  );
}

export default ReviewPanel;
