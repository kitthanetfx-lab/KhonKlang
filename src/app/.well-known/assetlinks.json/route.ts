// GET /.well-known/assetlinks.json — Android App Links verification
// ตั้ง env บน Vercel: ANDROID_APP_LINK_SHA256 = fingerprint จาก debug/release keystore (คั่นด้วย comma ถ้ามีหลายตัว)
// ดูวิธีหา fingerprint: glangApp/docs/07-app-links.md
import { NextResponse } from 'next/server';

export async function GET() {
  const fingerprints = (process.env.ANDROID_APP_LINK_SHA256 || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const body = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.glanghub.app',
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  return NextResponse.json(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
