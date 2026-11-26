// สมุด: ค้นในโน้ต · สอบที่ใกล้ที่สุด · ของที่ต้องอ่านก่อนสอบ — ฟังก์ชันล้วน ไม่แตะ DOM/ที่เก็บข้อมูล
import { toYMD } from './dates.js';

/** ค้นในชื่องานและโน้ตข้อความของทุกงาน (ไม่สนตัวพิมพ์เล็ก/ใหญ่) */
export function searchNotes(q, tasks, notes) {
  const k = q.trim().toLowerCase();
  if (!k) return [];
  const out = [];
  for (const t of tasks) {
    for (const n of notes(t.id)) if (n.kind === 'text' && (n.text || '').toLowerCase().includes(k)) out.push({ task: t, note: n });
    if ((t.title || '').toLowerCase().includes(k)) out.push({ task: t, note: null });
  }
  return out.slice(0, 30);
}

/** โน้ตที่บอกว่า "ออกสอบ" — คำที่ครูใช้บ่อย (จดเองหรือจากปุ่มฟังครูก็ได้) */
const HINT = /ออกสอบ|ข้อสอบ|สอบแน่|ออกแน่/;
export const isExamHint = n => n?.kind === 'text' && HINT.test(n.text || '');

/** โน้ตจากปุ่มฟังครูเก็บเป็น 'ครูพูด · <เวลา>\n“ประโยค”' → แยกเป็น { said, text } ไว้โชว์แค่ประโยค */
export function noteQuote(text = '') {
  const m = /^ครูพูด[^\n]*\n([\s\S]*)$/.exec(text);
  if (!m) return { said: false, text: text.trim() };
  return { said: true, text: m[1].trim().replace(/^[“"]|[”"]$/g, '').trim() };
}

const dueKey = t => (t.due_date || '') + ' ' + (t.due_time || '99:99');
/** สอบที่ยังไม่ถึง (รวมวันนี้) และยังไม่ติ๊กเสร็จ — ใกล้สุดก่อน */
export function upcomingExams(tasks, today) {
  return tasks.filter(t => !t.deleted_at && t.type === 'exam' && t.status !== 'done' && t.due_date && t.due_date >= today)
    .sort((a, b) => dueKey(a).localeCompare(dueKey(b)));
}

/**
 * ของที่ต้องอ่านก่อนสอบ = โน้ตทุกชิ้นของวิชาเดียวกัน ที่จดหลังวันสอบครั้งก่อนของวิชานั้น จนถึงวันสอบนี้
 * (รวมโน้ตที่แนบกับงานสอบเอง) · สอบที่ไม่ระบุวิชา = เฉพาะโน้ตของงานสอบเอง
 * คืน { from, items: [{ note, task, day }] } เรียงใหม่สุดก่อน · from = วันสอบครั้งก่อน (null = ไม่มี)
 */
export function examScope(exam, tasks, notesOf, dayOf = iso => toYMD(new Date(iso))) {
  const live = tasks.filter(t => !t.deleted_at);
  const prev = exam.subject_id ? live.filter(t => t.id !== exam.id && t.type === 'exam' && t.subject_id === exam.subject_id && t.due_date && t.due_date < exam.due_date)
    .map(t => t.due_date).sort().pop() || null : null;
  const pool = exam.subject_id ? live.filter(t => t.subject_id === exam.subject_id) : [exam];
  const items = [];
  for (const t of pool) for (const note of notesOf(t.id)) {
    const day = dayOf(note.created_at);
    if (t.id !== exam.id && ((prev && day <= prev) || (exam.due_date && day > exam.due_date))) continue;
    items.push({ note, task: t, day });
  }
  items.sort((a, b) => b.note.created_at.localeCompare(a.note.created_at));
  return { from: prev, items };
}

/** อ่านไปแล้วกี่ชิ้น */
export const readCount = items => items.filter(x => x.note.read_at).length;
