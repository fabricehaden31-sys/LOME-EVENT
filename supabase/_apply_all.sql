-- ============================================================
-- Lomé Events — combined migrations (run top-to-bottom in Supabase SQL Editor)
-- Idempotent: safe to re-run. Generated for convenience.
-- ============================================================

-- ##### 202609290001_initial_schema.sql #####
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  phone text,
  role text not null default 'participant' check (role in ('participant', 'organizer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  language text not null default 'fr' check (language in ('fr', 'en')),
  theme text not null default 'light' check (theme in ('light', 'dark')),
  email_notifications boolean not null default true,
  push_notifications boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.categories (
  id text primary key,
  label text not null,
  emoji text not null default '',
  sort_order integer not null default 0
);

insert into public.categories (id, label, emoji, sort_order) values
  ('concerts', 'Concerts', 'ðŸŽµ', 1),
  ('soirees', 'SoirÃ©es', 'ðŸŽ‰', 2),
  ('sport', 'Sport', 'ðŸ†', 3),
  ('business', 'Business', 'ðŸ’¼', 4),
  ('formations', 'Formations', 'ðŸŽ“', 5),
  ('culture', 'Culture', 'ðŸŽ­', 6),
  ('festivals', 'Festivals', 'ðŸŽª', 7),
  ('famille', 'Famille', 'ðŸ‘¨â€ðŸ‘©â€ðŸ‘§', 8),
  ('networking', 'Networking', 'ðŸŒ', 9)
on conflict (id) do nothing;

create table public.events (
  id text primary key default gen_random_uuid()::text,
  organizer_id uuid not null references public.profiles (id) on delete restrict,
  category_id text not null references public.categories (id),
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue text not null,
  address text not null,
  district text not null,
  poster_url text,
  latitude double precision,
  longitude double precision,
  status text not null default 'pending' check (status in ('draft', 'pending', 'published', 'rejected', 'cancelled')),
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create table public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events (id) on delete cascade,
  name text not null,
  price_xof bigint not null check (price_xof >= 0),
  quota integer not null check (quota > 0),
  perks text[] not null default '{}',
  sales_start timestamptz,
  sales_end timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, name)
);

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id text not null references public.events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  event_id text not null references public.events (id) on delete restrict,
  total_xof bigint not null check (total_xof >= 0),
  fees_xof bigint not null default 0 check (fees_xof >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'refunded', 'failed')),
  created_at timestamptz not null default now()
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  ticket_type_id uuid not null references public.ticket_types (id) on delete restrict,
  code text not null unique,
  checked_in_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null check (provider in ('flooz', 'tmoney', 'card')),
  provider_reference text,
  amount_xof bigint not null check (amount_xof > 0),
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  unique (provider, provider_reference)
);

create index events_public_listing_idx on public.events (starts_at) where status = 'published';
create index events_organizer_idx on public.events (organizer_id, created_at desc);
create index ticket_types_event_idx on public.ticket_types (event_id);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index tickets_user_idx on public.tickets (user_id, created_at desc);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
    and auth.uid() is not null
    and not public.is_admin() then
    raise exception 'Only an admin may change profile roles';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger protect_profile_role_before_update
  before update on public.profiles
  for each row execute procedure public.protect_profile_role();

create or replace function public.protect_event_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
    and auth.uid() is not null
    and not public.is_admin() then
    raise exception 'Only an admin may change event status';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger protect_event_status_before_update
  before update on public.events
  for each row execute procedure public.protect_event_status();

create or replace function public.set_event_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.status = 'pending';
  end if;
  return new;
end;
$$;

create trigger force_new_events_pending
  before insert on public.events
  for each row execute procedure public.set_event_pending();

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.categories enable row level security;
alter table public.events enable row level security;
alter table public.ticket_types enable row level security;
alter table public.favorites enable row level security;
alter table public.orders enable row level security;
alter table public.tickets enable row level security;
alter table public.notifications enable row level security;
alter table public.payments enable row level security;

create policy "profiles read self or admin" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles update self or admin" on public.profiles
  for update to authenticated using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

create policy "users read own settings" on public.user_settings
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "users update own settings" on public.user_settings
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "categories public read" on public.categories
  for select to anon, authenticated using (true);
create policy "categories admin manage" on public.categories
  for all to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "published events public read" on public.events
  for select to anon, authenticated using (
    status = 'published' or organizer_id = (select auth.uid()) or (select public.is_admin())
  );
create policy "organizers create own events" on public.events
  for insert to authenticated with check (
    organizer_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('organizer', 'admin'))
  );
create policy "organizers update own events" on public.events
  for update to authenticated using (
    organizer_id = (select auth.uid()) or (select public.is_admin())
  ) with check (organizer_id = (select auth.uid()) or (select public.is_admin()));
create policy "admins delete events" on public.events
  for delete to authenticated using ((select public.is_admin()));

create policy "ticket types public read" on public.ticket_types
  for select to anon, authenticated using (
    exists (select 1 from public.events e where e.id = event_id and e.status = 'published')
    or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = (select auth.uid()))
    or (select public.is_admin())
  );
