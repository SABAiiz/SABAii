// สถานะของแอปทั้งหมด + การบันทึกลงเครื่อง · จอทุกจออ่านจากที่นี่ที่เดียว
import { makeTask, updateTask, newId, isLive } from '../domain/tasks.js';
import { toYMD } from '../domain/dates.js';
import { blankPage } from '../domain/pages.js';

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
  const state = { tasks: [], subjects: [], attachments: [], prefs: {}, books: [], pages: [], dbKind: db.kind };
  const listeners = new Set();
  const iso = () => now().toISOString();
  const emit = () => listeners.forEach(fn => fn(state));

  async function load() {
    [state.tasks, state.subjects, state.attachments, state.books, state.pages] = await Promise.all(['tasks', 'subjects', 'attachments', 'books', 'pages'].map(n => db.all(n)));
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

  async function addAttachment(task_id, { kind, blob = null, text = '', mime_type = '', size = 0, page_id = null }) {
    const a = { id: newId('a'), task_id, kind, blob, text, mime_type, size, created_at: iso() };
    if (page_id) a.page_id = page_id; // kind 'page' = หน้าในสมุดที่ผูกกับงาน (ภาพย่อสด ๆ ไม่ได้ก๊อปมา)
    await db.put('attachments', a);
    state.attachments.push(a);
    emit();
    return a;
  }
  /** ผูกหน้าในสมุดเข้าโน้ตของงาน (ผูกซ้ำ = ได้อันเดิม) */
  async function linkPage(task_id, page_id) {
    return state.attachments.find(a => a.task_id === task_id && a.kind === 'page' && a.page_id === page_id)
      || addAttachment(task_id, { kind: 'page', page_id });
  }
  /** หน้าถูกลบ → โน้ตงานที่ผูกหน้านั้นหายตาม */
  async function unlinkPages(ids) {
    for (const a of state.attachments.filter(a => a.kind === 'page' && ids.includes(a.page_id))) await removeAttachment(a.id, false);
  }
  async function removeAttachment(id, notify = true) {
    await db.del('attachments', id);
    state.attachments = state.attachments.filter(a => a.id !== id);
    if (notify) emit();
  }

  /* ---------- สมุดจด (0.10): สมุด 1 เล่ม = หลายหน้า · หน้าเก็บเส้นปากกา/ข้อความ/รูปเป็นหน่วยหน้ากระดาษ ---------- */
  const pagesOf = book_id => state.pages.filter(p => p.book_id === book_id).sort((a, b) => a.order - b.order);
  async function putBook(b, notify = true) {
    await db.put('books', b);
    const i = state.books.findIndex(x => x.id === b.id);
    if (i >= 0) state.books[i] = b; else state.books.push(b);
    if (notify) emit();
    return b;
  }
  /** สมุดใหม่ · cover = มีหน้าปก+สารบัญเป็นหน้าแรก (เปิดครั้งแรกเจอหน้าปก) แล้วตามด้วยหน้าเขียน 1 หน้า */
  async function addBook({ title, color = SUBJECT_COLORS[state.books.length % SUBJECT_COLORS.length], paper = 'lined', subject_id = null, cover = false }) {
    const b = { id: newId('b'), title: String(title || '').trim() || 'สมุดจด', color, paper, subject_id, created_at: iso(), updated_at: iso(), last_page: null };
    const pages = cover ? [{ ...blankPage(b.id, 0, 'blank', iso()), cover: true }, blankPage(b.id, 1, paper, iso())] : [blankPage(b.id, 0, paper, iso())];
    b.last_page = pages[0].id;
    for (const p of pages) { await db.put('pages', p); state.pages.push(p); }
    return putBook(b);
  }
  const updateBook = (id, patch) => putBook({ ...state.books.find(b => b.id === id), ...patch, updated_at: iso() });
  async function deleteBook(id) {
    await unlinkPages(pagesOf(id).map(p => p.id));
    for (const p of pagesOf(id)) await db.del('pages', p.id);
    state.pages = state.pages.filter(p => p.book_id !== id);
    await db.del('books', id);
    state.books = state.books.filter(b => b.id !== id);
    emit();
  }
  /** บันทึกหน้า — ระหว่างเขียนไม่ต้องวาดทั้งแอปใหม่ (notify=false) แจ้งทีเดียวตอนออกจากหน้าเขียน */
  async function savePage(p, notify = true) {
    const v = { ...p, updated_at: iso() };
    delete v.need_body; // ซิงก์: เขียนหน้านี้ในเครื่องแล้ว = ไม่เอาเนื้อหาจากคลาวด์มาทับ
    await db.put('pages', v);
    const i = state.pages.findIndex(x => x.id === v.id);
    if (i >= 0) state.pages[i] = v; else state.pages.push(v);
    const b = state.books.find(x => x.id === v.book_id);
    if (b) { b.updated_at = v.updated_at; await db.put('books', b); }
    if (notify) emit();
    return v;
  }
  /** เพิ่มหน้าต่อจากหน้า after (ไม่ระบุ = ท้ายเล่ม) — กระดาษแบบเดียวกับหน้าก่อนหน้า */
  async function addPage(book_id, after = null) {
    const list = pagesOf(book_id), at = after ? list.findIndex(p => p.id === after) + 1 : list.length;
    const prev = list[at - 1], book = state.books.find(b => b.id === book_id);
    for (const p of list.slice(at)) { p.order++; await db.put('pages', p); }
    const p = blankPage(book_id, at, (!prev?.cover && prev?.paper) || book?.paper || 'lined', iso());
    await db.put('pages', p); state.pages.push(p);
    return p;
  }
  /** ทำสำเนาหน้า (วางต่อจากหน้าเดิม) */
  async function duplicatePage(id) {
    const src = state.pages.find(x => x.id === id);
    if (!src) return null;
    const p = await addPage(src.book_id, id);
    return savePage({ ...p, paper: src.cover ? (state.books.find(b => b.id === src.book_id)?.paper || 'lined') : src.paper, strokes: src.strokes.slice(), texts: src.texts.map(t => ({ ...t })), imgs: src.imgs.map(i => ({ ...i })), shapes: (src.shapes || []).map(o => ({ ...o })), lines: (src.lines || []).map(l => ({ ...l })) }, false);
  }
  async function removePage(id) {
    const p = state.pages.find(x => x.id === id);
    if (!p) return;
    await unlinkPages([id]);
    await db.del('pages', id);
    state.pages = state.pages.filter(x => x.id !== id);
    for (const [i, x] of pagesOf(p.book_id).entries()) if (x.order !== i) { x.order = i; await db.put('pages', x); }
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
      notes: state.attachments.filter(a => a.kind === 'text' || a.kind === 'page').map(({ blob, ...a }) => a),
      books: state.books, pages: state.pages.map(p => ({ ...p, imgs: [] })),
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
    for (const b of data.books || []) if (b?.id && !state.books.some(x => x.id === b.id)) await putBook(b, false);
    for (const p of data.pages || []) if (p?.id && p.book_id && Array.isArray(p.strokes) && !state.pages.some(x => x.id === p.id)) { const v = { texts: [], imgs: [], ...p }; await db.put('pages', v); state.pages.push(v); }
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
    addAttachment, removeAttachment, linkPage, attachmentsOf: id => state.attachments.filter(a => a.task_id === id),
    ensureSubject, updateSubject, deleteSubject,
    addBook, updateBook, deleteBook, pagesOf, savePage, addPage, duplicatePage, removePage, setPref, exportJSON, restoreBackup, addSamples, removeSamples,
    subjectsById: () => Object.fromEntries(state.subjects.map(s => [s.id, s])),
  };
}
