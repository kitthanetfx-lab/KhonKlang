'use client';
import Link from 'next/link';
import { PageShell } from '@/components/PageShell';
import { Icon } from '@/components/Icon';
import { useAppPreferences } from '@/components/AppPreferences';

export default function HowItWorks() {
  const { locale } = useAppPreferences();
  const STEPS = locale === 'th'
    ? [
        { t: 'สร้างดีลหรือเลือกสินค้า', d: 'ผู้ขายโพสต์สินค้า หรือผู้ซื้อสร้างดีลแล้วแชร์ลิงก์ให้คู่ค้าเข้าร่วม ระบบจะเปิดห้องดีลที่มีแชทและวิดีโอคอลในตัว' },
        { t: 'เลือกคนกลางที่ผ่านการรับรอง', d: 'ผู้ซื้อเลือกคนกลางจากรายชื่อที่ยืนยันตัวตน KYC แล้ว ดูคะแนนรีวิว เทียร์ จังหวัด และความถนัดก่อนตัดสินใจ' },
        { t: 'ทุกฝ่ายยอมรับเงื่อนไข', d: 'ผู้ซื้อ ผู้ขาย และคนกลาง กดยอมรับเงื่อนไขดีลเดียวกันในระบบ ทุกอย่างถูกบันทึกไว้เป็นหลักฐาน' },
        { t: 'ผู้ซื้อโอนเงินเข้าระบบพักเงิน', d: 'เงินจะถูกพักไว้ ไม่ถึงมือผู้ขายจนกว่าผู้ซื้อจะได้รับสินค้าจริง คนกลางยืนยันยอดก่อนเริ่มขั้นตอนถัดไป' },
        { t: 'ผู้ขายส่งของให้คนกลางตรวจ', d: 'ผู้ขายแพ็คสินค้าพร้อมอัปโหลดวิดีโอหลักฐาน คนกลางรับของ ตรวจสภาพ และอัปโหลดวิดีโอการตรวจให้เห็นทุกขั้นตอน' },
        { t: 'ผู้ซื้อยืนยัน แล้วระบบปล่อยเงิน', d: 'เมื่อผู้ซื้อได้รับสินค้าและยืนยันว่าตรงปก ระบบโอนเงินให้ผู้ขายทันที จากนั้นทุกฝ่ายให้คะแนนรีวิวซึ่งกันและกัน' },
      ]
    : [
        { t: 'Create a deal or choose an item', d: 'The seller lists an item, or the buyer creates a deal and shares the link with the counterparty. The system opens a deal room with built-in chat and video calls.' },
        { t: 'Choose a verified middleman', d: 'The buyer selects a KYC-verified middleman based on ratings, tier, province, and expertise before confirming the deal.' },
        { t: 'All parties accept the same terms', d: 'Buyer, seller, and middleman confirm the same deal terms inside the system. Every agreement is recorded as evidence.' },
        { t: 'Buyer pays into escrow', d: 'Funds stay in the system and do not reach the seller until the buyer receives the real item. The middleman confirms the payment before the next step starts.' },
        { t: 'Seller ships for inspection', d: 'The seller packs the item and uploads video evidence. The middleman receives it, checks the condition, and uploads inspection evidence for transparency.' },
        { t: 'Buyer confirms and the system releases funds', d: 'Once the buyer confirms the item is correct, the system transfers money to the seller. Afterward, every party can leave a review.' },
      ];
  return (
    <PageShell
      kicker={{ th: 'วิธีใช้งาน', en: 'How It Works' }}
      title={{ th: 'ซื้อขายผ่านคนกลางใน 6 ขั้นตอน', en: 'Escrow Trading In 6 Steps' }}
      lead={{ th: 'ทุกขั้นตอนถูกออกแบบให้เงินและสินค้าปลอดภัยทั้งสองฝ่าย โดยมีหลักฐานบันทึกไว้ในระบบตลอดดีล', en: 'Each step is designed to protect both money and goods, with evidence recorded throughout the entire deal.' }}
    >
      <div className="prose-card">
        {STEPS.map((s, i) => (
          <div key={s.t} className="how-step">
            <span className="how-no">{i + 1}</span>
            <div><b>{s.t}</b><p>{s.d}</p></div>
          </div>
        ))}
      </div>
      <div className="prose-card">
        <h2>{locale === 'th' ? 'เกิดปัญหาระหว่างดีลทำอย่างไร?' : 'What if something goes wrong during the deal?'}</h2>
        <p>
          {locale === 'th' ? <>กดปุ่ม &ldquo;แจ้งปัญหา&rdquo; ในห้องดีลได้ทุกขั้นตอน ระบบจะหยุดการปล่อยเงินไว้ก่อน และทีมงานจะเข้าตรวจสอบหลักฐานทั้งหมด เช่น สลิป วิดีโอแพ็ค วิดีโอตรวจสินค้า และแชท เพื่อช่วยไกล่เกลี่ย อ่านเพิ่มเติมได้ที่ <Link href="/faq">คำถามที่พบบ่อย</Link> หรือ <Link href="/contact">ติดต่อทีมงาน</Link></> : <>You can use the &ldquo;Report issue&rdquo; button at any stage inside the deal room. The system will pause fund release first, and the team will review all evidence such as payment slips, packing videos, inspection videos, and chat records to help resolve the case. Read more in the <Link href="/faq">FAQ</Link> or <Link href="/contact">contact support</Link>.</>}
        </p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 24 }}>
        <Link className="btn btn-primary btn-lg" href="/service/trade">{locale === 'th' ? 'เริ่มสร้างดีลแรก' : 'Start your first deal'} <Icon name="arrowRight" size={18} /></Link>
        <Link className="btn btn-ghost btn-lg" href="/marketplace"><Icon name="store" size={18} /> {locale === 'th' ? 'ดูตลาด' : 'Browse marketplace'}</Link>
      </div>
    </PageShell>
  );
}