create policy "organizers manage ticket types" on public.ticket_types
  for all to authenticated using (
    exists (select 1 from public.events e where e.id = event_id and e.organizer_id = (select auth.uid()))
    or (select public.is_admin())
  ) with check (
    exists (select 1 from public.events e where e.id = event_id and e.organizer_id = (select auth.uid()))
    or (select public.is_admin())
  );

create policy "users manage own favorites" on public.favorites
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "users read own orders and admins read all" on public.orders
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "users read own tickets and admins read all" on public.tickets
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "users read own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "users update own notifications" on public.notifications
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "admins create notifications" on public.notifications
  for insert to authenticated with check ((select public.is_admin()));

create policy "admins read payments" on public.payments
  for select to authenticated using ((select public.is_admin()));

-- ##### 202610020001_organizer_applications.sql #####
create table if not exists public.organizer_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  organization_name text not null,
  organization_type text not null check (organization_type in (
    'event_company', 'business', 'association', 'artist', 'club', 'venue', 'independent', 'other'
  )),
  description text not null default '',
  business_phone text not null,
  business_email text not null,
  website text,
  social_links jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists country text not null default '',
  add column if not exists city text not null default '',
  add column if not exists avatar_url text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, phone, country, city, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'country', ''),
    coalesce(new.raw_user_meta_data ->> 'city', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create index if not exists organizer_applications_pending_idx
  on public.organizer_applications (created_at)
  where status = 'pending';

create unique index if not exists organizer_applications_one_pending_per_user_idx
  on public.organizer_applications (user_id)
  where status = 'pending';

alter table public.organizer_applications enable row level security;

drop policy if exists "users read own organizer applications" on public.organizer_applications;
create policy "users read own organizer applications" on public.organizer_applications
  for select to authenticated using (
    user_id = (select auth.uid()) or (select public.is_admin())
  );

drop policy if exists "participants submit organizer applications" on public.organizer_applications;
create policy "participants submit organizer applications" on public.organizer_applications
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'participant'
    )
  );

create or replace function public.create_organizer_application_after_email_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb := new.raw_user_meta_data;
begin
  if new.email_confirmed_at is null
    or metadata ->> 'registration_type' <> 'organizer'
    or nullif(trim(metadata ->> 'organization_name'), '') is null then
    return new;
  end if;

  insert into public.organizer_applications (
    user_id,
    organization_name,
    organization_type,
    description,
    business_phone,
    business_email,
    website,
    social_links
  )
  values (
    new.id,
    trim(metadata ->> 'organization_name'),
    coalesce(nullif(metadata ->> 'organization_type', ''), 'other'),
    coalesce(metadata ->> 'organization_description', ''),
    coalesce(metadata ->> 'business_phone', ''),
    coalesce(metadata ->> 'business_email', new.email),
    nullif(metadata ->> 'website', ''),
    coalesce(metadata -> 'social_links', '{}'::jsonb)
  )
  on conflict (user_id) where status = 'pending' do nothing;

  return new;
end;
$$;

drop trigger if exists zz_create_organizer_application_after_confirmation on auth.users;
create trigger zz_create_organizer_application_after_confirmation
  after insert or update of email_confirmed_at on auth.users
  for each row execute procedure public.create_organizer_application_after_email_confirmation();

create or replace function public.approve_organizer_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  application_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins may review organizer applications';
  end if;

  update public.organizer_applications
  set status = 'approved',
      rejection_reason = null,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      verified_at = now(),
      updated_at = now()
  where id = p_application_id and status = 'pending'
  returning user_id into application_user_id;

  if application_user_id is null then
    raise exception 'Pending organizer application not found';
  end if;

  update public.profiles
  set role = 'organizer'
  where id = application_user_id;

  insert into public.notifications (user_id, title, body)
  values (
    application_user_id,
    'Demande organisateur approuvÃ©e',
    'Votre compte organisateur est activÃ©. Vous pouvez accÃ©der Ã  votre espace organisateur.'
  );
end;
$$;

