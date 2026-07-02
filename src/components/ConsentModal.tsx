'use client';

import { useState } from 'react';

interface ConsentModalProps {
  /** เรียกเมื่อผู้ใช้กดยอมรับ — ปิด modal และให้เข้าใช้งานได้ */
  onAccept: () => void;
  /** เรียกเมื่อผู้ใช้กด "ไม่ยอมรับ / กลับ" */
  onDecline: () => void;
}

export function ConsentModal({ onAccept, onDecline }: ConsentModalProps) {
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
              นโยบายคุ้มครองข้อมูลส่วนบุคคล
            </h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted, #6b7280)', margin: 0 }}>
            กรุณาอ่านและยอมรับก่อนดำเนินการสมัคร
          </p>
        </div>

        {/* Scrollable body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          <p style={{ fontSize: 14, color: 'var(--fg, #111)', lineHeight: 1.7, marginBottom: 16 }}>
            ทาง <strong>glanghub.com</strong> ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของคุณเป็นอันดับหนึ่ง
            ข้อมูลที่คุณส่งให้เราจะถูกนำไปใช้ตามวัตถุประสงค์ที่จำกัดและปลอดภัยดังนี้:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--surface, #f9fafb)', borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg, #111)', marginBottom: 8 }}>
                📋 วัตถุประสงค์การเก็บข้อมูล
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--muted-fg, #374151)', lineHeight: 1.75, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li>
                  <strong>ภาพถ่าย / เลขบัตรประชาชน:</strong> ใช้เพื่อยืนยันตัวตน (KYC)
                  เพื่อป้องกันมิจฉาชีพและการแอบอ้างสิทธิ์ในการซื้อขาย
                  และสร้างความปลอดภัยให้กับชุมชนตามระบบสมัครเป็นผู้ขาย/คนกลาง
                </li>
                <li>
                  <strong>เลขบัญชีธนาคาร:</strong> ใช้เพื่อวัตถุประสงค์ในการโอนเงินค่าสินค้า/บริการ
                  หรือค่าผลประโยชน์ตามข้อตกลงเท่านั้น
                </li>
              </ul>
            </div>

            <div style={{ background: 'var(--surface, #f9fafb)', borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg, #111)', marginBottom: 6 }}>
                🗂 ระยะเวลาการจัดเก็บ
              </p>
              <p style={{ fontSize: 13, color: 'var(--muted-fg, #374151)', lineHeight: 1.7, margin: 0 }}>
                เราจะเก็บรักษาข้อมูลของคุณไว้ตลอดระยะเวลาที่ท่านยังคงเป็นสมาชิกในระบบ
                และจะทำการลบทำลายข้อมูลทั้งหมดอย่างปลอดภัยภายใน 90 วัน
                หลังจากที่ท่านยกเลิกการเป็นสมาชิก
              </p>
            </div>

            <div style={{ background: 'var(--surface, #f9fafb)', borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg, #111)', marginBottom: 6 }}>
                🔒 การรักษาความปลอดภัย
              </p>
              <p style={{ fontSize: 13, color: 'var(--muted-fg, #374151)', lineHeight: 1.7, margin: 0 }}>
                ข้อมูลบัตรประชาชนและเลขบัญชีจะถูกเก็บรักษาไว้ในระบบฐานข้อมูลที่มีการเข้ารหัสความปลอดภัย
                ระดับมาตรฐาน และจะไม่มีการนำไปเผยแพร่ ขาย หรือส่งต่อให้แก่บุคคลภายนอกโดยเด็ดขาด
                เว้นแต่เป็นการปฏิบัติตามกฎหมาย
              </p>
            </div>

            <div style={{ background: 'var(--surface, #f9fafb)', borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg, #111)', marginBottom: 6 }}>
                ✅ สิทธิ์ของเจ้าของข้อมูล
              </p>
              <p style={{ fontSize: 13, color: 'var(--muted-fg, #374151)', lineHeight: 1.7, margin: 0 }}>
                ท่านมีสิทธิ์ในการขอตรวจสอบ แก้ไข หรือขอให้ลบข้อมูลส่วนบุคคลของท่านออกจากระบบ
                ได้ทุกเมื่อ โดยติดต่อแอดมินผ่านช่องทางบริการลูกค้า
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
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              style={{ marginTop: 2, width: 17, height: 17, accentColor: 'var(--green-600, #16a34a)', flexShrink: 0, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 13, color: 'var(--fg, #111)', lineHeight: 1.65 }}>
              ฉันได้อ่านและยอมรับ{' '}
              <a href="/terms" target="_blank" style={{ color: 'var(--accent, #2f6bf0)', textDecoration: 'underline' }}>
                เงื่อนไขการสมัคร
              </a>{' '}
              และ{' '}
              <a href="/privacy" target="_blank" style={{ color: 'var(--accent, #2f6bf0)', textDecoration: 'underline' }}>
                นโยบายความเป็นส่วนตัว
              </a>{' '}
              นี้แล้ว <span style={{ color: 'var(--red-500, #ef4444)' }}>*</span>
            </span>
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onDecline}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 10, border: '1.5px solid var(--line-2, #e5e7eb)',
                background: 'transparent', color: 'var(--muted, #6b7280)',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              ไม่ยอมรับ / กลับ
            </button>
            <button
              onClick={onAccept}
              disabled={!checked}
              style={{
                flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
                background: checked ? 'var(--green-600, #16a34a)' : 'var(--line-2, #e5e7eb)',
                color: checked ? '#fff' : 'var(--muted, #9ca3af)',
                fontSize: 14, fontWeight: 700, cursor: checked ? 'pointer' : 'not-allowed',
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
