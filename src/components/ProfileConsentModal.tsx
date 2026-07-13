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
 * (สมาชิกใหม่หลังล็อกอิน LINE/Google ครั้งแรก) — responsive ทุกอุปกรณ์
 * สี: ใช้ตัวแปรธีมจริงของโปรเจกต์ (--ink/--ink-2/--muted/--surface/--line)
 * เพื่อให้อ่านชัดทั้ง light และ dark theme
 */
export function ProfileConsentModal({ onAccept, onDecline }: ProfileConsentModalProps) {
  const [checked, setChecked] = useState(false);

  const sectionStyle: React.CSSProperties = {
    background: 'var(--surface-2)',
    border: '1px solid var(--line-2)',
    borderRadius: 10,
    padding: '14px 16px',
  };
  const sectionTitleStyle: React.CSSProperties = {
    fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 6, marginTop: 0,
  };
  const sectionTextStyle: React.CSSProperties = {
    fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.8, margin: 0,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 16,
        boxShadow: 'var(--sh-lg)',
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
          borderBottom: '1px solid var(--line)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 22 }}>🔐</span>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
              ทำไมเราจึงขอข้อมูลส่วนตัวและบัญชีธนาคารของคุณ
            </h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
            กรุณาอ่านและยอมรับก่อนกรอกข้อมูลโปรไฟล์
          </p>
        </div>

        {/* Scrollable body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.75, marginBottom: 16, marginTop: 0 }}>
            <strong style={{ color: 'var(--ink)' }}>กลางฮับ (glanghub.com)</strong> เป็นระบบซื้อขายปลอดภัยแบบพักเงิน (Escrow)
            ข้อมูลที่คุณกรอกจำเป็นต่อการคุ้มครองเงินของคุณเอง และถูกใช้ตามวัตถุประสงค์ที่จำกัดดังนี้:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={sectionStyle}>
              <p style={{ ...sectionTitleStyle, marginBottom: 8 }}>
                🏦 เลขบัญชีธนาคาร — ใช้เพื่อโอนเงินให้คุณเท่านั้น
              </p>
              <ul style={{ ...sectionTextStyle, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li>
                  <strong style={{ color: 'var(--ink)' }}>ฝั่งผู้ขาย / คนกลาง:</strong> ใช้โอนเงินค่าสินค้าหรือค่าบริการให้คุณ
                  เมื่อดีลสำเร็จตามข้อตกลง
                </li>
                <li>
                  <strong style={{ color: 'var(--ink)' }}>ฝั่งผู้ซื้อ:</strong> ใช้โอนเงินคืนให้คุณ ในกรณีที่ดีลมีปัญหา
                  ถูกยกเลิก หรือเกิดข้อพิพาทอื่น ๆ — เงินของคุณจะได้กลับถึงมือแน่นอน
                </li>
              </ul>
            </div>

            <div style={sectionStyle}>
              <p style={sectionTitleStyle}>👤 ชื่อ-นามสกุล และเบอร์โทรศัพท์</p>
              <p style={sectionTextStyle}>
                ใช้ยืนยันตัวตนของคู่ดีล ป้องกันมิจฉาชีพและการแอบอ้าง
                และใช้ติดต่อคุณเมื่อดีลมีความคืบหน้าหรือต้องการข้อมูลเพิ่มเติม
              </p>
            </div>

            <div style={sectionStyle}>
              <p style={sectionTitleStyle}>🔒 การรักษาความปลอดภัย</p>
              <p style={sectionTextStyle}>
                ข้อมูลส่วนตัวและเลขบัญชีถูกเก็บในฐานข้อมูลที่เข้ารหัสตามมาตรฐาน
                จะไม่ถูกเผยแพร่ ขาย หรือส่งต่อให้บุคคลภายนอกโดยเด็ดขาด
                เว้นแต่เป็นการปฏิบัติตามกฎหมาย
              </p>
            </div>

            <div style={sectionStyle}>
              <p style={sectionTitleStyle}>✅ สิทธิ์ของเจ้าของข้อมูล</p>
              <p style={sectionTextStyle}>
                คุณมีสิทธิ์ขอตรวจสอบ แก้ไข หรือขอให้ลบข้อมูลส่วนบุคคลออกจากระบบได้ทุกเมื่อ
                ผ่านหน้าโปรไฟล์หรือช่องทางบริการลูกค้า (ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล)
              </p>
            </div>
          </div>
        </div>

        {/* Footer — checkbox + buttons */}
        <div style={{
          padding: '16px 24px 20px',
          borderTop: '1px solid var(--line)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}>
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: checked ? 'color-mix(in srgb, #16a34a 12%, transparent)' : 'var(--surface-2)',
            border: `1.5px solid ${checked ? 'color-mix(in srgb, #16a34a 55%, transparent)' : 'var(--line)'}`,
            borderRadius: 10, padding: '12px 14px',
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <input
              type="checkbox"
              id="profile-consent-check"
              name="profileConsentCheck"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              style={{ marginTop: 3, width: 18, height: 18, accentColor: '#16a34a', flexShrink: 0, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.7 }}>
              ฉันได้อ่านและยอมรับ{' '}
              <a href="/terms" target="_blank" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                เงื่อนไขการให้บริการ
              </a>{' '}
              และ{' '}
              <a href="/privacy" target="_blank" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
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
                background: 'transparent', color: '#ef4444',
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
                background: checked ? '#16a34a' : 'var(--line-2)',
                color: checked ? '#fff' : 'var(--faint)',
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
