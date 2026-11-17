// ข้อความที่ผู้ใช้พิมพ์/พูด → "ร่างงาน" สำหรับหน้าตรวจสอบ (ใช้ตัวแกะของ SABAii เอง: thai-parse.js)
import { parseTask, splitLines } from './thai-parse.js';

/** ข้อความ 1 ท่อน → ร่างงาน 1 ชิ้น */
export function draftFromText(text, { now = new Date(), subjects = [] } = {}) {
  const p = parseTask(text, { now, subjects });
  return {
    title: p.title,
    subject_id: p.subject?.id || null,
    subject_name: '',
    type: p.type,
    due_date: p.due_date,
    due_time: p.due_time,
    raw: String(text),
    flags: p.flags,
  };
}

/** หลายบรรทัด = หลายงาน (หัวเรื่องแบบ "การบ้านประจำสัปดาห์" ไม่นับเป็นงาน) */
export function draftsFromText(text, opts = {}) {
  if (!String(text || '').trim()) return [];
  return splitLines(text).map(s => draftFromText(s, opts));
}
