'use client';

import Link from 'next/link';
import { PageShell } from '@/components/PageShell';
import { useAppPreferences } from '@/components/AppPreferences';

export default function Privacy() {
  const { locale } = useAppPreferences();
  return (
    <PageShell
      kicker={{ th: 'ข้อกฎหมาย', en: 'Legal' }}
      title={{ th: 'นโยบายความเป็นส่วนตัว', en: 'Privacy Policy' }}
      lead={{ th: 'อัปเดตล่าสุด: มิถุนายน 2568 — เราเก็บ ใช้ และดูแลข้อมูลส่วนบุคคลเท่าที่จำเป็นต่อการให้บริการอย่างปลอดภัย', en: 'Last updated: June 2025. We collect, use, and protect personal data only as necessary to operate the service safely.' }}
    >
      <div className="max-w-2xl mx-auto">
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">{locale === 'th' ? '1. ข้อมูลที่เราเก็บรวบรวม' : '1. Information We Collect'}</h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {locale === 'th'
              ? 'เราเก็บข้อมูลที่คุณให้ไว้โดยตรง เช่น ชื่อ อีเมล ข้อมูลบัญชีธนาคาร และข้อมูลที่ได้รับจากการเข้าสู่ระบบผ่าน LINE หรือ Google เช่น ชื่อผู้ใช้และรูปโปรไฟล์'
              : 'We collect information you provide directly, such as your name, email, and bank account details, as well as information received from LINE or Google sign-in, such as your display name and profile image.'}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">{locale === 'th' ? '2. วัตถุประสงค์การใช้ข้อมูล' : '2. Purpose Of Data Use'}</h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {locale === 'th'
              ? 'ข้อมูลของคุณถูกใช้เพื่อยืนยันตัวตน ดำเนินการลงทะเบียนผู้ขาย และอำนวยความสะดวกในการทำธุรกรรมซื้อขายผ่านแพลตฟอร์ม KhonGlang เท่านั้น'
              : 'Your information is used to verify identity, process seller registration, and support trading transactions through the KhonGlang platform only.'}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">{locale === 'th' ? '3. การเปิดเผยข้อมูล' : '3. Data Disclosure'}</h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {locale === 'th'
              ? 'เราไม่ขาย แลกเปลี่ยน หรือเปิดเผยข้อมูลส่วนตัวของคุณแก่บุคคลภายนอก ยกเว้นกรณีที่จำเป็นตามกฎหมายหรือได้รับความยินยอมจากคุณ'
              : 'We do not sell, trade, or disclose your personal data to outside parties except where required by law or with your consent.'}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">{locale === 'th' ? '4. ระยะเวลาเก็บข้อมูล' : '4. Data Retention'}</h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {locale === 'th'
              ? 'เราเก็บข้อมูลยืนยันตัวตน เช่น บัตรประชาชนและสมุดบัญชี เท่าที่จำเป็นต่อการให้บริการและตามที่กฎหมายกำหนด เมื่อบัญชีถูกปิดหรือพ้นระยะเวลาที่จำเป็น ข้อมูลอ่อนไหวจะถูกลบหรือทำให้ไม่สามารถระบุตัวบุคคลได้ และหลักฐานการทำธุรกรรมอาจถูกเก็บตามอายุความทางกฎหมายเพื่อใช้ระงับข้อพิพาท'
              : 'We retain identity verification data such as ID cards and bank book details only as needed for service operations and legal compliance. When an account is closed or retention is no longer required, sensitive data is deleted or anonymized. Transaction evidence may be stored for legally permitted periods to resolve disputes.'}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">{locale === 'th' ? '5. สิทธิของเจ้าของข้อมูล (PDPA)' : '5. Data Subject Rights (PDPA)'}</h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {locale === 'th' ? <>คุณมีสิทธิ์เข้าถึง แก้ไข ขอสำเนา คัดค้านการประมวลผล และ <strong>ขอลบ</strong> ข้อมูลส่วนบุคคลของคุณได้ทุกเมื่อ โดยกดปุ่ม &ldquo;ขอลบข้อมูลส่วนบุคคล&rdquo; ในหน้าโปรไฟล์ หรือติดต่อ <a href="mailto:runandyaow002@gmail.com" className="text-blue-500 underline">runandyaow002@gmail.com</a> เราจะดำเนินการภายใน 30 วัน</> : <>You may access, correct, request a copy of, object to processing, or <strong>request deletion</strong> of your personal data at any time. Use the personal data deletion button in your profile or contact <a href="mailto:runandyaow002@gmail.com" className="text-blue-500 underline">runandyaow002@gmail.com</a>. We will process the request within 30 days.</>}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">{locale === 'th' ? '6. ติดต่อเรา' : '6. Contact Us'}</h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {locale === 'th' ? 'หากมีคำถามเกี่ยวกับนโยบายนี้ กรุณาติดต่อ ' : 'If you have any questions about this policy, please contact '}
            <a href="mailto:runandyaow002@gmail.com" className="text-blue-500 underline">
              runandyaow002@gmail.com
            </a>
            {locale === 'th' ? null : <> or review the <Link href="/terms" className="text-blue-500 underline">terms of service</Link> for related platform obligations.</>}
          </p>
        </section>
      </div>
    </PageShell>
  );
}
