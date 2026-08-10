'use client';

/** Bottom tabs สำหรับห้องดีลบนมือถือ — ควบคุม tab steps/evidence + floatbar */
type Tab = 'steps' | 'evidence';

type Props = {
  tab: Tab;
  onTab: (t: Tab) => void;
  msgCount?: number;
  canCall?: boolean;
  onChat: () => void;
  chatOpen?: boolean;
  onVoice?: () => void;
  voiceActive?: boolean;
  voiceLabel?: string;
};

export function DealRoomMobileBar({
  tab, onTab, msgCount = 0, canCall, onChat, chatOpen, onVoice, voiceActive, voiceLabel,
}: Props) {
  return (
    <nav className="dr-mobile-bar" aria-label="เมนูห้องดีล">
      <button type="button" className={tab === 'steps' ? 'is-on' : ''} onClick={() => onTab('steps')}>
        📋<span>ขั้นตอน</span>
      </button>
      <button type="button" className={tab === 'evidence' ? 'is-on' : ''} onClick={() => onTab('evidence')}>
        📁<span>หลักฐาน</span>
      </button>
      <button type="button" className={chatOpen ? 'is-on' : ''} onClick={onChat}>
        💬<span>แชท</span>
        {msgCount > 0 && !chatOpen && <em>{msgCount > 99 ? '99+' : msgCount}</em>}
      </button>
      {canCall && onVoice && (
        <button type="button" className={voiceActive ? 'is-on voice' : ''} onClick={onVoice}>
          📞<span>{voiceLabel || 'โทร'}</span>
        </button>
      )}
    </nav>
  );
}

export default DealRoomMobileBar;
