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
      .then((u) => setUser(u as AppUser))
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
