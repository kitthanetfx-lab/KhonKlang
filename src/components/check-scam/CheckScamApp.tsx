'use client';

import { Icon } from '@/components/Icon';
import { ScamDbSearch } from '@/components/ScamDbSearch';
import { ScamReportForm } from '@/components/ScamReportForm';
import { AppSegment } from '@/components/mobile/AppSegment';

export type CheckScamTab = 'db' | 'web' | 'report';

export type ExternalSite = {
  name: string;
  tag: string;
  desc: string;
  bg: string;
  tagColor: string;
  url: string;
};

type Props = {
  tab: CheckScamTab;
  onTab: (t: CheckScamTab) => void;
  q: string;
  onQ: (v: string) => void;
  sites: ExternalSite[];
  onOpen: (site: ExternalSite) => void;
  onOpenAll: () => void;
};

/** เช็คคนโกงมือถือ — tabs ชัด · action หลักไม่ต้องเลื่อน */
export function CheckScamApp({ tab, onTab, q, onQ, sites, onOpen, onOpenAll }: Props) {
  return (
    <div className="cs-app">
      <div className="cs-app-hero">
        <div className="cs-app-hero-icon">🛡️</div>
        <h2 className="cs-app-title">เช็คคนโกงก่อนโอน</h2>
        <p className="cs-app-slogan">เสียเวลาสักนิด · ปลอดภัยมั่นใจ · ความเสี่ยงน้อยลง</p>
      </div>

      <AppSegment
        items={[
          { id: 'db' as const, label: 'ฐานข้อมูล' },
          { id: 'web' as const, label: 'เว็บภายนอก' },
          { id: 'report' as const, label: '🚨 รายงาน' },
        ]}
        value={tab}
        onChange={onTab}
        ariaLabel="เมนูเช็คคนโกง"
        columns={3}
      />

      {tab === 'db' && <ScamDbSearch />}

      {tab === 'web' && (
        <>
          <div className="cs-app-search-row">
            <div className="app-field cs-app-search">
              <input
                type="text"
                value={q}
                onChange={e => onQ(e.target.value)}
                placeholder="ชื่อ, เลขบัญชี หรือเบอร์โทร..."
                onKeyDown={e => { if (e.key === 'Enter') onOpenAll(); }}
              />
            </div>
            <button type="button" className="btn btn-primary cs-app-btn-all" onClick={onOpenAll}>
              เช็คทุกเว็บ
            </button>
          </div>
          <div className="cs-app-sites">
            {sites.map(s => (
              <div key={s.name} className="cs-app-site">
                <div className="cs-app-site-banner" style={{ background: s.bg }}>
                  <span className="cs-app-site-name">{s.name}</span>
                  <span className="cs-app-site-tag" style={{ color: s.tagColor, borderColor: `${s.tagColor}60`, background: `${s.tagColor}30` }}>
                    {s.tag}
                  </span>
                </div>
                <p className="cs-app-site-desc">{s.desc}</p>
                <button type="button" className="btn btn-ghost btn-sm cs-app-site-btn" onClick={() => onOpen(s)}>
                  เปิดเว็บไซต์ <Icon name="arrowUpRight" size={14} />
                </button>
              </div>
            ))}
          </div>
          <p className="cs-app-note">
            เปิดเว็บภายนอกในแท็บใหม่ — หากพบประวัติน่าสงสัย <strong>ไม่ควรโอนเงิน</strong>
          </p>
        </>
      )}

      {tab === 'report' && <ScamReportForm />}
    </div>
  );
}

export default CheckScamApp;
