alter table public.deals
  add column if not exists tracking_to_middleman_provider text,
  add column if not exists tracking_to_buyer_provider text;
