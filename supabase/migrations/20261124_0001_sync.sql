-- SABAii หลังบ้าน ขั้น 1: บัญชี + ซิงก์
-- โปรเจกต์ Supabase "sabaii" (mojdvfzalfemenpxsoub) — แยกจากแอปอื่นทั้งหมด
--
-- แนวคิด: เครื่องเป็นตัวหลัก (ใช้ออฟไลน์ได้) · เซิร์ฟเวอร์เก็บสำเนาทุกแถวเป็น JSON ในตารางเดียว
--   items(user_id, kind, id) — kind = task | subject | attachment | pref
--   seq   = ลำดับการเปลี่ยนแปลงทั้งระบบ เครื่องดึง "ทุกแถวที่ seq > ที่เคยดึงล่าสุด"
--   ชนกัน = ใครแก้ทีหลัง (updated_at ใหม่กว่า) ชนะ · ลบ = deleted true (ไม่ลบแถวจริง ให้เครื่องอื่นรู้)

create sequence if not exists public.items_seq;

create table if not exists public.items (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text        not null check (kind in ('task', 'subject', 'attachment', 'pref')),
  id         text        not null check (char_length(id) between 1 and 80),
  data       jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null,
  seq        bigint      not null default nextval('public.items_seq'),
  primary key (user_id, kind, id),
  check (data is null or pg_column_size(data) < 65536)
);
comment on table public.items is 'SABAii: one row per synced record (task/subject/attachment/pref) per user. Client is source of truth offline; last-writer-wins by updated_at.';

create index if not exists items_user_seq on public.items (user_id, seq);

alter table public.items enable row level security;

drop policy if exists "items: read own" on public.items;
create policy "items: read own" on public.items
  for select to authenticated using (user_id = (select auth.uid()));
-- เขียนผ่าน sync_push เท่านั้น (ไม่มี policy insert/update/delete ตรง)

revoke all on public.items from anon;
grant select on public.items to authenticated;

-- ส่งชุดการเปลี่ยนแปลงขึ้นมา · แถวที่ใหม่กว่าของเดิมเท่านั้นที่ทับ · คืนจำนวนที่รับไว้
create or replace function public.sync_push(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  n integer;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'p_items must be an array'; end if;
  if jsonb_array_length(p_items) > 500 then raise exception 'too many items (max 500)'; end if;
  -- ทีละผู้ใช้ทีละชุด: seq ของผู้ใช้คนเดียวกันเรียงตามลำดับที่บันทึกจริง (เครื่องที่ดึงจะไม่พลาดแถว)
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  with src as (
    select distinct on (x.kind, x.id) x.kind, x.id, x.data, coalesce(x.deleted, false) as deleted, x.updated_at
    from jsonb_to_recordset(p_items) as x(kind text, id text, data jsonb, deleted boolean, updated_at timestamptz)
    where x.kind is not null and x.id is not null and x.updated_at is not null
    order by x.kind, x.id, x.updated_at desc
  ), up as (
    insert into public.items as i (user_id, kind, id, data, deleted, updated_at, seq)
    select uid, s.kind, s.id, case when s.deleted then null else s.data end, s.deleted,
           least(s.updated_at, now() + interval '5 minutes'), nextval('public.items_seq')
    from src s
    on conflict (user_id, kind, id) do update
      set data = excluded.data, deleted = excluded.deleted, updated_at = excluded.updated_at, seq = excluded.seq
      where i.updated_at <= excluded.updated_at
    returning 1
  )
  select count(*) into n from up;
  return n;
end;
$$;

revoke all on function public.sync_push(jsonb) from public, anon;
grant execute on function public.sync_push(jsonb) to authenticated;

-- ลบบัญชีตัวเอง (Google Play / App Store บังคับให้มี) · แถวใน items หายตาม (on delete cascade)
-- รูปใน Storage แอปลบเองก่อนเรียกฟังก์ชันนี้
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- รูปที่แนบกับงาน: attachments/<user_id>/<attachment_id> · ส่วนตัว · ไม่เกิน 5 MB
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "attachments: read own" on storage.objects;
create policy "attachments: read own" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "attachments: insert own" on storage.objects;
create policy "attachments: insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "attachments: update own" on storage.objects;
create policy "attachments: update own" on storage.objects for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "attachments: delete own" on storage.objects;
create policy "attachments: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
