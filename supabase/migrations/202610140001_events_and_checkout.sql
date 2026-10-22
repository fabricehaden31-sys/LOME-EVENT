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
