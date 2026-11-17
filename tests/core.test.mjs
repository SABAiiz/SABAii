// รัน: node --test sabaii/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { toYMD, dueLabel, monthGrid, twoWeeks, daysBetween, relDay } from '../src/domain/dates.js';
import { makeTask, recommend, applyFilter, search, summary, dayMarks, nextExam } from '../src/domain/tasks.js';
import { draftFromText, draftsFromText } from '../src/domain/parse.js';
import { findTime, findDate } from '../src/domain/thai-parse.js';
import { memoryDB } from '../src/data/db.js';
import { createStore } from '../src/data/store.js';

// จันทร์ 16 พ.ย. 2569 16:40
const NOW = new Date(2026, 10, 16, 16, 40);
const TODAY = toYMD(NOW);
const SUBJ = [
  { id: 's_math', name: 'คณิตศาสตร์', aliases: ['คณิต', 'เลข'] },
  { id: 's_eng', name: 'ภาษาอังกฤษ', aliases: ['อังกฤษ'] },
  { id: 's_thai', name: 'ภาษาไทย', aliases: ['ไทย'] },
  { id: 's_sci', name: 'วิทยาศาสตร์', aliases: ['วิทย์'] },
];

// ---------- วันที่ ----------
test('toYMD ใช้วันท้องถิ่น ไม่เลื่อนผ่าน UTC', () => {
  assert.equal(toYMD(new Date(2026, 10, 17, 0, 30)), '2026-11-17');
  assert.equal(toYMD(new Date(2026, 10, 16, 23, 59)), '2026-11-16');
});
test('ป้ายกำหนดส่ง', () => {
  assert.equal(dueLabel({ due_date: '2026-11-17', due_time: '08:00' }, TODAY), 'ส่งพรุ่งนี้ 08:00');
  assert.equal(dueLabel({ due_date: '2026-11-16', due_time: null }, TODAY), 'ส่งวันนี้');
  assert.equal(dueLabel({ due_date: '2026-11-19', due_time: '10:00', type: 'exam' }, TODAY), 'สอบ พฤ. 19 พ.ย. 10:00');
  assert.equal(dueLabel({ due_date: '2026-11-15', due_time: null }, TODAY), 'เลยกำหนด · ส่งเมื่อวาน');
  assert.equal(dueLabel({ due_date: null }, TODAY), 'ยังไม่มีกำหนดส่ง');
});
test('ปฏิทินเดือนเริ่มวันจันทร์ · 42 ช่อง · วันที่ 1 อยู่ช่องถูก', () => {
  const g = monthGrid(2026, 10); // พ.ย. 2569 — วันที่ 1 เป็นวันอาทิตย์
  assert.equal(g.length, 42);
  assert.equal(g[6].ymd, '2026-11-01');
  assert.equal(g[0].ymd, '2026-10-26');
  assert.equal(g.filter(c => c.inMonth).length, 30);
});
test('ปฏิทินเดือนกุมภาพันธ์ปีอธิกสุรทิน', () => {
  assert.equal(monthGrid(2028, 1).filter(c => c.inMonth).length, 29);
});
test('2 สัปดาห์เริ่มวันจันทร์ของสัปดาห์นี้', () => {
  const w = twoWeeks('2026-11-19');
  assert.equal(w[0].ymd, '2026-11-16');
  assert.equal(w[13].ymd, '2026-11-29');
});
test('ข้ามปี', () => {
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(relDay('2027-01-04', '2026-12-30'), 'จ. 4 ม.ค. 70');
});

