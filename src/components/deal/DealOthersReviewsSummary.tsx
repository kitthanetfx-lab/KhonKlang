'use client';

import { useEffect, useState } from 'react';
import { AllReviewsSummary, type AllReviewItem } from '@/components/ReviewPanel';

type Props = {
  dealId: string;
  headers: Record<string, string>;
};

/** คะแนนที่อีกฝั่งให้แล้ว — แสดงใต้ปุ่มบันทึก */
export function DealOthersReviewsSummary({ dealId, headers }: Props) {
  const [items, setItems] = useState<AllReviewItem[] | null>(null);

  useEffect(() => {
    if (!headers.Authorization) {
      setItems([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/reviews?dealId=${dealId}&all=true`, { headers })
      .then(r => r.json())
      .then(d => { if (!cancelled) setItems(d.items || []); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, [dealId, headers.Authorization]);

  if (!items?.length) return null;

  const byReviewer: Record<string, AllReviewItem[]> = {};
  items.forEach(rv => {
    if (!byReviewer[rv.reviewer_role]) byReviewer[rv.reviewer_role] = [];
    byReviewer[rv.reviewer_role].push(rv);
  });

  return (
    <div className="simple-deal-others-reviews">
      <AllReviewsSummary byReviewer={byReviewer} compact />
    </div>
  );
}
