'use client';
import Link from 'next/link';
import { PageShell } from '@/components/PageShell';
import { useAppPreferences } from '@/components/AppPreferences';

export default function FAQ() {
  const { locale } = useAppPreferences();
  const FAQS: { q: string; a: React.ReactNode }[] = locale === 'th'
    ? [
        { q: 'คนกลางคือใคร เชื่อถือได้แค่ไหน?', a: <>คนกลางทุกรายต้องผ่านการยืนยันตัวตน (KYC) ด้วยเอกสารจริงก่อนรับงาน มีคะแนนรีวิวจากดีลจริง และต้องวางเครดิตค้ำประกันตามมูลค่าสินค้า หากเกิดความเสียหายจากคนกลาง เครดิตส่วนนี้จะถูกใช้ชดเชย</> },
        { q: 'เงินของฉันปลอดภัยอย่างไร?', a: <>เงินค่าสินค้าถูกพักไว้กับระบบ ไม่ถึงมือผู้ขายจนกว่าคุณจะกดยืนยันว่าได้รับสินค้าตรงปก หากดีลยกเลิกก่อนส่งของ เงินคืนเต็มจำนวน</> },
        { q: 'ถ้าได้ของไม่ตรงปกต้องทำอย่างไร?', a: <>อย่าเพิ่งกดยืนยันรับสินค้า กดปุ่ม &ldquo;แจ้งปัญหา&rdquo; ในห้องดีลทันที ระบบจะหยุดการปล่อยเงิน และทีมงานจะตรวจสอบหลักฐานวิดีโอแพ็คหรือวิดีโอตรวจสินค้าที่บันทึกไว้ทุกขั้นตอน</> },
        { q: 'ค่าบริการคนกลางเท่าไหร่?', a: <>ขึ้นอยู่กับมูลค่าสินค้าและเทียร์ของคนกลาง โดยจะแสดงและต้องยอมรับร่วมกันก่อนโอนเงินเสมอ ดูรายละเอียดที่หน้า <Link href="/fees">ค่าธรรมเนียม</Link></> },
        { q: 'ตรวจสอบคนโกงก่อนโอนได้ไหม?', a: <>ได้ ใช้หน้า <Link href="/check-scam">เช็คคนโกง</Link> ค้นหาชื่อ เลขบัญชี หรือเบอร์โทรจากฐานข้อมูลแบล็กลิสต์ได้ฟรีก่อนทำธุรกรรมทุกครั้ง</> },
        { q: 'อยากเป็นคนกลางต้องทำอย่างไร?', a: <>สมัครที่หน้า <Link href="/register/middleman">สมัครเป็นคนกลาง</Link> เตรียมเอกสารยืนยันตัวตน แล้วรอทีมงานตรวจสอบและอนุมัติก่อนเริ่มรับงานได้จริง</> },
        { q: 'ซื้อขายสินค้าประเภทไหนได้บ้าง?', a: <>ครอบคลุมมือถือ ไอที แบรนด์เนม รถ ไอดีเกม พระเครื่อง ของสะสม ไปจนถึงเหมาสวนและสั่งผลิตโรงงาน ดูทั้งหมดได้ที่ <Link href="/marketplace">ตลาด</Link></> },
        { q: 'นัดเจอซื้อขายต่อหน้าได้ไหม?', a: <>ได้ ใช้บริการ <Link href="/service/meetup">นัดรับผ่านกลาง</Link> เพื่อนัดเจอในจุดปลอดภัย โดยมีคนกลางดูแลการแลกเปลี่ยนเงินและสินค้า</> },
      ]
    : [
        { q: 'Who are the middlemen and can they be trusted?', a: <>Every middleman must complete real-identity KYC before taking jobs. They also carry ratings from real deals and must place guarantee credit based on item value. If damage is caused by the middleman, that credit can be used for compensation.</> },
        { q: 'How is my money protected?', a: <>The product payment stays inside the escrow system and is not released to the seller until you confirm the item is correct. If the deal is cancelled before shipment, the buyer receives a full refund.</> },
        { q: 'What if the item does not match the listing?', a: <>Do not confirm receipt yet. Use the &ldquo;Report issue&rdquo; button inside the deal room immediately. The system will pause fund release while the team reviews packing and inspection evidence recorded in each step.</> },
        { q: 'How much is the middleman fee?', a: <>It depends on item value and the middleman tier. The fee is always shown in advance and must be accepted by all parties before payment. See more on the <Link href="/fees">fees</Link> page.</> },
        { q: 'Can I check for scammers before paying?', a: <>Yes. Use the <Link href="/check-scam">scam check</Link> page to search names, bank accounts, or phone numbers from the blacklist database for free before every transaction.</> },
        { q: 'How do I become a middleman?', a: <>Apply on the <Link href="/register/middleman">middleman registration</Link> page, prepare your identity documents, and wait for team approval before taking real jobs.</> },
        { q: 'What kinds of items can be traded here?', a: <>The platform supports phones, IT gear, luxury goods, car-related deals, game accounts, amulets, collectibles, wholesale lots, farm contracts, and more. Browse everything on the <Link href="/marketplace">marketplace</Link>.</> },
        { q: 'Can I trade face to face?', a: <>Yes. Use <Link href="/service/meetup">meetup escrow</Link> to exchange goods and money at a safer location with a middleman supervising the handover.</> },
      ];
  return (
    <PageShell
      kicker={{ th: 'ช่วยเหลือ', en: 'Help' }}
      title={{ th: 'คำถามที่พบบ่อย', en: 'Frequently Asked Questions' }}
      lead={{ th: 'รวมคำตอบเรื่องความปลอดภัย ค่าบริการ และขั้นตอนการใช้งานที่ถูกถามบ่อยที่สุด', en: 'Common answers about safety, fees, and the most frequently asked usage flows.' }}
    >
      {FAQS.map(f => (
        <details key={f.q} className="faq-item">
          <summary>{f.q}</summary>
          <div className="faq-a">{f.a}</div>
        </details>
      ))}
      <div className="prose-card" style={{ marginTop: 24 }}>
        <h2>{locale === 'th' ? 'ยังไม่พบคำตอบ?' : 'Still need help?'}</h2>
        <p>
          {locale === 'th' ? <>อ่าน<Link href="/how-it-works">วิธีใช้งานแบบละเอียด</Link> หรือ<Link href="/contact">ติดต่อทีมงาน</Link>โดยตรง เรายินดีช่วยเหลือทุกขั้นตอน</> : <>Read the full <Link href="/how-it-works">how it works</Link> guide or <Link href="/contact">contact the team</Link> directly. We are happy to help at every step.</>}
        </p>
      </div>
    </PageShell>
  );
}