// ---------- กฎของงาน ----------
const T = (o) => makeTask({ title: 'x', ...o }, '2026-11-16T00:00:00.000Z');
test('งานแนะนำ: ใกล้กำหนดก่อน · ไม่มีกำหนดอยู่ท้าย · งานเสร็จไม่โผล่', () => {
  const a = T({ id: 'a', due_date: '2026-11-20' });
  const b = T({ id: 'b', due_date: '2026-11-17', due_time: '08:00' });
  const c = T({ id: 'c' });
  const d = T({ id: 'd', due_date: '2026-11-17', status: 'done' });
  const e = T({ id: 'e', due_date: '2026-11-17' }); // ไม่ระบุเวลา = ปลายวัน → หลัง b
  assert.deepEqual(recommend([a, b, c, d, e]).map(t => t.id), ['b', 'e', 'a', 'c']);
});
test('งานที่ปักหมุดเองอยู่บนสุดตามลำดับที่ปัก', () => {
  const a = T({ id: 'a', due_date: '2026-11-17' });
  const b = { ...T({ id: 'b', due_date: '2026-12-01' }), pinned_at: '2026-11-16T02:00:00Z' };
  const c = { ...T({ id: 'c' }), pinned_at: '2026-11-16T01:00:00Z' };
  assert.deepEqual(recommend([a, b, c]).map(t => t.id), ['c', 'b', 'a']);
});
test('ตัวกรอง วันนี้/ใกล้กำหนด/เสร็จแล้ว', () => {
  const late = T({ id: 'late', due_date: '2026-11-14' });
  const today = T({ id: 'today', due_date: '2026-11-16' });
  const in3 = T({ id: 'in3', due_date: '2026-11-19' });
  const in4 = T({ id: 'in4', due_date: '2026-11-20' });
  const done = { ...T({ id: 'done', due_date: '2026-11-16', status: 'done' }), completed_at: '2026-11-16T05:00:00Z' };
  const all = [late, today, in3, in4, done];
  assert.deepEqual(applyFilter(all, 'today', TODAY).map(t => t.id), ['late', 'today']);
  assert.deepEqual(applyFilter(all, 'soon', TODAY).map(t => t.id), ['late', 'today', 'in3']);
  assert.deepEqual(applyFilter(all, 'done', TODAY).map(t => t.id), ['done']);
});
test('งานที่ลบแล้วไม่โผล่ในตัวกรองใดเลย', () => {
  const del = { ...T({ id: 'del', due_date: '2026-11-16' }), deleted_at: '2026-11-16T00:00:00Z' };
  for (const k of ['all', 'today', 'soon', 'done']) assert.equal(applyFilter([del], k, TODAY).length, 0);
});
test('ค้นหาจากชื่อวิชา/ชื่องาน/รายละเอียด ทุกคำต้องเจอ', () => {
  const a = T({ id: 'a', title: 'แบบฝึกหัดบทที่ 4', subject_id: 's_math' });
  const b = T({ id: 'b', title: 'ท่องศัพท์', description: 'unit 4' , subject_id: 's_eng'});
  const by = Object.fromEntries(SUBJ.map(s => [s.id, s]));
  assert.deepEqual(search([a, b], 'คณิต', by).map(t => t.id), ['a']);
  assert.deepEqual(search([a, b], '4', by).map(t => t.id), ['a', 'b']);
  assert.deepEqual(search([a, b], 'unit 4', by).map(t => t.id), ['b']);
});
test('สรุปหน้าฉันนับจากงานจริง · จุดปฏิทิน · สอบถัดไป', () => {
  const tasks = [T({ due_date: '2026-11-17' }), T({ due_date: '2026-11-19', type: 'exam' }), T({ due_date: '2026-11-17', status: 'done' })];
  assert.deepEqual(summary(tasks, TODAY), { total: 3, open: 2, done: 1, soon: 2 });
  assert.deepEqual(dayMarks(tasks)['2026-11-17'], { task: 1, exam: 0, done: 1 });
  assert.equal(nextExam(tasks, TODAY).due_date, '2026-11-19');
  assert.deepEqual(summary([], TODAY), { total: 0, open: 0, done: 0, soon: 0 });
});

