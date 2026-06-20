import { NextRequest, NextResponse } from 'next/server';
import { Databases } from 'node-appwrite';
import { verifyAdmin, getAdminClient } from '../../admin/_lib';
import { readJsonConfig, writeJsonConfig } from '../../_lib/appConfig';
import { SERVICE_CONTROL_DEFAULTS, sanitizeServiceControls } from '@/lib/serviceControls';

const DOC = 'service_controls';

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = new Databases(getAdminClient());
    const services = sanitizeServiceControls(await readJsonConfig(db, DOC, SERVICE_CONTROL_DEFAULTS));
    return NextResponse.json({ services });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message ?? 'error' }, { status: e.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = new Databases(getAdminClient());
    const body = await req.json();
    const nextServices = sanitizeServiceControls(body?.services);
    await writeJsonConfig(db, DOC, nextServices);
    return NextResponse.json({ services: nextServices, ok: true });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message ?? 'error' }, { status: e.status ?? 500 });
  }
}
