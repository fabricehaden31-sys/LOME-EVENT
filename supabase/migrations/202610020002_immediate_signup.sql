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