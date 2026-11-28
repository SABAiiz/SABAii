// แจ้งเตือนก่อนวันส่ง: ข้อความ (supabase/functions/push-reminders/compose.js) + service worker แสดง/แตะแจ้งเตือน (sw.js)
// รัน: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { compose, TEST_MESSAGE } from '../supabase/functions/push-reminders/compose.js';

test('ไม่มีงานพรุ่งนี้ = ไม่ส่ง', () => {
  assert.equal(compose([]), null);
  assert.equal(compose(null), null);
  assert.equal(compose([{ title: '' }]), null);
});

test('งานเดียว: ชื่องาน + วิชา (ตัด "ภาษา") + เวลาส่ง', () => {
  const m = compose([{ title: 'เรียงความ', type: 'homework', subject: 'ภาษาไทย', time: '08:30:00' }]);
  assert.equal(m.title, 'พรุ่งนี้มีงานต้องส่ง');
  assert.equal(m.body, 'เรียงความ (ไทย) ก่อน 08:30');
  assert.equal(m.url, '#/tasks');
});

test('หลายงาน: บอกจำนวน · เกิน 3 งาน = "และอีก N งาน"', () => {
  const tasks = ['ก', 'ข', 'ค', 'ง', 'จ'].map(t => ({ title: t, type: 'homework' }));
  const m = compose(tasks);
  assert.equal(m.title, 'พรุ่งนี้มีงานต้องส่ง 5 งาน');
  assert.equal(m.body, 'ก, ข, ค และอีก 2 งาน');
});

test('มีสอบ: หัวข้อเป็นสอบ (วิชาไม่ซ้ำ) · งานส่งอยู่ในเนื้อความ', () => {
  const m = compose([
    { title: 'สอบย่อย บท 3', type: 'exam', subject: 'ฟิสิกส์' },
    { title: 'สอบเก็บคะแนน', type: 'exam', subject: 'ฟิสิกส์' },
    { title: 'แบบฝึกหัด 4.3', type: 'homework', subject: 'คณิตศาสตร์' },
  ]);
  assert.equal(m.title, 'พรุ่งนี้สอบ ฟิสิกส์');
  assert.equal(m.body, 'และมีงานต้องส่ง 1 งาน: แบบฝึกหัด 4.3 (คณิตศาสตร์)');
  assert.equal(compose([{ title: 'สอบกลางภาค', type: 'exam' }]).title, 'พรุ่งนี้สอบ สอบกลางภาค');
});

function loadSW() {
  const on = {}, shown = [], opened = [], focused = [];
  const win = { url: 'https://sabaii.test/app/#/home', navigate: async u => { win.url = u; }, focus: async () => { focused.push(win.url); } };
  let windows = [];
  const self = {
    addEventListener: (t, fn) => { on[t] = fn; },
    registration: { scope: 'https://sabaii.test/app/', showNotification: async (title, o) => { shown.push({ title, ...o }); } },
    clients: { matchAll: async () => windows, openWindow: async u => { opened.push(u); }, claim: async () => {} },
    skipWaiting: () => {},
  };
  vm.runInNewContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), { self, caches: {}, fetch: () => {}, location: { origin: 'https://sabaii.test' }, URL, Request: class {}, Promise });
  const fire = async (type, ev) => { let p; on[type]({ ...ev, waitUntil: x => { p = x; } }); await p; };
  return { fire, shown, opened, focused, win, setWindows: w => { windows = w; } };
}

test('service worker: push → แสดงแจ้งเตือนภาษาไทย · ข้อมูลเสียก็ยังแสดง', async () => {
  const sw = loadSW();
  await sw.fire('push', { data: { json: () => TEST_MESSAGE } });
  assert.equal(sw.shown[0].title, TEST_MESSAGE.title);
  assert.equal(sw.shown[0].body, TEST_MESSAGE.body);
  assert.equal(sw.shown[0].tag, 'sabaii-test');
  assert.equal(sw.shown[0].data.url, '#/me');
  await sw.fire('push', { data: { json: () => { throw new Error('x'); }, text: () => 'ข้อความดิบ' } });
  assert.equal(sw.shown[1].title, 'SABAii');
  assert.equal(sw.shown[1].body, 'ข้อความดิบ');
});

test('service worker: แตะแจ้งเตือน → ใช้หน้าต่างแอปที่เปิดอยู่ ไปหน้างาน · ไม่มีหน้าต่าง = เปิดใหม่', async () => {
  const sw = loadSW();
  const note = { close() { this.closed = true; }, data: { url: '#/tasks' } };
  sw.setWindows([sw.win]);
  await sw.fire('notificationclick', { notification: note });
  assert.ok(note.closed);
  assert.deepEqual(sw.focused, ['https://sabaii.test/app/#/tasks']);
  sw.setWindows([]);
  await sw.fire('notificationclick', { notification: { close() {}, data: {} } });
  assert.deepEqual(sw.opened, ['https://sabaii.test/app/#/tasks']);
});
