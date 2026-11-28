-- SABAii หลังบ้าน ขั้น 3 (0.15): ระบบผู้ใช้เต็มรูปแบบ
--
--   profiles          1 แถวต่อ 1 บัญชี · สร้างเองตอนสมัคร (trigger บน auth.users) · ชื่อ/รูปดึงจาก Google/Facebook/Apple ครั้งแรก
--                     ผู้ใช้แก้ได้แค่: display_name avatar_url locale timezone onboarded_at terms_version terms_accepted_at
--                     role (user|admin) แก้ได้จาก SQL/แดชบอร์ดเท่านั้น
--   account_events    ประวัติบัญชี (สมัคร · เข้าสู่ระบบ · ผูกวิธีเข้าใหม่) ผู้ใช้เห็นของตัวเอง · ลบเองหลัง 180 วัน
--   private.deleted_accounts  สถิติการลบบัญชี ไม่มีข้อมูลส่วนตัว (ไม่มีอีเมล/ชื่อ/id) — ไว้ดูว่าทำไมคนเลิกใช้
--   delete_my_account(p_reason)  ลบบัญชี + เก็บเหตุผล (ไม่ใส่ก็ได้ — แอปเดิมเรียกแบบไม่มีพารามิเตอร์ยังใช้ได้)
--   touch_last_seen()  แอปเรียกตอนเปิด → รู้ว่าใครยัง active (เขียนจริงอย่างมาก 1 ครั้ง / 10 นาที)
--   admin_user_stats() ตัวเลขภาพรวม (แอดมินเท่านั้น)
--   custom_access_token_hook  ใส่ app_role ใน JWT — ต้องเปิดเองที่ Authentication → Hooks (ไม่เปิดก็ไม่มีอะไรพัง)
--
-- กันพัง: trigger บน auth.users ห่อด้วย exception — ถ้าเขียนโปรไฟล์ไม่ได้ การเข้าสู่ระบบยังผ่าน (แค่ log warning)

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id                uuid        primary key references auth.users (id) on delete cascade,
  email             text,
  display_name      text        check (display_name is null or char_length(display_name) between 1 and 60),
  avatar_url        text        check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) < 1000)),
  providers         text[]      not null default '{}',
  locale            text        not null default 'th' check (locale in ('th', 'en')),
  timezone          text        not null default 'Asia/Bangkok' check (char_length(timezone) < 64),
  role              text        not null default 'user' check (role in ('user', 'admin')),
  onboarded_at      timestamptz,
  terms_version     text        check (terms_version is null or char_length(terms_version) <= 20),
  terms_accepted_at timestamptz,
  sign_in_count     integer     not null default 0,
  last_sign_in_at   timestamptz,
  last_seen_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.profiles is 'SABAii: one row per account, created by trigger on auth.users. Users may update only display/preference columns (column grants).';

create index if not exists profiles_last_seen on public.profiles (last_seen_at desc);
create index if not exists profiles_created on public.profiles (created_at desc);

alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, locale, timezone, onboarded_at, terms_version, terms_accepted_at) on public.profiles to authenticated;

-- แอดมินไหม (อ่านจากตาราง ไม่พึ่ง JWT hook) · security definer = ไม่วนเข้า RLS ของ profiles เอง
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.role = 'admin' from public.profiles p where p.id = (select auth.uid())), false);
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
-- ไม่มี policy insert/delete: สร้างด้วย trigger · ลบตาม auth.users (cascade)

-- ก่อนแก้ทุกครั้ง: ตัดช่องว่างชื่อ · เขตเวลาต้องมีจริง · updated_at · ย้อนเวลา onboarded/terms ไปอนาคตไม่ได้
create or replace function private.profiles_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.display_name := nullif(btrim(regexp_replace(new.display_name, '\s+', ' ', 'g')), '');
  if new.timezone is distinct from old.timezone
     and not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'unknown timezone: %', new.timezone using errcode = '22023';
  end if;
  if new.onboarded_at > now() + interval '5 minutes' then new.onboarded_at := now(); end if;
  if new.terms_accepted_at > now() + interval '5 minutes' then new.terms_accepted_at := now(); end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_before_update on public.profiles;
create trigger profiles_before_update before update on public.profiles
  for each row execute function private.profiles_before_update();

