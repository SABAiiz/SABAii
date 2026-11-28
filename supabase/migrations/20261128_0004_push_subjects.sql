-- SABAii 0.16: แจ้งเตือน "ตั้งเวลารายวิชา" (เจ้าของขอ 28 พ.ย. 69: ง่ายที่สุด บอกเวลาแล้วเตือนตามนั้น แยกแต่ละวิชา)
--   เวลาอยู่ในข้อมูลของบัญชี (ซิงก์ผ่าน items อยู่แล้ว → ทุกเครื่องของบัญชีเดียวกันได้เวลาเดียวกัน):
--     วิชา   items(kind='subject').data.remind_at = 'HH:MM' | 'off' · ไม่มีค่า = 19:00
--     งานไม่มีวิชา (หรือวิชาถูกซ่อน/ลบ)   items(kind='pref', id='remind_none').data.value = 'HH:MM' | 'off' · ไม่มีค่า = 19:00
--   ถึงเวลาของวิชาไหน → เตือนงานที่ยังไม่เสร็จของวิชานั้น: เลยกำหนด (ไม่เกิน 14 วัน) · ส่งวันนี้/พรุ่งนี้ · สอบภายใน 3 วัน
--   ไม่มีงาน = ไม่เตือน · ส่งไปทุกเครื่องที่เปิดแจ้งเตือนของบัญชีนั้น · 1 วิชา / 1 ครั้ง / 1 วัน (push_sent)
--   push_subs.remind_at / last_sent (แบบเวลาเดียวของ 0.14–0.15) เลิกใช้แล้ว — คงคอลัมน์ไว้ ไม่มีใครอ่าน

create table if not exists public.push_sent (
  user_id    uuid not null references auth.users (id) on delete cascade,
  slot       text not null check (char_length(slot) between 1 and 90), -- id ของวิชา หรือ '_none'
  local_date date not null,
  sent_at    timestamptz not null default now(),
  primary key (user_id, slot, local_date)
);
alter table public.push_sent enable row level security; -- ไม่มี policy: ใช้ผ่านฟังก์ชันของ service_role เท่านั้น
revoke all on public.push_sent from anon, authenticated;

-- แปลงวันที่จากข้อมูลผู้ใช้แบบไม่ล้ม (ค่าแปลก = null · ไม่ทำให้ทั้งรอบพัง)
create or replace function private.try_date(p text)
returns date language plpgsql immutable set search_path = '' as $$
begin
  if p is null or p !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return p::date;
exception when others then return null;
end $$;

drop function if exists public.push_due(timestamptz);
drop function if exists public.push_mark(text[], timestamptz);

-- วิชาที่ถึงเวลาเตือนแล้ววันนี้ (เวลาท้องถิ่นของเครื่องล่าสุดของบัญชี) + งานที่ต้องเตือน + เครื่องที่ต้องส่ง
-- เลยเวลามาไม่เกิน 3 ชั่วโมงก็ยังส่ง (เผื่อรอบไหนพลาด) · เคยส่ง/เช็กแล้ววันนี้ = ข้าม
create function public.push_due(p_now timestamptz default now())
returns table (user_id uuid, slot text, subject text, local_date date, tasks jsonb, subs jsonb)
language sql security definer set search_path = '' stable as $$
  with u as (
    select distinct on (ps.user_id) ps.user_id, (p_now at time zone ps.tz) as local_ts
    from public.push_subs ps order by ps.user_id, ps.updated_at desc
  ), shown as (   -- วิชาที่แสดงอยู่ (ไม่ถูกซ่อน/ลบ)
    select sj.user_id, sj.id, sj.data
    from public.items sj join u on u.user_id = sj.user_id
    where sj.kind = 'subject' and not sj.deleted and coalesce(sj.data->>'hidden', 'false') <> 'true'
  ), slots as (
    select u.user_id, u.local_ts, s.id as slot, s.data->>'name' as subject, coalesce(s.data->>'remind_at', '19:00') as at
    from u join shown s on s.user_id = u.user_id
    union all
    select u.user_id, u.local_ts, '_none', null,
      coalesce((select p.data->>'value' from public.items p where p.user_id = u.user_id and p.kind = 'pref' and p.id = 'remind_none' and not p.deleted), '19:00')
    from u
  ), ready as (
    select s.*, s.local_ts::date as d from slots s
    where s.at ~ '^([01]\d|2[0-3]):[0-5]\d$'
      and (s.local_ts::time - s.at::time) >= interval '0'        -- time - time = interval (ไม่วนข้ามเที่ยงคืน)
      and (s.local_ts::time - s.at::time) < interval '3 hours'
      and not exists (select 1 from public.push_sent x where x.user_id = s.user_id and x.slot = s.slot and x.local_date = s.local_ts::date)
  )
  select r.user_id, r.slot, r.subject, r.d,
    coalesce((
      select jsonb_agg(jsonb_build_object('title', t.data->>'title', 'type', t.data->>'type', 'time', t.data->>'due_time',
                                          'days', private.try_date(t.data->>'due_date') - r.d)
                       order by private.try_date(t.data->>'due_date'), t.data->>'due_time' nulls last, t.data->>'title')
      from public.items t
      where t.user_id = r.user_id and t.kind = 'task' and not t.deleted
        and t.data->>'deleted_at' is null and coalesce(t.data->>'status', 'todo') <> 'done'
        and case when r.slot = '_none'
              then not exists (select 1 from shown s where s.user_id = t.user_id and s.id = t.data->>'subject_id')
              else t.data->>'subject_id' = r.slot end
        and private.try_date(t.data->>'due_date') between r.d - 14 and r.d + case when t.data->>'type' = 'exam' then 3 else 1 end
    ), '[]'::jsonb) as tasks,
    (select jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth))
       from public.push_subs ps where ps.user_id = r.user_id) as subs
  from ready r;
$$;

-- ส่งแล้ว (หรือไม่มีงานให้เตือน) = จดไว้ วันนี้วิชานี้ไม่ส่งอีก · ล้างบันทึกเก่ากว่า 30 วันไปด้วย
create or replace function public.push_mark_sent(p_rows jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.push_sent (user_id, slot, local_date)
  select (x->>'user_id')::uuid, x->>'slot', (x->>'local_date')::date from jsonb_array_elements(p_rows) x
  on conflict do nothing;
  delete from public.push_sent where local_date < current_date - 30;
$$;

revoke all on function public.push_due(timestamptz), public.push_mark_sent(jsonb), private.try_date(text) from public, anon, authenticated;
grant execute on function public.push_due(timestamptz), public.push_mark_sent(jsonb) to service_role;
