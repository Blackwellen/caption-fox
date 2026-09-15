-- Public affiliate/partner program applications. Caption Fox does not yet
-- have a full separate affiliate account system (no distinct login tables) —
-- this captures real applications so /affiliates/signup is a genuine,
-- working intake rather than a dead-end form, and Platform Admin can review
-- and approve/reject from here.
create table if not exists public.affiliate_applications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  email text not null,
  website_url text,
  promotion_channel text,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists affiliate_applications_status_idx on public.affiliate_applications(status);
create index if not exists affiliate_applications_email_idx on public.affiliate_applications(email);

alter table public.affiliate_applications enable row level security;

-- Anyone (including anonymous visitors) can submit an application.
drop policy if exists "affiliate_applications_public_insert" on public.affiliate_applications;
create policy "affiliate_applications_public_insert" on public.affiliate_applications
  for insert
  with check (true);

-- Applicants can see their own application's status; platform admins see all.
drop policy if exists "affiliate_applications_read" on public.affiliate_applications;
create policy "affiliate_applications_read" on public.affiliate_applications
  for select
  using (
    (user_id is not null and user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin)
  );

-- Only platform admins can review (approve/reject) applications.
drop policy if exists "affiliate_applications_admin_update" on public.affiliate_applications;
create policy "affiliate_applications_admin_update" on public.affiliate_applications
  for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin));
