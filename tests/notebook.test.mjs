// 0.9.9 แท็บสมุด: ค้นในโน้ต + ไอคอนวิชา (ฟังก์ชันล้วน ไม่ต้องเปิดเบราว์เซอร์)
import test from 'node:test';
import assert from 'node:assert/strict';
import { searchNotes } from '../src/domain/notebook.js';
import { subjIcon } from '../src/ui/subject-icon.js';

const tasks = [{ id: 't1', title: 'ฟิสิกส์ แบบฝึกหัด 4.1' }, { id: 't2', title: 'ท่องศัพท์ Unit 7' }];
const notes = { t1: [{ kind: 'text', text: 'ความเร่ง a = Δv/Δt' }, { kind: 'image', text: '' }], t2: [{ kind: 'text', text: 'Vocabulary list' }] };
const find = q => searchNotes(q, tasks, id => notes[id] || []);

test('ค้นเจอทั้งในโน้ตข้อความและชื่องาน', () => {
  assert.equal(find('ความเร่ง').length, 1);
  assert.equal(find('ความเร่ง')[0].task.id, 't1');
  assert.equal(find('4.1')[0].note, null);
});
test('ไม่สนตัวพิมพ์เล็ก/ใหญ่ · คำว่าง = ไม่มีผล', () => {
  assert.equal(find('VOCAB').length, 1);
  assert.deepEqual(find('   '), []);
});
test('ไอคอนวิชาเดาจากชื่อ · ไม่รู้จัก = ตัวอักษรแรก (กันอักขระพิเศษ)', () => {
  assert.match(subjIcon({ name: 'ฟิสิกส์' }), /ellipse/);
  assert.match(subjIcon({ name: 'คณิตศาสตร์' }), /M17 5H7/);
  assert.match(subjIcon({ name: 'ภาษาอังกฤษ' }), />Aa</);
  assert.match(subjIcon({ name: '<b>' }), /&#60;/);
  assert.doesNotMatch(subjIcon({ name: '<b>' }), /<b>/);
});

// 0.10 สมุดเน้นก่อนสอบ: สอบที่ใกล้สุด · ของที่ต้องอ่าน · ป้ายออกสอบ
import { upcomingExams, examScope, isExamHint, noteQuote, readCount } from '../src/domain/notebook.js';
const T = (id, o) => ({ id, title: id, type: 'homework', status: 'todo', subject_id: 'phy', due_date: null, due_time: null, deleted_at: null, ...o });
const N = (id, day, o = {}) => ({ id, kind: 'text', text: id, created_at: `${day}T05:00:00.000Z`, ...o });
const dayOf = iso => iso.slice(0, 10);

test('สอบที่ยังไม่ถึง: ไม่เอาที่ผ่านแล้ว/เสร็จแล้ว/ลบแล้ว · ใกล้สุดก่อน (วันเดียวกันดูเวลา)', () => {
  const ts = [T('e1', { type: 'exam', due_date: '2026-11-29', due_time: '13:00' }), T('e2', { type: 'exam', due_date: '2026-11-29', due_time: '09:00' }),
    T('e3', { type: 'exam', due_date: '2026-11-20' }), T('e4', { type: 'exam', due_date: '2026-12-01', status: 'done' }),
    T('e5', { type: 'exam', due_date: '2026-12-02', deleted_at: 'x' }), T('h1', { due_date: '2026-11-27' }), T('e6', { type: 'exam', due_date: '2026-11-26' })];
  assert.deepEqual(upcomingExams(ts, '2026-11-26').map(t => t.id), ['e6', 'e2', 'e1']);
});
test('ของที่ต้องอ่าน = โน้ตวิชาเดียวกันหลังสอบครั้งก่อนถึงวันสอบ + โน้ตของงานสอบเอง · ใหม่สุดก่อน', () => {
  const ex = T('ex', { type: 'exam', due_date: '2026-11-29' });
  const ts = [ex, T('old', { type: 'exam', due_date: '2026-11-12' }), T('hw'), T('math', { subject_id: 'mat' }), T('gone', { deleted_at: 'x' })];
  const notes = { hw: [N('before', '2026-11-10'), N('sameday', '2026-11-12'), N('in1', '2026-11-19'), N('in2', '2026-11-25'), N('after', '2026-11-30')],
    ex: [N('own', '2026-11-01')], math: [N('m', '2026-11-20')], gone: [N('g', '2026-11-20')] };
  const sc = examScope(ex, ts, id => notes[id] || [], dayOf);
  assert.equal(sc.from, '2026-11-12');
  assert.deepEqual(sc.items.map(x => x.note.id), ['in2', 'in1', 'own']);
});
test('สอบไม่มีครั้งก่อน = โน้ตทั้งหมดของวิชา · สอบไม่ระบุวิชา = เฉพาะโน้ตของสอบเอง', () => {
  const ex = T('ex', { type: 'exam', due_date: '2026-11-29' }), hw = T('hw');
  const notes = { hw: [N('a', '2026-09-01')], ex: [N('b', '2026-11-01')] };
  assert.equal(examScope(ex, [ex, hw], id => notes[id] || [], dayOf).items.length, 2);
  const free = T('ex', { type: 'exam', due_date: '2026-11-29', subject_id: null });
  assert.deepEqual(examScope(free, [free, hw], id => notes[id] || [], dayOf).items.map(x => x.note.id), ['b']);
});
test('ป้ายออกสอบ · แยกประโยคครูพูด · นับอ่านแล้ว', () => {
  assert.ok(isExamHint({ kind: 'text', text: 'ครูพูด · 10:31\n“ข้อ 5 แบบนี้ออกสอบแน่นอน”' }));
  assert.ok(isExamHint({ kind: 'text', text: 'บทนี้อยู่ในข้อสอบ' }));
  assert.ok(!isExamHint({ kind: 'text', text: 'ส่งการบ้านพรุ่งนี้' }));
  assert.ok(!isExamHint({ kind: 'image', text: 'ออกสอบ' }));
  assert.deepEqual(noteQuote('ครูพูด · พ. 10:31\n“ข้อ 5 ออกสอบ”'), { said: true, text: 'ข้อ 5 ออกสอบ' });
  assert.deepEqual(noteQuote(' จดเอง '), { said: false, text: 'จดเอง' });
  assert.equal(readCount([{ note: { read_at: 'x' } }, { note: {} }]), 1);
});
