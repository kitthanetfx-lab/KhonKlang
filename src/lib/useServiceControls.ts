'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  SERVICE_CONTROL_DEFAULTS,
  ServiceControlKey,
  ServiceControlMap,
  getServiceControlMessage,
  isServiceEnabled,
  sanitizeServiceControls,
} from '@/lib/serviceControls';

export function useServiceControls() {
  const [services, setServices] = useState<ServiceControlMap>(SERVICE_CONTROL_DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/service-controls', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (!cancelled) setServices(sanitizeServiceControls(d?.services));
      })
      .catch(() => {
        if (!cancelled) setServices(SERVICE_CONTROL_DEFAULTS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const api = useMemo(() => ({
    services,
    loading,
    isEnabled: (key: ServiceControlKey) => isServiceEnabled(services, key),
    message: (key: ServiceControlKey, fallback?: string) => getServiceControlMessage(services[key], fallback),
  }), [loading, services]);

  return api;
}
