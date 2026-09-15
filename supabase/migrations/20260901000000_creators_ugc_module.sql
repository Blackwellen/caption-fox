-- ============================================================
-- Caption Fox — Campaign Manager: Creators & UGC module
--
-- Extends the original ugc_* tables into the full sourcing -> brief ->
-- submission -> rights -> payment lifecycle, and adds the relationship,
-- list, invitation, review, rights and payout tables the six Creators &
-- UGC surfaces read from. Safe to re-run (idempotent).
-- ============================================================

-- ============================================================
-- CREATOR PROFILE / RELATIONSHIP
-- A workspace-scoped relationship record. The commercial creator identity
-- (name/handle/audience) and the workspace relationship state (status,
-- owner, tags, shortlist) are deliberately separate columns so a creator
-- can be "active" in one workspace and "invited" in another.
-- ============================================================
alter table public.ugc_creators add column if not exists avatar_url text;
alter table public.ugc_creators add column if not exists bio text;
alter table public.ugc_creators add column if not exists region text;
alter table public.ugc_creators add column if not exists languages text[] not null default '{}';
alter table public.ugc_creators add column if not exists platforms text[] not null default '{}';
alter table public.ugc_creators add column if not exists audience_size integer not null default 0;
alter table public.ugc_creators add column if not exists engagement_rate numeric(6,3) not null default 0;
alter table public.ugc_creators add column if not exists avg_rate numeric(12,2);
alter table public.ugc_creators add column if not exists creator_tier text not null default 'creator';
alter table public.ugc_creators add column if not exists relationship_status text not null default 'discovered';
alter table public.ugc_creators add column if not exists rights_readiness text not null default 'none';
alter table public.ugc_creators add column if not exists payment_ready boolean not null default false;
alter table public.ugc_creators add column if not exists availability text not null default 'unknown';
alter table public.ugc_creators add column if not exists shortlisted boolean not null default false;
alter table public.ugc_creators add column if not exists campaign_fit integer not null default 0;
alter table public.ugc_creators add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.ugc_creators add column if not exists tags text[] not null default '{}';
alter table public.ugc_creators add column if not exists source text not null default 'manual';
alter table public.ugc_creators add column if not exists marketplace_supplier_id uuid;
alter table public.ugc_creators add column if not exists total_earnings numeric(12,2) not null default 0;
alter table public.ugc_creators add column if not exists archived_at timestamptz;
alter table public.ugc_creators add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.ugc_creators add constraint ugc_creators_relationship_status_check
    check (relationship_status in (
      'discovered','invited','invitation_accepted','onboarding','available',
      'shortlisted','in_review','active','paused','unavailable','archived','blocked'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.ugc_creators add constraint ugc_creators_rights_readiness_check
    check (rights_readiness in ('none','limited','full'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.ugc_creators add constraint ugc_creators_availability_check
    check (availability in ('unknown','available','limited','booked','unavailable'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.ugc_creators add constraint ugc_creators_tier_check
    check (creator_tier in ('creator','pro','elite'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.ugc_creators add constraint ugc_creators_campaign_fit_check
    check (campaign_fit >= 0 and campaign_fit <= 100);
exception when duplicate_object then null; end $$;

create index if not exists idx_ugc_creators_workspace_status on public.ugc_creators(workspace_id, relationship_status);
create index if not exists idx_ugc_creators_workspace_updated on public.ugc_creators(workspace_id, updated_at desc);
create index if not exists idx_ugc_creators_owner on public.ugc_creators(owner_id);
create index if not exists idx_ugc_creators_shortlist on public.ugc_creators(workspace_id, shortlisted);
create index if not exists idx_ugc_creators_archived on public.ugc_creators(workspace_id, archived_at);

-- Re-declared with an explicit WITH CHECK so an insert cannot smuggle in a
-- workspace_id the caller is not a member of.
drop policy if exists "creators_workspace" on public.ugc_creators;
create policy "creators_workspace" on public.ugc_creators for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- ============================================================
-- CREATOR LISTS & SHORTLISTS
-- ============================================================
create table if not exists public.creator_lists (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  list_type text not null default 'list' check (list_type in ('list','shortlist','saved_search','featured')),
  campaign_id uuid references public.campaigns(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  is_shared boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.creator_lists enable row level security;
drop policy if exists "creator_lists_workspace" on public.creator_lists;
create policy "creator_lists_workspace" on public.creator_lists for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_creator_lists_workspace on public.creator_lists(workspace_id, list_type);

create table if not exists public.creator_list_members (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  list_id uuid not null references public.creator_lists(id) on delete cascade,
  creator_id uuid not null references public.ugc_creators(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (list_id, creator_id)
);
alter table public.creator_list_members enable row level security;
drop policy if exists "creator_list_members_workspace" on public.creator_list_members;
create policy "creator_list_members_workspace" on public.creator_list_members for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_creator_list_members_list on public.creator_list_members(list_id);
create index if not exists idx_creator_list_members_creator on public.creator_list_members(creator_id);

-- ============================================================
-- CREATOR INVITATIONS
-- ============================================================
create table if not exists public.creator_invitations (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  creator_id uuid references public.ugc_creators(id) on delete cascade,
  email text not null,
  display_name text,
  message text,
  status text not null default 'sent'
    check (status in ('draft','sent','accepted','declined','expired','revoked')),
  require_payment_details boolean not null default true,
  require_rights_details boolean not null default true,
  expires_at timestamptz,
  sent_at timestamptz,
  responded_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.creator_invitations enable row level security;
drop policy if exists "creator_invitations_workspace" on public.creator_invitations;
create policy "creator_invitations_workspace" on public.creator_invitations for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_creator_invitations_workspace on public.creator_invitations(workspace_id, status);
-- One live invitation per email per workspace: re-inviting resends rather than duplicating.
create unique index if not exists idx_creator_invitations_live
  on public.creator_invitations(workspace_id, lower(email)) where status in ('draft','sent');

-- ============================================================
-- BRIEFS - lifecycle, ownership, delivery
-- ============================================================
alter table public.ugc_briefs add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.ugc_briefs add column if not exists approval_stage text not null default 'not_sent';
alter table public.ugc_briefs add column if not exists cover_url text;
alter table public.ugc_briefs add column if not exists category text;
alter table public.ugc_briefs add column if not exists priority text not null default 'medium';
alter table public.ugc_briefs add column if not exists channels text[] not null default '{}';
alter table public.ugc_briefs add column if not exists rights_requirement text;
alter table public.ugc_briefs add column if not exists creators_assigned integer not null default 0;
alter table public.ugc_briefs add column if not exists deliverables_target integer not null default 0;
alter table public.ugc_briefs add column if not exists deliverables_submitted integer not null default 0;
alter table public.ugc_briefs add column if not exists completed_at timestamptz;
alter table public.ugc_briefs add column if not exists archived_at timestamptz;
alter table public.ugc_briefs add column if not exists board_position integer not null default 0;

-- The original lifecycle only covered draft -> in_production -> completed.
alter table public.ugc_briefs drop constraint if exists ugc_briefs_status_check;
update public.ugc_briefs set status = 'in_progress' where status = 'in_production';
do $$ begin
  alter table public.ugc_briefs add constraint ugc_briefs_status_check
    check (status in ('draft','open','in_progress','submitted','completed','on_hold','cancelled'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.ugc_briefs add constraint ugc_briefs_approval_stage_check
    check (approval_stage in ('not_sent','brief_sent','waiting_for_creator','in_review','pending_approval','approved','changes_requested','rejected'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.ugc_briefs add constraint ugc_briefs_priority_check
    check (priority in ('low','medium','high','urgent'));
exception when duplicate_object then null; end $$;

create index if not exists idx_ugc_briefs_workspace_status on public.ugc_briefs(workspace_id, status);
create index if not exists idx_ugc_briefs_workspace_deadline on public.ugc_briefs(workspace_id, deadline);
create index if not exists idx_ugc_briefs_owner on public.ugc_briefs(owner_id);
create index if not exists idx_ugc_briefs_campaign on public.ugc_briefs(campaign_id);
create index if not exists idx_ugc_briefs_archived on public.ugc_briefs(workspace_id, archived_at);

drop policy if exists "ugc_briefs_workspace" on public.ugc_briefs;
create policy "ugc_briefs_workspace" on public.ugc_briefs for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- Per-creator brief participation. A brief-level status must never hide
-- where one individual creator actually is in the workflow.
create table if not exists public.ugc_brief_creators (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brief_id uuid not null references public.ugc_briefs(id) on delete cascade,
  creator_id uuid not null references public.ugc_creators(id) on delete cascade,
  status text not null default 'invited'
    check (status in ('invited','viewed','accepted','declined','in_production','submitted','changes_requested','approved','completed','cancelled')),
  agreed_rate numeric(12,2),
  currency text not null default 'GBP',
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brief_id, creator_id)
);
alter table public.ugc_brief_creators enable row level security;
drop policy if exists "ugc_brief_creators_workspace" on public.ugc_brief_creators;
create policy "ugc_brief_creators_workspace" on public.ugc_brief_creators for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_ugc_brief_creators_brief on public.ugc_brief_creators(brief_id, status);
create index if not exists idx_ugc_brief_creators_creator on public.ugc_brief_creators(creator_id);

create table if not exists public.ugc_brief_deliverables (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brief_id uuid not null references public.ugc_briefs(id) on delete cascade,
  title text not null,
  asset_type text not null default 'video'
    check (asset_type in ('video','image','carousel','audio','document','caption','raw_footage','package')),
  quantity integer not null default 1 check (quantity > 0),
  channel text,
  due_date date,
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.ugc_brief_deliverables enable row level security;
drop policy if exists "ugc_brief_deliverables_workspace" on public.ugc_brief_deliverables;
create policy "ugc_brief_deliverables_workspace" on public.ugc_brief_deliverables for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_ugc_brief_deliverables_brief on public.ugc_brief_deliverables(brief_id);

-- ============================================================
-- SUBMISSIONS - review workflow, versions, assets, issues
-- ============================================================
alter table public.ugc_submissions add column if not exists title text;
alter table public.ugc_submissions add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;
alter table public.ugc_submissions add column if not exists deliverable_id uuid references public.ugc_brief_deliverables(id) on delete set null;
alter table public.ugc_submissions add column if not exists asset_type text not null default 'video';
alter table public.ugc_submissions add column if not exists version integer not null default 1;
alter table public.ugc_submissions add column if not exists reviewer_id uuid references public.profiles(id) on delete set null;
alter table public.ugc_submissions add column if not exists rights_status text not null default 'none';
alter table public.ugc_submissions add column if not exists thumbnail_url text;
alter table public.ugc_submissions add column if not exists duration_seconds integer;
alter table public.ugc_submissions add column if not exists file_count integer not null default 0;
alter table public.ugc_submissions add column if not exists views integer not null default 0;
alter table public.ugc_submissions add column if not exists engagement_rate numeric(6,3) not null default 0;
alter table public.ugc_submissions add column if not exists comments_count integer not null default 0;
alter table public.ugc_submissions add column if not exists issue_count integer not null default 0;
alter table public.ugc_submissions add column if not exists submitted_at timestamptz not null default now();
alter table public.ugc_submissions add column if not exists review_started_at timestamptz;
alter table public.ugc_submissions add column if not exists review_seconds integer;
alter table public.ugc_submissions add column if not exists payment_eligible boolean not null default false;
alter table public.ugc_submissions add column if not exists archived_at timestamptz;

alter table public.ugc_submissions drop constraint if exists ugc_submissions_status_check;
update public.ugc_submissions set status = 'waiting_review' where status = 'pending';
update public.ugc_submissions set status = 'changes_requested' where status = 'revision_requested';
do $$ begin
  alter table public.ugc_submissions add constraint ugc_submissions_status_check
    check (status in ('draft','waiting_review','in_review','changes_requested','approved','rejected','published'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.ugc_submissions add constraint ugc_submissions_asset_type_check
    check (asset_type in ('video','image','carousel','audio','document','caption','raw_footage','package'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.ugc_submissions add constraint ugc_submissions_rights_status_check
    check (rights_status in ('none','pending','requested','active','expired','restricted','revoked'));
exception when duplicate_object then null; end $$;

create index if not exists idx_ugc_submissions_workspace_status on public.ugc_submissions(workspace_id, status);
create index if not exists idx_ugc_submissions_workspace_submitted on public.ugc_submissions(workspace_id, submitted_at desc);
create index if not exists idx_ugc_submissions_brief on public.ugc_submissions(brief_id);
create index if not exists idx_ugc_submissions_creator on public.ugc_submissions(creator_id);
create index if not exists idx_ugc_submissions_reviewer on public.ugc_submissions(reviewer_id);
create index if not exists idx_ugc_submissions_archived on public.ugc_submissions(workspace_id, archived_at);

drop policy if exists "submissions_workspace" on public.ugc_submissions;
create policy "submissions_workspace" on public.ugc_submissions for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

create table if not exists public.ugc_submission_assets (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  submission_id uuid not null references public.ugc_submissions(id) on delete cascade,
  version integer not null default 1,
  storage_path text not null,
  media_type text not null default 'image' check (media_type in ('image','video','audio','document')),
  mime_type text,
  size_bytes bigint,
  width integer,
  height integer,
  duration_seconds integer,
  thumbnail_path text,
  original_name text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.ugc_submission_assets enable row level security;
drop policy if exists "ugc_submission_assets_workspace" on public.ugc_submission_assets;
create policy "ugc_submission_assets_workspace" on public.ugc_submission_assets for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_ugc_submission_assets_submission on public.ugc_submission_assets(submission_id, version);

create table if not exists public.ugc_submission_reviews (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  submission_id uuid not null references public.ugc_submissions(id) on delete cascade,
  version integer not null default 1,
  reviewer_id uuid references public.profiles(id) on delete set null,
  decision text not null
    check (decision in ('started','approved','changes_requested','rejected','note','reassigned','escalated')),
  note text,
  creator_visible boolean not null default false,
  timecode_seconds integer,
  created_at timestamptz not null default now()
);
alter table public.ugc_submission_reviews enable row level security;
drop policy if exists "ugc_submission_reviews_workspace" on public.ugc_submission_reviews;
create policy "ugc_submission_reviews_workspace" on public.ugc_submission_reviews for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_ugc_submission_reviews_submission on public.ugc_submission_reviews(submission_id, created_at desc);

create table if not exists public.ugc_submission_issues (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  submission_id uuid not null references public.ugc_submissions(id) on delete cascade,
  category text not null,
  severity text not null default 'medium' check (severity in ('low','medium','high')),
  detail text,
  -- Automated checks are surfaced as "detected", never as confirmed fact,
  -- until a reviewer confirms them.
  source text not null default 'reviewer' check (source in ('reviewer','automated')),
  status text not null default 'open' check (status in ('open','confirmed','dismissed','resolved')),
  raised_by uuid references public.profiles(id) on delete set null,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.ugc_submission_issues enable row level security;
drop policy if exists "ugc_submission_issues_workspace" on public.ugc_submission_issues;
create policy "ugc_submission_issues_workspace" on public.ugc_submission_issues for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_ugc_submission_issues_submission on public.ugc_submission_issues(submission_id, status);
create index if not exists idx_ugc_submission_issues_workspace on public.ugc_submission_issues(workspace_id, category);

-- ============================================================
-- USAGE RIGHTS
-- ============================================================
create table if not exists public.ugc_rights (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  creator_id uuid not null references public.ugc_creators(id) on delete cascade,
  submission_id uuid references public.ugc_submissions(id) on delete set null,
  submission_version integer,
  campaign_id uuid references public.campaigns(id) on delete set null,
  brief_id uuid references public.ugc_briefs(id) on delete set null,
  asset_label text not null,
  rights_type text not null default 'licence' check (rights_type in ('licence','assignment','permission','renewal')),
  usage_scope text not null default 'organic_only',
  channels text[] not null default '{}',
  territories text[] not null default '{}',
  start_date date,
  expiry_date date,
  exclusivity boolean not null default false,
  modification_allowed boolean not null default false,
  paid_amplification boolean not null default false,
  whitelisting boolean not null default false,
  handle_usage boolean not null default false,
  agreement_url text,
  agreement_signed boolean not null default false,
  status text not null default 'draft',
  owner_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.ugc_rights add constraint ugc_rights_status_check
    check (status in ('draft','requested','pending_approval','active','expired','restricted','revoked','renewal_pending','rejected'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.ugc_rights add constraint ugc_rights_usage_scope_check
    check (usage_scope in ('organic_only','paid_social','full_digital','broadcast','print','retail','internal','single_use','limited','exclusive','perpetual','custom'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.ugc_rights add constraint ugc_rights_dates_check
    check (expiry_date is null or start_date is null or expiry_date >= start_date);
exception when duplicate_object then null; end $$;

alter table public.ugc_rights enable row level security;
drop policy if exists "ugc_rights_workspace" on public.ugc_rights;
create policy "ugc_rights_workspace" on public.ugc_rights for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_ugc_rights_workspace_status on public.ugc_rights(workspace_id, status);
create index if not exists idx_ugc_rights_workspace_expiry on public.ugc_rights(workspace_id, expiry_date);
create index if not exists idx_ugc_rights_creator on public.ugc_rights(creator_id);
create index if not exists idx_ugc_rights_submission on public.ugc_rights(submission_id);
create index if not exists idx_ugc_rights_campaign on public.ugc_rights(campaign_id);

create table if not exists public.ugc_rights_requests (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rights_id uuid references public.ugc_rights(id) on delete cascade,
  creator_id uuid not null references public.ugc_creators(id) on delete cascade,
  submission_id uuid references public.ugc_submissions(id) on delete set null,
  requested_channels text[] not null default '{}',
  requested_territories text[] not null default '{}',
  requested_duration_days integer,
  paid_media boolean not null default false,
  exclusivity boolean not null default false,
  proposed_fee numeric(12,2),
  currency text not null default 'GBP',
  message text,
  status text not null default 'sent'
    check (status in ('draft','sent','accepted','declined','countered','expired','withdrawn')),
  counter_fee numeric(12,2),
  expires_at timestamptz,
  responded_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ugc_rights_requests enable row level security;
drop policy if exists "ugc_rights_requests_workspace" on public.ugc_rights_requests;
create policy "ugc_rights_requests_workspace" on public.ugc_rights_requests for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_ugc_rights_requests_workspace on public.ugc_rights_requests(workspace_id, status);
create index if not exists idx_ugc_rights_requests_creator on public.ugc_rights_requests(creator_id);

-- ============================================================
-- PAYMENTS, BATCHES AND PAYOUT ATTEMPTS
-- ============================================================
alter table public.ugc_payments add column if not exists brief_id uuid references public.ugc_briefs(id) on delete set null;
alter table public.ugc_payments add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;
alter table public.ugc_payments add column if not exists batch_id uuid;
alter table public.ugc_payments add column if not exists approval_state text not null default 'not_submitted';
alter table public.ugc_payments add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table public.ugc_payments add column if not exists approved_at timestamptz;
alter table public.ugc_payments add column if not exists payout_date date;
alter table public.ugc_payments add column if not exists submitted_date timestamptz;
alter table public.ugc_payments add column if not exists invoice_number text;
alter table public.ugc_payments add column if not exists invoice_url text;
alter table public.ugc_payments add column if not exists invoice_status text not null default 'not_required';
alter table public.ugc_payments add column if not exists invoice_flag text;
alter table public.ugc_payments add column if not exists tax_status text not null default 'not_required';
alter table public.ugc_payments add column if not exists provider_reference text;
alter table public.ugc_payments add column if not exists failure_reason text;
alter table public.ugc_payments add column if not exists blocked_reason text;
alter table public.ugc_payments add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.ugc_payments add column if not exists idempotency_key text;
alter table public.ugc_payments add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.ugc_payments add column if not exists updated_at timestamptz not null default now();
alter table public.ugc_payments alter column submission_id drop not null;

alter table public.ugc_payments drop constraint if exists ugc_payments_status_check;
do $$ begin
  alter table public.ugc_payments add constraint ugc_payments_status_check
    check (status in ('draft','invoice_required','invoice_submitted','in_review','pending_approval','approved','scheduled','processing','paid','failed','on_hold','cancelled','refunded','partially_paid'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.ugc_payments add constraint ugc_payments_approval_state_check
    check (approval_state in ('not_submitted','pending','approved','rejected'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.ugc_payments add constraint ugc_payments_invoice_status_check
    check (invoice_status in ('not_required','required','submitted','approved','flagged'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.ugc_payments add constraint ugc_payments_tax_status_check
    check (tax_status in ('not_required','missing','submitted','verified'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.ugc_payments add constraint ugc_payments_amount_check check (amount >= 0);
exception when duplicate_object then null; end $$;

-- Duplicate payout protection: a caller-supplied key can only be used once.
create unique index if not exists idx_ugc_payments_idempotency
  on public.ugc_payments(workspace_id, idempotency_key) where idempotency_key is not null;
create index if not exists idx_ugc_payments_workspace_status on public.ugc_payments(workspace_id, status);
create index if not exists idx_ugc_payments_workspace_payout on public.ugc_payments(workspace_id, payout_date);
create index if not exists idx_ugc_payments_creator on public.ugc_payments(creator_id);
create index if not exists idx_ugc_payments_batch on public.ugc_payments(batch_id);
create index if not exists idx_ugc_payments_campaign on public.ugc_payments(campaign_id);

drop policy if exists "ugc_payments_workspace" on public.ugc_payments;
create policy "ugc_payments_workspace" on public.ugc_payments for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

create table if not exists public.ugc_payment_batches (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  currency text not null default 'GBP',
  payment_method text not null default 'bank_transfer',
  status text not null default 'draft'
    check (status in ('draft','pending_approval','approved','scheduled','processing','completed','partially_completed','failed','cancelled')),
  total_amount numeric(14,2) not null default 0,
  item_count integer not null default 0,
  scheduled_for date,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  processed_at timestamptz,
  idempotency_key text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ugc_payment_batches enable row level security;
drop policy if exists "ugc_payment_batches_workspace" on public.ugc_payment_batches;
create policy "ugc_payment_batches_workspace" on public.ugc_payment_batches for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_ugc_payment_batches_workspace on public.ugc_payment_batches(workspace_id, status);
create unique index if not exists idx_ugc_payment_batches_idempotency
  on public.ugc_payment_batches(workspace_id, idempotency_key) where idempotency_key is not null;

do $$ begin
  alter table public.ugc_payments add constraint ugc_payments_batch_fk
    foreign key (batch_id) references public.ugc_payment_batches(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.ugc_payout_attempts (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  payment_id uuid not null references public.ugc_payments(id) on delete cascade,
  batch_id uuid references public.ugc_payment_batches(id) on delete set null,
  attempt_no integer not null default 1,
  status text not null default 'processing'
    check (status in ('processing','succeeded','failed','cancelled')),
  provider text,
  provider_reference text,
  error_code text,
  error_message text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (payment_id, attempt_no)
);
alter table public.ugc_payout_attempts enable row level security;
drop policy if exists "ugc_payout_attempts_workspace" on public.ugc_payout_attempts;
create policy "ugc_payout_attempts_workspace" on public.ugc_payout_attempts for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_ugc_payout_attempts_payment on public.ugc_payout_attempts(payment_id);

-- ============================================================
-- CREATORS & UGC ACTIVITY / AUDIT FEED
-- ============================================================
create table if not exists public.ugc_activity (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  summary text not null,
  link text,
  surface text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.ugc_activity enable row level security;
drop policy if exists "ugc_activity_workspace_read" on public.ugc_activity;
create policy "ugc_activity_workspace_read" on public.ugc_activity for select using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
drop policy if exists "ugc_activity_workspace_write" on public.ugc_activity;
create policy "ugc_activity_workspace_write" on public.ugc_activity for insert with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  and actor_id = auth.uid()
);
create index if not exists idx_ugc_activity_workspace on public.ugc_activity(workspace_id, created_at desc);
create index if not exists idx_ugc_activity_entity on public.ugc_activity(entity_type, entity_id);

-- ============================================================
-- STORAGE - private submission bucket
-- Paths are `{workspace_id}/{submission_id}/{file}`; the policies below
-- read the first path segment so a member can only reach their own
-- workspace's files. The bucket is private: reads go through signed URLs.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ugc-submissions', 'ugc-submissions', false, 524288000,
  array['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/quicktime','video/webm','audio/mpeg','audio/mp4','application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ugc_submissions_member_read" on storage.objects;
create policy "ugc_submissions_member_read" on storage.objects for select using (
  bucket_id = 'ugc-submissions'
  and (storage.foldername(name))[1] in (
    select workspace_id::text from public.workspace_members where user_id = auth.uid()
  )
);

drop policy if exists "ugc_submissions_member_write" on storage.objects;
create policy "ugc_submissions_member_write" on storage.objects for insert with check (
  bucket_id = 'ugc-submissions'
  and (storage.foldername(name))[1] in (
    select workspace_id::text from public.workspace_members where user_id = auth.uid()
  )
);

drop policy if exists "ugc_submissions_member_delete" on storage.objects;
create policy "ugc_submissions_member_delete" on storage.objects for delete using (
  bucket_id = 'ugc-submissions'
  and (storage.foldername(name))[1] in (
    select workspace_id::text from public.workspace_members where user_id = auth.uid()
  )
);
