'use client';
import { useEffect, useState } from 'react';
import { account, clearPersistedSession, hydratePersistedSession } from './appwrite';

export type UserRole = 'seller' | 'middleman' | 'user';

export interface AppUser {
  $id: string;
  name: string;
  email: string;
  prefs: {
    firstName?: string;
    lastName?: string;
    role?: UserRole;
    displayName?: string;
    phone?: string;
    address?: string;
    bankAccountName?: string;
    bankName?: string;
    accountNumber?: string;
    bankAcct?: string;
    bankOwner?: string;
    sellerStatus?: string;
    middlemanStatus?: string;
    linkedTo?: string;
  };
}

export function useUser() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hydratePersistedSession();
    account.get()
      .then(async (u) => {
        setUser(u as AppUser);
        // Sync โปรไฟล์ข้ามช่องทาง login (อีเมลเดียวกัน = สมาชิกเดียวกัน) — ครั้งเดียวต่อ session
        try {
          if (!sessionStorage.getItem('kk.psync')) {
            sessionStorage.setItem('kk.psync', '1');
            const jwt = (await account.createJWT()).jwt;
            const r = await fetch('/api/profile/sync', { method: 'POST', headers: { 'x-session-jwt': jwt } });
            const d = await r.json().catch(() => ({} as { updated?: boolean }));
            if (d?.updated) {
              const fresh = await account.get();
              setUser(fresh as AppUser);
            }
          }
        } catch { /* sync ล้มเหลวไม่กระทบการใช้งาน */ }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    try {
      await account.deleteSession('current');
    } catch {
      // Clear local auth state even if the remote session is already gone.
    } finally {
      clearPersistedSession();
      setUser(null);
      window.location.href = '/';
    }
  };

  return { user, loading, setUser, logout };
}
