// สถานะของแอปทั้งหมด + การบันทึกลงเครื่อง · จอทุกจออ่านจากที่นี่ที่เดียว
import { makeTask, updateTask, newId, isLive } from '../domain/tasks.js';
import { toYMD } from '../domain/dates.js';

export const SUBJECT_COLORS = ['#1769D2', '#E45465', '#16B76A', '#F4A340', '#8B5CF6', '#0EA5B7', '#D9468F', '#64748B'];

// วิชาตั้งต้น — ลบ/ซ่อน/เปลี่ยนชื่อได้ทั้งหมดในหน้า "ฉัน"
export const DEFAULT_SUBJECTS = [
  ['คณิตศาสตร์', ['คณิต', 'เลข', 'math']],
  ['ภาษาไทย', ['ไทย']],
  ['ภาษาอังกฤษ', ['อังกฤษ', 'eng', 'english']],
  ['วิทยาศาสตร์', ['วิทย์', 'science']],
  ['ฟิสิกส์', ['ฟิสิก', 'physics']],
  ['เคมี', ['chem']],
  ['ชีววิทยา', ['ชีวะ', 'bio']],
  ['สังคมศึกษา', ['สังคม']],
];

export function createStore(db, { now = () => new Date() } = {}) {
  const state = { tasks: [], subjects: [], attachments: [], prefs: {}, dbKind: db.kind };
  const listeners = new Set();
  const iso = () => now().toISOString();
  const emit = () => listeners.forEach(fn => fn(state));

  async function load() {
    [state.tasks, state.subjects, state.attachments] = await Promise.all([db.all('tasks'), db.all('subjects'), db.all('attachments')]);
    state.prefs = Object.fromEntries((await db.all('prefs')).map(p => [p.key, p.value]));
    if (!state.prefs.seeded) {
      for (const [i, [name, aliases]] of DEFAULT_SUBJECTS.entries()) {
        await putSubject({ id: newId('s'), name, aliases, color: SUBJECT_COLORS[i % SUBJECT_COLORS.length], order: i, hidden: false, created_at: iso() }, false);
      }
      await setPref('seeded', true, false);
    }
    // งานที่ลบแล้วเกิน 30 วัน ลบทิ้งจริง (ช่วงกู้คืนหมดแล้ว)
    const cutoff = now().getTime() - 30 * 86400000;
    for (const t of state.tasks.filter(t => t.deleted_at && Date.parse(t.deleted_at) < cutoff)) await purgeTask(t.id, false);
    emit();
    return state;
  }

  async function putTask(t, notify = true) {
    await db.put('tasks', t);
    const i = state.tasks.findIndex(x => x.id === t.id);
    if (i >= 0) state.tasks[i] = t; else state.tasks.push(t);
    if (notify) emit();
    return t;
  }
  async function putSubject(s, notify = true) {
    await db.put('subjects', s);
    const i = state.subjects.findIndex(x => x.id === s.id);
    if (i >= 0) state.subjects[i] = s; else state.subjects.push(s);
    if (notify) emit();
    return s;
  }
  async function setPref(key, value, notify = true) {
    await db.put('prefs', { key, value });
    state.prefs[key] = value;
    if (notify) emit();
  }

  /** บันทึกร่างงานหลายชิ้นพร้อมกัน — กันซ้ำด้วย draft_key (กดบันทึกสองทีต้องไม่ได้งานสองชุด) */
  async function addTasks(drafts) {
    const saved = [];
    for (const d of drafts) {
      if (d.draft_key && state.tasks.some(t => t.draft_key === d.draft_key && isLive(t))) continue;
      let subject_id = d.subject_id || null;
      if (!subject_id && d.subject_name) subject_id = (await ensureSubject(d.subject_name)).id;
      const t = makeTask({ ...d, subject_id }, iso());
      if (d.draft_key) t.draft_key = d.draft_key;
      saved.push(await putTask(t, false));
    }
    emit();
    return saved;
  }
  async function ensureSubject(name) {
    const clean = String(name).trim();
    const found = state.subjects.find(s => s.name === clean);
    if (found) return found;
    const order = state.subjects.length;
    return putSubject({ id: newId('s'), name: clean, aliases: [], color: SUBJECT_COLORS[order % SUBJECT_COLORS.length], order, hidden: false, created_at: iso() }, false);
  }
  async function patchTask(id, patch) {
    const t = state.tasks.find(x => x.id === id);
    if (!t) throw new Error('ไม่พบงาน');
    return putTask(updateTask(t, patch, iso()));
  }
  const removeTask = id => patchTask(id, { deleted_at: iso() });
  const restoreTask = id => patchTask(id, { deleted_at: null });
  async function purgeTask(id, notify = true) {
    for (const a of state.attachments.filter(a => a.task_id === id)) await removeAttachment(a.id, false);
    await db.del('tasks', id);
    state.tasks = state.tasks.filter(t => t.id !== id);
    if (notify) emit();
  }

  async function addAttachment(task_id, { kind, blob = null, text = '', mime_type = '', size = 0 }) {
    const a = { id: newId('a'), task_id, kind, blob, text, mime_type, size, created_at: iso() };
    await db.put('attachments', a);
    state.attachments.push(a);
    emit();
    return a;
  }
  async function removeAttachment(id, notify = true) {
    await db.del('attachments', id);
    state.attachments = state.attachments.filter(a => a.id !== id);
    if (notify) emit();
  }

  const updateSubject = (id, patch) => putSubject({ ...state.subjects.find(s => s.id === id), ...patch });
  /** ลบวิชา — งานที่ผูกอยู่ไม่หาย แค่กลายเป็น "ไม่ระบุวิชา" (หน้าจอถามยืนยันก่อนเรียก) */
  async function deleteSubject(id) {
    for (const t of state.tasks.filter(t => t.subject_id === id)) await putTask(updateTask(t, { subject_id: null }, iso()), false);
    await db.del('subjects', id);
    state.subjects = state.subjects.filter(s => s.id !== id);
    emit();
  }

  /** ส่งออกทุกอย่างเป็น JSON (รูปไม่รวม — บอกผู้ใช้ตรง ๆ) */
  function exportJSON() {
    return JSON.stringify({
      app: 'SABAii.com', version: 1, exported_at: iso(),
      tasks: state.tasks, subjects: state.subjects, prefs: state.prefs,
      notes: state.attachments.filter(a => a.kind === 'text').map(({ blob, ...a }) => a),
    }, null, 2);
  }

  /** งานตัวอย่างให้ลองใช้ — ติดป้าย "ตัวอย่าง" ทุกชิ้น และลบทิ้งได้ทั้งหมดในครั้งเดียว */
  async function addSamples() {
    const day = n => { const d = new Date(now()); d.setDate(d.getDate() + n); return toYMD(d); };
    const sid = name => state.subjects.find(x => x.name === name)?.id || null;
    const rows = [
      ['แบบฝึกหัดบทที่ 3 ข้อ 1–12', 'ฟิสิกส์', 'homework', day(1), '08:00', 'ครูบอกทำแค่ข้อคี่ ส่งในห้อง'],
      ['ใบงานลำดับเลขคณิต', 'คณิตศาสตร์', 'homework', day(4), null, ''],
      ['ท่องศัพท์ Unit 5 (20 คำ)', 'ภาษาอังกฤษ', 'homework', day(2), null, ''],
      ['สอบย่อยไฟฟ้า', 'ฟิสิกส์', 'exam', day(3), '10:00', 'ห้อง 412 · บทที่ 2–3'],
      ['สรุปเรื่องขุนช้างขุนแผน 1 หน้า', 'ภาษาไทย', 'homework', day(8), null, ''],
      ['รายงานกลุ่มระบบหายใจ', 'ชีววิทยา', 'project', day(10), '16:00', ''],
    ];
    const saved = [];
    for (const [title, subj, type, due_date, due_time, note] of rows) {
      const t = makeTask({ title, subject_id: sid(subj), type, due_date, due_time, source: 'sample' }, iso());
      if (type === 'exam') t.place = '412';
      await putTask(t, false);
      if (note) { const a = { id: newId('a'), task_id: t.id, kind: 'text', blob: null, text: note, mime_type: '', size: 0, created_at: iso() }; await db.put('attachments', a); state.attachments.push(a); }
      saved.push(t);
    }
    emit();
    return saved;
  }
  async function removeSamples() {
    const ids = state.tasks.filter(t => t.source === 'sample').map(t => t.id);
    for (const id of ids) await purgeTask(id, false);
    emit();
    return ids.length;
  }

  /** กู้คืนจากไฟล์สำรองของ SABAii เอง — งานที่มีอยู่แล้ว (id เดียวกัน) ข้ามไป ไม่เขียนทับ */
  async function restoreBackup(raw) {
    let data;
    try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { throw new Error('ไฟล์นี้ไม่ใช่ไฟล์สำรองของ SABAii'); }
    if (data?.app !== 'SABAii.com' || !Array.isArray(data.tasks)) throw new Error('ไฟล์นี้ไม่ใช่ไฟล์สำรองของ SABAii');
    let added = 0, skipped = 0;
    for (const sj of data.subjects || []) if (sj?.id && sj.name && !state.subjects.some(x => x.id === sj.id)) await putSubject(sj, false);
    for (const t of data.tasks) {
      if (!t?.id || !t.title || state.tasks.some(x => x.id === t.id)) { skipped++; continue; }
      await putTask(t, false); added++;
    }
    for (const n of data.notes || []) if (n?.id && n.task_id && !state.attachments.some(a => a.id === n.id)) { await db.put('attachments', n); state.attachments.push(n); }
    emit();
    return { added, skipped };
  }

  /** ระบบซิงก์เขียนลงเครื่องเองแล้ว (ไม่ผ่านที่นี่ จะได้ไม่วนกลับไปเข้าคิวส่ง) — อัปเดตสถานะในหน่วยความจำแล้วแจ้งจอครั้งเดียว */
  function applyRemote(changes) {
    for (const { store: name, key, value } of changes) {
      if (name === 'prefs') { if (value) state.prefs[key] = value.value; else delete state.prefs[key]; continue; }
      const list = state[name], i = list.findIndex(x => x.id === key);
      if (value) { if (i >= 0) list[i] = value; else list.push(value); } else if (i >= 0) list.splice(i, 1);
    }
    if (changes.length) emit();
  }

  return {
    state, load, applyRemote, subscribe: fn => (listeners.add(fn), () => listeners.delete(fn)),
    addTasks, patchTask, removeTask, restoreTask, purgeTask,
    addAttachment, removeAttachment, attachmentsOf: id => state.attachments.filter(a => a.task_id === id),
    ensureSubject, updateSubject, deleteSubject, setPref, exportJSON, restoreBackup, addSamples, removeSamples,
    subjectsById: () => Object.fromEntries(state.subjects.map(s => [s.id, s])),
  };
}
