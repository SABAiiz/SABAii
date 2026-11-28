// โปรไฟล์บนเซิร์ฟเวอร์ตามค่าในเครื่อง (src/data/profile.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileSync, profilePatch } from '../src/data/profile.js';

function mem() { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; }

test('profilePatch: ชื่อว่างไม่ส่ง · ตัดช่องว่าง · มีวันทำแบบสอบถาม/เขตเวลาก็ส่ง', () => {
  assert.deepEqual(profilePatch({ display_name: '   ' }, ''), {});
  assert.deepEqual(profilePatch({ display_name: ' ปลา ', onboarded_at: '2026-11-28T10:00:00.000Z' }, 'Asia/Bangkok'),
    { display_name: 'ปลา', onboarded_at: '2026-11-28T10:00:00.000Z', timezone: 'Asia/Bangkok' });
});

test('ส่งเฉพาะที่เปลี่ยน · ล้มแล้วรอบหน้าส่งใหม่ · ไม่ได้เข้าสู่ระบบ = ไม่ทำอะไร', async () => {
  const sent = [], prefs = { display_name: 'ปลา' };
  let fail = false, uid = 'u1', touched = 0;
  const cloud = { user: () => uid && { id: uid }, touch: async () => { touched++; },
    updateProfile: async p => { if (fail) throw new Error('offline'); sent.push(p); } };
  const ps = createProfileSync({ cloud, getPrefs: () => prefs, storage: mem(), tz: () => 'Asia/Bangkok' });
  await ps.start();
  assert.equal(touched, 1);
  assert.deepEqual(sent, [{ display_name: 'ปลา', timezone: 'Asia/Bangkok' }]);
  await ps.flush();
  assert.equal(sent.length, 1); // ไม่มีอะไรเปลี่ยน
  fail = true; prefs.onboarded_at = '2026-11-28T10:00:00.000Z'; await ps.flush();
  fail = false; await ps.flush();
  assert.deepEqual(sent[1], { onboarded_at: '2026-11-28T10:00:00.000Z' });
  uid = null; prefs.display_name = 'ทอง'; await ps.start(); await ps.flush();
  assert.equal(sent.length, 2);
});
