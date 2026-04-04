create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  brand text not null,
  model_code text not null,
  variant text,
  category text,
  engine_cc integer,
  cash_price integer not null,
  currency text not null default 'KES',
  hero_image_url text,
  gallery_images jsonb not null default '[]'::jsonb,
  image_alt text,
  short_description text,
  features jsonb not null default '[]'::jsonb,
  promo_enabled boolean not null default false,
  promo_text text,
  display_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_active_cash_price_check check (
    not is_active or cash_price > 0
  ),
  constraint products_gallery_images_array_check check (
    jsonb_typeof(gallery_images) = 'array'
  ),
  constraint products_features_array_check check (
    jsonb_typeof(features) = 'array'
  )
);

create table if not exists public.product_finance_plans (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  financier text not null,
  plan_code text not null,
  payment_frequency text not null,
  tenure_months integer not null,
  deposit_amount integer not null,
  installment_amount integer not null,
  interest_rate numeric(8, 4),
  processing_fee integer,
  insurance_fee integer,
  total_payable integer,
  is_available boolean not null default true,
  sort_order integer not null default 100,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_finance_financier_check check (
    financier in ('fortune_credit', 'watu')
  ),
  constraint product_finance_frequency_check check (
    payment_frequency in ('weekly', 'monthly')
  ),
  constraint product_finance_tenure_check check (
    tenure_months > 0
  ),
  constraint product_finance_active_amounts_check check (
    not is_available or (deposit_amount > 0 and installment_amount > 0)
  )
);

create unique index if not exists product_finance_unique_plan_idx
  on public.product_finance_plans (product_id, financier, tenure_months, payment_frequency);

create index if not exists products_active_display_order_idx
  on public.products (is_active, display_order, slug);

create index if not exists product_finance_lookup_idx
  on public.product_finance_plans (product_id, is_available, financier, sort_order, tenure_months);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

drop trigger if exists product_finance_plans_set_updated_at on public.product_finance_plans;
create trigger product_finance_plans_set_updated_at
before update on public.product_finance_plans
for each row
execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.product_finance_plans enable row level security;

comment on table public.products is 'Nakaja Bikes public product catalog for product detail pages and storefront cards.';
comment on table public.product_finance_plans is 'Per-product approved finance rows for Fortune Credit and Watu.';
