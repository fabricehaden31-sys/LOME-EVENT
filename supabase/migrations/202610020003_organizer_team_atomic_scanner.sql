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
