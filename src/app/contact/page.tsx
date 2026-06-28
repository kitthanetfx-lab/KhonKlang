'use client';
import Link from 'next/link';
import { PageShell } from '@/components/PageShell';
import { Icon } from '@/components/Icon';
import { useAppPreferences } from '@/components/AppPreferences';

export default function Contact() {
  const { locale } = useAppPreferences();
  const cards = locale === 'th'
    ? [
        {
          href: 'mailto:runandyaow002@gmail.com',
          icon: <Icon name="message" />,
          className: 'contact-card',
          title: 'อีเมลทีมงาน',
          body: 'runandyaow002@gmail.com — ตอบกลับภายใน 24 ชั่วโมงทำการ',
        },
        {
          href: '/check-scam',
          icon: <Icon name="search" />,
          className: 'contact-card',
          iconClass: 'amber',
          title: 'รายงาน / เช็คคนโกง',
          body: 'ตรวจสอบชื่อ เลขบัญชี เบอร์โทร จากฐานข้อมูลแบล็กลิสต์',
          isLink: true,
        },
        {
          href: '/status',
          icon: <Icon name="zap" />,
          className: 'contact-card',
          iconClass: 'green',
          title: 'สถานะระบบ',
          body: 'ตรวจสอบว่าระบบทำงานปกติหรือมีการแจ้งปิดปรับปรุง',
          isLink: true,
        },
        {
          href: '/faq',
          icon: <Icon name="info" />,
          className: 'contact-card',
          iconClass: 'violet',
          title: 'คำถามที่พบบ่อย',
          body: 'คำตอบเรื่องความปลอดภัย ค่าบริการ และขั้นตอนการใช้งาน',
          isLink: true,
        },
      ]
    : [
        {
          href: 'mailto:runandyaow002@gmail.com',
          icon: <Icon name="message" />,
          className: 'contact-card',
          title: 'Support Email',
          body: 'runandyaow002@gmail.com — replies within 24 business hours',
        },
        {
          href: '/check-scam',
          icon: <Icon name="search" />,
          className: 'contact-card',
          iconClass: 'amber',
          title: 'Report / Scam Check',
          body: 'Search names, bank accounts, or phone numbers from the blacklist database',
          isLink: true,
        },
        {
          href: '/status',
          icon: <Icon name="zap" />,
          className: 'contact-card',
          iconClass: 'green',
          title: 'System Status',
          body: 'Check whether the platform is running normally or under maintenance',
          isLink: true,
        },
        {
          href: '/faq',
          icon: <Icon name="info" />,
          className: 'contact-card',
          iconClass: 'violet',
          title: 'FAQ',
          body: 'Answers about safety, fees, and the key usage steps',
          isLink: true,
        },
      ];
  return (
    <PageShell
      kicker={{ th: 'ติดต่อทีมงาน', en: 'Contact Support' }}
      title={{ th: 'เราพร้อมช่วยเหลือคุณ', en: 'We Are Ready To Help' }}
      lead={{ th: 'ติดต่อได้ทุกเรื่อง — ปัญหาดีล การสมัครคนกลาง รายงานคนโกง หรือข้อเสนอแนะการใช้งาน', en: 'Reach out about anything: deal issues, middleman applications, scam reports, or product feedback.' }}
    >
      <div className="contact-grid">
        {cards.map(card => {
          const content = (
            <>
              <span className={`icon-tile ${card.iconClass || ''}`.trim()}>{card.icon}</span>
              <div><b>{card.title}</b><p>{card.body}</p></div>
            </>
          );
          return card.isLink ? (
            <Link key={card.href} className={card.className} href={card.href}>
              {content}
            </Link>
          ) : (
            <a key={card.href} className={card.className} href={card.href}>
              {content}
            </a>
          );
        })}
      </div>
      <div className="prose-card" style={{ marginTop: 24 }}>
        <h2>{locale === 'th' ? 'ปัญหาเกี่ยวกับดีลที่กำลังดำเนินอยู่' : 'Issue With An Active Deal?'}</h2>
        <p>
          {locale === 'th'
            ? 'เพื่อให้ทีมงานช่วยได้เร็วที่สุด ให้กดปุ่ม "แจ้งปัญหา" ภายในห้องดีลโดยตรง ระบบจะหยุดการปล่อยเงินไว้ก่อนและแนบหลักฐานทั้งหมดในดีลให้ทีมงานอัตโนมัติ จากนั้นอีเมลแจ้งหมายเลขดีลมาที่ทีมงานเพื่อเร่งติดตามได้ทันที'
            : 'For the fastest support, use the "Report issue" button directly inside the deal room. The system will pause fund release and attach all deal evidence for the team automatically. After that, send the deal number to support by email so we can follow up immediately.'}
        </p>
      </div>
    </PageShell>
  );
}
