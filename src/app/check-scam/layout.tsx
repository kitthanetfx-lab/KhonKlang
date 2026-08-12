import { Suspense } from 'react';

export default function CheckScamLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
