// Shared admin auth helper — now backed by Supabase (was Appwrite).
// Re-exports from src/lib/supabaseServer.ts so existing import paths
// (`from '../../admin/_lib'` / `from '../admin/_lib'`) keep working while
// each route file is converted one at a time.
export { getAdminClient, verifyAdmin, verifyUser, HttpError, type CurrentUser } from '@/lib/supabaseServer';
