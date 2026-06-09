'use client';
import Link from 'next/link';

export default function RegisterSelectPage() {
  return (
    <div className="rsel-page">
      <div className="rsel-inner">
        <div className="rsel-header">
          <img src="/logo.png" alt="คนกลาง" className="rsel-logo" />
          <h1 className="rsel-title">เลือกประเภทการสมัคร</h1>
          <p className="rsel-sub">คุณต้องการเข้าร่วมแพลตฟอร์ม Khonklang ในฐานะอะไร?</p>
        </div>

        <Link href="/register/seller" className="rsel-card">
          <div className="rsel-card-head">
            <div className="rsel-card-icon" style={{ background: '#eef4ff' }}>🛒</div>
            <div>
              <div className="rsel-card-title">สมัครเป็นผู้ขาย</div>
              <div className="rsel-card-sub">ลงขายสินค้าในตลาด Khonklang และรับการคุ้มครองจากระบบ Escrow</div>
            </div>
          </div>
          <div className="rsel-card-feats">
            <div className="rsel-card-feat">✅ ลงประกาศสินค้าได้ไม่จำกัด</div>
            <div className="rsel-card-feat">✅ เพิ่มความน่าเชื่อถือ</div>
            <div className="rsel-card-feat">✅ รองรับ Certified</div>
            <div className="rsel-card-feat">✅ Dashboard จัดการดีล</div>
          </div>
          <div className="rsel-card-cta">
            <span className="rsel-card-fee">ค่าสมาชิก ฿199/ปี</span>
            <span className="rsel-card-cta-t">สมัครเลย →</span>
          </div>
        </Link>

        <Link href="/register/middleman" className="rsel-card">
          <div className="rsel-card-head">
            <div className="rsel-card-icon" style={{ background: '#e9faf2' }}>🤝</div>
            <div>
              <div className="rsel-card-title">สมัครเป็นคนกลาง</div>
              <div className="rsel-card-sub">รับค่าบริการจากการดูแลธุรกรรม สร้างรายได้จากความน่าเชื่อถือ</div>
            </div>
          </div>
          <div className="rsel-card-feats">
            <div className="rsel-card-feat">✅ สร้างรายได้เสริม</div>
            <div className="rsel-card-feat">✅ 4 ระดับ Bronze–Platinum</div>
            <div className="rsel-card-feat">✅ รับงานได้ทุกที่</div>
            <div className="rsel-card-feat">✅ คืนเงินประกันได้</div>
          </div>
          <div className="rsel-card-cta">
            <span className="rsel-card-fee">เงินประกัน ฿1,000–50,000</span>
            <span className="rsel-card-cta-t" style={{ color: 'var(--green-600)' }}>สมัครเลย →</span>
          </div>
        </Link>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--muted)' }}>
          มีบัญชีแล้ว? <Link href="/login" style={{ color: 'var(--accent)' }}>เข้าสู่ระบบ</Link>
          &nbsp;·&nbsp;
          <Link href="/" style={{ color: 'var(--accent)' }}>กลับหน้าหลัก</Link>
        </div>
      </div>
    </div>
  );
}
