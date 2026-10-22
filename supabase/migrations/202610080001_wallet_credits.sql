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
