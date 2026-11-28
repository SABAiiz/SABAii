-- SABAii หลังบ้าน ขั้น 2 (0.12): ซิงก์สมุดจดด้วย + เข้าสู่ระบบด้วย Google
--   items.kind เพิ่ม book (เล่ม) · page (หัวหน้ากระดาษ: เล่ม ลำดับ กระดาษ — เนื้อหาไม่อยู่ในแถว)
--   เนื้อหาหน้า (เส้น ข้อความ ตำแหน่งรูป) = ไฟล์ attachments/<user_id>/page-<page_id>.json
--   รูปในหน้า = ไฟล์รูปแยก attachments/<user_id>/<img_id> เหมือนรูปแนบงาน
-- เข้าสู่ระบบด้วย Google ตั้งในแดชบอร์ด Supabase (Authentication → Providers → Google) ไม่มีอะไรต้องแก้ในฐานข้อมูล

alter table public.items drop constraint if exists items_kind_check;
alter table public.items add constraint items_kind_check
  check (kind in ('task', 'subject', 'attachment', 'pref', 'book', 'page'));

update storage.buckets
  set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/json']
  where id = 'attachments';
