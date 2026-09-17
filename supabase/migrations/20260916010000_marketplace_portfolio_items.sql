-- Portfolio media for marketplace supplier profiles.
--
-- The approved UGC-creator and services designs show a strip of recent work
-- under each profile card, which had no table behind it. Cards cannot invent
-- thumbnails, so this gives the strip a real, per-supplier source.
--
-- Read access mirrors the directory itself: anyone who can see an active
-- supplier can see its portfolio. Writes belong to the supplier's own user.

create table if not exists public.marketplace_portfolio_items (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.marketplace_suppliers(id) on delete cascade,
  position smallint not null default 0,
  title text,
  media_url text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  link_url text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, position)
);

create index if not exists marketplace_portfolio_items_supplier_idx
  on public.marketplace_portfolio_items (supplier_id, position);

alter table public.marketplace_portfolio_items enable row level security;

-- Visible wherever the supplier itself is visible.
drop policy if exists "mkt_portfolio_public_read" on public.marketplace_portfolio_items;
create policy "mkt_portfolio_public_read" on public.marketplace_portfolio_items for select using (
  exists (
    select 1 from public.marketplace_suppliers s
    where s.id = marketplace_portfolio_items.supplier_id
      and s.status = 'active'
  )
);

-- Only the supplier's own account may change its portfolio.
drop policy if exists "mkt_portfolio_owner_write" on public.marketplace_portfolio_items;
create policy "mkt_portfolio_owner_write" on public.marketplace_portfolio_items for all using (
  supplier_id in (select public.my_marketplace_supplier_ids())
) with check (
  supplier_id in (select public.my_marketplace_supplier_ids())
);
