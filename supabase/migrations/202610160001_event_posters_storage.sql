-- Migration: 202610160001_event_posters_storage.sql
-- Configure public storage bucket for event posters

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