create or replace function public.reject_organizer_application(
  p_application_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  application_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins may review organizer applications';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'A rejection reason is required';
  end if;

  update public.organizer_applications
  set status = 'rejected',
      rejection_reason = trim(p_reason),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_application_id and status = 'pending'
  returning user_id into application_user_id;

  if application_user_id is null then
    raise exception 'Pending organizer application not found';
  end if;

  insert into public.notifications (user_id, title, body)
  values (
    application_user_id,
    'Demande organisateur refusÃ©e',
    'Votre demande a Ã©tÃ© refusÃ©e. Motif : ' || trim(p_reason)
  );
end;
$$;

revoke all on function public.approve_organizer_application(uuid) from public, anon;
revoke all on function public.reject_organizer_application(uuid, text) from public, anon;
grant execute on function public.approve_organizer_application(uuid) to authenticated;
grant execute on function public.reject_organizer_application(uuid, text) to authenticated;

-- ##### 202610020002_immediate_signup.sql #####
create or replace function public.create_organizer_application_after_email_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb := new.raw_user_meta_data;
begin
  if metadata ->> 'registration_type' <> 'organizer'
    or nullif(trim(metadata ->> 'organization_name'), '') is null then
    return new;
  end if;

  insert into public.organizer_applications (
    user_id,
    organization_name,
    organization_type,
    description,
    business_phone,
    business_email,
    website,
    social_links
  )
  values (
    new.id,
    trim(metadata ->> 'organization_name'),
    coalesce(nullif(metadata ->> 'organization_type', ''), 'other'),
    coalesce(metadata ->> 'organization_description', ''),
    coalesce(metadata ->> 'business_phone', ''),
    coalesce(metadata ->> 'business_email', new.email),
    nullif(metadata ->> 'website', ''),
    coalesce(metadata -> 'social_links', '{}'::jsonb)
  )
  on conflict (user_id) where status = 'pending' do nothing;

  return new;
end;
$$;

drop trigger if exists zz_create_organizer_application_after_confirmation on auth.users;
create trigger zz_create_organizer_application_after_confirmation
  after insert on auth.users
  for each row execute procedure public.create_organizer_application_after_email_confirmation();

-- ##### 202610020003_organizer_team_atomic_scanner.sql #####
create table if not exists public.organizer_members (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  member_user_id uuid references public.profiles (id) on delete set null,
  member_email text not null,
  role text not null check (role in ('manager', 'scanner', 'cashier', 'staff')),
  permissions jsonb not null default '{}'::jsonb,
  status text not null default 'invited' check (status in ('invited', 'active', 'disabled')),
  invited_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(permissions) = 'object'),
  unique (owner_user_id, member_email)
);

create index if not exists organizer_members_member_user_idx
  on public.organizer_members (member_user_id, status);

create table if not exists public.ticket_scan_logs (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events (id) on delete cascade,
  ticket_id uuid references public.tickets (id) on delete set null,
  scanned_by uuid not null references public.profiles (id) on delete restrict,
  result text not null check (result in ('valid', 'already_used', 'unknown', 'wrong_event', 'unpaid')),
  scanned_at timestamptz not null default now()
);

create index if not exists ticket_scan_logs_event_time_idx
  on public.ticket_scan_logs (event_id, scanned_at desc);
create index if not exists ticket_scan_logs_member_time_idx
  on public.ticket_scan_logs (scanned_by, scanned_at desc);

alter table public.organizer_members enable row level security;
alter table public.ticket_scan_logs enable row level security;

drop policy if exists "owners and members read team membership" on public.organizer_members;
create policy "owners and members read team membership" on public.organizer_members
  for select to authenticated using (
    owner_user_id = (select auth.uid()) or member_user_id = (select auth.uid())
  );

drop policy if exists "team may read scan activity" on public.ticket_scan_logs;
create policy "team may read scan activity" on public.ticket_scan_logs
  for select to authenticated using (
    scanned_by = (select auth.uid())
    or (select public.is_admin())
    or exists (
      select 1 from public.events e
      where e.id = event_id
        and (
          e.organizer_id = (select auth.uid())
          or exists (
            select 1 from public.organizer_members m
            where m.owner_user_id = e.organizer_id
              and m.member_user_id = (select auth.uid())
              and m.status = 'active'
              and (m.role = 'manager' or coalesce((m.permissions ->> 'stats')::boolean, false))
          )
        )
    )
  );

create or replace function public.has_organizer_permission(p_owner_user_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (select public.is_admin())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.id = p_owner_user_id
        and p.role = 'organizer'
    )
    or exists (
      select 1 from public.organizer_members m
      where m.owner_user_id = p_owner_user_id
        and m.member_user_id = (select auth.uid())
        and m.status = 'active'
        and (
          m.role = 'manager'
          or (p_permission = 'scan' and m.role = 'scanner')
          or (p_permission = 'sales' and m.role = 'cashier')
          or coalesce((m.permissions ->> p_permission)::boolean, false)
        )
    );
$$;

revoke all on function public.has_organizer_permission(uuid, text) from public, anon;
grant execute on function public.has_organizer_permission(uuid, text) to authenticated;

create or replace function public.manage_organizer_member(
  p_email text,
  p_role text,
  p_permissions jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  target_user_id uuid;
  member_id uuid;
  normalized_email text := lower(trim(p_email));
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = owner_id and p.role = 'organizer'
  ) then
    raise exception 'Only an approved organizer may manage team members';
  end if;
  if p_role not in ('manager', 'scanner', 'cashier', 'staff') then
    raise exception 'Invalid team role';
  end if;
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid email address';
  end if;
  if jsonb_typeof(coalesce(p_permissions, '{}'::jsonb)) <> 'object'
    or exists (
      select 1 from jsonb_each(coalesce(p_permissions, '{}'::jsonb)) permission
      where permission.key not in ('scan', 'sales', 'stats')
        or jsonb_typeof(permission.value) <> 'boolean'
    ) then
    raise exception 'Invalid permissions';
  end if;

  select u.id into target_user_id
  from auth.users u
  where lower(u.email) = normalized_email;
  if target_user_id is null then
    raise exception 'The team member must create an account before being added';
  end if;
  if target_user_id = owner_id then
    raise exception 'Organizer cannot invite themselves';
  end if;

  insert into public.organizer_members (
    owner_user_id, member_user_id, member_email, role, permissions,
    status, invited_by, updated_at
  ) values (
    owner_id,
    target_user_id,
    normalized_email,
    p_role,
    coalesce(p_permissions, '{}'::jsonb),
    'active',
    owner_id,
    now()
  )
  on conflict (owner_user_id, member_email) do update
    set member_user_id = excluded.member_user_id,
        role = excluded.role,
        permissions = excluded.permissions,
        status = excluded.status,
        invited_by = excluded.invited_by,
        updated_at = now()
  returning id into member_id;

  return member_id;
