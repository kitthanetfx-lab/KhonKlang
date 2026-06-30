import Link from 'next/link';

export function ServiceDisabledNotice({
  title,
  message,
  backHref = '/',
  backLabel = 'กลับหน้าหลัก',
}: {
  title: string;
  message: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div style={{ maxWidth: 760, margin: '48px auto', padding: '0 20px' }}>
      <div style={{
        background: 'linear-gradient(180deg, #fff, #f7f9fd)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-xl)',
        padding: '28px 24px',
        boxShadow: 'var(--sh-sm)',
      }}>
        <div className="badge badge-amber" style={{ marginBottom: 14 }}>ปิดชั่วคราว</div>
        <h1 style={{ marginBottom: 10 }}>{title}</h1>
        <p style={{ color: 'var(--ink-2)', marginBottom: 18 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href={backHref} className="btn btn-primary">{backLabel}</Link>
          <Link href="/" className="btn btn-ghost">ไปหน้าหลัก</Link>
        </div>
      </div>
    </div>
  );
}
