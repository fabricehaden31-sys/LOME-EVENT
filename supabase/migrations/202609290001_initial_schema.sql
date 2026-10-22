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
  ('concerts', 'Concerts', '🎵', 1),
  ('soirees', 'Soirées', '🎉', 2),
  ('sport', 'Sport', '🏆', 3),
  ('business', 'Business', '💼', 4),
  ('formations', 'Formations', '🎓', 5),
  ('culture', 'Culture', '🎭', 6),
  ('festivals', 'Festivals', '🎪', 7),
  ('famille', 'Famille', '👨‍👩‍👧', 8),
  ('networking', 'Networking', '🌐', 9)
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