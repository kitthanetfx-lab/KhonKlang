'use client';

import { AsyncButton } from '@/components/AsyncButton';

type ParticipantRow = {
  roleLabel: string;
  name: string;
  ok: boolean;
  doneText: string;
  waitText: string;
};

type WaitProps = {
  mode: 'wait';
  waitingFor: string;
  participants: ParticipantRow[];
  copied: boolean;
  onCopyLink: () => void;
  compact?: boolean;
};

type GuestProps = {
  mode: 'guest';
  waitingFor: string;
  participants: ParticipantRow[];
  notLoggedIn: boolean;
  canBeBuyer: boolean;
  canBeSeller: boolean;
  onJoin: (role: 'buyer' | 'seller') => void;
  compact?: boolean;
};

type Props = WaitProps | GuestProps;

export function SimpleDealJoinPanel(props: Props) {
  const { waitingFor, participants, compact = false } = props;
  const rootClass = compact ? 'simple-deal-join-panel simple-deal-join-panel--compact' : 'dr-card simple-deal-join-panel';

  return (
    <div className={rootClass}>
      <div className="simple-deal-join-heading">
        {!compact && <div className="simple-deal-join-icon" aria-hidden>⏳</div>}
        <div className="simple-deal-join-title">
          {compact && <span className="simple-deal-join-title-ic" aria-hidden>⏳ </span>}
          รอ{waitingFor}เข้าร่วมดีล
        </div>
      </div>
      <p className="simple-deal-join-hint">
        {compact
          ? `ส่งลิงก์ให้${waitingFor} — ครบสองฝ่ายแล้วโอนเงินได้ทันที`
          : `ส่งลิงก์นี้ให้${waitingFor}เพื่อเข้าร่วม — เมื่อครบทั้งสองฝ่ายจะเข้าหน้าโอนเงินได้ทันที`}
      </p>

      <div className="simple-deal-join-participants">
        {participants.map(row => (
          <div key={row.roleLabel} className="simple-deal-join-row">
            <span className="simple-deal-join-role">{row.roleLabel}</span>
            <span className="simple-deal-join-name">{row.name}</span>
            <span className={`simple-deal-join-status${row.ok ? ' is-ok' : ''}`}>
              {row.ok ? row.doneText : row.waitText}
            </span>
          </div>
        ))}
      </div>

      {props.mode === 'wait' ? (
        <button type="button" onClick={props.onCopyLink} className="btn btn-soft btn-block">
          {props.copied ? '✅ คัดลอกลิงก์แล้ว' : '🔗 คัดลอกลิงก์แชร์'}
        </button>
      ) : (
        <div className="simple-deal-join-actions">
          {props.notLoggedIn && (
            <div className="simple-deal-join-login-hint">
              ⚠️ กรุณาเข้าสู่ระบบก่อนเข้าร่วมดีล
            </div>
          )}
          {props.canBeBuyer && (
            <AsyncButton onClick={() => props.onJoin('buyer')} className="btn btn-green btn-block btn-lg">
              {props.notLoggedIn ? '🔑 เข้าสู่ระบบเพื่อเป็นผู้ซื้อ' : '🛍️ เข้าร่วมเป็นผู้ซื้อ'}
            </AsyncButton>
          )}
          {props.canBeSeller && (
            <AsyncButton
              onClick={() => props.onJoin('seller')}
              className="btn btn-block btn-lg simple-deal-join-seller-btn"
            >
              {props.notLoggedIn ? '🔑 เข้าสู่ระบบเพื่อเป็นผู้ขาย' : '🛒 เข้าร่วมเป็นผู้ขาย'}
            </AsyncButton>
          )}
          {!props.canBeBuyer && !props.canBeSeller && (
            <p className="simple-deal-join-full">ดีลนี้มีผู้ซื้อและผู้ขายครบแล้ว</p>
          )}
        </div>
      )}
    </div>
  );
}

function simpleDealParticipants(deal: { seller_name?: string; buyer_name?: string; seller_id?: string | null; buyer_id?: string | null }) {
  return [
    {
      roleLabel: 'ผู้ขาย',
      name: deal.seller_name || '-',
      ok: !!deal.seller_id,
      doneText: '✅ เข้าร่วมแล้ว',
      waitText: '⏳ รอเข้าร่วม',
    },
    {
      roleLabel: 'ผู้ซื้อ',
      name: deal.buyer_name || '-',
      ok: !!deal.buyer_id,
      doneText: '✅ เข้าร่วมแล้ว',
      waitText: '⏳ รอเข้าร่วม',
    },
  ];
}

export { simpleDealParticipants };
