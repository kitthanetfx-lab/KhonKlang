import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '../../admin/_lib';
import { readServiceControlsConfig, writeServiceControlsConfig } from '../../_lib/appConfig';
import { sanitizeServiceControls } from '@/lib/serviceControls';

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const services = await readServiceControlsConfig(db);
    return NextResponse.json({ services });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message ?? 'error' }, { status: e.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const body = await req.json();
    const nextServices = sanitizeServiceControls(body?.services);
    await writeServiceControlsConfig(db, nextServices);
    return NextResponse.json({ services: nextServices, ok: true });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message ?? 'error' }, { status: e.status ?? 500 });
  }
}
