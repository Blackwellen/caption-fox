-- Supplier marketplace (kept SEPARATE from the workspace app).
-- Suppliers = freelancers, UGC creators, ads managers, agencies, influencers.
-- Listings = the services/products they sell. Orders flow through escrow (held until
-- delivery/approval) and a dispute workflow. Payment capture/payout is via Stripe Connect
-- (wired once your Connect account + keys are configured).
--
-- Apply with: supabase db push (or the Supabase SQL editor).

create table if not exists public.marketplace_suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  slug text not null unique,
  display_name text not null,
  type text not null check (type in ('freelancer','ugc_creator','ads_manager','agency','influencer')),
  headline text,
  bio text,
  location text,
  avatar_url text,
  cover_url text,
  rating numeric(2,1) default 0,
  reviews_count integer default 0,
  verified boolean default false,
  status text not null default 'active' check (status in ('active','paused','suspended')),
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.marketplace_suppliers (id) on delete cascade,
  kind text not null default 'service' check (kind in ('service','product','booking')),
  title text not null,
  summary text,
  description text,
  category text,
  price_cents integer not null default 0,
  currency text not null default 'GBP',
  delivery_days integer,
  images text[] default '{}',
  rating numeric(2,1) default 0,
  reviews_count integer default 0,
  status text not null default 'active' check (status in ('active','paused','archived')),
  created_at timestamptz not null default now()
);
create index if not exists marketplace_listings_supplier_idx on public.marketplace_listings (supplier_id);
create index if not exists marketplace_listings_category_idx on public.marketplace_listings (category);

create table if not exists public.marketplace_reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.marketplace_listings (id) on delete cascade,
  supplier_id uuid references public.marketplace_suppliers (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  body text,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings (id) on delete restrict,
  supplier_id uuid not null references public.marketplace_suppliers (id) on delete restrict,
  buyer_id uuid not null references public.profiles (id) on delete restrict,
  amount_cents integer not null,
  currency text not null default 'GBP',
  -- escrow lifecycle: payment held → in progress → delivered → released (or refunded/disputed)
  status text not null default 'pending' check (status in (
    'pending','escrow_held','in_progress','delivered','completed','disputed','refunded','cancelled'
  )),
  stripe_payment_intent text,
  scheduled_for timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists marketplace_orders_buyer_idx on public.marketplace_orders (buyer_id, created_at desc);
create index if not exists marketplace_orders_supplier_idx on public.marketplace_orders (supplier_id);

create table if not exists public.marketplace_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.marketplace_orders (id) on delete cascade,
  raised_by uuid references public.profiles (id) on delete set null,
  -- staged dispute workflow
  stage text not null default 'opened' check (stage in ('opened','evidence','mediation','resolved','refunded','rejected')),
  reason text,
  resolution text,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.marketplace_listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- RLS
alter table public.marketplace_suppliers enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.marketplace_reviews enable row level security;
alter table public.marketplace_orders enable row level security;
alter table public.marketplace_disputes enable row level security;
alter table public.marketplace_favorites enable row level security;

-- Public can browse active suppliers/listings/reviews.
drop policy if exists "mkt_suppliers_public" on public.marketplace_suppliers;
create policy "mkt_suppliers_public" on public.marketplace_suppliers for select using (status = 'active');
drop policy if exists "mkt_listings_public" on public.marketplace_listings;
create policy "mkt_listings_public" on public.marketplace_listings for select using (status = 'active');
drop policy if exists "mkt_reviews_public" on public.marketplace_reviews;
create policy "mkt_reviews_public" on public.marketplace_reviews for select using (true);

-- Suppliers manage their own supplier/listing rows.
drop policy if exists "mkt_suppliers_owner" on public.marketplace_suppliers;
create policy "mkt_suppliers_owner" on public.marketplace_suppliers for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "mkt_listings_owner" on public.marketplace_listings;
create policy "mkt_listings_owner" on public.marketplace_listings for all using (
  supplier_id in (select id from public.marketplace_suppliers where user_id = auth.uid())
);

-- Orders: buyer or the listing's supplier can see them.
drop policy if exists "mkt_orders_party" on public.marketplace_orders;
create policy "mkt_orders_party" on public.marketplace_orders for select using (
  buyer_id = auth.uid()
  or supplier_id in (select id from public.marketplace_suppliers where user_id = auth.uid())
);
drop policy if exists "mkt_orders_buyer_insert" on public.marketplace_orders;
create policy "mkt_orders_buyer_insert" on public.marketplace_orders for insert with check (buyer_id = auth.uid());

-- Disputes: parties to the order.
drop policy if exists "mkt_disputes_party" on public.marketplace_disputes;
create policy "mkt_disputes_party" on public.marketplace_disputes for select using (
  order_id in (
    select id from public.marketplace_orders
    where buyer_id = auth.uid()
       or supplier_id in (select id from public.marketplace_suppliers where user_id = auth.uid())
  )
);

-- Favourites are private to the user.
drop policy if exists "mkt_favorites_own" on public.marketplace_favorites;
create policy "mkt_favorites_own" on public.marketplace_favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
