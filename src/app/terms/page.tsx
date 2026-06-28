'use client';
import Link from 'next/link';
import { PageShell } from '@/components/PageShell';
import { useAppPreferences } from '@/components/AppPreferences';

export default function Terms() {
  const { locale } = useAppPreferences();
  return (
    <PageShell
      kicker={{ th: 'ข้อกฎหมาย', en: 'Legal' }}
      title={{ th: 'เงื่อนไขการใช้งาน', en: 'Terms of Service' }}
      lead={{ th: 'อัปเดตล่าสุด: มิถุนายน 2569 — โปรดอ่านก่อนใช้บริการ การใช้งานแพลตฟอร์มถือว่าคุณยอมรับเงื่อนไขทั้งหมดนี้', en: 'Last updated: June 2026. Please read before using the service. By using the platform, you agree to all terms below.' }}
    >
      <div className="prose-card">
        <h2>{locale === 'th' ? '1. การใช้บริการ' : '1. Service Use'}</h2>
        <p>
          {locale === 'th'
            ? 'KhonGlang ("คนกลาง") เป็นแพลตฟอร์มอำนวยความสะดวกการซื้อขายผ่านคนกลางและระบบพักเงิน ผู้ใช้ต้องมีอายุไม่ต่ำกว่า 18 ปี ให้ข้อมูลที่เป็นจริงในการสมัครและยืนยันตัวตน และห้ามใช้แพลตฟอร์มเพื่อซื้อขายสินค้าผิดกฎหมายหรือละเมิดสิทธิของผู้อื่น'
            : 'KhonGlang ("KhonGlang") is a platform that supports middleman-assisted trading and escrow payments. Users must be at least 18 years old, provide truthful registration and identity details, and must not use the platform for illegal products or activities that violate the rights of others.'}
        </p>
      </div>
      <div className="prose-card">
        <h2>{locale === 'th' ? '2. บทบาทและความรับผิดชอบ' : '2. Roles And Responsibilities'}</h2>
        <ul>
          {locale === 'th' ? (
            <>
              <li><b>ผู้ซื้อ</b> — โอนเงินเข้าระบบพักเงินตามยอดที่ตกลง และตรวจรับสินค้าภายในเวลาอันสมควร</li>
              <li><b>ผู้ขาย</b> — ส่งสินค้าตรงตามคำอธิบาย พร้อมบันทึกหลักฐานการแพ็คตามที่ระบบกำหนด</li>
              <li><b>คนกลาง</b> — ตรวจสอบสินค้าอย่างสุจริต วางเครดิตค้ำประกัน และปฏิบัติตามขั้นตอนของระบบทุกข้อ</li>
            </>
          ) : (
            <>
              <li><b>Buyer</b> — Sends payment into escrow according to the agreed amount and inspects the item within a reasonable time.</li>
              <li><b>Seller</b> — Ships an item that matches the description and records packing evidence as required by the system.</li>
              <li><b>Middleman</b> — Inspects items honestly, places guarantee credit, and follows every required system step.</li>
            </>
          )}
        </ul>
      </div>
      <div className="prose-card">
        <h2>{locale === 'th' ? '3. การพักเงินและการปล่อยเงิน' : '3. Escrow Hold And Fund Release'}</h2>
        <p>
          {locale === 'th'
            ? 'เงินค่าสินค้าถูกพักไว้กับระบบจนกว่าผู้ซื้อยืนยันรับสินค้า ระบบจึงโอนเงินให้ผู้ขาย กรณีข้อพิพาท ทีมงานมีสิทธิ์ระงับการปล่อยเงินไว้จนกว่าการตรวจสอบหลักฐานจะเสร็จสิ้น และตัดสินโดยอิงหลักฐานที่บันทึกไว้ในระบบเป็นสำคัญ'
            : 'Product payments remain inside the system until the buyer confirms receipt. Only then will the system release funds to the seller. In dispute cases, the team may hold the funds until the evidence review is completed and decide the outcome based on evidence recorded in the system.'}
        </p>
      </div>
      <div className="prose-card">
        <h2>{locale === 'th' ? '4. ข้อจำกัดความรับผิด' : '4. Limitation Of Liability'}</h2>
        <p>
          {locale === 'th'
            ? 'แพลตฟอร์มทำหน้าที่เป็นตัวกลางอำนวยความสะดวกและเก็บหลักฐาน ไม่ใช่คู่สัญญาซื้อขายโดยตรง ความรับผิดของแพลตฟอร์มจำกัดอยู่ที่มูลค่าเงินที่พักไว้ในดีลนั้น ๆ และการซื้อขายนอกระบบหรือการโอนเงินนอกช่องทางที่ระบบกำหนดอยู่นอกความคุ้มครองทั้งหมด'
            : 'The platform acts as a facilitator and evidence keeper, not as the direct buyer or seller in a transaction. Platform liability is limited to the value of funds held in that specific deal. Off-platform trading or payments made outside approved system channels are fully outside platform protection.'}
        </p>
      </div>
      <div className="prose-card">
        <h2>{locale === 'th' ? '5. การระงับบัญชี' : '5. Account Suspension'}</h2>
        <p>
          {locale === 'th' ? <>เราอาจระงับหรือยกเลิกบัญชีที่มีพฤติกรรมฉ้อโกง ให้ข้อมูลเท็จ หรือละเมิดเงื่อนไขนี้ โดยรายชื่อผู้กระทำผิดอาจถูกบันทึกในฐานข้อมูล <Link href="/check-scam">เช็คคนโกง</Link> เพื่อคุ้มครองผู้ใช้รายอื่น</> : <>We may suspend or terminate accounts involved in fraud, false information, or violations of these terms. Names related to confirmed misconduct may be recorded in the <Link href="/check-scam">scam check</Link> database to protect other users.</>}
        </p>
      </div>
      <div className="prose-card">
        <h2>{locale === 'th' ? '6. ติดต่อ' : '6. Contact'}</h2>
        <p>
          {locale === 'th' ? <>คำถามเกี่ยวกับเงื่อนไขนี้ ติดต่อ <a href="mailto:runandyaow002@gmail.com">runandyaow002@gmail.com</a> และอ่าน <Link href="/privacy">นโยบายความเป็นส่วนตัว</Link> ประกอบ</> : <>For questions about these terms, contact <a href="mailto:runandyaow002@gmail.com">runandyaow002@gmail.com</a> and also review the <Link href="/privacy">privacy policy</Link>.</>}
        </p>
      </div>
    </PageShell>
  );
}
