#!/usr/bin/env node
// ============================================================================
// export-appwrite.mjs
// ============================================================================
// READ-ONLY. Dumps every Appwrite collection + every Users.prefs to local
// JSON files under supabase/migration/.data/. Does not touch Supabase at all
// — safe to run against production as many times as you want.
//
// Usage:
//   node supabase/migration/export-appwrite.mjs
//
// Requires the SAME env vars the app already uses (read from .env.local via
// dotenv, same credentials as `npm run dev`):
//   NEXT_PUBLIC_APPWRITE_ENDPOINT
//   NEXT_PUBLIC_APPWRITE_PROJECT_ID
//   APPWRITE_API_KEY
// ============================================================================

import { Client, Databases, Users, Query } from 'node-appwrite';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, '..', '..', '.env.local') });

const DB_ID = 'khonklang_db';
const OUT_DIR = join(__dirname, '.data');
const PAGE_SIZE = 100;

const COLLECTIONS = [
  'deals',
  'messages',
  'dm_messages',
  'finance_ledger_v2',
  'middleman_wallets_v2',
  'seller_applications',
  'middleman_applications',
  'onsite_jobs',
  'app_config',
  'profiles',
  'support_threads',
  'support_messages',
  'call_signals',
  'notifications',
  'scam_reports',
  'wanted_posts',
  'reviews',
];

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name} (check .env.local)`);
    process.exit(1);
  }
  return v;
}

function client() {
  return new Client()
    .setEndpoint(requireEnv('NEXT_PUBLIC_APPWRITE_ENDPOINT'))
    .setProject(requireEnv('NEXT_PUBLIC_APPWRITE_PROJECT_ID'))
    .setKey(requireEnv('APPWRITE_API_KEY'));
}

async function dumpCollection(db, collectionId) {
  const all = [];
  let offset = 0;
  for (;;) {
    let page;
    try {
      page = await db.listDocuments(DB_ID, collectionId, [
        Query.limit(PAGE_SIZE),
        Query.offset(offset),
      ]);
    } catch (err) {
      console.warn(`  ! ${collectionId}: ${err.message} (collection may not exist — skipping)`);
      return [];
    }
    all.push(...page.documents);
    offset += page.documents.length;
    if (page.documents.length < PAGE_SIZE || offset >= page.total) break;
  }
  return all;
}

async function dumpUsers(usersApi) {
  const all = [];
  let offset = 0;
  for (;;) {
    const page = await usersApi.list([Query.limit(PAGE_SIZE), Query.offset(offset)]);
    all.push(
      ...page.users.map(u => ({
        id: u.$id,
        email: u.email,
        name: u.name,
        phone: u.phone,
        registration: u.registration,
        prefs: u.prefs || {},
      })),
    );
    offset += page.users.length;
    if (page.users.length < PAGE_SIZE || offset >= page.total) break;
  }
  return all;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const c = client();
  const db = new Databases(c);
  const usersApi = new Users(c);

  console.log(`Exporting from ${DB_ID} → ${OUT_DIR}\n`);

  for (const collectionId of COLLECTIONS) {
    process.stdout.write(`  ${collectionId} ... `);
    const docs = await dumpCollection(db, collectionId);
    await writeFile(join(OUT_DIR, `${collectionId}.json`), JSON.stringify(docs, null, 2));
    console.log(`${docs.length} docs`);
  }

  process.stdout.write('  users (auth + prefs) ... ');
  const users = await dumpUsers(usersApi);
  await writeFile(join(OUT_DIR, 'users.json'), JSON.stringify(users, null, 2));
  console.log(`${users.length} users`);

  console.log('\nDone. Next step: node supabase/migration/transform.mjs');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