end;
$$;

create or replace function public.set_organizer_member_status(p_member_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.organizer_members m
    join public.profiles p on p.id = m.owner_user_id
    where m.id = p_member_id
      and m.owner_user_id = auth.uid()
      and p.role = 'organizer'
  ) then
    raise exception 'Team member not found or access denied';
  end if;
  if p_status not in ('active', 'disabled') then
    raise exception 'Invalid team member status';
  end if;

  update public.organizer_members
  set status = p_status, updated_at = now()
  where id = p_member_id and owner_user_id = auth.uid();
end;
$$;

create or replace function public.remove_organizer_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.organizer_members m
    join public.profiles p on p.id = m.owner_user_id
    where m.id = p_member_id
      and m.owner_user_id = auth.uid()
      and p.role = 'organizer'
  ) then
    raise exception 'Team member not found or access denied';
  end if;

  delete from public.organizer_members
  where id = p_member_id and owner_user_id = auth.uid();
end;
$$;

drop trigger if exists attach_organizer_team_membership_after_auth on auth.users;
drop trigger if exists zz_attach_organizer_team_membership_after_auth on auth.users;
drop function if exists public.attach_organizer_team_membership();

create or replace function public.list_scannable_events()
returns table (id text, title text, starts_at timestamptz, venue text)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.title, e.starts_at, e.venue
  from public.events e
  where public.has_organizer_permission(e.organizer_id, 'scan')
  order by e.starts_at desc;
$$;

create or replace function public.scan_ticket(p_code text, p_event_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_row record;
  claimed_ticket_id uuid;
  used_at timestamptz;
  scan_result text;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'denied');
  end if;

  if not exists (
    select 1 from public.events e
    where e.id = p_event_id
      and public.has_organizer_permission(e.organizer_id, 'scan')
  ) then
    return jsonb_build_object('status', 'denied');
  end if;

  select t.id, t.code, t.checked_in_at, t.user_id, tt.name as ticket_type,
         o.status as order_status, e.id as event_id, e.title as event_title,
         e.starts_at, e.venue, p.display_name as buyer_name
  into ticket_row
  from public.tickets t
  join public.orders o on o.id = t.order_id
  join public.ticket_types tt on tt.id = t.ticket_type_id
  join public.events e on e.id = o.event_id
  join public.profiles p on p.id = t.user_id
  where upper(t.code) = upper(trim(p_code))
  limit 1;

  if not found then
    scan_result := 'unknown';
  elsif ticket_row.event_id <> p_event_id then
    scan_result := 'wrong_event';
  elsif ticket_row.order_status <> 'paid' then
    scan_result := 'unpaid';
  else
    update public.tickets
    set checked_in_at = now()
    where id = ticket_row.id and checked_in_at is null
    returning id into claimed_ticket_id;

    if claimed_ticket_id is null then
      scan_result := 'already_used';
      select t.checked_in_at into used_at
      from public.tickets t
      where t.id = ticket_row.id;
    else
      scan_result := 'valid';
    end if;
  end if;

  insert into public.ticket_scan_logs (event_id, ticket_id, scanned_by, result)
  values (
    p_event_id,
    case when ticket_row.id is null then null else ticket_row.id end,
    auth.uid(),
    scan_result
  );

  if scan_result = 'valid' then
    return jsonb_build_object(
      'status', scan_result,
      'code', ticket_row.code,
      'ticket_type', ticket_row.ticket_type,
      'buyer_name', ticket_row.buyer_name,
      'event_title', ticket_row.event_title,
      'starts_at', ticket_row.starts_at,
      'venue', ticket_row.venue
    );
  end if;

  return jsonb_build_object(
    'status', scan_result,
    'code', upper(trim(p_code)),
    'checked_in_at', coalesce(used_at, ticket_row.checked_in_at)
  );
end;
$$;

revoke all on function public.manage_organizer_member(text, text, jsonb) from public, anon;
revoke all on function public.set_organizer_member_status(uuid, text) from public, anon;
revoke all on function public.remove_organizer_member(uuid) from public, anon;
revoke all on function public.list_scannable_events() from public, anon;
revoke all on function public.scan_ticket(text, text) from public, anon;
grant execute on function public.manage_organizer_member(text, text, jsonb) to authenticated;
grant execute on function public.set_organizer_member_status(uuid, text) to authenticated;
grant execute on function public.remove_organizer_member(uuid) to authenticated;
grant execute on function public.list_scannable_events() to authenticated;
grant execute on function public.scan_ticket(text, text) to authenticated;


-- ##### 202610080001_wallet_credits.sql #####
create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  created_by uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('refund', 'promotion', 'compensation')),
  amount_xof bigint not null check (amount_xof > 0 and amount_xof <= 10000000),
  description text not null check (length(trim(description)) between 1 and 240),
  request_id uuid not null unique,
  created_at timestamptz not null default now()
);

