// ข้อมูลที่ทุกหน้าใช้ร่วมกัน: ที่เก็บข้อมูล · วิชา · ข้อความกำหนดส่ง · ลิงก์รูปโน้ต
import { h, NONE, nameOf } from '../ui/kit.js';
import { toYMD, fromYMD, daysBetween, relDay, DOW_LONG } from '../domain/dates.js';
import { recommend, isLive } from '../domain/tasks.js';

export const app = { store: null, refresh: () => {}, openNotes: () => {} };
export const S = () => app.store.state;
export const today = () => toYMD(new Date());
export const subj = id => S().subjects.find(s => s.id === id) || NONE;
export const task = id => S().tasks.find(t => t.id === id && isLive(t));
export const ranked = () => recommend(S().tasks);
export const notesOf = id => app.store.attachmentsOf(id).sort((a, b) => a.created_at.localeCompare(b.created_at));
export const visibleSubjects = () => [...S().subjects].filter(s => !s.hidden).sort((a, b) => a.order - b.order);

/** "ส่งพรุ่งนี้ 08:00" · "สอบจันทร์" · "ส่งศุกร์หน้า" · "เลยกำหนด จ. 10 พ.ย." */
export function dueInfo(t) {
  if (!t.due_date) return { text: 'ไม่มีกำหนดส่ง', urgent: false, n: null };
  const n = daysBetween(today(), t.due_date), d = fromYMD(t.due_date);
  const pre = t.type === 'exam' ? 'สอบ' : 'ส่ง';
  const day = n < 0 ? `เลยกำหนด ${relDay(t.due_date, today())}` : n === 0 ? 'วันนี้' : n === 1 ? 'พรุ่งนี้'
    : n < 7 ? DOW_LONG[d.getDay()] : n < 14 ? DOW_LONG[d.getDay()] + 'หน้า' : relDay(t.due_date, today());
  return { text: `${n < 0 ? '' : pre}${day}${t.due_time ? ' ' + t.due_time : ''}`, urgent: n <= 1, n };
}
export const dueLine = t => { const d = dueInfo(t); return [d.urgent ? h('em', d.text) : d.text, t.est_min ? ` · ~${t.est_min} นาที` : '']; };
export const fullTitle = t => { const n = nameOf(subj(t.subject_id)); return (n ? n + ' · ' : '') + t.title; };

/** ลิงก์รูปของโน้ต (เก็บไว้ใช้ซ้ำ · คืนหน่วยความจำเมื่อโน้ตถูกลบ) */
const urls = new Map();
export function urlOf(a, preview = false) {
  const key = preview && a.thumbnail instanceof Blob ? 'thumbnail' : 'blob';
  if (!a[key]) return '';
  const id = a.id + ':' + key;
  const current = urls.get(id);
  if (current?.blob === a[key]) return current.url;
  if (current) URL.revokeObjectURL(current.url);
  const url = URL.createObjectURL(a[key]);
  urls.set(id, { attachment: a.id, blob: a[key], key, url });
  return url;
}
export function gcUrls() {
  if (!urls.size) return;
  const live = new Map(S().attachments.map(a => [a.id, a]));
  for (const [id, entry] of urls) if (live.get(entry.attachment)?.[entry.key] !== entry.blob) {
    URL.revokeObjectURL(entry.url);
    urls.delete(id);
  }
}
