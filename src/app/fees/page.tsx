'use client';
import Link from 'next/link';
import { PageShell } from '@/components/PageShell';
import { useAppPreferences } from '@/components/AppPreferences';

export default function Fees() {
  const { locale } = useAppPreferences();
  return (
    <PageShell
      kicker={{ th: 'ค่าธรรมเนียม', en: 'Fees' }}
      title={{ th: 'ค่าบริการโปร่งใส รู้ก่อนเริ่มดีลเสมอ', en: 'Transparent Fees Before Every Deal' }}
      lead={{ th: 'ไม่มีค่าใช้จ่ายแอบแฝง — ค่าบริการทั้งหมดแสดงให้เห็นและต้องยอมรับร่วมกันก่อนโอนเงินทุกครั้ง', en: 'No hidden charges. Every fee is shown clearly and must be accepted by all parties before payment.' }}
    >
      <div className="prose-card">
        <h2>{locale === 'th' ? 'ค่าบริการคนกลาง' : 'Middleman Fees'}</h2>
        <p>
          {locale === 'th'
            ? 'ค่าบริการของคนกลางแต่ละรายขึ้นอยู่กับมูลค่าสินค้า ประเภทงาน และระดับเทียร์ของคนกลาง (Bronze / Silver / Gold / Platinum) โดยจะตกลงกันก่อนเริ่มดีล และแสดงในขั้นตอน "ยอมรับเงื่อนไข" ซึ่งทุกฝ่ายต้องกดยืนยันก่อน ระบบจึงจะให้โอนเงิน'
            : 'Each middleman sets fees based on item value, job type, and their service tier (Bronze / Silver / Gold / Platinum). The agreed fee is shown before the deal starts in the terms step, and all parties must confirm it before payment can proceed.'}
        </p>
        <ul>
          {locale === 'th' ? (
            <>
              <li>เห็นค่าบริการชัดเจนก่อนตัดสินใจ ไม่มีการเรียกเก็บเพิ่มภายหลัง</li>
              <li>เปรียบเทียบคนกลางหลายรายได้จากคะแนนรีวิวและประวัติงานจริง</li>
              <li>คนกลางต้องวางเครดิตค้ำประกันตามมูลค่าสินค้า เพื่อความปลอดภัยของทั้งสองฝ่าย</li>
            </>
          ) : (
            <>
              <li>Fees are shown clearly before you decide, with no hidden charges added later.</li>
              <li>You can compare multiple middlemen by ratings and real work history.</li>
              <li>Middlemen must place guarantee credit based on item value to protect both sides.</li>
            </>
          )}
        </ul>
      </div>
      <div className="prose-card">
        <h2>{locale === 'th' ? 'ค่าบริการนัดออนไซต์' : 'On-site Service Fees'}</h2>
        <p>
          {locale === 'th'
            ? 'งานตรวจสอบสินค้าถึงที่ เช่น รถ เครื่องจักร หรืออสังหาริมทรัพย์ จะคิดค่าบริการตามระยะทางและความซับซ้อนของงาน โดยผู้เชี่ยวชาญจะเสนอราคาให้ยืนยันก่อนรับงานทุกครั้ง'
            : 'For on-site inspections such as vehicles, machinery, or property, service fees depend on travel distance and job complexity. An expert always sends a quote for approval before the job begins.'}
        </p>
      </div>
      <div className="prose-card">
        <h2>{locale === 'th' ? 'การโอนและการคืนเงิน' : 'Payouts And Refunds'}</h2>
        <ul>
          {locale === 'th' ? (
            <>
              <li>เงินค่าสินค้าถูกพักไว้กับระบบตลอดดีล และจะปล่อยให้ผู้ขายเมื่อผู้ซื้อยืนยันรับของแล้วเท่านั้น</li>
              <li>หากดีลถูกยกเลิกก่อนส่งสินค้า เงินจะถูกคืนผู้ซื้อเต็มจำนวน</li>
              <li>กรณีมีข้อพิพาท ทีมงานตรวจสอบหลักฐานก่อนตัดสินการคืนเงินตามจริง</li>
            </>
          ) : (
            <>
              <li>The product payment stays inside the system throughout the deal and is released only after the buyer confirms receipt.</li>
              <li>If the deal is cancelled before shipment, the buyer gets a full refund.</li>
              <li>When disputes happen, the team reviews the evidence first before deciding the actual refund outcome.</li>
            </>
          )}
        </ul>
        <p style={{ marginTop: 10 }}>
          {locale === 'th' ? <>มีคำถามเรื่องอัตราค่าบริการสำหรับดีลของคุณ? <Link href="/contact">ติดต่อทีมงาน</Link> ได้เลย</> : <>Need a fee estimate for your deal? <Link href="/contact">Contact the team</Link> anytime.</>}
        </p>
      </div>
    </PageShell>
  );
}
