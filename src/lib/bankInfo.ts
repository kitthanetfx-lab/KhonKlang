import { Client, Users } from 'node-appwrite';

export interface BankInfo {
  bankName: string;
  bankAcct: string;
  bankOwner: string;
  bankQrFileId?: string;
}

function getClient() {
  return new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
}

// ดึงเลขบัญชี/ธนาคาร/คิวอาร์โค๊ดของผู้ใช้จาก prefs (ที่ผู้ใช้กรอกไว้ในหน้าโปรไฟล์)
// ใช้แสดงในดีล/หน้าการเงิน เพื่อสรุปว่าต้องโอนเงินเข้า-คืนบัญชีไหน โดยไม่ต้องไปเปิดหาเอง
export async function getBankInfo(uid?: string): Promise<BankInfo | null> {
  if (!uid) return null;
  try {
    const u = await new Users(getClient()).get(uid);
    const p = (u.prefs || {}) as Record<string, string>;
    const bankName = p.bankName || '';
    const bankAcct = p.bankAcct || p.accountNumber || '';
    const bankOwner = p.bankOwner || p.bankAccountName || u.name || '';
    const bankQrFileId = p.bankQrFileId || '';
    if (!bankName && !bankAcct && !bankQrFileId) return null;
    return { bankName, bankAcct, bankOwner, bankQrFileId: bankQrFileId || undefined };
  } catch { return null; }
}

// ดึงข้อมูลบัญชีของผู้ใช้หลายคนพร้อมกัน คืนเป็น map uid -> BankInfo|null
export async function getBankInfoMap(uids: (string | undefined)[]): Promise<Record<string, BankInfo | null>> {
  const unique = Array.from(new Set(uids.filter((u): u is string => !!u)));
  const results = await Promise.all(unique.map(uid => getBankInfo(uid)));
  const map: Record<string, BankInfo | null> = {};
  unique.forEach((uid, i) => { map[uid] = results[i]; });
  return map;
}
