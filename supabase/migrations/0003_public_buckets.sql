-- ============================================================================
-- 0003_public_buckets.sql
-- ============================================================================
-- schema.sql (0001) created deal-files/kyc-docs/report-files as private
-- buckets. Decision made during the app-code cutover: make them public,
-- matching the OLD Appwrite behavior — every file URL in the live app today
-- is a plain `${endpoint}/storage/buckets/x/files/y/view?project=z` with no
-- auth header attached (images, slips, QR codes are all rendered via plain
-- <img src>, which can't carry an Authorization header). Access control in
-- the existing app is "unguessable file id", not real per-user permission
-- checks at the storage layer — this just ports that same model to
-- Supabase's public-bucket + getPublicUrl(), instead of inventing a new,
-- stricter model that the old app never actually had.
--
-- If this assumption turns out to be wrong (i.e. Appwrite bucket-level
-- permissions were actually locking files down per-user), revert this and
-- switch src/lib/supabase.ts's fileViewUrl() to signed URLs instead.
-- ============================================================================

update storage.buckets set public = true where id in ('deal-files', 'kyc-docs', 'report-files');
