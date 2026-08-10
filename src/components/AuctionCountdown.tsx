'use client';

import { useEffect, useState } from 'react';
import {
  formatAuctionCountdown,
  getAuctionPhase,
  parseAuctionCountdownParts,
} from '@/lib/auction';

const pad2 = (n: number) => String(n).padStart(2, '0');

export function AuctionCountdown({
  endsAt,
  endedAt,
  className = '',
  liveClassName = '',
  variant = 'inline',
}: {
  endsAt: string;
  endedAt?: string | null;
  className?: string;
  liveClassName?: string;
  /** inline = ข้อความเดียว · card = ตัวเลขใหญ่แยกส่วน · overlay = บadge บนรูป */
  variant?: 'inline' | 'card' | 'overlay';
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const phase = getAuctionPhase(endsAt, endedAt, now);

  if (phase === 'ended') {
    return <span className={`auction-countdown auction-countdown--ended${className ? ` ${className}` : ''}`}>ปิดแล้ว</span>;
  }

  const parts = parseAuctionCountdownParts(endsAt, now);
  const urgent = parts.totalMs > 0 && parts.totalMs < 3600 * 1000;

  if (variant === 'card') {
    return (
      <span
        className={`auction-countdown auction-countdown--card${urgent ? ' is-urgent' : ''}${liveClassName ? ` ${liveClassName}` : ''}${className ? ` ${className}` : ''}`}
        aria-live="polite"
      >
        {parts.days > 0 && (
          <span className="acd-days">
            <strong>{parts.days}</strong>
            <small>วัน</small>
          </span>
        )}
        <span className="acd-clock">
          <span className="acd-digit">{pad2(parts.h)}</span>
          <span className="acd-sep">:</span>
          <span className="acd-digit">{pad2(parts.m)}</span>
          <span className="acd-sep">:</span>
          <span className="acd-digit acd-digit--sec">{pad2(parts.s)}</span>
        </span>
      </span>
    );
  }

  if (variant === 'overlay') {
    return (
      <span
        className={`auction-countdown auction-countdown--overlay${urgent ? ' is-urgent' : ''}${liveClassName ? ` ${liveClassName}` : ''}${className ? ` ${className}` : ''}`}
        aria-live="polite"
      >
        {parts.days > 0 && <span className="acd-days-inline">{parts.days} วัน </span>}
        <span className="acd-clock-inline">{pad2(parts.h)}:{pad2(parts.m)}:{pad2(parts.s)}</span>
      </span>
    );
  }

  const label = formatAuctionCountdown(endsAt, now);
  return (
    <span className={`auction-countdown${className ? ` ${className}` : ''}${phase === 'live' && liveClassName ? ` ${liveClassName}` : ''}`}>
      {phase === 'live' ? '⏱ ' : ''}{label}
    </span>
  );
}
