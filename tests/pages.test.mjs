// 0.10 สมุดจด: เรขาคณิตหน้ากระดาษ (ยางลบ · บ่วงเลือก · ย้าย/ย่อขยาย · รูปทรง · ค้นข้อความ) + ที่เก็บสมุด/หน้า
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/domain/pages.js';
import { memoryDB } from '../src/data/db.js';
import { createStore } from '../src/data/store.js';

const line = (id, x0, y0, x1, y1, w = 6) => ({ id, t: 'pen', c: '#000', w, p: [x0, y0, .5, (x0 + x1) / 2, (y0 + y1) / 2, .5, x1, y1, .5] });
const page = () => ({ ...G.blankPage('b1', 0), strokes: [line('a', 100, 100, 300, 100), line('b', 100, 600, 300, 700)], texts: [{ id: 't1', x: 500, y: 500, w: 200, s: 40, c: '#000', v: 'แรงลัพธ์' }], imgs: [] });

test('ยางลบ: โดนเส้นไหนลบเส้นนั้นทั้งเส้น · ไม่โดนไม่ลบ', () => {
  assert.deepEqual(G.strokesHit(page().strokes, 200, 104, 5), ['a']);
  assert.deepEqual(G.strokesHit(page().strokes, 600, 300, 10), []);
  assert.deepEqual(G.strokesHit([{ id: 'dot', w: 6, p: [50, 50, .5] }], 52, 52, 4), ['dot']);
});
test('บ่วงเลือก: เส้นที่อยู่ในบ่วงเกินครึ่ง + ข้อความที่จุดกลางอยู่ในบ่วง', () => {
  const sel = G.lassoPick(page(), [50, 50, 800, 50, 800, 400, 50, 400]);
  assert.deepEqual(sel.strokes, ['a']); assert.deepEqual(sel.texts, []);
  const all = G.lassoPick(page(), [0, 0, 1000, 0, 1000, 1000, 0, 1000]);
  assert.deepEqual(all.strokes, ['a', 'b']); assert.deepEqual(all.texts, ['t1']);
  assert.equal(G.inPoly(5, 5, [0, 0, 10, 0, 10, 10, 0, 10]), true);
  assert.equal(G.inPoly(15, 5, [0, 0, 10, 0, 10, 10, 0, 10]), false);
});
test('ย้าย/ย่อขยายสิ่งที่เลือก ไม่แก้หน้าเดิม (เลิกทำได้) · ทำสำเนา · ลบ', () => {
  const p = page(), sel = { strokes: ['a'], texts: ['t1'], imgs: [] };
  const moved = G.transformSel(p, sel, { dx: 10, dy: 20 });
  assert.equal(moved.strokes[0].p[0], 110); assert.equal(moved.strokes[0].p[1], 120); assert.equal(moved.texts[0].x, 510);
  assert.equal(p.strokes[0].p[0], 100, 'หน้าเดิมต้องไม่เปลี่ยน');
  assert.equal(moved.strokes[1], p.strokes[1], 'เส้นที่ไม่ได้เลือกใช้ของเดิม');
  const big = G.transformSel(p, sel, { k: 2, ox: 100, oy: 100 });
  assert.equal(big.strokes[0].p[6], 500); assert.equal(big.strokes[0].w, 12); assert.equal(big.texts[0].s, 80);
  const d = G.duplicateSel(p, sel);
  assert.equal(d.page.strokes.length, 3); assert.equal(d.page.texts.length, 2); assert.notEqual(d.sel.strokes[0], 'a');
  const r = G.removeSel(p, sel);
  assert.deepEqual(r.strokes.map(s => s.id), ['b']); assert.equal(r.texts.length, 0);
  const box = G.selBox(p, { strokes: ['a'], texts: [], imgs: [] });
  assert.deepEqual(box, { x0: 97, y0: 97, x1: 303, y1: 103 });
});
test('รูปทรง: เส้นตรง 2 จุด · ลูกศรมีหัว · สี่เหลี่ยมปิดมุม · วงกลมกลับมาที่เดิม', () => {
  assert.equal(G.shapePoints('line', 0, 0, 100, 0).length, 6);
  assert.equal(G.shapePoints('arrow', 0, 0, 100, 0).length, 15);
  const r = G.shapePoints('rect', 0, 0, 100, 50); assert.equal(r.length, 15); assert.deepEqual(r.slice(0, 2), r.slice(-3, -1));
  const c = G.shapePoints('circle', 0, 0, 100, 100); assert.ok(Math.abs(c[0] - c[c.length - 3]) < .01);
});
test('ลดจุดถี่ ๆ แต่เก็บจุดแรก/สุดท้าย', () => {
  const p = []; for (let i = 0; i <= 100; i++) p.push(i * .1, 0, .5);
  const t = G.thin(p, 1.2);
  assert.ok(t.length < p.length / 3); assert.equal(t[0], 0); assert.equal(t[t.length - 3], 10);
});
test('ค้นข้อความที่พิมพ์ในสมุด + ชื่อสมุด', () => {
  const books = [{ id: 'b1', title: 'สรุปฟิสิกส์' }], pages = { b1: [page()] };
  assert.equal(G.searchPages('แรง', books, id => pages[id]).length, 1);
  assert.equal(G.searchPages('ฟิสิกส์', books, id => pages[id])[0].page, null);
  assert.deepEqual(G.searchPages('  ', books, id => pages[id]), []);
});
test('ที่เก็บ: สร้างสมุดได้หน้าแรก · แทรกหน้าเรียงลำดับถูก · ลบหน้าเรียงใหม่ · ลบสมุดลบทุกหน้า · สำรอง/กู้คืน', async () => {
  const st = createStore(memoryDB());
  await st.load();
  const b = await st.addBook({ title: '  ', paper: 'grid' });
  assert.equal(b.title, 'สมุดจด');
  let ps = st.pagesOf(b.id);
  assert.equal(ps.length, 1); assert.equal(ps[0].paper, 'grid'); assert.equal(b.last_page, ps[0].id);
  const p2 = await st.addPage(b.id);
  const mid = await st.addPage(b.id, ps[0].id);
  assert.deepEqual(st.pagesOf(b.id).map(p => p.id), [ps[0].id, mid.id, p2.id]);
  await st.savePage({ ...mid, strokes: [line('x', 0, 0, 10, 10)] }, false);
  assert.equal(st.pagesOf(b.id)[1].strokes.length, 1);
  await st.removePage(ps[0].id);
  assert.deepEqual(st.pagesOf(b.id).map(p => p.order), [0, 1]);
  const json = st.exportJSON();
  const st2 = createStore(memoryDB()); await st2.load();
  await st2.restoreBackup(json);
  assert.equal(st2.state.books.length, 1); assert.equal(st2.pagesOf(b.id).length, 2); assert.equal(st2.pagesOf(b.id)[0].strokes.length, 1);
  await st.deleteBook(b.id);
  assert.equal(st.state.books.length, 0); assert.equal(st.state.pages.length, 0);
});
