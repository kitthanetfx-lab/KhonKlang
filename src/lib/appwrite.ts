import { Client, Account, Storage } from 'appwrite';

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';

export const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId);

export const account  = new Account(client);
export const storage  = new Storage(client);

export const KYC_BUCKET = 'kyc_docs';

/** URL สำหรับดูไฟล์จาก Appwrite Storage */
export function fileViewUrl(fileId: string) {
  return `${endpoint}/storage/buckets/${KYC_BUCKET}/files/${fileId}/view?project=${projectId}`;
}

/** URL สำหรับดาวน์โหลดไฟล์ */
export function fileDownloadUrl(fileId: string) {
  return `${endpoint}/storage/buckets/${KYC_BUCKET}/files/${fileId}/download?project=${projectId}`;
}
