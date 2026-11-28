// แจ้งเตือนรายวิชา (0.16): ข้อความ (supabase/functions/push-reminders/compose.js) + service worker แสดง/แตะแจ้งเตือน (sw.js)
// รัน: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { compose, when, TEST_MESSAGE } from '../supabase/functions/push-reminders/compose.js';

test('ไม่มีงาน = ไม่ส่ง', () => {
  assert.equal(compose({ slot: 's1', subject: 'คณิตศาสตร์', tasks: [] }), null);
  assert.equal(compose(null), null);
  assert.equal(compose({ slot: 's1', tasks: [{ title: '' }] }), null);
});

test('คำบอกวัน: วันนี้/พรุ่งนี้ (มีเวลา) · สอบอีก N วัน · เลยกำหนด', () => {
  assert.equal(when({ days: 0, time: '08:30:00' }), 'ส่งวันนี้ 08:30');
  assert.equal(when({ days: 1 }), 'ส่งพรุ่งนี้');
  assert.equal(when({ days: 1, type: 'exam', time: '09:00' }), 'สอบพรุ่งนี้ 09:00');
  assert.equal(when({ days: 3, type: 'exam' }), 'สอบอีก 3 วัน');
  assert.equal(when({ days: -2, time: '08:00' }), 'เลยกำหนด 2 วัน');
});

test('งานเดียว: หัว = วิชา (ตัด "ภาษา") · แตะแล้วไปหน้าวิชานั้น · แยกแจ้งเตือนตามวิชา', () => {
  const m = compose({ slot: 's_th', subject: 'ภาษาไทย', tasks: [{ title: 'เรียงความ', type: 'homework', days: 1, time: '08:30:00' }] });
  assert.equal(m.title, 'ไทย · มีงานต้องส่ง');
  assert.equal(m.body, 'เรียงความ (ส่งพรุ่งนี้ 08:30)');
  assert.equal(m.url, '#/subject/s_th');
  assert.equal(m.tag, 'sabaii-s_th');
  assert.equal(compose({ slot: 's', subject: 'เคมี', tasks: [{ title: 'รายงาน', days: -1 }] }).title, 'เคมี · งานค้าง');
  assert.equal(compose({ slot: 's', subject: 'ฟิสิกส์', tasks: [{ title: 'สอบย่อย', type: 'exam', days: 3 }] }).title, 'ฟิสิกส์ · สอบอีก 3 วัน');
});

test('หลายงาน: "ค้าง N งาน" · บรรทัดละงาน · เกิน 3 = "และอีก N งาน" · งานไม่มีวิชาไปหน้า none', () => {
  const tasks = ['ก', 'ข', 'ค', 'ง', 'จ'].map((t, i) => ({ title: t, type: 'homework', days: i - 1 }));
  const m = compose({ slot: '_none', subject: null, tasks });
  assert.equal(m.title, 'งานไม่มีวิชา · ค้าง 5 งาน');
  assert.equal(m.body, 'ก (เลยกำหนด 1 วัน)\nข (ส่งวันนี้)\nค (ส่งพรุ่งนี้)\nและอีก 2 งาน');
  assert.equal(m.url, '#/subject/none');
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
