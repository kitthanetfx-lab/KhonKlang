// Shared admin auth helper
import { NextRequest } from 'next/server';
import { Client, Account, Users } from 'node-appwrite';

export const DB_ID = 'khonklang_db';

export function getAdminClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return client;
}

export async function verifyAdmin(req: NextRequest): Promise<string> {
  const jwt = req.headers.get('x-session-jwt');
  if (!jwt) throw Object.assign(new Error('Unauthorized'), { status: 401 });

  const sessionClient = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);

  const currentUser = await new Account(sessionClient).get();
  const adminClient = getAdminClient();
  const users = new Users(adminClient);
  const full = await users.get(currentUser.$id);
  const prefs = (full.prefs || {}) as Record<string, string>;

  if (prefs.role !== 'admin') throw Object.assign(new Error('Forbidden'), { status: 403 });
  return currentUser.$id;
}
