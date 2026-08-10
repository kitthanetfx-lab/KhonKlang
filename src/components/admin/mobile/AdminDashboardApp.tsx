'use client';

import Link from 'next/link';
import { AdminAppCard, AdminAppFrame, AdminAppSection } from './AdminAppFrame';

export type DashboardApplication = {
  id: string;
  full_name_id: string;
  seller_type?: string;
  tier?: string;
  province?: string;
  work_province?: string;
  status: string;
  created_at: string;
};

export type DashboardStats = {
  totalUsers: number;
  pendingSellers: number;
  approvedSellers: number;
  pendingMiddlemen: number;
  approvedMiddlemen: number;
  onsiteOpen?: number;
  onsiteActive?: number;
  onsiteTotal?: number;
  recentSellers: DashboardApplication[];
  recentMiddlemen: DashboardApplication[];
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending_review: { label: 'รอตรวจสอบ', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'อนุมัติแล้ว', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'ปฏิเสธ', cls: 'bg-red-100 text-red-700' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

type Props = {
  stats: DashboardStats | null;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function AdminDashboardApp({ stats, loading, error, onRefresh, refreshing }: Props) {
  const pendingTotal = stats ? stats.pendingSellers + stats.pendingMiddlemen : 0;

  return (
    <AdminAppFrame
      title="ภาพรวมระบบ"
      subtitle="ข้อมูลสรุป ณ วันนี้"
      onRefresh={onRefresh}
      refreshing={refreshing || loading}
    >
      {error && <div className="admin-app-alert">{error}</div>}
      {loading && !stats ? (
        <div className="app-loading"><div className="mkt-spinner" /></div>
      ) : stats ? (
        <>
          {pendingTotal > 0 && (
            <div className="admin-app-alert">
              มีใบสมัคร <strong>{pendingTotal}</strong> รายการรอตรวจสอบ
              {stats.pendingSellers > 0 && (
                <> · <Link href="/admin/sellers?status=pending_review">ผู้ขาย ({stats.pendingSellers})</Link></>
              )}
              {stats.pendingMiddlemen > 0 && (
                <> · <Link href="/admin/middlemen?status=pending_review">คนกลาง ({stats.pendingMiddlemen})</Link></>
              )}
            </div>
          )}

          <AdminAppSection title="สถิติ">
            <div className="admin-app-stat-grid">
              <Link href="/admin/users" className="admin-app-stat-tile">
                <div className="admin-app-stat-val">{stats.totalUsers.toLocaleString()}</div>
                <div className="admin-app-stat-lbl">ผู้ใช้ทั้งหมด</div>
              </Link>
              <div className="admin-app-stat-tile">
                <div className="admin-app-stat-val">{pendingTotal}</div>
                <div className="admin-app-stat-lbl">รอตรวจสอบ</div>
                <div className="admin-app-stat-sub">ผู้ขาย {stats.pendingSellers} · คนกลาง {stats.pendingMiddlemen}</div>
              </div>
              <Link href="/admin/sellers" className="admin-app-stat-tile">
                <div className="admin-app-stat-val">{stats.approvedSellers.toLocaleString()}</div>
                <div className="admin-app-stat-lbl">ผู้ขายที่อนุมัติ</div>
              </Link>
              <Link href="/admin/middlemen" className="admin-app-stat-tile">
                <div className="admin-app-stat-val">{stats.approvedMiddlemen.toLocaleString()}</div>
                <div className="admin-app-stat-lbl">คนกลางที่อนุมัติ</div>
              </Link>
              <div className="admin-app-stat-tile">
                <div className="admin-app-stat-val">{(stats.approvedSellers + stats.pendingSellers + stats.approvedMiddlemen + stats.pendingMiddlemen).toLocaleString()}</div>
                <div className="admin-app-stat-lbl">ใบสมัครทั้งหมด</div>
              </div>
              <div className="admin-app-stat-tile">
                <div className="admin-app-stat-val">{(stats.approvedSellers + stats.approvedMiddlemen).toLocaleString()}</div>
                <div className="admin-app-stat-lbl">อนุมัติแล้วรวม</div>
              </div>
              <Link href="/admin/onsite-jobs" className="admin-app-stat-tile">
                <div className="admin-app-stat-val">{(stats.onsiteTotal ?? 0).toLocaleString()}</div>
                <div className="admin-app-stat-lbl">งานนัดออนไซต์</div>
                <div className="admin-app-stat-sub">เปิด {stats.onsiteOpen ?? 0} · กำลังทำ {stats.onsiteActive ?? 0}</div>
              </Link>
            </div>
          </AdminAppSection>

          <AdminAppSection title="ผู้ขายล่าสุด">
            {stats.recentSellers.length === 0 ? (
              <div className="app-empty"><p>ยังไม่มีข้อมูล</p></div>
            ) : (
              stats.recentSellers.map(s => {
                const st = STATUS_LABEL[s.status] ?? { label: s.status, cls: 'bg-gray-100 text-gray-600' };
                return (
                  <AdminAppCard
                    key={s.id}
                    title={s.full_name_id}
                    subtitle={`${s.province || '—'} · ${fmtDate(s.created_at)}`}
                    badges={<span className={`admin-app-badge ${st.cls}`}>{st.label}</span>}
                  />
                );
              })
            )}
            <Link href="/admin/sellers" className="text-sm text-blue-600 font-semibold">ดูผู้ขายทั้งหมด →</Link>
          </AdminAppSection>

          <AdminAppSection title="คนกลางล่าสุด">
            {stats.recentMiddlemen.length === 0 ? (
              <div className="app-empty"><p>ยังไม่มีข้อมูล</p></div>
            ) : (
              stats.recentMiddlemen.map(m => {
                const st = STATUS_LABEL[m.status] ?? { label: m.status, cls: 'bg-gray-100 text-gray-600' };
                return (
                  <AdminAppCard
                    key={m.id}
                    title={m.full_name_id}
                    subtitle={`${m.work_province || '—'} · Tier ${m.tier || '—'} · ${fmtDate(m.created_at)}`}
                    badges={<span className={`admin-app-badge ${st.cls}`}>{st.label}</span>}
                  />
                );
              })
            )}
            <Link href="/admin/middlemen" className="text-sm text-blue-600 font-semibold">ดูคนกลางทั้งหมด →</Link>
          </AdminAppSection>
        </>
      ) : null}
    </AdminAppFrame>
  );
}
