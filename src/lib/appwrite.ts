import { Client, Account, Storage } from 'appwrite';

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
const SESSION_STORAGE_KEY = 'khonklang.appwrite.session';

export const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId);

export const account  = new Account(client);
export const storage  = new Storage(client);

export const KYC_BUCKET = 'kyc_docs';

function clearCookie(name: string) {
  document.cookie = `${name}=; max-age=0; path=/`;
}

export function hydratePersistedSession() {
  if (typeof window === 'undefined') return '';
  const secret = window.localStorage.getItem(SESSION_STORAGE_KEY) || '';
  if (secret) client.setSession(secret);
  return secret;
}

export function persistSession(secret: string) {
  if (!secret) return;
  client.setSession(secret);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(SESSION_STORAGE_KEY, secret);
  }
}

export function clearPersistedSession() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    clearCookie('line_session_pending');
    if (projectId) {
      clearCookie(`a_session_${projectId}`);
      clearCookie(`a_session_${projectId}_legacy`);
    }
  }
  client.setSession('');
}

if (typeof window !== 'undefined') {
  hydratePersistedSession();
}

/** URL สำหรับดูไฟล์จาก Appwrite Storage */
export function fileViewUrl(fileId: string) {
  return `${endpoint}/storage/buckets/${KYC_BUCKET}/files/${fileId}/view?project=${projectId}`;
}

/** URL สำหรับดาวน์โหลดไฟล์ */
export function fileDownloadUrl(fileId: string) {
  return `${endpoint}/storage/buckets/${KYC_BUCKET}/files/${fileId}/download?project=${projectId}`;
}