create index wallet_transactions_user_created_idx
  on public.wallet_transactions (user_id, created_at desc);

alter table public.wallet_transactions enable row level security;

revoke update on public.profiles from authenticated;
grant update (display_name, phone, country, city, avatar_url)
  on public.profiles to authenticated;

create policy "users and admins read wallet transactions"
  on public.wallet_transactions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create or replace function public.admin_grant_wallet_credit(
  p_email text,
  p_amount_xof bigint,
  p_kind text,
  p_description text,
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  transaction_id uuid;
  existing_transaction public.wallet_transactions%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only admins may grant wallet credits';
  end if;

  if p_amount_xof is null or p_amount_xof <= 0 or p_amount_xof > 10000000 then
    raise exception 'Credit amount must be between 1 and 10000000 XOF';
  end if;

  if p_kind is null or p_kind not in ('refund', 'promotion', 'compensation') then
    raise exception 'Unsupported wallet credit type';
  end if;

  if nullif(trim(p_description), '') is null or length(trim(p_description)) > 240 then
    raise exception 'A description of at most 240 characters is required';
  end if;

  if p_request_id is null then
    raise exception 'A request ID is required';
  end if;

  select p.id
  into target_user_id
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(p_email));

  if target_user_id is null then
    raise exception 'No account found for this email';
  end if;

  insert into public.wallet_transactions (
    user_id,
    created_by,
    kind,
    amount_xof,
    description,
    request_id
  )
  values (
    target_user_id,
    auth.uid(),
    p_kind,
    p_amount_xof,
    trim(p_description),
    p_request_id
  )
  on conflict (request_id) do nothing
  returning id into transaction_id;

  if transaction_id is null then
    select *
    into existing_transaction
    from public.wallet_transactions
    where request_id = p_request_id;

    if existing_transaction.user_id = target_user_id
      and existing_transaction.created_by = auth.uid()
      and existing_transaction.kind = p_kind
      and existing_transaction.amount_xof = p_amount_xof
      and existing_transaction.description = trim(p_description) then
      return existing_transaction.id;
    end if;

    raise exception 'Request ID has already been used for a different wallet credit';
  end if;

  return transaction_id;
end;
$$;

revoke all on public.wallet_transactions from anon, authenticated;
grant select on public.wallet_transactions to authenticated;
revoke all on function public.admin_grant_wallet_credit(text, bigint, text, text, uuid) from public, anon;
grant execute on function public.admin_grant_wallet_credit(text, bigint, text, text, uuid) to authenticated;


-- ##### 202610140001_events_and_checkout.sql #####
alter table public.events
  add column if not exists program jsonb not null default '[]'::jsonb;

create or replace function public.set_event_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() and new.status <> 'draft' then
    new.status = 'pending';
  end if;
  return new;
end;
$$;

alter table public.orders
  add column if not exists expires_at timestamptz;

alter table public.payments
  drop constraint if exists payments_provider_check;
alter table public.payments
  add constraint payments_provider_check
  check (provider in ('flooz', 'tmoney', 'card', 'cinetpay'));

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types (id) on delete restrict,
  quantity integer not null check (quantity between 1 and 10),
  unit_price_xof bigint not null check (unit_price_xof >= 0),
  created_at timestamptz not null default now(),
  unique (order_id, ticket_type_id)
);

create index if not exists order_items_ticket_type_idx
  on public.order_items (ticket_type_id, created_at desc);

alter table public.order_items enable row level security;

create policy "users read own order items" on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.user_id = (select auth.uid()) or (select public.is_admin()))
    )
  );

