'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from 'react';
import { authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { TH_LOGISTICS_PROVIDERS, getLogisticsProviderLabel } from '@/lib/logistics';
import { Icon } from '@/components/Icon';

type EvidenceItem = {
  id: string;
  type: string;
  file_id: string;
  file_name?: string;
  uploaded_by?: string;
};

type BuyerShipping = {
  name: string;
  phone: string;
  address: string;
};

type Props = {
  dealId: string;
  dealTitle: string;
  onDone: () => void;
  onClose: () => void;
};

const PACK_STEPS = [
  { step: 1 as const, imageSrc: '/pack.webp', title: 'แพ็คสินค้า', hint: 'ถ่ายรูป/วิดีโอตอนใส่ของเข้ากล่อง' },
  { step: 2 as const, imageSrc: '/Logistic.webp', title: 'ไปส่งของ', hint: 'ถ่ายรูป/วิดีโอตอนส่งหรือรูปกล่องก่อนส่ง' },
  { step: 3 as const, imageSrc: '/Slip.webp', title: 'สลิป/QR พัสดุ', hint: 'สลิปพัสดุ หรือ QR Code จากขนส่ง' },
];

function fileUrl(fileId: string) {
  return fileViewUrl(DEAL_BUCKET, fileId);
}

function isVideoName(name?: string) {
  return !!name?.match(/\.(mp4|mov|avi|webm)$/i);
}

export function SellerPackingPanel({ dealId, dealTitle, onDone, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);
  const [uploadingStep, setUploadingStep] = useState<1 | 2 | 3 | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [buyerShipping, setBuyerShipping] = useState<BuyerShipping | null>(null);
  const [buyerShippingProvider, setBuyerShippingProvider] = useState('');
  const [trackingProvider, setTrackingProvider] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const activeStepRef = useRef<1 | 2 | 3 | null>(null);

  const load = useCallback(async () => {
    const headers = await authHeaders();
    const res = await fetch(`/api/deals/${dealId}`, { headers });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || 'โหลดไม่สำเร็จ');
    setEvidence((d.evidence || []).filter((e: EvidenceItem) => e.type === 'packing'));
    setBuyerShipping(d.buyerShipping || null);
    const chosenProvider = String(d.deal?.buyer_shipping_provider || '').trim();
    setBuyerShippingProvider(chosenProvider);
    if (d.deal?.tracking_to_buyer_provider) {
      setTrackingProvider(String(d.deal.tracking_to_buyer_provider));
    } else if (chosenProvider) {
      setTrackingProvider(chosenProvider);
    }
    if (d.deal?.tracking_to_buyer) setTrackingNumber(String(d.deal.tracking_to_buyer));
  }, [dealId]);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'โหลดไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const slots = [evidence[0] || null, evidence[1] || null, evidence[2] || null] as Array<EvidenceItem | null>;
  const canUploadStep = (step: 1 | 2 | 3) => step === 1 || !!slots[step - 2];
  const hasAll = slots.every(Boolean);

  async function uploadStep(file: File, step: 1 | 2 | 3) {
    if (!canUploadStep(step) || slots[step - 1]) return;
    setUploadingStep(step);
    setError('');
    try {
      const headers = await authHeaders();
      const fd = new FormData();
      fd.append('file', file);
      const up = await fetch('/api/upload-deal', { method: 'POST', headers, body: fd });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok) throw new Error(upData.error || 'อัปโหลดไม่สำเร็จ');

      const patch = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_evidence',
          evidenceType: 'packing',
          fileId: upData.fileId,
          fileName: file.name,
        }),
      });
      const patchData = await patch.json().catch(() => ({}));
      if (!patch.ok) throw new Error(patchData.error || 'บันทึกหลักฐานไม่สำเร็จ');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ');
    } finally {
      setUploadingStep(null);
      activeStepRef.current = null;
    }
  }

  async function deleteEvidence(item: EvidenceItem) {
    setActing(true);
    setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_evidence', evidenceId: item.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'ลบไม่สำเร็จ');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'ลบไม่สำเร็จ');
    } finally {
      setActing(false);
    }
  }

  async function finishPacking() {
    if (!hasAll) { setError('กรุณาอัปโหลดหลักฐานให้ครบทั้ง 3 ขั้นก่อน'); return; }
    const provider = buyerShippingProvider || trackingProvider.trim();
    if (!provider) { setError('ยังไม่ทราบผู้ให้บริการขนส่ง — รอผู้ซื้อเลือกขนส่งจากตัวเลือกที่ลงไว้'); return; }
    if (!trackingNumber.trim()) { setError('กรุณากรอกเลขพัสดุ'); return; }
    setActing(true);
    setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'seller_done_packing',
          trackingNumber: trackingNumber.trim(),
          trackingProvider: provider,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'บันทึกไม่สำเร็จ');
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="seller-pack-panel">
        <div className="seller-pack-loading">กำลังโหลดข้อมูลแพ็ค...</div>
      </div>
    );
  }

  return (
    <div className="seller-pack-panel">
      <div className="seller-pack-head">
        <div>
          <div className="seller-pack-kicker">แพ็คสินค้า · หน้าร้านผู้ขาย</div>
          <h3 className="seller-pack-title">{dealTitle}</h3>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>ปิด</button>
      </div>

      {error && <div className="shop-alert shop-alert--err">⚠️ {error}</div>}

      {buyerShipping && (
        <div className="seller-pack-ship">
          <div className="seller-pack-ship-title">📦 ที่อยู่จัดส่งผู้ซื้อ</div>
          <div className="seller-pack-ship-name">{buyerShipping.name || '—'}</div>
          {buyerShipping.address && <div className="seller-pack-ship-addr">{buyerShipping.address}</div>}
          {buyerShipping.phone && (
            <a href={`tel:${buyerShipping.phone}`} className="seller-pack-ship-phone">📞 {buyerShipping.phone}</a>
          )}
          {buyerShippingProvider && (
            <div className="seller-pack-ship-carrier">
              🚚 ขนส่งที่ผู้ซื้อเลือก: <strong>{getLogisticsProviderLabel(buyerShippingProvider)}</strong>
            </div>
          )}
        </div>
      )}

      {!buyerShipping && buyerShippingProvider && (
        <div className="seller-pack-ship">
          <div className="seller-pack-ship-carrier">
            🚚 ขนส่งที่ผู้ซื้อเลือก: <strong>{getLogisticsProviderLabel(buyerShippingProvider)}</strong>
          </div>
        </div>
      )}

      <div className="seller-pack-steps-guide">
        {PACK_STEPS.map(item => (
          <div key={item.step} className="seller-pack-guide-card">
            <div className="seller-pack-guide-img">
              <img src={item.imageSrc} alt={item.title} />
              <span>{item.step}</span>
            </div>
            <div className="seller-pack-guide-label">{item.title}</div>
          </div>
        ))}
      </div>

      <div className="seller-pack-upload-grid">
        {PACK_STEPS.map(item => {
          const uploaded = slots[item.step - 1];
          const locked = !canUploadStep(item.step);
          const busy = uploadingStep === item.step;
          return (
            <div key={item.step} className={`seller-pack-slot${locked ? ' is-locked' : ''}${uploaded ? ' is-done' : ''}`}>
              <div className="seller-pack-slot-label">ขั้น {item.step} · {item.title}</div>
              <div className="seller-pack-slot-preview">
                {uploaded ? (
                  isVideoName(uploaded.file_name)
                    ? <video src={fileUrl(uploaded.file_id)} controls />
                    : <img src={fileUrl(uploaded.file_id)} alt={item.title} />
                ) : (
                  <span>{item.step}</span>
                )}
              </div>
              <p className="seller-pack-slot-hint">
                {uploaded ? '✅ อัปโหลดแล้ว' : locked ? `รอขั้น ${item.step - 1} ก่อน` : item.hint}
              </p>
              <button
                type="button"
                className="btn btn-soft btn-sm btn-block"
                disabled={locked || !!uploaded || busy || acting}
                onClick={() => {
                  activeStepRef.current = item.step;
                  inputRef.current?.click();
                }}
              >
                <Icon name="upload" size={14} /> {busy ? 'กำลังอัป...' : uploaded ? 'อัปแล้ว' : `เลือกไฟล์ขั้น ${item.step}`}
              </button>
              {uploaded && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-block"
                  style={{ color: 'var(--rose-500)', marginTop: 6 }}
                  disabled={acting}
                  onClick={() => void deleteEvidence(uploaded)}
                >
                  ลบ / อัปใหม่
                </button>
              )}
            </div>
          );
        })}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={e => {
          const f = e.target.files?.[0];
          const step = activeStepRef.current;
          e.target.value = '';
          if (!f || !step) return;
          void uploadStep(f, step);
        }}
      />

      <div className="seller-pack-tracking">
        {buyerShippingProvider ? (
          <div className="seller-pack-carrier-fixed">
            <span className="seller-pack-carrier-label">ผู้ให้บริการขนส่ง</span>
            <div className="seller-pack-carrier-value">
              {getLogisticsProviderLabel(buyerShippingProvider)}
              <span className="seller-pack-carrier-note">ผู้ซื้อเลือกแล้ว — ใช้ขนส่งนี้ส่งพัสดุ</span>
            </div>
          </div>
        ) : (
          <label>
            <span>ผู้ให้บริการโลจิสติกส์ *</span>
            <select value={trackingProvider} onChange={e => setTrackingProvider(e.target.value)}>
              <option value="">เลือกผู้ให้บริการ...</option>
              {TH_LOGISTICS_PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span>เลขพัสดุ *</span>
          <input
            type="text"
            value={trackingNumber}
            onChange={e => setTrackingNumber(e.target.value)}
            placeholder="กรอกเลขพัสดุ"
          />
        </label>
        {(buyerShippingProvider || trackingProvider) && trackingNumber && (
          <div className="seller-pack-track-preview">
            {getLogisticsProviderLabel(buyerShippingProvider || trackingProvider)} · <strong>{trackingNumber}</strong>
          </div>
        )}
      </div>

      <div className="seller-pack-progress">
        {hasAll ? '✅ อัปโหลดครบ 3 ขั้นแล้ว — กรอกเลขพัสดุแล้วกดส่งได้' : `อัปโหลดแล้ว ${evidence.length}/3 ขั้น`}
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block btn-lg"
        disabled={acting || !hasAll}
        onClick={() => void finishPacking()}
      >
        {acting ? 'กำลังบันทึก...' : '📦 แพ็คเสร็จ — แจ้งเลขพัสดุให้ผู้ซื้อ'}
      </button>
    </div>
  );
}
