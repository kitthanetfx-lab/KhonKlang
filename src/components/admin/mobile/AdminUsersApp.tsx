'use client';

import { AdminAppCard, AdminAppChip, AdminAppFrame, AdminAppSearch } from './AdminAppFrame';

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

const ROLE_CFG: Record<string, { label: string; cls: string }> = {
  admin:     { label: 'Admin', cls: 'bg-purple-100 text-purple-700' },
  seller:    { label: 'ผู้ขาย', cls: 'bg-blue-100 text-blue-700' },
  middleman: { label: 'คนกลาง', cls: 'bg-green-100 text-green-700' },
  user:      { label: 'ผู้ใช้', cls: 'bg-gray-100 text-gray-600' },
};

function badgeKeys(u: AdminUserRow): string[] {
  const keys: string[] = [];
  if ((u.role || 'user') === 'admin') keys.push('admin');
  if (u.seller_status === 'approved') keys.push('seller');
  if (u.middleman_status === 'approved') keys.push('middleman');
  if (keys.length === 0) keys.push('user');
  return keys;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

type Props = {
  users: AdminUserRow[];
  total: number;
  loading: boolean;
  search: string;
  roleFilter: string;
  onSearch: (v: string) => void;
  onRoleFilter: (v: string) => void;
  onRefresh: () => void;
  renderActions: (u: AdminUserRow) => React.ReactNode;
};

export function AdminUsersApp({
  users, total, loading, search, roleFilter, onSearch, onRoleFilter, onRefresh, renderActions,
}: Props) {
  const filtered = users.filter(u => {
    const name = (u.display_name || u.first_name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const q = search.toLowerCase();
    if (search && !name.includes(q) && !email.includes(q)) return false;
    if (roleFilter && !badgeKeys(u).includes(roleFilter)) return false;
    return true;
  });

  return (
    <AdminAppFrame
      title="ผู้ใช้ทั้งหมด"
      subtitle={`รวม ${total.toLocaleString()} บัญชี`}
      onRefresh={onRefresh}
      refreshing={loading}
      search={<AdminAppSearch value={search} onChange={onSearch} placeholder="ค้นหาชื่อหรืออีเมล…" />}
      stats={
        <>
          {Object.entries(ROLE_CFG).map(([key, cfg]) => (
            <AdminAppChip
              key={key}
              label={cfg.label}
              count={users.filter(u => badgeKeys(u).includes(key)).length}
              active={roleFilter === key}
              onClick={() => onRoleFilter(roleFilter === key ? '' : key)}
            />
          ))}
        </>
      }
    >
      {loading ? (
        <div className="app-loading"><div className="mkt-spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="app-empty"><p>ไม่มีข้อมูล</p></div>
      ) : (
        filtered.map(u => (
          <AdminAppCard
            key={u.id}
            title={u.display_name || u.first_name || '—'}
            subtitle={u.phone || (u.email?.includes('@line.') ? 'LINE Login' : u.email) || '—'}
            badges={
              <>
                {badgeKeys(u).map(k => (
                  <span key={k} className={`admin-app-badge ${ROLE_CFG[k]?.cls ?? ''}`}>{ROLE_CFG[k]?.label ?? k}</span>
                ))}
                <span className={`admin-app-badge ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {u.active ? 'ใช้งาน' : 'ระงับ'}
                </span>
              </>
            }
            meta={`สมัคร ${fmtDate(u.created_at)}`}
            actions={renderActions(u)}
          />
        ))
      )}
    </AdminAppFrame>
  );
}