create or replace function public.create_organizer_event(
  p_event jsonb,
  p_ticket_types jsonb,
  p_status text default 'pending'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  new_event_id text;
  ticket jsonb;
begin
  if owner_id is null or not exists (
    select 1 from public.profiles p
    where p.id = owner_id and p.role in ('organizer', 'admin')
  ) then
    raise exception 'Only an approved organizer may create an event';
  end if;
  if jsonb_typeof(p_event) <> 'object'
    or jsonb_typeof(p_ticket_types) <> 'array'
    or jsonb_array_length(p_ticket_types) not between 1 and 20
    or p_status not in ('draft', 'pending') then
    raise exception 'Invalid event or ticket data';
  end if;
  if coalesce(trim(p_event ->> 'title'), '') = ''
    or coalesce(trim(p_event ->> 'description'), '') = ''
    or coalesce(trim(p_event ->> 'venue'), '') = ''
    or coalesce(trim(p_event ->> 'address'), '') = ''
    or coalesce(trim(p_event ->> 'district'), '') = ''
    or jsonb_typeof(coalesce(p_event -> 'program', '[]'::jsonb)) <> 'array' then
    raise exception 'Required event details are missing';
  end if;

  insert into public.events (
    organizer_id, category_id, title, description, starts_at, venue, address,
    district, poster_url, program, status
  ) values (
    owner_id,
    p_event ->> 'category_id',
    trim(p_event ->> 'title'),
    trim(p_event ->> 'description'),
    (p_event ->> 'starts_at')::timestamptz,
    trim(p_event ->> 'venue'),
    trim(p_event ->> 'address'),
    trim(p_event ->> 'district'),
    nullif(trim(p_event ->> 'poster_url'), ''),
    coalesce(p_event -> 'program', '[]'::jsonb),
    p_status
  )
  returning id into new_event_id;

  for ticket in select value from jsonb_array_elements(p_ticket_types)
  loop
    if jsonb_typeof(ticket) <> 'object'
      or coalesce(trim(ticket ->> 'name'), '') = ''
      or coalesce((ticket ->> 'price_xof')::bigint, -1) < 0
      or coalesce((ticket ->> 'quota')::integer, 0) < 1
      or jsonb_typeof(coalesce(ticket -> 'perks', '[]'::jsonb)) <> 'array' then
      raise exception 'Invalid ticket category';
    end if;

    insert into public.ticket_types (event_id, name, price_xof, quota, perks)
    values (
      new_event_id,
      trim(ticket ->> 'name'),
      (ticket ->> 'price_xof')::bigint,
      (ticket ->> 'quota')::integer,
      array(select jsonb_array_elements_text(coalesce(ticket -> 'perks', '[]'::jsonb)))
    );
  end loop;

  return new_event_id;
end;
$$;

revoke all on function public.create_organizer_event(jsonb, jsonb, text) from public, anon;
grant execute on function public.create_organizer_event(jsonb, jsonb, text) to authenticated;

create or replace function public.get_public_events(p_event_id text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'title', e.title,
      'category', e.category_id,
      'category_label', c.label,
      'category_emoji', c.emoji,
      'date', to_char(e.starts_at at time zone 'Africa/Lome', 'YYYY-MM-DD'),
      'time', to_char(e.starts_at at time zone 'Africa/Lome', 'HH24:MI'),
      'venue', e.venue,
      'address', e.address,
      'district', e.district,
      'organizer_id', e.organizer_id,
      'organizer_name', coalesce(nullif(p.display_name, ''), oa.organization_name, 'Organisateur'),
      'organizer_verified', oa.verified_at is not null,
      'description', e.description,
      'program', e.program,
      'tiers', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', tt.id,
            'name', tt.name,
            'price', tt.price_xof,
            'quota', tt.quota,
            'sold', (
              select count(*) from public.tickets t
              join public.orders o on o.id = t.order_id
              where t.ticket_type_id = tt.id and o.status = 'paid'
            ),
            'perks', to_jsonb(tt.perks)
          ) order by tt.price_xof, tt.name
        ), '[]'::jsonb)
        from public.ticket_types tt
        where tt.event_id = e.id
      ),
      'featured', e.featured,
      'trending', false,
      'is_new', e.created_at >= now() - interval '7 days',
      'free', exists (
        select 1 from public.ticket_types tt
        where tt.event_id = e.id and tt.price_xof = 0
      ),
      'poster_url', e.poster_url,
      'latitude', coalesce(e.latitude, 6.1319),
      'longitude', coalesce(e.longitude, 1.2228)
    ) order by e.starts_at
  ), '[]'::jsonb)
  from public.events e
  join public.categories c on c.id = e.category_id
  left join public.profiles p on p.id = e.organizer_id
  left join lateral (
    select a.organization_name, a.verified_at
    from public.organizer_applications a
    where a.user_id = e.organizer_id and a.status = 'approved'
    order by a.created_at desc
    limit 1
  ) oa on true
  where e.status = 'published'
    and (p_event_id is null or e.id = p_event_id);
$$;

revoke all on function public.get_public_events(text) from public;
grant execute on function public.get_public_events(text) to anon, authenticated;