// ---------- แกะข้อความ ----------
test('คำย่อที่นักเรียนพิมพ์: "พน." = พรุ่งนี้ · "ส่งศ." = ศุกร์ · ไม่แย่งคำอื่น', () => {
  assert.equal(draftFromText('คณิต ส่งพน.', { now: NOW, subjects: SUBJ }).due_date, '2026-11-17');
  assert.equal(draftFromText('คณิตส่งพน. 8.00', { now: NOW, subjects: SUBJ }).due_time, '08:00');
  assert.equal(draftFromText('คณิต ส่งศ.', { now: NOW, subjects: SUBJ }).due_date, '2026-11-20');
  assert.equal(draftFromText('ไปหาพนักงาน', { now: NOW, subjects: SUBJ }).due_date, null);
  assert.equal(draftFromText('อ.สมชาย สั่งงาน', { now: NOW, subjects: SUBJ }).due_date, null);
});
test('พิมพ์แค่วิชา + วัน → ชื่องานตามประเภท ไม่เอาข้อความทั้งก้อน', () => {
  assert.equal(draftFromText('คณิต ส่งพรุ่งนี้', { now: NOW, subjects: SUBJ }).title, 'การบ้าน');
  assert.equal(draftFromText('คณิต สอบ ศ.', { now: NOW, subjects: SUBJ }).title, 'สอบ');
});
test('ตัวอย่างในสเปก: "คณิตทำแบบฝึกหัดหน้า 20 ส่งวันศุกร์" → วิชา/วันศุกร์/ไม่ระบุเวลา', () => {
  const d = draftFromText('คณิตทำแบบฝึกหัดหน้า 20 ส่งวันศุกร์', { now: NOW, subjects: SUBJ });
  assert.equal(d.subject_id, 's_math');
  assert.equal(d.due_date, '2026-11-20');
  assert.equal(d.due_time, null, 'ไม่ได้พิมพ์เวลา ต้องไม่เติม 23:59 ให้เอง');
  assert.ok(d.flags.noTime);
  assert.match(d.title, /แบบฝึกหัดหน้า 20/);
});
test('พิมพ์เวลามา → เก็บเวลา · วิชาที่ไม่อยู่ในรายชื่อ = ไม่ระบุวิชา', () => {
  const d = draftFromText('ฟิสิกส์ แบบฝึกบทที่ 3 ส่งพรุ่งนี้ 08:00', { now: NOW, subjects: SUBJ });
  assert.equal(d.due_date, '2026-11-17');
  assert.equal(d.due_time, '08:00');
  assert.equal(d.subject_id, null);
  assert.ok(d.flags.noSubject);
});
const T_ = s => { const r = findTime(s); return r && `${r.hh}:${String(r.mm).padStart(2, '0')}`; };
test('อ่านเวลาแบบพูด', () => {
  assert.equal(T_('ส่ง 16.30 น.'), '16:30');
  assert.equal(T_('ส่งบ่ายสาม'), '15:00');
  assert.equal(T_('บ่าย 2 โมงครึ่ง'), '14:30');
  assert.equal(T_('สองทุ่ม'), '20:00');
  assert.equal(T_('8 โมงเช้า'), '8:00');
  assert.equal(T_('4 โมงเย็น'), '16:00');
  assert.equal(T_('ส่งเที่ยงคืน'), '23:59');
  assert.equal(T_('ส่งเที่ยง'), '12:00');
  assert.equal(T_('หน้า 20 ข้อ 5'), null, 'ตัวเลขเฉย ๆ ไม่ใช่เวลา');
});
const D_ = s => { const r = findDate(s, NOW); return r && toYMD(r.date); };
test('อ่านวันแบบต่าง ๆ (วันนี้ = จ. 16 พ.ย. 69)', () => {
  assert.equal(D_('ส่งมะรืนนี้'), '2026-11-18');
  assert.equal(D_('ส่งวันจันทร์'), '2026-11-23', 'วันเดียวกับวันนี้ = สัปดาห์หน้า');
  assert.equal(D_('ส่งศุกร์หน้า'), '2026-11-27');
  assert.equal(D_('ส่ง 25 พ.ย.'), '2026-11-25');
  assert.equal(D_('ส่ง 3 ม.ค. 70'), '2027-01-03');
  assert.equal(D_('ส่ง 5/12'), '2026-12-05');
  assert.equal(D_('ส่งวันที่ ๒๐'), '2026-11-20', 'เลขไทย');
  assert.equal(D_('ส่งวันที่ 2'), '2026-12-02', 'วันที่ผ่านไปแล้วในเดือนนี้ = เดือนหน้า');
  assert.equal(D_('ส่งงาน อ.สมชาย'), null, '"อ." ที่เป็นคำนำหน้าชื่อครู ไม่ใช่วันอังคาร');
  assert.equal(D_('ส่งอาทิตย์หน้า'), '2026-11-23');
});
test('สอบไม่บอกเวลา → ไม่เติม 08:00 ให้เอง', () => {
  const d = draftFromText('สอบย่อยอังกฤษวันพฤหัส', { now: NOW, subjects: SUBJ });
  assert.equal(d.type, 'exam');
  assert.equal(d.due_date, '2026-11-19');
  assert.equal(d.due_time, null);
});
test('ไม่มีวันที่ → ไม่มีกำหนดส่ง และติดธงให้หน้าตรวจสอบ', () => {
  const d = draftFromText('การบ้านเลข', { now: NOW, subjects: SUBJ });
  assert.equal(d.due_date, null);
  assert.ok(d.flags.noDate);
});
test('ตัวอย่างหลายงานในสเปก 3.2 → 3 งาน', () => {
  const ds = draftsFromText('ไทย ทำใบงานบทที่ 2 ส่งพรุ่งนี้\nอังกฤษ ท่องศัพท์วันศุกร์\nวิทย์ ทำรายงานส่งสัปดาห์หน้า', { now: NOW, subjects: SUBJ });
  assert.equal(ds.length, 3);
  assert.deepEqual(ds.map(d => d.subject_id), ['s_thai', 's_eng', 's_sci']);
  assert.equal(ds[0].due_date, '2026-11-17');
  assert.equal(ds[1].due_date, '2026-11-20');
});
test('ชื่อเล่นวิชาไม่ค้างต้นชื่องาน ("ไทย ทำใบงาน…" → "ทำใบงาน…")', () => {
  const d = draftFromText('ไทย ทำใบงานบทที่ 2 ส่งพรุ่งนี้', { now: NOW, subjects: SUBJ });
  assert.equal(d.subject_id, 's_thai');
  assert.equal(d.title, 'ทำใบงานบทที่ 2');
});
test('ชื่องานที่เป็นแค่ชื่อวิชาไม่ถูกตัดจนว่าง', () => {
  const d = draftFromText('ไทย', { now: NOW, subjects: SUBJ });
  assert.ok(d.title.length > 0);
});
test('หัวเรื่องรายการไม่กลายเป็นงาน', () => {
  const ds = draftsFromText('การบ้านประจำสัปดาห์\n- คณิต ใบงานที่ 6 ส่งศุกร์\n- อังกฤษ worksheet ส่งจันทร์', { now: NOW, subjects: SUBJ });
  assert.equal(ds.length, 2);
});

