'use client';

import { useEffect, useState } from 'react';
import { formatAuctionCountdown, getAuctionPhase } from '@/lib/auction';

export function AuctionCountdown({
  endsAt,
  endedAt,
  className = '',
  liveClassName = '',
}: {
  endsAt: string;
  endedAt?: string | null;
  className?: string;
  liveClassName?: string;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const phase = getAuctionPhase(endsAt, endedAt, now);
  const label = phase === 'ended' ? 'ปิดแล้ว' : formatAuctionCountdown(endsAt, now);
  return (
    <span className={`auction-countdown${className ? ` ${className}` : ''}${phase === 'live' && liveClassName ? ` ${liveClassName}` : ''}`}>
      {phase === 'live' ? '⏱ ' : ''}{label}
    </span>
  );
}