create or replace function public.create_cinetpay_order(
  p_ticket_type_id uuid,
  p_quantity integer,
  p_transaction_id text
)
returns table (order_id uuid, amount_xof bigint, event_title text, ticket_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  ticket_row public.ticket_types%rowtype;
  event_row public.events%rowtype;
  service_fee constant bigint := 500;
  reserved_count bigint;
  new_order_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_quantity not between 1 and 10
    or p_transaction_id !~ '^[A-Fa-f0-9-]{32,36}$' then
    raise exception 'Invalid ticket quantity or payment transaction ID';
  end if;

  select * into ticket_row
  from public.ticket_types
  where id = p_ticket_type_id
  for update;
  if not found then
    raise exception 'Ticket category not found';
  end if;

  select * into event_row
  from public.events
  where id = ticket_row.event_id and status = 'published';
  if not found then
    raise exception 'Event is not available for purchase';
  end if;

  select count(*) into reserved_count
  from public.tickets t
  join public.orders o on o.id = t.order_id
  where t.ticket_type_id = ticket_row.id and o.status = 'paid';

  select reserved_count + coalesce(sum(oi.quantity), 0) into reserved_count
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.ticket_type_id = ticket_row.id
    and o.status = 'pending'
    and o.created_at > now() - interval '15 minutes';

  if reserved_count + p_quantity > ticket_row.quota then
    raise exception 'Not enough tickets are available';
  end if;

  insert into public.orders (user_id, event_id, total_xof, fees_xof, status, expires_at)
  values (
    current_user_id,
    event_row.id,
    ticket_row.price_xof * p_quantity + service_fee,
    service_fee,
    'pending',
    now() + interval '15 minutes'
  )
  returning id into new_order_id;

  insert into public.order_items (order_id, ticket_type_id, quantity, unit_price_xof)
  values (new_order_id, ticket_row.id, p_quantity, ticket_row.price_xof);

  insert into public.payments (order_id, provider, provider_reference, amount_xof)
  values (
    new_order_id,
    'cinetpay',
    p_transaction_id,
    ticket_row.price_xof * p_quantity + service_fee
  );

  return query select
    new_order_id,
    ticket_row.price_xof * p_quantity + service_fee,
    event_row.title,
    ticket_row.name;
end;
$$;

revoke all on function public.create_cinetpay_order(uuid, integer, text) from public, anon;
grant execute on function public.create_cinetpay_order(uuid, integer, text) to authenticated;

create or replace function public.fail_cinetpay_order(p_transaction_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.payments p
  set status = 'failed'
  from public.orders o
  where p.order_id = o.id
    and p.provider = 'cinetpay'
    and p.provider_reference = p_transaction_id
    and p.status = 'pending'
    and o.status = 'pending'
    and o.user_id = auth.uid();

  update public.orders o
  set status = 'failed'
  from public.payments p
  where o.id = p.order_id
    and p.provider = 'cinetpay'
    and p.provider_reference = p_transaction_id
    and p.status = 'failed'
    and o.user_id = auth.uid()
    and o.status = 'pending';
end;
$$;

revoke all on function public.fail_cinetpay_order(text) from public, anon;
grant execute on function public.fail_cinetpay_order(text) to authenticated;

create or replace function public.finalize_cinetpay_payment(
  p_transaction_id text,
  p_status text,
  p_amount_xof bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.payments%rowtype;
  order_row public.orders%rowtype;
  item_row record;
begin
  if p_status not in ('succeeded', 'failed') then
    raise exception 'Invalid payment status';
  end if;

  select * into payment_row
  from public.payments
  where provider = 'cinetpay' and provider_reference = p_transaction_id
  for update;
  if not found then
    raise exception 'Payment transaction not found';
  end if;
  if payment_row.amount_xof <> p_amount_xof then
    raise exception 'Provider amount does not match the order';
  end if;

  select * into order_row
  from public.orders
  where id = payment_row.order_id
  for update;

  if payment_row.status = 'succeeded' and order_row.status = 'paid' then
    return;
  end if;
  if payment_row.status <> 'pending' or order_row.status <> 'pending' then
    return;
  end if;

  if p_status = 'failed' then
    update public.payments set status = 'failed' where id = payment_row.id;
    update public.orders set status = 'failed' where id = order_row.id;
    return;
  end if;

  if order_row.expires_at < now() then
    update public.payments set status = 'failed' where id = payment_row.id;
    update public.orders set status = 'failed' where id = order_row.id;
    return;
  end if;

  update public.payments set status = 'succeeded' where id = payment_row.id;
  update public.orders set status = 'paid' where id = order_row.id;

  for item_row in
    select ticket_type_id, quantity from public.order_items where order_id = order_row.id
  loop
    insert into public.tickets (order_id, user_id, ticket_type_id, code)
    select order_row.id,
      order_row.user_id,
      item_row.ticket_type_id,
      'LE-' || upper(replace(gen_random_uuid()::text, '-', ''))
    from generate_series(1, item_row.quantity);
  end loop;
end;
$$;

revoke all on function public.finalize_cinetpay_payment(text, text, bigint) from public, anon, authenticated;
grant execute on function public.finalize_cinetpay_payment(text, text, bigint) to service_role;

create or replace function public.get_my_tickets()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'code', ticket_rows.code,
      'event_id', ticket_rows.event_id,
      'tier_name', ticket_rows.tier_name,
      'price', ticket_rows.price,
      'qty', 1,
      'fees', ticket_rows.fees,
      'buyer_name', ticket_rows.buyer_name,
      'purchased_at', ticket_rows.purchased_at,
      'used', ticket_rows.used
    ) order by ticket_rows.purchased_at desc, ticket_rows.created_at desc
  ), '[]'::jsonb)
  from (
    select
      t.code,
      tt.event_id,
      tt.name as tier_name,
      oi.unit_price_xof as price,
      case when row_number() over (partition by o.id order by t.created_at, t.id) = 1 then o.fees_xof else 0 end as fees,
      coalesce(nullif(p.display_name, ''), 'Participant') as buyer_name,
      o.created_at as purchased_at,
      t.created_at,
      t.checked_in_at is not null as used
    from public.tickets t
    join public.orders o on o.id = t.order_id
    join public.order_items oi on oi.order_id = o.id and oi.ticket_type_id = t.ticket_type_id
    join public.ticket_types tt on tt.id = t.ticket_type_id
    join public.profiles p on p.id = t.user_id
    where t.user_id = (select auth.uid())
      and o.status = 'paid'
  ) ticket_rows;
$$;

revoke all on function public.get_my_tickets() from public, anon;
grant execute on function public.get_my_tickets() to authenticated;

-- ##### 202610150001_wallet_payment_checkout.sql #####
alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_kind_check;

