'use client';

import {
  SERVICE_CONTROL_CATALOG,
  SERVICE_CONTROL_GROUPS,
  ServiceControlKey,
  ServiceControlMap,
} from '@/lib/serviceControls';
import { AdminAppFrame, AdminAppSection } from './AdminAppFrame';

type Props = {
  services: ServiceControlMap | null;
  loading: boolean;
  error?: string;
  videoUrl: string;
  videoLoaded: boolean;
  videoSaving: boolean;
  videoSaved: boolean;
  videoError?: string;
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  onVideoUrlChange: (v: string) => void;
  onSaveVideo: () => void;
  onSave: () => void;
  setSiteMaintenance: (active: boolean) => void;
  setServiceNote: (key: ServiceControlKey | 'siteMaintenance', note: string) => void;
  setServiceEnabled: (key: ServiceControlKey, enabled: boolean) => void;
  setSlipAutoMode: (auto: boolean) => void;
  setSlipManualThreshold: (value: string) => void;
  setSiteReopenAt: (iso: string) => void;
  toLocalInput: (iso: string) => string;
  fromLocalInput: (value: string) => string;
};

export function AdminServiceControlsApp({
  services, loading, error, videoUrl, videoLoaded, videoSaving, videoSaved, videoError,
  dirty, saving, saved, onVideoUrlChange, onSaveVideo, onSave,
  setSiteMaintenance, setServiceNote, setServiceEnabled, setSlipAutoMode, setSlipManualThreshold,
  setSiteReopenAt, toLocalInput, fromLocalInput,
}: Props) {
  return (
    <>
      <AdminAppFrame title="ควบคุมบริการ" subtitle="เปิด/ปิดบริการและเมนเทนแนนซ์">
        {error && <div className="admin-app-alert">{error}</div>}
        {loading && !services ? (
          <div className="app-loading"><div className="mkt-spinner" /></div>
        ) : services ? (
          <>
            <AdminAppSection title="วีดีโอหน้าแรก">
              <div className="admin-app-form-card">
                <input
                  value={videoUrl}
                  onChange={e => onVideoUrlChange(e.target.value)}
                  placeholder="ลิงก์ YouTube…"
                  disabled={!videoLoaded}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-gray-200 text-base mb-2"
                />
                <button type="button" onClick={onSaveVideo} disabled={videoSaving || !videoLoaded}
                  className="admin-app-toggle-btn is-on w-full">
                  {videoSaving ? 'กำลังบันทึก…' : 'บันทึกวีดีโอ'}
                </button>
                {videoSaved && <p className="text-xs text-green-600 mt-2">บันทึกวีดีโอแล้ว</p>}
                {videoError && <p className="text-xs text-red-600 mt-2">{videoError}</p>}
              </div>
            </AdminAppSection>

            <AdminAppSection title="เว็บไซต์ทั้งหมด">
              <div className="admin-app-form-card">
                <div className="admin-app-toggle-row">
                  <button type="button" className={`admin-app-toggle-btn${!services.siteMaintenance.enabled ? ' is-on' : ''}`}
                    onClick={() => setSiteMaintenance(false)}>เปิดเว็บ</button>
                  <button type="button" className={`admin-app-toggle-btn${services.siteMaintenance.enabled ? ' is-on' : ''}`}
                    onClick={() => setSiteMaintenance(true)}>ปิดปรับปรุง</button>
                </div>
                <label className="admin-app-field">
                  <span>ข้อความแจ้งผู้ใช้</span>
                  <input value={services.siteMaintenance.note} onChange={e => setServiceNote('siteMaintenance', e.target.value)} />
                </label>
              </div>
            </AdminAppSection>

            <AdminAppSection title="ตรวจสลิป">
              <div className="admin-app-form-card">
                <div className="admin-app-toggle-row">
                  <button type="button" className={`admin-app-toggle-btn${services.slipAutoVerify.enabled ? ' is-on' : ''}`}
                    onClick={() => setSlipAutoMode(true)}>อัตโนมัติ</button>
                  <button type="button" className={`admin-app-toggle-btn${!services.slipAutoVerify.enabled ? ' is-on' : ''}`}
                    onClick={() => setSlipAutoMode(false)}>แมนนวล</button>
                </div>
                <label className="admin-app-field">
                  <span>ยอดเกิน → บังคับแมนนวล (บาท)</span>
                  <input type="number" value={services.slipAutoVerify.amountThreshold ?? ''}
                    onChange={e => setSlipManualThreshold(e.target.value)} disabled={!services.slipAutoVerify.enabled} />
                </label>
              </div>
            </AdminAppSection>

            {SERVICE_CONTROL_GROUPS.map(group => (
              <AdminAppSection key={group} title={group}>
                {group === 'บริการเสริม' && (
                  <div className="admin-app-form-card mb-2">
                    <label className="admin-app-field">
                      <span>เปิดบริการอีกครั้ง (ทั้งเว็บ)</span>
                      <input type="datetime-local"
                        value={toLocalInput(services.siteMaintenance.reopenAt || '')}
                        onChange={e => setSiteReopenAt(fromLocalInput(e.target.value))} />
                    </label>
                  </div>
                )}
                {SERVICE_CONTROL_CATALOG.filter(item => item.group === group).map(item => {
                  const entry = services[item.key];
                  return (
                    <div key={item.key} className="admin-app-form-card">
                      <p className="admin-app-form-card-title">{item.title}</p>
                      <p className="admin-app-form-card-hint">{item.description}</p>
                      <div className="admin-app-toggle-row">
                        <button type="button" className={`admin-app-toggle-btn${entry.enabled ? ' is-on' : ''}`}
                          onClick={() => setServiceEnabled(item.key, true)}>เปิด</button>
                        <button type="button" className={`admin-app-toggle-btn${!entry.enabled ? ' is-on' : ''}`}
                          onClick={() => setServiceEnabled(item.key, false)}>ปิด</button>
                      </div>
                      <label className="admin-app-field">
                        <span>ข้อความเมื่อปิด</span>
                        <input value={entry.note} onChange={e => setServiceNote(item.key, e.target.value)} />
                      </label>
                    </div>
                  );
                })}
              </AdminAppSection>
            ))}
          </>
        ) : null}
      </AdminAppFrame>
      {services && (
        <div className="admin-app-save-bar">
          <button type="button" className="btn-primary" onClick={onSave} disabled={saving || !dirty}>
            {saving ? 'กำลังบันทึก…' : saved ? 'บันทึกแล้ว ✓' : 'บันทึกสถานะบริการ'}
          </button>
        </div>
      )}
    </>
  );
}
