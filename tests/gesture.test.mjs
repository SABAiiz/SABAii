// ตัวจับ "ปัด" ของโหมดโบกมือ (src/gesture/hand.js) — ป้อนจุดมือปลอมเป็นลำดับ ไม่ต้องใช้กล้อง
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSwipe, palmCenter } from '../src/gesture/hand.js';

// เคลื่อนจาก a ไป b ใน ms มิลลิวินาที ทีละ 33ms (≈30 เฟรม/วินาที) → คืนผลปัดที่เจอ
function move(sw, a, b, ms, t0 = 0) {
  const out = [], n = Math.max(1, Math.round(ms / 33));
  for (let i = 0; i <= n; i++) {
    const k = i / n, r = sw({ x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, t: t0 + i * 33 });
    if (r) out.push(r);
  }
  return out;
}

test('ปัดขวาเร็ว ๆ = right ครั้งเดียว', () => {
  assert.deepEqual(move(createSwipe(), [.3, .5], [.7, .52], 250), ['right']);
});
test('ปัดซ้าย / ขึ้น / ลง', () => {
  assert.deepEqual(move(createSwipe(), [.7, .5], [.3, .5], 250), ['left']);
  assert.deepEqual(move(createSwipe(), [.5, .7], [.5, .3], 250), ['up']);
  assert.deepEqual(move(createSwipe(), [.5, .3], [.5, .7], 250), ['down']);
});
test('ขยับช้า ๆ (ไม่ใช่การปัด) ไม่นับ', () => {
  assert.deepEqual(move(createSwipe(), [.3, .5], [.7, .5], 1600), []);
});
test('ระยะสั้นเกินไปไม่นับ', () => {
  assert.deepEqual(move(createSwipe(), [.45, .5], [.55, .5], 200), []);
});
test('ทแยง ไม่ชัดว่าทิศไหน ไม่นับ', () => {
  assert.deepEqual(move(createSwipe(), [.3, .3], [.6, .6], 250), []);
});
test('ปัดขวาแล้วดึงมือกลับทันที ไม่นับเป็นปัดซ้าย', () => {
  const sw = createSwipe();
  const a = move(sw, [.3, .5], [.7, .5], 250, 0);
  const b = move(sw, [.7, .5], [.3, .5], 250, 300);
  assert.deepEqual([...a, ...b], ['right']);
});
test('พักแล้วปัดซ้ายใหม่ได้', () => {
  const sw = createSwipe();
  move(sw, [.3, .5], [.7, .5], 250, 0);
  assert.deepEqual(move(sw, [.7, .5], [.3, .5], 250, 1500), ['left']);
});
test('มือหายกลางทาง = เริ่มนับใหม่', () => {
  const sw = createSwipe();
  sw({ x: .3, y: .5, t: 0 }); sw({ x: .4, y: .5, t: 33 }); sw(null);
  assert.deepEqual(move(sw, [.5, .5], [.6, .5], 100, 66), []);
});
test('จุดกลางฝ่ามือ กลับซ้ายขวาแบบกระจก', () => {
  const lm = Array.from({ length: 21 }, () => ({ x: .2, y: .6 }));
  const p = palmCenter(lm);
  assert.ok(Math.abs(p.x - .8) < 1e-9 && Math.abs(p.y - .6) < 1e-9);
});
