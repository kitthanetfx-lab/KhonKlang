import { NextResponse } from 'next/server';
import { getAdminClient } from '../admin/_lib';
import { readServiceControlsConfig } from '../_lib/appConfig';
import { SERVICE_CONTROL_DEFAULTS, getSiteMaintenanceInfo } from '@/lib/serviceControls';

export async function GET() {
  try {
    const db = getAdminClient();
    const services = await readServiceControlsConfig(db);
    return NextResponse.json({ services, maintenance: getSiteMaintenanceInfo(services) });
  } catch {
    return NextResponse.json({
      services: SERVICE_CONTROL_DEFAULTS,
      maintenance: getSiteMaintenanceInfo(SERVICE_CONTROL_DEFAULTS),
    });
  }
}
