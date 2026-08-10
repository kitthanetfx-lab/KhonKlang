'use client';

import { Search, RefreshCw, MoreVertical } from 'lucide-react';

export type AdminUserRow = {
  id: string;
  display_name: string;
  first_name?: string;
  email: string;
  active: boolean;
  created_at: string;
  role?: string;
  phone?: string;
  seller_status?: string;
  middleman_status?: string;
};

type Props = {
  users: AdminUserRow[];
  filtered: AdminUserRow[];
  total: number;
  loading: boolean;
  search: string;
  onSearch: (v: string) => void;
  roleFilter: string;
  onRoleFilter: (v: string) => void;
  roleCounts: Record<string, number>;
  onRefresh: () => void;
  renderActions: (user: AdminUserRow) => React.ReactNode;
  badgeFor: (user: AdminUserRow) => { label: string; cls: string }[];
};

/** Admin ผู้ใช้ — list แบบแอป ไม่ใช้ table */
export function AdminUsersApp({
  users, filtered, total, loading, search, onSearch, roleFilter, onRoleFilter,
  roleCounts, onRefresh, renderActions, badgeFor,
}: Props) {
  const roles = [
    { key: 'admin', label: 'Admin', dot: 'bg-purple-500' },
    { key: 'seller', label: 'ผู้ขาย', dot: 'bg-blue-500' },
    { key: 'middleman', label: 'คนกลาง', dot: 'bg-green-500' },
    { key: 'user', label: 'ผู้ใช้', dot: 'bg-gray-400' },
  ];

  return (
    <div className="adm-app">
      <div className="adm-app-head">
        <div>
          <h2 className="adm-app-title">ผู้ใช้ทั้งหมด</h2>
          <p className="adm-app-sub">รวม {total.toLocaleString()} บัญชี</p>
        </div>
        <button type="button" className="adm-app-icon-btn" onClick={onRefresh} aria-label="รีเฟรช">
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="adm-app-search">
        <Search size={16} />
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="ค้นหาชื่อหรืออีเมล…"
        />
      </div>

      <div className="adm-app-chips">
        {roles.map(r => (
          <button
            key={r.key}
            type="button"
            className={`adm-app-chip${roleFilter === r.key ? ' is-on' : ''}`}
            onClick={() => onRoleFilter(roleFilter === r.key ? '' : r.key)}
          >
            <span className={`adm-app-chip-dot ${r.dot}`} />
            {r.label} <b>{roleCounts[r.key] ?? 0}</b>
          </button>
        ))}
      </div>

      <p className="adm-app-count">
        {loading ? 'กำลังโหลด…' : `แสดง ${filtered.length} จาก ${users.length} รายการ`}
      </p>

      {loading ? (
        <div className="adm-app-loading"><div className="mkt-spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="adm-app-empty">ไม่มีข้อมูล</div>
      ) : (
        <ul className="adm-app-list">
          {filtered.map(u => (
            <li key={u.id} className="adm-app-card">
              <div className="adm-app-card-top">
                <div className="adm-app-av">{(u.display_name || u.email || '?')[0]?.toUpperCase()}</div>
                <div className="adm-app-card-main">
                  <strong>{u.display_name || u.first_name || '—'}</strong>
                  <span className="adm-app-email">
                    {u.email?.includes('@line.khonklang.app') ? `LINE ${u.id.slice(0, 10)}…` : u.email || '—'}
                  </span>
                  {u.phone && <span className="adm-app-meta">{u.phone}</span>}
                </div>
                {renderActions(u)}
              </div>
              <div className="adm-app-card-tags">
                {badgeFor(u).map(b => (
                  <span key={b.label} className={`adm-app-tag ${b.cls}`}>{b.label}</span>
                ))}
                <span className={`adm-app-tag ${u.active ? 'adm-app-tag--ok' : 'adm-app-tag--bad'}`}>
                  {u.active ? 'ใช้งานได้' : 'ระงับ'}
                </span>
              </div>
              <div className="adm-app-card-foot">
                สมัคร {new Date(u.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AdminUsersApp;