// ---------- ที่เก็บข้อมูล ----------
async function freshStore() {
  const s = createStore(memoryDB(), { now: () => NOW });
  await s.load();
  return s;
}
test('เปิดครั้งแรกมีวิชาตั้งต้น · เปิดซ้ำไม่เพิ่มซ้ำ', async () => {
  const db = memoryDB();
  const a = createStore(db, { now: () => NOW }); await a.load();
  const n = a.state.subjects.length;
  const b = createStore(db, { now: () => NOW }); await b.load();
  assert.equal(b.state.subjects.length, n);
});
test('บันทึกร่างเดิมซ้ำ (กดบันทึกสองที) ไม่ได้งานซ้ำ', async () => {
  const s = await freshStore();
  const d = { title: 'ใบงาน', draft_key: 'k1' };
  await s.addTasks([d]); await s.addTasks([d]);
  assert.equal(s.state.tasks.length, 1);
});
test('ร่างที่มีชื่อวิชาใหม่ → สร้างวิชาให้', async () => {
  const s = await freshStore();
  const [t] = await s.addTasks([{ title: 'โครงงาน', subject_name: 'นาฏศิลป์' }]);
  assert.equal(s.subjectsById()[t.subject_id].name, 'นาฏศิลป์');
});
test('ทำเสร็จ → ยกเลิกเสร็จ', async () => {
  const s = await freshStore();
  const [t] = await s.addTasks([{ title: 'a' }]);
  await s.patchTask(t.id, { status: 'done' });
  assert.ok(s.state.tasks[0].completed_at);
  await s.patchTask(t.id, { status: 'todo' });
  assert.equal(s.state.tasks[0].completed_at, null);
});
test('ลบแล้วกู้คืนได้ · ลบเกิน 30 วันถูกล้างตอนเปิดแอป', async () => {
  const db = memoryDB();
  const s = createStore(db, { now: () => NOW }); await s.load();
  const [t] = await s.addTasks([{ title: 'a' }]);
  await s.removeTask(t.id);
  assert.ok(s.state.tasks[0].deleted_at);
  await s.restoreTask(t.id);
  assert.equal(s.state.tasks[0].deleted_at, null);
  await s.removeTask(t.id);
  const later = createStore(db, { now: () => new Date(2026, 11, 20) }); await later.load();
  assert.equal(later.state.tasks.length, 0);
});
test('ลบวิชา → งานยังอยู่ แค่ไม่มีวิชา', async () => {
  const s = await freshStore();
  const subj = s.state.subjects[0];
  const [t] = await s.addTasks([{ title: 'a', subject_id: subj.id }]);
  await s.deleteSubject(subj.id);
  assert.equal(s.state.tasks.find(x => x.id === t.id).subject_id, null);
});
test('สำรองแล้วกู้คืน: ได้งานกลับครบ · กู้ซ้ำไม่ซ้ำ · ไฟล์อื่นถูกปฏิเสธ', async () => {
  const a = await freshStore();
  await a.addTasks([{ title: 'ใบงาน 5', due_date: '2026-11-20' }, { title: 'ท่องศัพท์' }]);
  const json = a.exportJSON();
  const b = await freshStore();
  const r1 = await b.restoreBackup(json);
  assert.deepEqual([r1.added, r1.skipped], [2, 0]);
  const r2 = await b.restoreBackup(json);
  assert.deepEqual([r2.added, r2.skipped], [0, 2]);
  await assert.rejects(() => b.restoreBackup('{"tasks":[]}'), /ไม่ใช่ไฟล์สำรองของ SABAii/);
});
