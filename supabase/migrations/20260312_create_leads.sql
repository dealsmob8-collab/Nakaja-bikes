create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  lead_status text not null default 'new',
  form_name text not null,
  source_page_url text,
  source_page_path text,
  source_referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  full_name text not null,
  phone_raw text not null,
  phone_normalized text not null,
  riding_area text not null,
  deposit_amount integer not null,
  model_id text not null,
  model_name text not null,
  plan_duration_months integer not null,
  payment_type text not null,
  payment_amount integer not null,
  pdl_status text not null,
  deposit_timeline text not null,
  notes text,
  consent boolean not null default true,
  technical jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb
);

create index if not exists leads_submitted_at_idx on public.leads (submitted_at desc);
create index if not exists leads_status_idx on public.leads (lead_status);
create index if not exists leads_phone_idx on public.leads (phone_normalized);
create index if not exists leads_model_idx on public.leads (model_id);

alter table public.leads enable row level security;

comment on table public.leads is 'Sales leads captured from the Nakaja Bikes landing page.';
