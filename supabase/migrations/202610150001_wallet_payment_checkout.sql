-- ============================================================
-- Lomé Events — Wallet payment at checkout
-- Migration: 202610150001_wallet_payment_checkout.sql
-- Enables users to spend their Lomé Events credits directly
-- at checkout to purchase event tickets atomically.
-- ============================================================

-- 1. Allow 'payment' kind in wallet_transactions
alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_kind_check;

alter table public.wallet_transactions
  add constraint wallet_transactions_kind_check
  check (kind in ('refund', 'promotion', 'compensation', 'payment'));

-- 2. Allow 'wallet' as a payment provider
alter table public.payments
  drop constraint if exists payments_provider_check;

alter table public.payments
  add constraint payments_provider_check
  check (provider in ('flooz', 'tmoney', 'card', 'cinetpay', 'wallet'));

-- 3. Function to get the authenticated user's current wallet balance
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

-- 4. Atomically pay for an order using wallet credits
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

  -- Lock ticket row to prevent race conditions on quota
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

  -- Check available quota
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

  -- Check user wallet balance
  select coalesce(
    sum(case when kind in ('refund', 'promotion', 'compensation') then amount_xof else -amount_xof end),
    0
  ) into current_balance
  from public.wallet_transactions
  where user_id = current_user_id;

  if current_balance < total_needed then
    raise exception 'Solde de crédits insuffisant (% XOF nécessaires, solde disponible: % XOF)', total_needed, current_balance;
  end if;

  -- Insert debit transaction in user's wallet
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

  -- Create paid order directly
  insert into public.orders (user_id, event_id, total_xof, fees_xof, status)
  values (
    current_user_id,
    event_row.id,
    total_needed,
    service_fee,
    'paid'
  )
  returning id into new_order_id;

  -- Insert order item
  insert into public.order_items (order_id, ticket_type_id, quantity, unit_price_xof)
  values (new_order_id, ticket_row.id, p_quantity, ticket_row.price_xof);

  -- Record succeeded payment via wallet
  insert into public.payments (order_id, provider, provider_reference, amount_xof, status)
  values (
    new_order_id,
    'wallet',
    p_request_id::text,
    total_needed,
    'succeeded'
  );

  -- Issue tickets atomically
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

  -- Send in-app notification to user
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
