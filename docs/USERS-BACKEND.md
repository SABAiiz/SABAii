# ระบบผู้ใช้ (Supabase "sabaii") — ขั้น 3

Migration: `supabase/migrations/20261128_0003_users.sql` (ขึ้นเซิร์ฟเวอร์แล้ว 28 พ.ย. 2026 ชื่อ `users_profiles`)

## โครง

| ส่วน | หน้าที่ | ใครเห็น/แก้ได้ |
|---|---|---|
| `public.profiles` | 1 แถว/บัญชี สร้างเองตอนสมัคร (trigger บน `auth.users`) · ชื่อ/รูปจาก Google/Facebook/Apple ครั้งแรก · อีเมล + วิธีเข้า (providers) ตามบัญชีเสมอ · นับการเข้าสู่ระบบ · `last_seen_at` | อ่าน: เจ้าของ + แอดมิน · แก้: เจ้าของ เฉพาะ `display_name avatar_url locale timezone onboarded_at terms_version terms_accepted_at` |
| `public.account_events` | ประวัติ: `sign_up` `sign_in` `provider_linked` `email_changed` · ล้างเองหลัง 180 วัน (pg_cron `sabaii-purge-account-events`) | อ่าน: เจ้าของ + แอดมิน · เขียน: trigger เท่านั้น |
| `private.deleted_accounts` | สถิติการลบบัญชี (อายุบัญชี · วิธีเข้า · จำนวนงาน · เหตุผล) ไม่มีอีเมล/ชื่อ/id | ไม่มีใครอ่านผ่าน API (ดูใน SQL editor) |
| `delete_my_account(p_reason?)` | ลบบัญชี + ข้อมูลทั้งหมด (cascade) · เหตุผลไม่บังคับ | ผู้ใช้ที่เข้าสู่ระบบ |
| `touch_last_seen()` | เรียกตอนเปิดแอป → รู้ว่าใคร active (เขียนจริงอย่างมาก 1 ครั้ง/10 นาที) | ผู้ใช้ที่เข้าสู่ระบบ |
| `admin_user_stats()` | ผู้ใช้ทั้งหมด · ใหม่ 7 วัน · active 1/7/30 วัน · ทำแบบสอบถามแล้ว · แยกตามวิธีเข้า · ลบบัญชี 30 วัน | แอดมินเท่านั้น |
| `custom_access_token_hook` | ใส่ `app_role` ใน JWT | Supabase Auth (ต้องเปิดเอง ดูด้านล่าง) |

กันพัง: trigger บน `auth.users` ห่อด้วย exception — เขียนโปรไฟล์ไม่ได้ การเข้าสู่ระบบยังผ่าน (แค่ log warning)

ฝั่งแอป (`src/data/cloud.js`): `cloud.profile()` · `cloud.updateProfile(patch)` · `cloud.touch()` · `cloud.accountEvents()` · `cloud.deleteAccount(reason)`

## ตั้งแอดมิน (ทำใน SQL editor)

```sql
update public.profiles set role = 'admin' where email = 'อีเมลของคุณ';
select public.admin_user_stats(); -- ต้องเรียกในนามผู้ใช้ที่เป็นแอดมิน (ผ่านแอป/REST)
```

## ตั้งในแดชบอร์ด (SQL ทำให้ไม่ได้)

1. **Authentication → Hooks → Customize Access Token** → เลือก `public.custom_access_token_hook` (ไม่เปิดก็ไม่มีอะไรพัง แค่ JWT ไม่มี `app_role`)
2. **Authentication → URL Configuration**: Site URL = โดเมนจริง · Redirect URLs ใส่ทุกหน้าที่ `returnUrl()` คืน (เช่น `https://<โดเมน>/app/` และ `http://localhost:*/**` ตอนพัฒนา)
3. **Authentication → Providers → Email**: เปิด · OTP length 6 · OTP expiry 600 วินาที · ปิด "Confirm email" ไม่ต้อง (OTP ยืนยันในตัว)
4. **Authentication → Emails → SMTP**: ตั้ง SMTP ของตัวเอง (เช่น Resend) — SMTP ของ Supabase ส่งได้แค่ไม่กี่ฉบับ/ชั่วโมง ใช้จริงไม่พอ · แก้แม่แบบ "Magic Link" ให้แสดง `{{ .Token }}` เป็นภาษาไทย
5. **Authentication → Rate Limits**: ส่ง OTP ต่อชั่วโมงให้พอกับผู้ใช้จริง · Sign-ins/verifications ต่อ 5 นาที ค่าเดิมพอ
6. **Authentication → Attack Protection**: เปิด CAPTCHA (Turnstile) เมื่อเริ่มมีคนใช้เยอะ (ต้องเพิ่ม token ในฝั่งแอปด้วย)
7. **Authentication → Sessions**: (แผน Pro) ตั้ง inactivity timeout ได้ถ้าต้องการ
8. ระงับผู้ใช้: Authentication → Users → ⋯ → Ban user (ใช้ `banned_until` ของ Supabase เอง ต่ออายุ token ไม่ได้)

## ทดสอบที่ทำแล้ว (ในฐานข้อมูลจริง ย้อนกลับหมด)

สมัคร → โปรไฟล์ขึ้นเอง · เข้าสู่ระบบ 2 ครั้ง + ผูก Facebook → นับ 2 · providers ถูก · เหตุการณ์ 4 แถว · ผู้ใช้เห็นแค่ของตัวเอง · แก้ชื่อ (ตัดช่องว่าง) + เขตเวลาได้ · แก้ role / เขตเวลามั่ว / insert เอง / เรียกสถิติแอดมิน → ถูกปฏิเสธ · แอดมินเห็นทุกคน + สถิติ · hook ใส่ `app_role` · ลบบัญชี → ข้อมูลหายหมด + สถิติเก็บเหตุผล
