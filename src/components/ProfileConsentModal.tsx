'use client';

import { useState } from 'react';

interface ProfileConsentModalProps {
  /** เรียกเมื่อผู้ใช้กดยอมรับ — ปิด modal และให้กรอกโปรไฟล์ได้ */
  onAccept: () => void;
  /** เรียกเมื่อผู้ใช้กด "ไม่ยอมรับ / กลับหน้าหลัก" */
  onDecline: () => void;
}

/**
 * Popup แจ้งเหตุผลการเก็บข้อมูลส่วนตัว+เลขบัญชีธนาคาร ก่อนเข้าฟอร์มกรอกโปรไฟล์
 * (สมาชิกใหม่หลังล็อกอิน LINE/Google ครั้งแรก) — รูปแบบเดียวกับ ConsentModal
 * ของหน้าสมัครผู้ขาย/คนกลาง responsive ทั้ง desktop/laptop/มือถือ
 */
export function ProfileConsentModal({ onAccept, onDecline }: ProfileConsentModalProps) {
  const [checked, setChecked] = useState(false);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: 'var(--card, #fff)',
        borderRadius: 16,
        boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
        maxWidth: 560,
        width: '100%',
        maxHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--line-2, #e5e7eb)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 22 }}>🔐</span>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg, #111)', margin: 0 }}>
              ทำไมเราจึงขอข้อมูลส่วนตัวและบัญชีธนาคารของคุณ
            </h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted, #6b7280)', margin: 0 }}>
            กรุณาอ่านและยอมรับก่อนกรอกข้อมูลโปรไฟล์
          </p>
        </div>

        {/* Scrollable body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          <p style={{ fontSize: 15, color: 'var(--fg, #111)', lineHeight: 1.75, marginBottom: 16 }}>
            <strong>กลางฮับ (glanghub.com)</strong> เป็นระบบซื้อขายปลอดภัยแบบพักเงิน (Escrow)
            ข้อมูลที่คุณกรอกจำเป็นต่อการคุ้มครองเงินของคุณเอง และถูกใช้ตามวัตถุประสงค์ที่จำกัดดังนี้:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--surface, #f9fafb)', borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--fg, #111)', marginBottom: 8 }}>
                🏦 เลขบัญชีธนาคาร — ใช้เพื่อโอนเงินให้คุณเท่านั้น
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 15, color: 'var(--muted-fg, #374151)', lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li>
                  <strong>ฝั่งผู้ขาย / คนกลาง:</strong> ใช้โอนเงินค่าสินค้าหรือค่าบริการให้คุณ
                  เมื่อดีลสำเร็จตามข้อตกลง
                </li>
                <li>
                  <strong>ฝั่งผู้ซื้อ:</strong> ใช้โอนเงินคืนให้คุณ ในกรณีที่ดีลมีปัญหา
                  ถูกยกเลิก หรือเกิดข้อพิพาทอื่น ๆ — เงินของคุณจะได้กลับถึงมือแน่นอน
                </li>
              </ul>
            </div>

            <div style={{ background: 'var(--surface, #f9fafb)', borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--fg, #111)', marginBottom: 6 }}>
                👤 ชื่อ-นามสกุล และเบอร์โทรศัพท์
              </p>
              <p style={{ fontSize: 15, color: 'var(--muted-fg, #374151)', lineHeight: 1.8, margin: 0 }}>
                ใช้ยืนยันตัวตนของคู่ดีล ป้องกันมิจฉาชีพและการแอบอ้าง
                และใช้ติดต่อคุณเมื่อดีลมีความคืบหน้าหรือต้องการข้อมูลเพิ่มเติม
              </p>
            </div>

            <div style={{ background: 'var(--surface, #f9fafb)', borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--fg, #111)', marginBottom: 6 }}>
                🔒 การรักษาความปลอดภัย
              </p>
              <p style={{ fontSize: 15, color: 'var(--muted-fg, #374151)', lineHeight: 1.8, margin: 0 }}>
                ข้อมูลส่วนตัวและเลขบัญชีถูกเก็บในฐานข้อมูลที่เข้ารหัสตามมาตรฐาน
                จะไม่ถูกเผยแพร่ ขาย หรือส่งต่อให้บุคคลภายนอกโดยเด็ดขาด
                เว้นแต่เป็นการปฏิบัติตามกฎหมาย
              </p>
            </div>

            <div style={{ background: 'var(--surface, #f9fafb)', borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--fg, #111)', marginBottom: 6 }}>
                ✅ สิทธิ์ของเจ้าของข้อมูล
              </p>
              <p style={{ fontSize: 15, color: 'var(--muted-fg, #374151)', lineHeight: 1.8, margin: 0 }}>
                คุณมีสิทธิ์ขอตรวจสอบ แก้ไข หรือขอให้ลบข้อมูลส่วนบุคคลออกจากระบบได้ทุกเมื่อ
                ผ่านหน้าโปรไฟล์หรือช่องทางบริการลูกค้า (ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล)
              </p>
            </div>
          </div>
        </div>

        {/* Footer — checkbox + buttons */}
        <div style={{
          padding: '16px 24px 20px',
          borderTop: '1px solid var(--line-2, #e5e7eb)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}>
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: checked ? 'var(--green-50, #f0fdf4)' : 'var(--surface, #f9fafb)',
            border: `1.5px solid ${checked ? 'var(--green-300, #86efac)' : 'var(--line-2, #e5e7eb)'}`,
            borderRadius: 10, padding: '12px 14px',
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <input
              type="checkbox"
              id="profile-consent-check"
              name="profileConsentCheck"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--green-600, #16a34a)', flexShrink: 0, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 15, color: 'var(--fg, #111)', lineHeight: 1.7 }}>
              ฉันได้อ่านและยอมรับ{' '}
              <a href="/terms" target="_blank" style={{ color: 'var(--accent, #2f6bf0)', textDecoration: 'underline' }}>
                เงื่อนไขการให้บริการ
              </a>{' '}
              และ{' '}
              <a href="/privacy" target="_blank" style={{ color: 'var(--accent, #2f6bf0)', textDecoration: 'underline' }}>
                นโยบายความเป็นส่วนตัว
              </a>{' '}
              นี้แล้ว <span style={{ color: '#ef4444' }}>*</span>
            </span>
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onDecline}
              style={{
                flex: 1, padding: '12px 0', borderRadius: 10,
                border: '1.5px solid #ef4444',
                background: '#fff', color: '#dc2626',
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              ไม่ยอมรับ / กลับหน้าหลัก
            </button>
            <button
              onClick={onAccept}
              disabled={!checked}
              style={{
                flex: 2, padding: '12px 0', borderRadius: 10, border: 'none',
                background: checked ? '#16a34a' : '#d1d5db',
                color: checked ? '#fff' : '#9ca3af',
                fontSize: 15, fontWeight: 700, cursor: checked ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
              }}
            >
              ✓ ยอมรับและกรอกข้อมูลต่อ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
