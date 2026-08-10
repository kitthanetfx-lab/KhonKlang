'use client';

import Link from 'next/link';
import { AppPage, AppHeader, AppFeed } from '@/components/mobile';
import { HeaderAccountActions } from '@/components/HeaderAccountActions';

type Props = {
  submitted: boolean;
  slipUploaded: boolean;
  payment: { label: string; amount: number; period: string; features: string[] };
  bank: { name: string; acct: string; owner: string; pp: string };
  onToggleSlip: () => void;
  onSubmit: () => void;
};

export function PaymentApp({
  submitted, slipUploaded, payment, bank, onToggleSlip, onSubmit,
}: Props) {
  if (submitted) {
    return (
      <AppPage withBottomNav={false}>
        <AppFeed>
          <div className="pay-app-success">
            <div className="pay-app-success-ic">✅</div>
            <h2>ส่งสลิปแล้ว!</h2>
            <p>ทีมงานจะตรวจสอบและเปิดใช้งานบัญชีของคุณภายใน 1–3 วันทำการ</p>
            <Link href="/profile" className="btn btn-primary btn-block">ดูสถานะใบสมัคร</Link>
          </div>
        </AppFeed>
      </AppPage>
    );
  }

  return (
    <AppPage withBottomNav={false}>
      <AppHeader title="ชำระเงิน" backHref="/register/seller" right={<HeaderAccountActions />} />
      <AppFeed>
        <div className="app-card pay-app-summary">
          <div className="pay-app-lbl">{payment.label}</div>
          <div className="pay-app-amount">฿{payment.amount}</div>
          <div className="pay-app-period">ต่ออายุ {payment.period}</div>
          <ul className="pay-app-features">
            {payment.features.map(f => <li key={f}>✅ {f}</li>)}
          </ul>
        </div>
        <div className="app-card pay-app-bank">
          <h2>ข้อมูลการโอน</h2>
          <dl>
            <div><dt>ธนาคาร</dt><dd>{bank.name}</dd></div>
            <div><dt>เลขบัญชี</dt><dd>{bank.acct}</dd></div>
            <div><dt>ชื่อบัญชี</dt><dd>{bank.owner}</dd></div>
            <div><dt>PromptPay</dt><dd>{bank.pp}</dd></div>
          </dl>
        </div>
        <button
          type="button"
          className={`pay-app-upload${slipUploaded ? ' is-on' : ''}`}
          onClick={onToggleSlip}
        >
          {slipUploaded ? '✅ อัปโหลดสลิปแล้ว (แตะเพื่อเปลี่ยน)' : '📎 แตะเพื่ออัปโหลดสลิป'}
        </button>
        <button type="button" className="btn btn-primary btn-block pay-app-submit" disabled={!slipUploaded} onClick={onSubmit}>
          ส่งสลิปเพื่อตรวจสอบ
        </button>
      </AppFeed>
    </AppPage>
  );
}