-- ---------------------------------------------------------------- account_events
create table if not exists public.account_events (
  id         bigint      generated always as identity primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  type       text        not null check (type in ('sign_up', 'sign_in', 'provider_linked', 'email_changed')),
  provider   text        check (provider is null or char_length(provider) <= 30),
  created_at timestamptz not null default now()
);
comment on table public.account_events is 'SABAii: account history (sign-up, sign-in, linked providers). Users read their own; written only by triggers; purged after 180 days.';

create index if not exists account_events_user_time on public.account_events (user_id, created_at desc);
create index if not exists account_events_time on public.account_events (created_at);

alter table public.account_events enable row level security;
revoke all on public.account_events from anon, authenticated;
grant select on public.account_events to authenticated;

drop policy if exists "account_events: read own or admin" on public.account_events;
create policy "account_events: read own or admin" on public.account_events
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- ---------------------------------------------------------------- sync จาก auth.users
create or replace function private.meta_name(meta jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(left(btrim(coalesce(meta->>'full_name', meta->>'name', '')), 60), '');
$$;

create or replace function private.meta_avatar(meta jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when u ~ '^https://' and char_length(u) < 1000 then u end
  from (select coalesce(meta->>'avatar_url', meta->>'picture') as u) x;
$$;

create or replace function private.meta_providers(meta jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (select array_agg(distinct p order by p) from jsonb_array_elements_text(
       case when jsonb_typeof(meta->'providers') = 'array' then meta->'providers' else '[]'::jsonb end) p),
    case when meta->>'provider' is not null then array[meta->>'provider'] else '{}'::text[] end);
$$;

create or replace function private.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into public.profiles (id, email, display_name, avatar_url, providers, sign_in_count, last_sign_in_at, created_at)
    values (new.id, new.email, private.meta_name(new.raw_user_meta_data), private.meta_avatar(new.raw_user_meta_data),
            private.meta_providers(new.raw_app_meta_data),
            case when new.last_sign_in_at is not null then 1 else 0 end, new.last_sign_in_at, coalesce(new.created_at, now()))
    on conflict (id) do nothing;
    insert into public.account_events (user_id, type, provider)
    values (new.id, 'sign_up', new.raw_app_meta_data->>'provider');
  exception when others then
    raise warning 'sabaii: profile for % not created: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

create or replace function private.on_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_providers text[] := private.meta_providers(new.raw_app_meta_data);
  old_providers text[] := private.meta_providers(old.raw_app_meta_data);
  signed_in boolean := new.last_sign_in_at is not null and new.last_sign_in_at is distinct from old.last_sign_in_at;
  p text;
begin
  begin
    -- โปรไฟล์หาย (เช่นบัญชีเก่าก่อน migration นี้) → สร้างใหม่ก่อน
    insert into public.profiles (id, email, display_name, avatar_url, providers, created_at)
    values (new.id, new.email, private.meta_name(new.raw_user_meta_data), private.meta_avatar(new.raw_user_meta_data),
            new_providers, coalesce(new.created_at, now()))
    on conflict (id) do nothing;

    update public.profiles pr set
      email           = new.email,
      providers       = new_providers,
      -- ชื่อ/รูปที่ผู้ใช้ตั้งเองไม่ถูกทับ · ว่างอยู่ถึงจะเติมจากผู้ให้บริการ
      display_name    = coalesce(pr.display_name, private.meta_name(new.raw_user_meta_data)),
      avatar_url      = coalesce(pr.avatar_url, private.meta_avatar(new.raw_user_meta_data)),
      sign_in_count   = pr.sign_in_count + case when signed_in then 1 else 0 end,
      last_sign_in_at = case when signed_in then new.last_sign_in_at else pr.last_sign_in_at end,
      last_seen_at    = case when signed_in then greatest(pr.last_seen_at, new.last_sign_in_at) else pr.last_seen_at end
    where pr.id = new.id;

    if signed_in then
      insert into public.account_events (user_id, type, provider) values (new.id, 'sign_in', new.raw_app_meta_data->>'provider');
    end if;
    for p in select unnest(new_providers) except select unnest(old_providers) loop
      insert into public.account_events (user_id, type, provider) values (new.id, 'provider_linked', p);
    end loop;
    if new.email is distinct from old.email and old.email is not null then
      insert into public.account_events (user_id, type) values (new.id, 'email_changed');
    end if;
  exception when others then
    raise warning 'sabaii: profile sync for % failed: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function private.on_auth_user_created(), private.on_auth_user_updated() from public, anon, authenticated;

drop trigger if exists sabaii_on_auth_user_created on auth.users;
create trigger sabaii_on_auth_user_created after insert on auth.users
  for each row execute function private.on_auth_user_created();

drop trigger if exists sabaii_on_auth_user_updated on auth.users;
create trigger sabaii_on_auth_user_updated
  after update of email, last_sign_in_at, raw_app_meta_data, raw_user_meta_data on auth.users
  for each row execute function private.on_auth_user_updated();

-- บัญชีที่มีอยู่แล้ว
insert into public.profiles (id, email, display_name, avatar_url, providers, sign_in_count, last_sign_in_at, last_seen_at, created_at)
select u.id, u.email, private.meta_name(u.raw_user_meta_data), private.meta_avatar(u.raw_user_meta_data),
       private.meta_providers(u.raw_app_meta_data),
       case when u.last_sign_in_at is not null then 1 else 0 end, u.last_sign_in_at, u.last_sign_in_at, coalesce(u.created_at, now())
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------- เปิดแอป = ยัง active
create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set last_seen_at = now()
  where id = (select auth.uid()) and (last_seen_at is null or last_seen_at < now() - interval '10 minutes');
$$;
revoke all on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

-- ---------------------------------------------------------------- ลบบัญชี (แทนของขั้น 1 · เพิ่มเหตุผล ไม่บังคับ)
create table if not exists private.deleted_accounts (
  id               bigint      generated always as identity primary key,
  deleted_at       timestamptz not null default now(),
  account_age_days integer,
  providers        text[],
  items_count      integer,
  reason           text        check (reason is null or char_length(reason) <= 500)
);
comment on table private.deleted_accounts is 'SABAii: anonymous stats about deleted accounts (no email, name or user id).';
revoke all on private.deleted_accounts from public, anon, authenticated;

drop function if exists public.delete_my_account();
create or replace function public.delete_my_account(p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  insert into private.deleted_accounts (account_age_days, providers, items_count, reason)
  select (now()::date - u.created_at::date), private.meta_providers(u.raw_app_meta_data),
         (select count(*) from public.items i where i.user_id = uid and not i.deleted),
         nullif(left(btrim(p_reason), 500), '')
  from auth.users u where u.id = uid;
  delete from auth.users where id = uid; -- profiles · items · account_events · push_subs หายตาม (cascade)
end;
$$;
revoke all on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;

-- ---------------------------------------------------------------- แอดมิน
create or replace function public.admin_user_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'users',          (select count(*) from public.profiles),
    'new_7d',         (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'active_1d',      (select count(*) from public.profiles where last_seen_at > now() - interval '1 day'),
    'active_7d',      (select count(*) from public.profiles where last_seen_at > now() - interval '7 days'),
    'active_30d',     (select count(*) from public.profiles where last_seen_at > now() - interval '30 days'),
    'onboarded',      (select count(*) from public.profiles where onboarded_at is not null),
    'by_provider',    (select coalesce(jsonb_object_agg(p, n), '{}'::jsonb)
                       from (select unnest(providers) p, count(*) n from public.profiles group by 1) x),
    'deleted_30d',    (select count(*) from private.deleted_accounts where deleted_at > now() - interval '30 days'),
    'items',          (select count(*) from public.items where not deleted)
  );
end;
$$;
revoke all on function public.admin_user_stats() from public, anon;
grant execute on function public.admin_user_stats() to authenticated;

-- ---------------------------------------------------------------- JWT hook (เปิดเองที่ Authentication → Hooks → Customize Access Token)
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  claims jsonb := coalesce(event->'claims', '{}'::jsonb);
  r text;
begin
  select p.role into r from public.profiles p where p.id = (event->>'user_id')::uuid;
  claims := jsonb_set(claims, '{app_role}', to_jsonb(coalesce(r, 'user')));
  return jsonb_set(event, '{claims}', claims);
end;
$$;
revoke all on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant select (id, role) on public.profiles to supabase_auth_admin;
drop policy if exists "profiles: auth hook reads role" on public.profiles;
create policy "profiles: auth hook reads role" on public.profiles
  for select to supabase_auth_admin using (true);

-- ---------------------------------------------------------------- ล้างประวัติเก่า (ทุกคืน 03:17 เวลาไทย)
create extension if not exists pg_cron;
select cron.unschedule('sabaii-purge-account-events') where exists (select 1 from cron.job where jobname = 'sabaii-purge-account-events');
select cron.schedule('sabaii-purge-account-events', '17 20 * * *',
  $$delete from public.account_events where created_at < now() - interval '180 days'$$);
