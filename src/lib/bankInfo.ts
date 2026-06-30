import type { SupabaseClient } from '@supabase/supabase-js';

export interface BankInfo {
  bankName: string;
  bankAcct: string;
  bankOwner: string;
  bankQrFileId?: string;
}

// ดึงเลขบัญชี/ธนาคาร/คิวอาร์โค๊ดของผู้ใช้จากโปรไฟล์ — ใช้แสดงในดีล/หน้าการเงิน
// เพื่อสรุปว่าต้องโอนเงินเข้า-คืนบัญชีไหน โดยไม่ต้องไปเปิดหาเอง
export async function getBankInfo(db: SupabaseClient, uid?: string): Promise<BankInfo | null> {
  if (!uid) return null;
  const { data: u } = await db.from('profiles').select('bank_name, bank_acct, bank_owner, bank_qr_file_id, display_name').eq('id', uid).maybeSingle();
  if (!u) return null;
  const bankName = u.bank_name || '';
  const bankAcct = u.bank_acct || '';
  const bankOwner = u.bank_owner || u.display_name || '';
  const bankQrFileId = u.bank_qr_file_id || '';
  if (!bankName && !bankAcct && !bankQrFileId) return null;
  return { bankName, bankAcct, bankOwner, bankQrFileId: bankQrFileId || undefined };
}

// ดึงข้อมูลบัญชีของผู้ใช้หลายคนพร้อมกัน คืนเป็น map uid -> BankInfo|null
export async function getBankInfoMap(db: SupabaseClient, uids: (string | undefined)[]): Promise<Record<string, BankInfo | null>> {
  const unique = Array.from(new Set(uids.filter((u): u is string => !!u)));
  if (!unique.length) return {};
  const { data } = await db.from('profiles').select('id, bank_name, bank_acct, bank_owner, bank_qr_file_id, display_name').in('id', unique);
  const map: Record<string, BankInfo | null> = {};
  for (const uid of unique) map[uid] = null;
  for (const u of data || []) {
    const bankName = u.bank_name || '';
    const bankAcct = u.bank_acct || '';
    const bankOwner = u.bank_owner || u.display_name || '';
    const bankQrFileId = u.bank_qr_file_id || '';
    map[u.id] = (!bankName && !bankAcct && !bankQrFileId) ? null : { bankName, bankAcct, bankOwner, bankQrFileId: bankQrFileId || undefined };
  }
  return map;
}
