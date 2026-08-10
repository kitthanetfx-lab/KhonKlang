'use client';

import { useEffect, useState } from 'react';
import { ReviewPanel } from '@/components/ReviewPanel';
import { authHeaders } from '@/lib/supabase';

type Props = {
  deal: {
    id: string;
    buyer_id: string;
    buyer_name: string;
    seller_id: string;
    seller_name: string;
    middleman_id: string;
    middleman_name: string;
  };
  onReviewed?: () => void;
};

/** ฟอร์มให้ดาวหลังรับสินค้า — ใช้ในหน้า checkout ตลาด */
export function MarketplaceReviewBlock({ deal, onReviewed }: Props) {
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [allRated, setAllRated] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitTrigger, setSubmitTrigger] = useState(0);

  useEffect(() => {
    void authHeaders().then(h => setHeaders(h));
  }, []);

  return (
    <div className="mkt-co-review">
      <div className="mkt-co-review-banner">⭐ ให้ดาวรีวิวผู้ขาย — ช่วยให้คนอื่นตัดสินใจได้ง่ายขึ้น</div>
      <ReviewPanel
        deal={deal}
        myRole="buyer"
        headers={headers}
        onReviewed={() => { setReviewed(true); onReviewed?.(); setSending(false); }}
        onRatedChange={setAllRated}
        onSubmitError={() => setSending(false)}
        externalSubmitTrigger={submitTrigger}
      />
      {!reviewed && (
        <button
          type="button"
          className="btn btn-primary btn-block btn-lg"
          style={{ marginTop: 12 }}
          disabled={!allRated || sending || !headers.Authorization}
          onClick={() => { setSending(true); setSubmitTrigger(t => t + 1); }}
        >
          {sending ? '⏳ กำลังบันทึกรีวิว...' : allRated ? '⭐ ส่งรีวิว' : '⭐ ให้ดาวครบทุกรายการก่อนส่ง'}
        </button>
      )}
    </div>
  );
}
