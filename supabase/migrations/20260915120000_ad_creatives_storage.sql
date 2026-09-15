-- Caption Fox — Advertising creative uploads
--
-- Private bucket for ad creative assets (images and video). Paths are
-- `{workspace_id}/{upload_id}/{file}`; the policies read the first path
-- segment so a member can only reach their own workspace's files. The bucket
-- is private: every read goes through a short-lived signed URL.
--
-- Rollback: delete the three policies below, then (once emptied)
--   delete from storage.buckets where id = 'ad-creatives';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ad-creatives', 'ad-creatives', false, 209715200,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ad_creatives_member_read" on storage.objects;
create policy "ad_creatives_member_read" on storage.objects for select using (
  bucket_id = 'ad-creatives'
  and (storage.foldername(name))[1] in (
    select workspace_id::text from public.workspace_members where user_id = auth.uid()
  )
);

drop policy if exists "ad_creatives_member_write" on storage.objects;
create policy "ad_creatives_member_write" on storage.objects for insert with check (
  bucket_id = 'ad-creatives'
  and (storage.foldername(name))[1] in (
    select workspace_id::text from public.workspace_members where user_id = auth.uid()
  )
);

drop policy if exists "ad_creatives_member_delete" on storage.objects;
create policy "ad_creatives_member_delete" on storage.objects for delete using (
  bucket_id = 'ad-creatives'
  and (storage.foldername(name))[1] in (
    select workspace_id::text from public.workspace_members where user_id = auth.uid()
  )
);
