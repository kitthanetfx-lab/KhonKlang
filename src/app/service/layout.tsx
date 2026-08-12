import { Suspense } from 'react';

export default function ServiceLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
