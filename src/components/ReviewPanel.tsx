'use client';
import React, { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { authHeaders } from '@/lib/supabase';

type Role = 'buyer' | 'seller' | 'middleman' | 'platform';

const ROLE_LABEL: Record<Role, string> = {
  buyer: 'ผู้ซื้อ', seller: 'ผู้ขาย', middleman: 'คนกลาง', platform: 'แพลตฟอร์มคนกลาง',
};
const QUICK_TAGS: Record<Role, string[]> = {
  seller:    ['ส่งของไว', 'สินค้าตรงปก', 'สื่อสารดี'],
  middleman: ['ตรวจละเอียด', 'รวดเร็ว', 'มืออาชีพ'],
  buyer:     ['โอนไว', 'สื่อสารดี', 'ให้ความร่วมมือดี'],
  platform:  ['ใช้งานง่าย', 'รู้สึกปลอดภัย', 'จะใช้อีกแน่นอน'],
};

interface DealParties {
  id: string;
  buyer_id: string; buyer_name: string;
  seller_id: string; seller_name: string;
  middleman_id: string; middleman_name: string;
}

interface RowState { rating: number; tags: string[] }

export function ReviewPanel({ deal, myRole, headers }: { deal: DealParties; myRole: Role | 'guest' | ''; headers: Record<string, string> }) {
  const [reviewed, setReviewed] = useState<boolean | null>(null);
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
    if (!isParty || !headers.Authorization) return;
    let cancelled = false;
    fetch(`/api/reviews?dealId=${deal.id}`, { headers })
      .then(r => r.json())
      .then(d => { if (!cancelled) setReviewed(!!d.reviewed); })
      .catch(() => { if (!cancelled) setReviewed(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal.id, isParty, headers.Authorization]);

  if (!isParty || reviewed === null) return null;

  if (reviewed) {
    return (
      <div className="dr-card rv-thanks">
        <span className="rv-thanks-ic"><Icon name="badgeCheck" size={22} /></span>
        <div><b>ขอบคุณสำหรับรีวิว</b><span>คะแนนของคุณช่วยให้ชุมชนซื้อขายปลอดภัยขึ้น</span></div>
      </div>
    );
  }

  const get = (role: string): RowState => rows[role] || { rating: 0, tags: [] };
  const setRating = (role: string, rating: number) => setRows(r => ({ ...r, [role]: { ...get(role), rating } }));
  const toggleTag = (role: string, tag: string) => setRows(r => {
    const cur = get(role);
    const tags = cur.tags.includes(tag) ? cur.tags.filter(t => t !== tag) : [...cur.tags, tag];
    return { ...r, [role]: { ...cur, tags } };
  });

  const allRated = targets.every(t => get(t.role).rating > 0);

  async function submit() {
    if (!allRated || sending) return;
    setSending(true); setError('');
    try {
      // ดึง token ใหม่เสมอตอน submit — ป้องกัน cached token หมดอายุ
      const freshHdrs = await authHeaders();
      const submitHdrs = Object.keys(freshHdrs).length ? freshHdrs : headers;
      const items = targets.map(t => ({
        targetRole: t.role,
        rating: get(t.role).rating,
        tags: get(t.role).tags,
        comment: t.role === 'platform' ? comment : '',
      }));
      const r = await fetch('/api/reviews', {
        method: 'POST',
        headers: { ...submitHdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, items }),
      });
      const d = await r.json();
      if (r.ok) setReviewed(true);
      else setError(d.error || 'บันทึกรีวิวไม่สำเร็จ');
    } catch { setError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'); }
    finally { setSending(false); }
  }

  return (
    <div className="dr-card rv-card">
      <div className="dr-card-title">⭐ ให้คะแนนดีลนี้</div>
      <p className="rv-lead">แตะดาวเพื่อให้คะแนน — ใช้เวลาไม่ถึง 10 วินาที</p>

      {targets.map(t => {
        const st = get(t.role);
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
              <div className="rv-tags">
                {QUICK_TAGS[t.role].map(tag => (
                  <button key={tag} type="button" className={`rv-tag ${st.tags.includes(tag) ? 'on' : ''}`} onClick={() => toggleTag(t.role, tag)}>
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <textarea
        className="rv-comment"
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="ข้อเสนอแนะถึงทีมงาน (ไม่บังคับ)"
        rows={2}
        maxLength={1000}
      />

      {error && <p className="rv-error">{error}</p>}
      <button type="button" className="btn btn-primary btn-block" disabled={!allRated || sending} onClick={submit}>
        {sending ? 'กำลังบันทึก...' : allRated ? 'ส่งรีวิว' : 'แตะดาวให้ครบทุกรายการก่อนส่ง'}
      </button>
    </div>
  );
}

export default ReviewPanel;