alter table public.wallet_transactions
  add constraint wallet_transactions_kind_check
  check (kind in ('refund', 'promotion', 'compensation', 'payment'));

alter table public.payments
  drop constraint if exists payments_provider_check;

alter table public.payments
  add constraint payments_provider_check
  check (provider in ('flooz', 'tmoney', 'card', 'cinetpay', 'wallet'));

create or replace function public.get_wallet_balance()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    sum(case when kind in ('refund', 'promotion', 'compensation') then amount_xof else -amount_xof end),
    0
  )::bigint
  from public.wallet_transactions
  where user_id = auth.uid();
$$;

revoke all on function public.get_wallet_balance() from public, anon;
grant execute on function public.get_wallet_balance() to authenticated;

create or replace function public.pay_order_with_wallet(
  p_ticket_type_id uuid,
  p_quantity integer,
  p_request_id uuid default gen_random_uuid()
)
returns table (order_id uuid, total_paid_xof bigint, ticket_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  ticket_row public.ticket_types%rowtype;
  event_row public.events%rowtype;
  service_fee constant bigint := 500;
  total_needed bigint;
  current_balance bigint;
  reserved_count bigint;
  new_order_id uuid;
  item_row record;
begin
  if current_user_id is null then
    raise exception 'Connexion requise pour payer avec vos crédits';
  end if;
  if p_quantity not between 1 and 10 then
    raise exception 'Quantité de billets invalide (entre 1 et 10)';
  end if;
  if p_request_id is null then
    p_request_id := gen_random_uuid();
  end if;

  select * into ticket_row
  from public.ticket_types
  where id = p_ticket_type_id
  for update;
  if not found then
    raise exception 'Catégorie de billet introuvable';
  end if;

  select * into event_row
  from public.events
  where id = ticket_row.event_id and status = 'published';
  if not found then
    raise exception 'Cet événement n’est pas disponible à l’achat';
  end if;

  select count(*) into reserved_count
  from public.tickets t
  join public.orders o on o.id = t.order_id
  where t.ticket_type_id = ticket_row.id and o.status = 'paid';

  select reserved_count + coalesce(sum(oi.quantity), 0) into reserved_count
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.ticket_type_id = ticket_row.id
    and o.status = 'pending'
    and o.created_at > now() - interval '15 minutes';

  if reserved_count + p_quantity > ticket_row.quota then
    raise exception 'Stock insuffisant pour cette catégorie de billet';
  end if;

  total_needed := ticket_row.price_xof * p_quantity + service_fee;

  select coalesce(
    sum(case when kind in ('refund', 'promotion', 'compensation') then amount_xof else -amount_xof end),
    0
  ) into current_balance
  from public.wallet_transactions
  where user_id = current_user_id;

  if current_balance < total_needed then
    raise exception 'Solde de crédits insuffisant (% XOF nécessaires, solde disponible: % XOF)', total_needed, current_balance;
  end if;

  insert into public.wallet_transactions (
    user_id,
    created_by,
    kind,
    amount_xof,
    description,
    request_id
  ) values (
    current_user_id,
    current_user_id,
    'payment',
    total_needed,
    'Achat ' || p_quantity || 'x ' || ticket_row.name || ' · ' || event_row.title,
    p_request_id
  );

  insert into public.orders (user_id, event_id, total_xof, fees_xof, status)
  values (
    current_user_id,
    event_row.id,
    total_needed,
    service_fee,
    'paid'
  )
  returning id into new_order_id;

  insert into public.order_items (order_id, ticket_type_id, quantity, unit_price_xof)
  values (new_order_id, ticket_row.id, p_quantity, ticket_row.price_xof);

  insert into public.payments (order_id, provider, provider_reference, amount_xof, status)
  values (
    new_order_id,
    'wallet',
    p_request_id::text,
    total_needed,
    'succeeded'
  );

  for item_row in
    select ticket_type_id, quantity from public.order_items where order_id = new_order_id
  loop
    insert into public.tickets (order_id, user_id, ticket_type_id, code)
    select new_order_id,
      current_user_id,
      item_row.ticket_type_id,
      'LE-' || upper(replace(gen_random_uuid()::text, '-', ''))
    from generate_series(1, item_row.quantity);
  end loop;

  insert into public.notifications (user_id, title, body)
  values (
    current_user_id,
    'Billet(s) réservé(s) avec succès !',
    'Votre commande pour "' || event_row.title || '" (' || p_quantity || 'x ' || ticket_row.name || ') a été réglée avec vos crédits Lomé Events.'
  );

  return query select new_order_id, total_needed, p_quantity;
end;
$$;

revoke all on function public.pay_order_with_wallet(uuid, integer, uuid) from public, anon;
grant execute on function public.pay_order_with_wallet(uuid, integer, uuid) to authenticated;

-- ##### 202610160001_event_posters_storage.sql #####
insert into storage.buckets (id, name, public)
values ('posters', 'posters', true)
on conflict (id) do nothing;

create policy "Event posters are publicly readable"
  on storage.objects for select
  using (bucket_id = 'posters');

create policy "Authenticated organizers can upload event posters"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'posters');

create policy "Authenticated organizers can update their event posters"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'posters');
