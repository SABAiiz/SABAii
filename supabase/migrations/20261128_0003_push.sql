-- SABAii หลังบ้าน ขั้น 3 (0.14): แจ้งเตือนตอนเย็นก่อนวันส่ง (Web Push · เด้งแม้ปิดแอป)
--   push_subs   = เครื่องที่เปิดแจ้งเตือน (1 แถว / 1 เครื่อง) · เวลาเตือน + เขตเวลาของเครื่อง
--   ทุก 5 นาที pg_cron → Edge Function push-reminders → push_due() บอกว่าเครื่องไหนถึงเวลา + งานที่ส่ง/สอบพรุ่งนี้
--   กุญแจ: push_cron_key สร้างในฐานข้อมูล · กุญแจ VAPID ฟังก์ชันสร้างเองครั้งแรก — ทั้งหมดอยู่ใน Vault ไม่อยู่ในโค้ด

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions; -- ไม่ใช่ public (คำแนะนำความปลอดภัยของ Supabase)

create table if not exists public.push_subs (
  endpoint   text primary key check (endpoint like 'https://%' and char_length(endpoint) < 1000),
  user_id    uuid not null references auth.users (id) on delete cascade,
  p256dh     text not null check (char_length(p256dh) < 200),
  auth       text not null check (char_length(auth) < 100),
  tz         text not null default 'Asia/Bangkok',
  remind_at  time not null default '19:00',
  last_sent  date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subs_user on public.push_subs (user_id);
alter table public.push_subs enable row level security; -- ไม่มี policy: เข้าถึงผ่านฟังก์ชันด้านล่างเท่านั้น
revoke all on public.push_subs from anon, authenticated;

-- ---------- ฝั่งแอป (ผู้ใช้ที่เข้าสู่ระบบ) ----------
-- เปิด/อัปเดต: เครื่องนี้เป็นของบัญชีที่เข้าสู่ระบบอยู่ (เปลี่ยนบัญชีในเครื่องเดิม = ย้ายมาเป็นของบัญชีใหม่)
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_tz text default 'Asia/Bangkok', p_remind_at time default '19:00')
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); tz text := coalesce(p_tz, 'Asia/Bangkok');
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = tz) then tz := 'Asia/Bangkok'; end if;
  insert into public.push_subs (endpoint, user_id, p256dh, auth, tz, remind_at)
  values (p_endpoint, uid, p_p256dh, p_auth, tz, coalesce(p_remind_at, '19:00'))
  on conflict (endpoint) do update set user_id = uid, p256dh = excluded.p256dh, auth = excluded.auth,
    tz = excluded.tz, remind_at = excluded.remind_at, updated_at = now(),
    last_sent = case when public.push_subs.remind_at = excluded.remind_at then public.push_subs.last_sent end;
end $$;

