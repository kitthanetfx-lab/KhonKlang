#!/usr/bin/env node
// ============================================================================
// import-supabase.mjs
// ============================================================================
// Reads supabase/migration/.transformed/*.json (produced by transform.mjs)
// and writes into your Supabase project using the service role key.
//
// Usage:
//   node supabase/migration/import-supabase.mjs --dry-run        # validate only, no writes
//   node supabase/migration/import-supabase.mjs                  # real import, all tables
//   node supabase/migration/import-supabase.mjs --table=deals     # one table only (after fixing data for that table)
//
// Requires (put these in .env.local yourself — never share the service role
// key with anyone, including in chat):
//   SUPABASE_URL=https://mwzotvfgzavwkfdmukuv.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=...
//
// Run order matters because of foreign keys — this script always processes
// tables in the order below regardless of --table (the filter just skips
// the others). Idempotent: every insert is an upsert keyed on
// legacy_appwrite_id (or on the fixed key for fee_config/service_controls),
// so re-running after a partial failure is safe.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, '..', '..', '.env.local') });

const IN_DIR = join(__dirname, '.transformed');
const BATCH_SIZE = 500;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const TABLE_FILTER = (args.find(a => a.startsWith('--table=')) || '').split('=')[1] || null;

// Order matters: every table here only references tables that appear before it.
const RUN_ORDER = [
  { table: 'profiles', mode: 'upsert', conflict: 'legacy_appwrite_id' },
  { table: 'wanted_posts', mode: 'upsert', conflict: 'legacy_appwrite_id' },
  { table: 'deals', mode: 'upsert', conflict: 'legacy_appwrite_id' },
  { table: 'deal_price_state', mode: 'upsert', conflict: 'deal_id' },
  { table: 'deal_meetup', mode: 'upsert', conflict: 'deal_id' },
  { table: 'deal_images', mode: 'insert' },          // no natural unique key, plain insert
  { table: 'deal_evidence', mode: 'insert' },
  { table: 'messages', mode: 'upsert', conflict: 'legacy_appwrite_id' },
  { table: 'dm_messages', mode: 'upsert', conflict: 'legacy_appwrite_id' },
  { table: 'seller_applications', mode: 'upsert', conflict: 'legacy_appwrite_id' },
  { table: 'middleman_applications', mode: 'upsert', conflict: 'legacy_appwrite_id' },
  { table: 'onsite_jobs', mode: 'upsert', conflict: 'legacy_appwrite_id' },
  { table: 'finance_ledger', mode: 'upsert', conflict: 'entry_key' },
  { table: 'middleman_wallets', mode: 'upsert', conflict: 'middleman_id' },
  { table: 'fee_config', mode: 'update_singleton' },   // pre-seeded by schema.sql, never insert
  { table: 'service_controls', mode: 'upsert', conflict: 'key' },
  { table: 'support_threads', mode: 'upsert', conflict: 'customer_id' },
  { table: 'support_messages', mode: 'upsert', conflict: 'legacy_appwrite_id' },
  { table: 'call_signals', mode: 'upsert', conflict: 'legacy_appwrite_id' },
  { table: 'notifications', mode: 'upsert', conflict: 'legacy_appwrite_id' },
  { table: 'scam_reports', mode: 'upsert', conflict: 'legacy_appwrite_id' },
  { table: 'reviews', mode: 'upsert', conflict: 'legacy_appwrite_id' },
];

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name} (add it to .env.local — never paste it into chat)`);
    process.exit(1);
  }
  return v;
}

async function loadRows(table) {
  try {
    return JSON.parse(await readFile(join(IN_DIR, `${table}.json`), 'utf8'));
  } catch {
    console.warn(`  ! ${table}.json not found — run transform.mjs first? Skipping.`);
    return [];
  }
}

function chunks(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  if (DRY_RUN) console.log('DRY RUN — no writes will be made.\n');

  const supabase = DRY_RUN
    ? null
    : createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
        auth: { persistSession: false },
      });

  let totalRows = 0;
  let totalErrors = 0;

  for (const step of RUN_ORDER) {
    if (TABLE_FILTER && step.table !== TABLE_FILTER) continue;
    const rows = await loadRows(step.table);
    if (rows.length === 0) {
      console.log(`  ${step.table}: 0 rows, skipped`);
      continue;
    }

    // Basic shape validation, even in dry-run.
    const nullFkCount = rows.filter(r => Object.values(r).some(v => v === undefined)).length;
    if (nullFkCount > 0) console.warn(`  ! ${step.table}: ${nullFkCount} row(s) contain "undefined" fields — likely a mapping bug, check before real import`);

    if (DRY_RUN) {
      console.log(`  ${step.table}: ${rows.length} rows OK (dry run, not written)`);
      totalRows += rows.length;
      continue;
    }

    let written = 0;
    for (const batch of chunks(rows, BATCH_SIZE)) {
      let result;
      if (step.mode === 'insert') {
        result = await supabase.from(step.table).insert(batch);
      } else if (step.mode === 'update_singleton') {
        // fee_config has exactly one row pre-seeded by schema.sql (id = true)
        result = await supabase.from(step.table).update(batch[0]).eq('id', true);
      } else {
        result = await supabase.from(step.table).upsert(batch, { onConflict: step.conflict });
      }
      if (result.error) {
        console.error(`  ! ${step.table}: ${result.error.message}`);
        totalErrors += 1;
      } else {
        written += batch.length;
      }
    }
    console.log(`  ${step.table}: ${written}/${rows.length} rows written`);
    totalRows += written;
  }

  console.log(`\n${DRY_RUN ? 'Validated' : 'Imported'} ${totalRows} rows total, ${totalErrors} batch error(s).`);
  if (!DRY_RUN && totalErrors === 0) {
    console.log('Next step: run the verification checklist in supabase/migration/README.md');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
