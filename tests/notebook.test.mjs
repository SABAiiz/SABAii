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
