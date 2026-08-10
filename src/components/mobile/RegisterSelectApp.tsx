'use client';

import Link from 'next/link';
import Image from 'next/image';
import { AppFeed, AppTop } from './shells';

type ChoiceCard = {
  href?: string;
  disabled?: boolean;
  icon: string;
  iconBg: string;
  title: string;
  desc: string;
  feats: string[];
  fee: string;
  cta: string;
  ctaColor?: string;
  notice?: string;
};

type Props = {
  seller: ChoiceCard;
  middleman: ChoiceCard;
};

export function RegisterSelectApp({ seller, middleman }: Props) {
  return (
    <div className="reg-app reg-app--select">
      <AppTop title="เลือกประเภทการสมัคร" subtitle="เข้าร่วมแพลตฟอร์มในฐานะอะไร?" classPrefix="reg-app" />
      <AppFeed classPrefix="reg-app">
        <div className="reg-app-logo-wrap">
          <Image src="/logo.png" alt="คนกลาง" width={88} height={88} priority />
        </div>
        <ChoiceCardView card={seller} />
        <ChoiceCardView card={middleman} />
      </AppFeed>
    </div>
  );
}

function ChoiceCardView({ card }: { card: ChoiceCard }) {
  const inner = (
    <>
      <div className="reg-app-choice-head">
        <div className="reg-app-choice-icon" style={{ background: card.iconBg }}>{card.icon}</div>
        <div>
          <div className="reg-app-choice-title">{card.title}</div>
          <div className="reg-app-choice-desc">{card.desc}</div>
        </div>
      </div>
      <ul className="reg-app-choice-feats">
        {card.feats.map(f => <li key={f}>{f}</li>)}
      </ul>
      <div className="reg-app-choice-foot">
        <span className="reg-app-choice-fee">{card.fee}</span>
        <span className="reg-app-choice-cta" style={card.ctaColor ? { color: card.ctaColor } : undefined}>{card.cta}</span>
      </div>
      {card.notice && <p className="reg-app-choice-notice">{card.notice}</p>}
    </>
  );

  if (card.disabled || !card.href) {
    return <div className="reg-app-choice is-disabled">{inner}</div>;
  }
  return <Link href={card.href} className="reg-app-choice">{inner}</Link>;
}
