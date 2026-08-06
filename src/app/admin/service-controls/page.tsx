'use client';

import { useEffect, useState } from 'react';
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

export default function ServiceControlsPage() {
  const [services, setServices] = useState<ServiceControlMap | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

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
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><SlidersHorizontal size={20} /> ควบคุมสถานะบริการ</h1>
        <p className="text-sm text-gray-500 mt-0.5">เปิดหรือปิดบริการแต่ละส่วนได้จากหลังบ้าน พร้อมตั้งข้อความแจ้งผู้ใช้ช่วงเมนเทนแนนซ์หรือเปิดใช้แบบทดลอง</p>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 space-y-3">
        <div>
          <h2 className="font-semibold text-base text-gray-900 dark:text-white flex items-center gap-2"><Film size={17} /> วีดีโอแนะนำการใช้งาน (หน้าแรก)</h2>
          <p className="text-sm text-gray-500 mt-1">วางลิงก์ YouTube รูปแบบไหนก็ได้ (ลิงก์จากแถบที่อยู่, youtu.be, Shorts ฯลฯ) ระบบจะแปลงเป็น embed URL ให้อัตโนมัติตอนบันทึก เพื่อแสดงในช่องวีดีโอเล็ก ๆ บนหน้าแรก ถ้าเว้นว่างจะแสดง placeholder แทน</p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <input
            value={videoUrl}
            onChange={e => { setVideoUrl(e.target.value); setVideoSaved(false); }}
            placeholder="https://www.youtube.com/watch?v=... หรือ https://youtu.be/..."
            disabled={!videoLoaded}
            className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm disabled:opacity-50"
          />
          <button
            type="button"
            onClick={saveVideoUrl}
            disabled={videoSaving || !videoLoaded}
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
          >
            {videoSaving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} บันทึกลิงก์วีดีโอ
          </button>
        </div>
        {videoSaved && <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 size={14} /> บันทึกแล้ว</span>}
        {videoError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm">⚠️ {videoError}</div>}
      </div>

      {services === null && !error && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">⚠️ {error}</div>}

      {services && (
        <>
          <div className="bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="font-semibold text-base text-gray-900 dark:text-white">🌐 เปิด / ปิดเว็บไซต์ทั้งหมด</h2>
              <p className="text-sm text-gray-500 mt-1">ปิดแล้วผู้ใช้ทั่วไปจะถูกพาไปหน้าแจ้งปิดปรับปรุงทันที (แอดมินเข้า /admin ได้ตามปกติ)</p>
            </div>
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
              <label className="block text-sm text-gray-600 dark:text-gray-300">ข้อความแจ้งผู้ใช้เมื่อปิดเว็บ</label>
              <input
                value={services.siteMaintenance.note}
                onChange={e => setServiceNote('siteMaintenance', e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          {SERVICE_CONTROL_GROUPS.map(group => (
            <div key={group} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 space-y-4">
              <div>
                <h2 className="font-semibold text-base text-gray-900 dark:text-white">{group}</h2>
                <p className="text-sm text-gray-500 mt-1">เลือกเปิดหรือปิดเฉพาะบริการในหมวดนี้ได้ตามรอบทดลองหรือช่วงบำรุงรักษา</p>
              </div>

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
            </div>
          ))}

          <div className="flex items-center gap-3 sticky bottom-4">
            <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 shadow-lg">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} บันทึกสถานะบริการ
            </button>
            {saved && <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 size={15} /> บันทึกแล้ว</span>}
          </div>
        </>
      )}
    </div>
  );
}
