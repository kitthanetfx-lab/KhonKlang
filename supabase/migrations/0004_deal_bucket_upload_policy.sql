-- ============================================================================
-- 0004_deal_bucket_upload_policy.sql
-- ============================================================================
-- The deal room's video-evidence upload bypasses the Next.js API routes and
-- uploads directly from the browser to Supabase Storage (the old Appwrite
-- code did the same direct-to-storage upload, to dodge Vercel's ~4.5MB
-- serverless function body-size limit on large video files). Direct browser
-- uploads go through the anon-key client, which is subject to storage RLS —
-- 0003_public_buckets.sql only made the buckets public for *reads*
-- (getPublicUrl), it did not add an INSERT policy, so without this, logged-in
-- users get an RLS error when uploading evidence videos.
--
-- Matches the same access model already established in 0003: "unguessable
-- file id" is the real access control in this app, not per-user storage
-- ownership checks. So this allows any authenticated user to upload into
-- deal-files (images/slips/evidence already go through the server's
-- service-role key via /api/upload-deal and are unaffected either way).
-- ============================================================================

create policy "authenticated users can upload deal files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'deal-files');
