'use client';

import { useEffect, useState, useMemo } from 'react';
import { authHeaders } from '@/lib/supabase';
import { CheckCircle2, Film, Loader2, SlidersHorizontal } from 'lucide-react';
import {
  SERVICE_CONTROL_CATALOG,
  SERVICE_CONTROL_GROUPS,
  SITE_MAINTENANCE_DEFAULT_NOTE,
  ServiceControlKey,
  ServiceControlMap,
  sanitizeServiceControls,
} from '@/lib/serviceControls';
import { toYouTubeEmbedUrl } from '@/lib/youtube';
import {
  AdminPage,
  AdminPageHeader,
  AdminAlert,
  AdminStickyBar,
  AdminCard,
  AdminLoading,
} from '@/components/admin/AdminUI';

export default function ServiceControlsPage() {
  const [services, setServices] = useState<ServiceControlMap | null>(null);
  const [savedServices, setSavedServices] = useState<ServiceControlMap | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const dirty = useMemo(() => {
    if (!services || !savedServices) return false;
    return JSON.stringify(services) !== JSON.stringify(savedServices);
  }, [services, savedServices]);

  // ลิงก์วีดีโอโปรโมตหน้าแรก (เก็บแยกใน fee_config ผ่าน /api/admin/settings)
  const [videoUrl, setVideoUrl] = useState('');
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoSaving, setVideoSaving] = useState(false);
  const [videoSaved, setVideoSaved] = useState(false);
  const [videoError, setVideoError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const headers = await authHeaders();
        const r = await fetch('/api/admin/service-controls', { headers });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'โหลดสถานะบริการไม่สำเร็จ');
        setServices(sanitizeServiceControls(d.services));
        setSavedServices(sanitizeServiceControls(d.services));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
      }
    })();
    (async () => {
      try {
        const headers = await authHeaders();
        const r = await fetch('/api/admin/settings', { headers });
        const d = await r.json();
        if (r.ok) setVideoUrl(d.fees?.promoVideoUrl || '');
      } catch {
        // ไม่บล็อกหน้าหลักถ้าโหลดลิงก์วีดีโอไม่สำเร็จ
      } finally {
        setVideoLoaded(true);
      }
    })();
  }, []);

  async function saveVideoUrl() {
    setVideoSaving(true);
    setVideoSaved(false);
    setVideoError('');
    try {
      const headers = await authHeaders();
      const r = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fees: { promoVideoUrl: toYouTubeEmbedUrl(videoUrl.trim()) } }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'บันทึกไม่สำเร็จ');
      setVideoUrl(d.fees?.promoVideoUrl || '');
      setVideoSaved(true);
    } catch (e) {
      setVideoError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setVideoSaving(false);
    }
  }

  function setServiceEnabled(key: ServiceControlKey, enabled: boolean) {
    setServices(current => current ? { ...current, [key]: { ...current[key], enabled } } : current);
    setSaved(false);
  }

  function setServiceNote(key: ServiceControlKey, note: string) {
    setServices(current => current ? { ...current, [key]: { ...current[key], note } } : current);
    setSaved(false);
  }

  function setSiteReopenAt(value: string) {
    setServices(current => current ? { ...current, siteMaintenance: { ...current.siteMaintenance, reopenAt: value } } : current);
    setSaved(false);
  }

  function setSiteMaintenance(active: boolean) {
    setServices(current => current ? {
      ...current,
      siteMaintenance: {
        ...current.siteMaintenance,
        enabled: active,
        note: current.siteMaintenance.note || SITE_MAINTENANCE_DEFAULT_NOTE,
      },
    } : current);
    setSaved(false);
  }

  function setSlipAutoMode(auto: boolean) {
    setServices(current => current ? { ...current, slipAutoVerify: { ...current.slipAutoVerify, enabled: auto } } : current);
    setSaved(false);
  }

  function setSlipManualThreshold(value: string) {
    const n = Number(String(value).replace(/,/g, '').trim());
    setServices(current => current ? {
      ...current,
      slipAutoVerify: {
        ...current.slipAutoVerify,
        amountThreshold: Number.isFinite(n) && n > 0 ? n : null,
      },
    } : current);
    setSaved(false);
  }

  const toLocalInput = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const fromLocalInput = (value: string) => {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  };

  async function save() {
    if (!services) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const headers = await authHeaders();
      const r = await fetch('/api/admin/service-controls', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ services }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'บันทึกไม่สำเร็จ');
      setServices(sanitizeServiceControls(d.services));
      setSavedServices(sanitizeServiceControls(d.services));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPage className="max-w-4xl">
      <AdminPageHeader
        icon={<SlidersHorizontal size={22} />}
        title="ควบคุมสถานะบริการ"
        subtitle="เปิดหรือปิดบริการแต่ละส่วน พร้อมตั้งข้อความแจ้งผู้ใช้ช่วงเมนเทนแนนซ์"
        onSave={save}
        saving={saving}
        saved={saved}
        dirty={dirty}
        saveLabel="บันทึกสถานะ"
      />

      <AdminCard title="วีดีโอแนะนำการใช้งาน (หน้าแรก)" icon={<Film size={18} className="text-violet-600" />} featured="purple"
        hint="วางลิงก์ YouTube รูปแบบไหนก็ได้ — ระบบแปลงเป็น embed อัตโนมัติ">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <input
            value={videoUrl}
            onChange={e => { setVideoUrl(e.target.value); setVideoSaved(false); }}
            placeholder="https://www.youtube.com/watch?v=... หรือ https://youtu.be/..."
            disabled={!videoLoaded}
            className="admin-field__input flex-1 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={saveVideoUrl}
            disabled={videoSaving || !videoLoaded}
            className="admin-btn admin-btn--primary whitespace-nowrap disabled:opacity-50"
          >
            {videoSaving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} บันทึกวีดีโอ
          </button>
        </div>
        {videoSaved && <span className="admin-page__saved" style={{ marginTop: 8 }}><CheckCircle2 size={14} /> บันทึกวีดีโอแล้ว</span>}
        {videoError && <AdminAlert type="error">⚠️ {videoError}</AdminAlert>}
      </AdminCard>

      {services === null && !error && <AdminLoading />}
      {error && <AdminAlert type="error">⚠️ {error}</AdminAlert>}

      {services && (
        <>
          <AdminCard title="เปิด / ปิดเว็บไซต์ทั้งหมด" icon={<span>🌐</span>} featured="amber"
            hint="ปิดแล้วผู้ใช้ทั่วไปจะถูกพาไปหน้าแจ้งปิดปรับปรุง (แอดมินเข้า /admin ได้ตามปกติ)">
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => setSiteMaintenance(false)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${!services.siteMaintenance.enabled ? 'bg-green-600 text-white border-green-600' : 'bg-white dark:bg-gray-900 text-gray-600 border-gray-200 dark:border-gray-700'}`}>
                เปิดเว็บ
              </button>
              <button type="button" onClick={() => setSiteMaintenance(true)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${services.siteMaintenance.enabled ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-gray-900 text-gray-600 border-gray-200 dark:border-gray-700'}`}>
                ปิดปรับปรุง
              </button>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${services.siteMaintenance.enabled ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                {services.siteMaintenance.enabled ? 'ปิดอยู่' : 'เปิดอยู่'}
              </span>
            </div>
            <div>
              <label className="admin-field__label">ข้อความแจ้งผู้ใช้เมื่อปิดเว็บ</label>
              <input
                value={services.siteMaintenance.note}
                onChange={e => setServiceNote('siteMaintenance', e.target.value)}
                className="admin-field__input mt-1"
              />
            </div>
          </AdminCard>

          <AdminCard title="ตรวจสลิปอัตโนมัติ / แมนนวล" icon={<span>🧾</span>} featured="purple"
            hint="โหมดอัตโนมัติเรียก SlipOK — แมนนวลให้แอดมินกดตรวจเองในแท็บยืนยันรับเงิน">
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => setSlipAutoMode(true)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${services.slipAutoVerify.enabled ? 'bg-green-600 text-white border-green-600' : 'bg-white dark:bg-gray-900 text-gray-600 border-gray-200 dark:border-gray-700'}`}>
                อัตโนมัติ
              </button>
              <button type="button" onClick={() => setSlipAutoMode(false)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${!services.slipAutoVerify.enabled ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-gray-900 text-gray-600 border-gray-200 dark:border-gray-700'}`}>
                แมนนวล
              </button>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${services.slipAutoVerify.enabled ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {services.slipAutoVerify.enabled ? 'อัตโนมัติ' : 'แมนนวล'}
              </span>
            </div>
            <div>
              <label className="admin-field__label">มูลค่าดีลเกินกว่านี้ → บังคับแมนนวล</label>
              <p className="admin-field__hint mb-2">ใช้ราคาสินค้าในดีล — ว่างหรือ 0 = ไม่จำกัดยอด</p>
              <input
                type="number"
                min={0}
                step={1000}
                value={services.slipAutoVerify.amountThreshold ?? ''}
                onChange={e => setSlipManualThreshold(e.target.value)}
                placeholder="เช่น 50000"
                disabled={!services.slipAutoVerify.enabled}
                className="admin-field__input max-w-xs disabled:opacity-50"
              />
            </div>
          </AdminCard>

          {SERVICE_CONTROL_GROUPS.map(group => (
            <AdminCard key={group} title={group} hint="เลือกเปิดหรือปิดเฉพาะบริการในหมวดนี้">
              {group === 'บริการเสริม' && (
                <div className="rounded-2xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 p-4">
                  <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">📅 วันเวลาเปิดให้บริการอีกครั้ง (ทั้งเว็บ)</h3>
                  <p className="text-sm text-gray-500 mt-1 mb-2">แสดงบนหน้าปิดปรับปรุง — ว่างได้ถ้ายังไม่กำหนด</p>
                  <input
                    type="datetime-local"
                    value={toLocalInput(services.siteMaintenance.reopenAt || '')}
                    onChange={e => setSiteReopenAt(fromLocalInput(e.target.value))}
                    className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm"
                  />
                </div>
              )}

              <div className="grid gap-3">
                {SERVICE_CONTROL_CATALOG.filter(item => item.group === group).map(item => {
                  const entry = services[item.key];
                  return (
                    <div key={item.key} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/30 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${entry.enabled ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {entry.enabled ? 'เปิดใช้งาน' : 'ปิดชั่วคราว'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-3xl">{item.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setServiceEnabled(item.key, true)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${entry.enabled ? 'bg-green-600 text-white border-green-600' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`}
                          >
                            เปิด
                          </button>
                          <button
                            type="button"
                            onClick={() => setServiceEnabled(item.key, false)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${!entry.enabled ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`}
                          >
                            ปิด
                          </button>
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="block text-sm text-gray-600 dark:text-gray-300">ข้อความแจ้งผู้ใช้เมื่อปิดบริการ</label>
                        <input
                          value={entry.note}
                          onChange={e => setServiceNote(item.key, e.target.value)}
                          placeholder="เช่น อยู่ระหว่างเมนเทนแนนซ์ หรือ เปิดให้ใช้งานเฉพาะบางกลุ่ม"
                          className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </AdminCard>
          ))}

          <AdminStickyBar onSave={save} saving={saving} saved={saved} dirty={dirty} label="บันทึกสถานะบริการ" />
        </>
      )}
    </AdminPage>
  );
}
