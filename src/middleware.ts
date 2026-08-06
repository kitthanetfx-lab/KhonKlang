import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BYPASS_PREFIXES = ['/admin', '/api', '/maintenance', '/_next', '/favicon', '/robots', '/sitemap'];

function shouldBypass(pathname: string): boolean {
  return BYPASS_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (shouldBypass(pathname)) return NextResponse.next();

  try {
    const origin = request.nextUrl.origin;
    const res = await fetch(`${origin}/api/service-controls`, { cache: 'no-store' });
    if (!res.ok) return NextResponse.next();
    const data = await res.json();
    if (!data?.maintenance?.active) return NextResponse.next();
  } catch {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = '/maintenance';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
