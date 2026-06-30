'use client';
import { useEffect, useState } from 'react';
import { supabase, authHeaders } from './supabase';

export type UserRole = 'seller' | 'middleman' | 'user' | 'admin';

// Same external shape as the old Appwrite-backed hook (prefs.* camelCase),
// so the ~30 components that read `user.prefs.firstName` etc. don't need to
// change at all — only this hook's internals moved from Appwrite to Supabase.
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
    bankQrFileId?: string;
    sellerStatus?: string;
    middlemanStatus?: string;
    middlemanTier?: string;
    middlemanTierIntent?: string;
    linkedTo?: string;
    reviewScore?: string;
    reviewCount?: string;
  };
}

interface ProfileRow {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  phone: string | null;
  address: string | null;
  role: string | null;
  bank_name: string | null;
  bank_acct: string | null;
  bank_owner: string | null;
  bank_qr_file_id: string | null;
  seller_status: string | null;
  middleman_status: string | null;
  middleman_tier: string | null;
  middleman_tier_intent: string | null;
  linked_to: string | null;
  review_score: number | null;
  review_count: number | null;
}

function toAppUser(p: ProfileRow): AppUser {
  return {
    $id: p.id,
    name: p.display_name || '',
    email: p.email || '',
    prefs: {
      firstName: p.first_name || undefined,
      lastName: p.last_name || undefined,
      role: (p.role as UserRole) || undefined,
      displayName: p.display_name || undefined,
      phone: p.phone || undefined,
      address: p.address || undefined,
      bankName: p.bank_name || undefined,
      bankAcct: p.bank_acct || undefined,
      bankOwner: p.bank_owner || undefined,
      bankQrFileId: p.bank_qr_file_id || undefined,
      sellerStatus: p.seller_status || undefined,
      middlemanStatus: p.middleman_status || undefined,
      middlemanTier: p.middleman_tier || undefined,
      middlemanTierIntent: p.middleman_tier_intent || undefined,
      linkedTo: p.linked_to || undefined,
      reviewScore: p.review_score != null ? p.review_score.toFixed(2) : undefined,
      reviewCount: p.review_count != null ? String(p.review_count) : undefined,
    },
  };
}

async function fetchProfile(): Promise<AppUser | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const authUser = session?.user ?? null;
  if (!authUser) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, display_name, phone, address, role, bank_name, bank_acct, bank_owner, bank_qr_file_id, seller_status, middleman_status, middleman_tier, middleman_tier_intent, linked_to, review_score, review_count')
    .eq('id', authUser.id)
    .single();
  if (!profile) return null;
  return toAppUser(profile as ProfileRow);
}

export function useUser() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const u = await fetchProfile();
        if (!active) return;
        setUser(u);

        // Sync โปรไฟล์ข้ามช่องทาง login (อีเมลเดียวกัน = สมาชิกเดียวกัน) — ครั้งเดียวต่อ session
        if (u && !sessionStorage.getItem('kk.psync')) {
          sessionStorage.setItem('kk.psync', '1');
          try {
            const headers = await authHeaders();
            const r = await fetch('/api/profile/sync', { method: 'POST', headers });
            const d = await r.json().catch(() => ({} as { updated?: boolean }));
            if (d?.updated && active) {
              const fresh = await fetchProfile();
              if (active) setUser(fresh);
            }
          } catch { /* sync ล้มเหลวไม่กระทบการใช้งาน */ }
        }
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      window.location.href = '/';
    }
  };

  return { user, loading, setUser, logout };
}
