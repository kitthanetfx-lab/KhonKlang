'use client';

import { useState } from 'react';

interface ConsentModalProps {
  /** เรียกเมื่อผู้ใช้กดยอมรับ — ปิด modal และให้เข้าใช้งานได้ */
  onAccept: () => void;
  /** เรียกเมื่อผู้ใช้กด "ไม่ยอมรับ / กลับ" */
  onDecline: () => void;
}

/**
 * PDPA consent ก่อนเริ่มฟอร์มสมัครผู้ขาย/คนกลาง
 * สี: ใช้ตัวแปรธีมจริงของโปรเจกต์ (--ink/--ink-2/--muted/--surface/--line)
 * เพื่อให้อ่านชัดทั้ง light และ dark theme
 */
export function ConsentModal({ onAccept, onDecline }: ConsentModalProps) {
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
              นโยบายคุ้มครองข้อมูลส่วนบุคคล
            </h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
            กรุณาอ่านและยอมรับก่อนดำเนินการสมัคร
          </p>
        </div>

        {/* Scrollable body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.75, marginBottom: 16, marginTop: 0 }}>
            ทาง <strong style={{ color: 'var(--ink)' }}>glanghub.com</strong> ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของคุณเป็นอันดับหนึ่ง
            ข้อมูลที่คุณส่งให้เราจะถูกนำไปใช้ตามวัตถุประสงค์ที่จำกัดและปลอดภัยดังนี้:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={sectionStyle}>
              <p style={{ ...sectionTitleStyle, marginBottom: 8 }}>
                📋 วัตถุประสงค์การเก็บข้อมูล
              </p>
              <ul style={{ ...sectionTextStyle, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li>
                  <strong style={{ color: 'var(--ink)' }}>ภาพถ่าย / เลขบัตรประชาชน:</strong> ใช้เพื่อยืนยันตัวตน (KYC)
                  เพื่อป้องกันมิจฉาชีพและการแอบอ้างสิทธิ์ในการซื้อขาย
                  และสร้างความปลอดภัยให้กับชุมชนตามระบบสมัครเป็นผู้ขาย/คนกลาง
                </li>
                <li>
                  <strong style={{ color: 'var(--ink)' }}>เลขบัญชีธนาคาร:</strong> ใช้เพื่อวัตถุประสงค์ในการโอนเงินค่าสินค้า/บริการ
                  หรือค่าผลประโยชน์ตามข้อตกลงเท่านั้น
                </li>
              </ul>
            </div>

            <div style={sectionStyle}>
              <p style={sectionTitleStyle}>🗂 ระยะเวลาการจัดเก็บ</p>
              <p style={sectionTextStyle}>
                เราจะเก็บรักษาข้อมูลของคุณไว้ตลอดระยะเวลาที่ท่านยังคงเป็นสมาชิกในระบบ
                และจะทำการลบทำลายข้อมูลทั้งหมดอย่างปลอดภัยภายใน 90 วัน
                หลังจากที่ท่านยกเลิกการเป็นสมาชิก
              </p>
            </div>

            <div style={sectionStyle}>
              <p style={sectionTitleStyle}>🔒 การรักษาความปลอดภัย</p>
              <p style={sectionTextStyle}>
                ข้อมูลบัตรประชาชนและเลขบัญชีจะถูกเก็บรักษาไว้ในระบบฐานข้อมูลที่มีการเข้ารหัสความปลอดภัย
                ระดับมาตรฐาน และจะไม่มีการนำไปเผยแพร่ ขาย หรือส่งต่อให้แก่บุคคลภายนอกโดยเด็ดขาด
                เว้นแต่เป็นการปฏิบัติตามกฎหมาย
              </p>
            </div>

            <div style={sectionStyle}>
              <p style={sectionTitleStyle}>✅ สิทธิ์ของเจ้าของข้อมูล</p>
              <p style={sectionTextStyle}>
                ท่านมีสิทธิ์ในการขอตรวจสอบ แก้ไข หรือขอให้ลบข้อมูลส่วนบุคคลของท่านออกจากระบบ
                ได้ทุกเมื่อ โดยติดต่อแอดมินผ่านช่องทางบริการลูกค้า
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
              id="consent-check"
              name="consentCheck"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              style={{ marginTop: 3, width: 18, height: 18, accentColor: '#16a34a', flexShrink: 0, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.7 }}>
              ฉันได้อ่านและยอมรับ{' '}
              <a href="/terms" target="_blank" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                เงื่อนไขการสมัคร
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
              ไม่ยอมรับ / กลับ
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
              ✓ ยอมรับและดำเนินการต่อ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
