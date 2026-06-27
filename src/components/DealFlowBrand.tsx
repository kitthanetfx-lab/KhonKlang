'use client';

import Image from 'next/image';

type DealFlowBrandProps = {
  docked?: boolean;
  className?: string;
};

export function DealFlowBrand({ docked = false, className = '' }: DealFlowBrandProps) {
  const wrapClass = `deal-flow-brand-wrap${docked ? ' is-docked' : ''}${className ? ` ${className}` : ''}`;
  return (
    <div className={wrapClass}>
      <div className="deal-flow-brand">
        <Image src="/logo.png" alt="กลางฮับ" width={420} height={132} priority className="deal-flow-brand-image" />
      </div>
    </div>
  );
}
