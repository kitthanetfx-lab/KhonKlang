import { NextResponse } from 'next/server';
import { Databases } from 'node-appwrite';
import { getAdminClient } from '../admin/_lib';
import { readJsonConfig } from '../_lib/appConfig';
import { SERVICE_CONTROL_DEFAULTS, sanitizeServiceControls } from '@/lib/serviceControls';

const DOC = 'service_controls';

export async function GET() {
  try {
    const db = new Databases(getAdminClient());
    const services = sanitizeServiceControls(await readJsonConfig(db, DOC, SERVICE_CONTROL_DEFAULTS));
    return NextResponse.json({ services });
  } catch {
    return NextResponse.json({ services: SERVICE_CONTROL_DEFAULTS });
  }
}
