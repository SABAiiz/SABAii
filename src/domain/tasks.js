// กฎของงานล้วน ๆ (ไม่แตะ DOM ไม่แตะฐานข้อมูล) — เทสต์ด้วย node ได้ตรง ๆ
import { dueSortKey, daysBetween, addDaysYMD } from './dates.js';

export const TYPES = {
  homework: 'การบ้าน',
  exam: 'สอบ',
  project: 'งานกลุ่ม/โครงงาน',
  activity: 'กิจกรรม',
  reminder: 'เตือนความจำ',
};
export const STATUS = { todo: 'ยังไม่เริ่ม', doing: 'กำลังทำ', done: 'เสร็จแล้ว' };

let seq = 0;
export function newId(prefix = 't') {
  seq = (seq + 1) % 1e6;
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${rnd}`;
}

/** สร้างงานใหม่ — ช่องที่ไม่รู้ปล่อยว่าง ไม่เดาให้ */
export function makeTask(input, nowISO = new Date().toISOString()) {
  const title = String(input.title || '').trim();
  if (!title) throw new Error('ต้องมีชื่องาน');
  return {
    id: input.id || newId('t'),
    title: title.slice(0, 200),
    subject_id: input.subject_id || null,
    description: String(input.description || '').slice(0, 2000),
    type: TYPES[input.type] ? input.type : 'homework',
    due_date: input.due_date || null,
    due_time: input.due_time || null,
    end_time: input.end_time || null,
    place: input.place || '',
    status: STATUS[input.status] ? input.status : 'todo',
    est_min: Number.isFinite(input.est_min) ? input.est_min : null,
    source: input.source || 'manual',
    created_at: nowISO,
    updated_at: nowISO,
    completed_at: null,
    deleted_at: null,
  };
}

export function updateTask(task, patch, nowISO = new Date().toISOString()) {
  const next = { ...task, ...patch, updated_at: nowISO };
  if (patch.status === 'done' && task.status !== 'done') next.completed_at = nowISO;
  if (patch.status && patch.status !== 'done') next.completed_at = null;
  return next;
}

export const isLive = t => !t.deleted_at;
export const isOpen = t => isLive(t) && t.status !== 'done';

/**
 * ลำดับ "งานแนะนำวันนี้": เลยกำหนด → ใกล้กำหนดก่อน → ไม่มีกำหนดอยู่ท้าย
 * งานที่ผู้ใช้ปักหมุดเอง (pinned) อยู่บนสุดตามลำดับที่ปักไว้ — ลำดับที่เลือกเองต้องไม่หาย (สเปก 2.3)
 */
export function recommend(tasks) {
  const open = tasks.filter(isOpen);
  const pinned = open.filter(t => t.pinned_at).sort((a, b) => a.pinned_at.localeCompare(b.pinned_at));
  const rest = open.filter(t => !t.pinned_at).sort((a, b) =>
    (dueSortKey(a) - dueSortKey(b)) ||
    ((b.status === 'doing') - (a.status === 'doing')) ||
    a.created_at.localeCompare(b.created_at));
  return pinned.concat(rest);
}

export const FILTERS = {
  all: { label: 'ทั้งหมด', test: t => isOpen(t) },
  today: { label: 'วันนี้', test: (t, today) => isOpen(t) && t.due_date && daysBetween(today, t.due_date) <= 0 },
  doing: { label: 'กำลังทำ', test: t => isOpen(t) && t.status === 'doing' },
  soon: { label: 'ใกล้กำหนด', test: (t, today) => isOpen(t) && t.due_date && daysBetween(today, t.due_date) <= 3 },
  done: { label: 'เสร็จแล้ว', test: t => isLive(t) && t.status === 'done' },
};

export function applyFilter(tasks, key, today) {
  const f = FILTERS[key] || FILTERS.all;
  const list = tasks.filter(t => f.test(t, today));
  if (key === 'done') return list.sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
  return recommend(list);
}

/** ค้นหาจากชื่อวิชา ชื่องาน รายละเอียด — ไม่สนตัวพิมพ์เล็กใหญ่ ช่องว่างหลายคำต้องเจอครบทุกคำ */
export function search(tasks, q, subjectsById = {}) {
  const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return tasks;
  return tasks.filter(t => {
    const hay = `${t.title} ${t.description} ${subjectsById[t.subject_id]?.name || ''}`.toLowerCase();
    return words.every(w => hay.includes(w));
  });
}

/** ตัวเลขสรุปของหน้า "ฉัน" — นับจากงานจริงเท่านั้น */
export function summary(tasks, today) {
  const live = tasks.filter(isLive);
  return {
    total: live.length,
    open: live.filter(t => t.status !== 'done').length,
    done: live.filter(t => t.status === 'done').length,
    soon: live.filter(t => t.status !== 'done' && t.due_date && daysBetween(today, t.due_date) <= 3).length,
  };
}

/** รายการต่อวัน สำหรับปฏิทิน: { 'YYYY-MM-DD': { task: n, exam: n, done: n } } */
export function dayMarks(tasks) {
  const out = {};
  for (const t of tasks.filter(isLive)) {
    if (!t.due_date) continue;
    const m = out[t.due_date] || (out[t.due_date] = { task: 0, exam: 0, done: 0 });
    if (t.status === 'done') m.done++;
    else if (t.type === 'exam') m.exam++;
    else m.task++;
  }
  return out;
}

/** สอบครั้งถัดไปที่ยังไม่ผ่าน */
export function nextExam(tasks, today) {
  return recommend(tasks.filter(t => t.type === 'exam' && t.due_date && daysBetween(today, t.due_date) >= 0))[0] || null;
}

/** วันต่อเนื่องที่ทำงานเสร็จอย่างน้อย 1 งาน · doneDays = Set ของ 'YYYY-MM-DD' (วันนี้ยังไม่มีก็ยังไม่ขาด — นับจากเมื่อวาน) */
export function streakOf(doneDays, today) {
  let d = doneDays.has(today) ? today : addDaysYMD(today, -1), n = 0;
  while (doneDays.has(d)) { n++; d = addDaysYMD(d, -1); }
  return n;
}

/** เรื่องด่วนสำหรับกระดิ่งหน้าหลัก (0.15) — งานที่ยังไม่เสร็จ:
 *   overdue = เลยกำหนด · exam = สอบภายใน 3 วัน (รวมวันนี้) · today = ส่งวันนี้ · tomorrow = ส่งพรุ่งนี้
 *   เรียง: เลยกำหนด → สอบใกล้สุด → ส่งวันนี้ → ส่งพรุ่งนี้ · key ใช้จำว่า "เห็นแล้ว" (เลื่อนวันส่ง = เรื่องใหม่) */
export function alertsOf(tasks, today) {
  const RANK = { overdue: 0, exam: 1, today: 2, tomorrow: 3 };
  const out = [];
  for (const t of tasks) {
    if (!isLive(t) || t.status === 'done' || !t.due_date) continue;
    const days = daysBetween(today, t.due_date);
    let kind = null;
    if (days < 0) kind = 'overdue';
    else if (t.type === 'exam') kind = days <= 3 ? 'exam' : null;
    else if (days === 0) kind = 'today';
    else if (days === 1) kind = 'tomorrow';
    if (kind) out.push({ id: t.id, task: t, kind, days, key: `${t.id}:${kind}:${t.due_date}` });
  }
  return out.sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.days - b.days || String(a.task.due_time || '99').localeCompare(String(b.task.due_time || '99')));
}
