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
    'Demande organisateur approuvée',
    'Votre compte organisateur est activé. Vous pouvez accéder à votre espace organisateur.'
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
    'Demande organisateur refusée',
    'Votre demande a été refusée. Motif : ' || trim(p_reason)
  );
end;
$$;

revoke all on function public.approve_organizer_application(uuid) from public, anon;
revoke all on function public.reject_organizer_application(uuid, text) from public, anon;
grant execute on function public.approve_organizer_application(uuid) to authenticated;
grant execute on function public.reject_organizer_application(uuid, text) to authenticated;