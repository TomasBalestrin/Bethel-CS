create type public.revenue_type as enum ('crossell', 'upsell');

alter table public.revenue_records
  add column revenue_type public.revenue_type not null default 'crossell';