-- ปิด: ใครถือ endpoint (= เครื่องนั้นเอง) ก็ลบได้
create or replace function public.push_unsubscribe(p_endpoint text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_subs where endpoint = p_endpoint;
$$;

-- กุญแจสาธารณะ VAPID สำหรับ pushManager.subscribe (เปิดเผยได้)
create or replace function public.push_public_key()
returns text language sql security definer set search_path = '' stable as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_public' limit 1;
$$;

revoke all on function public.push_subscribe(text, text, text, text, time), public.push_unsubscribe(text), public.push_public_key() from public, anon;
grant execute on function public.push_subscribe(text, text, text, text, time), public.push_unsubscribe(text), public.push_public_key() to authenticated;

-- ---------- ฝั่ง Edge Function (service_role เท่านั้น) ----------
create or replace function public.push_config()
returns jsonb language sql security definer set search_path = '' stable as $$
  select jsonb_build_object(
    'cron_key', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_key' limit 1),
    'vapid_public', (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_public' limit 1),
    'vapid_private', (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_private' limit 1));
$$;

-- ครั้งแรก: ฟังก์ชันสร้างกุญแจ VAPID แล้วเก็บไว้ (มีแล้ว = ไม่ทับ)
create or replace function public.push_set_vapid(p_public text, p_private text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from vault.secrets where name = 'push_vapid_private') then return; end if;
  perform vault.create_secret(p_public, 'push_vapid_public', 'SABAii web push public key');
  perform vault.create_secret(p_private, 'push_vapid_private', 'SABAii web push private key');
end $$;

-- เครื่องที่ถึงเวลาเตือนแล้ววันนี้ (ตามเวลาท้องถิ่นของเครื่อง) + งานที่ยังไม่เสร็จที่ส่ง/สอบ "พรุ่งนี้"
-- เลยเวลามาไม่เกิน 3 ชั่วโมงก็ยังส่ง (เผื่อรอบไหนพลาด) · ส่งแล้ววันนี้ = ไม่ส่งซ้ำ
create or replace function public.push_due(p_now timestamptz default now())
returns table (endpoint text, p256dh text, auth text, user_id uuid, tasks jsonb)
language sql security definer set search_path = '' stable as $$
  with s as (
    select ps.*, (p_now at time zone ps.tz) as local_ts
    from public.push_subs ps
  ), ready as (
    select * from s
    where (s.local_ts::time - s.remind_at) >= interval '0'          -- time - time = interval (ไม่วนข้ามเที่ยงคืน)
      and (s.local_ts::time - s.remind_at) < interval '3 hours'
      and (s.last_sent is null or s.last_sent < s.local_ts::date)
  )
  select r.endpoint, r.p256dh, r.auth, r.user_id,
    coalesce((
      select jsonb_agg(jsonb_build_object('title', t.data->>'title', 'type', t.data->>'type', 'time', t.data->>'due_time',
                                          'subject', sj.data->>'name') order by t.data->>'due_time' nulls last, t.data->>'title')
      from public.items t
      left join public.items sj on sj.user_id = t.user_id and sj.kind = 'subject' and sj.id = t.data->>'subject_id' and not sj.deleted
      where t.user_id = r.user_id and t.kind = 'task' and not t.deleted
        and t.data->>'due_date' = to_char(r.local_ts::date + 1, 'YYYY-MM-DD')
        and coalesce(t.data->>'status', 'todo') <> 'done'
        and t.data->>'deleted_at' is null
    ), '[]'::jsonb) as tasks
  from ready r;
$$;

-- ส่งแล้ว (หรือไม่มีอะไรต้องเตือน) = จดวันที่ไว้ วันนี้ไม่ส่งอีก
create or replace function public.push_mark(p_endpoints text[], p_now timestamptz default now())
returns void language sql security definer set search_path = '' as $$
  update public.push_subs set last_sent = (p_now at time zone tz)::date where endpoint = any (p_endpoints);
$$;
-- เครื่องที่ยกเลิกการรับแล้ว (บริการ push ตอบ 404/410) = ลบทิ้ง
create or replace function public.push_drop(p_endpoints text[])
returns void language sql security definer set search_path = '' as $$
  delete from public.push_subs where endpoint = any (p_endpoints);
$$;
-- ปุ่ม "ส่งแจ้งเตือนทดสอบ": เครื่องทั้งหมดของผู้ใช้คนนี้
create or replace function public.push_subs_of(p_user uuid)
returns table (endpoint text, p256dh text, auth text)
language sql security definer set search_path = '' stable as $$
  select endpoint, p256dh, auth from public.push_subs where user_id = p_user;
$$;

revoke all on function public.push_config(), public.push_set_vapid(text, text), public.push_due(timestamptz), public.push_mark(text[], timestamptz),
  public.push_drop(text[]), public.push_subs_of(uuid) from public, anon, authenticated;
grant execute on function public.push_config(), public.push_set_vapid(text, text), public.push_due(timestamptz), public.push_mark(text[], timestamptz),
  public.push_drop(text[]), public.push_subs_of(uuid) to service_role;

-- กุญแจของรอบเวลา (สุ่มในฐานข้อมูล ไม่มีใครเห็น)
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'push_cron_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'push_cron_key', 'SABAii push cron → edge function');
  end if;
end $$;

-- ทุก 5 นาที เรียก Edge Function (0.15: ผู้ใช้ตั้งเวลาเองได้ทุกนาที → ช้าสุด 5 นาที)
select cron.unschedule('sabaii-push-reminders') where exists (select 1 from cron.job where jobname = 'sabaii-push-reminders');
select cron.schedule('sabaii-push-reminders', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://mojdvfzalfemenpxsoub.supabase.co/functions/v1/push-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-key', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_key' limit 1)),
    body := '{"run":"cron"}'::jsonb,
    timeout_milliseconds := 25000);
$$);
