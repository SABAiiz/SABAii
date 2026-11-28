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

// 0.10.1
const wobble = f => { const p = []; for (let i = 0; i <= 60; i++) { const [x, y] = f(i / 60); p.push(x + Math.sin(i * 1.7) * 3, y + Math.cos(i * 2.3) * 3, .5); } return p; };
test('ค้างไว้ = รูปทรงเป๊ะ: วงกลม · สี่เหลี่ยม · สามเหลี่ยม · เส้นตรง · ขีดมั่ว ๆ ไม่แปลง', () => {
  assert.equal(G.recognize(wobble(t => [300 + 120 * Math.cos(t * 6.28), 300 + 90 * Math.sin(t * 6.28)]))?.kind, 'circle');
  const sq = t => { const s = ((t + .1) % 1) * 4, k = Math.floor(s) % 4, u = s - Math.floor(s); return [[100 + 200 * u, 100], [300, 100 + 200 * u], [300 - 200 * u, 300], [100, 300 - 200 * u]][k]; };
  assert.equal(G.recognize(wobble(sq))?.kind, 'rect');
  const V = [[200, 100], [350, 360], [60, 340]];
  const tri = t => { const s = t * 3, k = Math.floor(s) % 3, u = s - Math.floor(s), a = V[k], b = V[(k + 1) % 3]; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; };
  const tr = G.recognize(wobble(tri)); assert.equal(tr?.kind, 'triangle'); assert.equal(tr.p.length, 12);
  const ln = G.recognize(wobble(t => [100 + 400 * t, 200 + 50 * t])); assert.equal(ln?.kind, 'line'); assert.equal(ln.p.length, 6);
  assert.equal(G.recognize(wobble(t => [100 + 400 * t, 200 + Math.sin(t * 40) * 60])), null);
  assert.equal(G.recognize([0, 0, .5, 5, 5, .5, 10, 0, .5, 12, 3, .5]), null, 'เล็กเกินไป');
});
test('หมึก: ช้า = หนา เร็ว = บาง · ขอบเส้นหัวท้ายเรียว', () => {
  let slow = .5, fast = .5;
  for (let i = 0; i < 20; i++) { slow = G.speedPressure(slow, .1); fast = G.speedPressure(fast, 3); }
  assert.ok(slow > .7 && fast < .3, `${slow} ${fast}`);
  const p = []; for (let i = 0; i < 12; i++) p.push(i * 20, 0, .5);
  const o = G.inkOutline(p, 10);
  assert.equal(o.L.length, 12);
  assert.ok(o.rad[0] < o.rad[6] && o.rad[11] < o.rad[6], 'หัวท้ายเรียวกว่ากลางเส้น');
  assert.ok(Math.abs(o.L[6][1] - o.R[6][1] - 2 * o.rad[6]) < 1e-9);
  assert.equal(G.inkOutline([0, 0, .5, 1, 1, .5], 6), null);
});
test('ทำสำเนาหน้า: วางต่อจากหน้าเดิม เนื้อหาเหมือนกัน แก้ฉบับใหม่ไม่กระทบของเดิม', async () => {
  const st = createStore(memoryDB()); await st.load();
  const b = await st.addBook({ title: 'x' });
  const [p0] = st.pagesOf(b.id);
  await st.addPage(b.id);
  await st.savePage({ ...p0, paper: 'board', strokes: [line('s', 0, 0, 9, 9)], texts: [{ id: 't', x: 0, y: 0, w: 9, s: 9, c: '#fff', v: 'ก' }] }, false);
  const d = await st.duplicatePage(p0.id);
  const ps = st.pagesOf(b.id);
  assert.equal(ps[1].id, d.id); assert.equal(ps.length, 3);
  assert.equal(d.paper, 'board'); assert.equal(d.strokes.length, 1); assert.equal(d.texts[0].v, 'ก');
  d.texts[0].v = 'ข'; assert.equal(st.pagesOf(b.id)[0].texts[0].v, 'ก');
});

// 0.11 หน้าปก + สารบัญ
test('หัวข้อของหน้า: ตัวใหญ่บนสุดก่อน · ไม่มีตัวใหญ่ใช้ข้อความบนสุด · ไม่มีเลย = null', () => {
  const T = (y, s, v) => ({ id: v, x: 100, y, w: 600, s, c: '#000', v });
  assert.equal(G.pageTitle({ texts: [T(400, 30, 'เนื้อหา'), T(120, 56, 'กฎของโอห์ม\nบรรทัดสอง'), T(80, 30, 'วันที่')] }), 'กฎของโอห์ม');
  assert.equal(G.pageTitle({ texts: [T(200, 30, 'สรุปบท 3'), T(500, 30, 'อื่น')] }), 'สรุปบท 3');
  assert.equal(G.pageTitle({ texts: [T(900, 30, 'ท้ายหน้า')] }), null);
  assert.equal(G.pageTitle({ texts: [T(100, 40, '   ')] }), null);
  assert.equal(G.pageTitle({}), null);
  assert.equal(G.pageTitle({ texts: [T(100, 40, 'ก'.repeat(80))] }).length, 60);
});
test('สารบัญ: ข้ามหน้าปก เลขหน้าตามลำดับในเล่ม', () => {
  const rows = G.tocOf([{ id: 'c', cover: true, texts: [] }, { id: 'a', texts: [{ x: 0, y: 100, s: 50, v: 'บทนำ' }] }, { id: 'b', texts: [] }]);
  assert.deepEqual(rows.map(r => [r.n, r.id, r.title]), [[2, 'a', 'บทนำ'], [3, 'b', null]]);
});
test('ที่เก็บ: สร้างเล่มแบบมีหน้าปก → หน้าปก + หน้าเขียน · เปิดครั้งแรกที่หน้าปก · หน้าใหม่ไม่ได้กระดาษว่างของหน้าปก', async () => {
  const st = createStore(memoryDB()); await st.load();
  const b = await st.addBook({ title: 'โครงงาน', paper: 'grid', cover: true });
  const ps = st.pagesOf(b.id);
  assert.equal(ps.length, 2); assert.equal(ps[0].cover, true); assert.equal(ps[1].paper, 'grid'); assert.equal(b.last_page, ps[0].id);
  const n = await st.addPage(b.id, ps[0].id); assert.equal(n.paper, 'grid');
  const d = await st.duplicatePage(ps[0].id); assert.equal(d.paper, 'grid'); assert.ok(!d.cover);
});

// 0.11.1 หน้าในสมุด ↔ โน้ตของงาน
test('ผูกหน้าเข้าโน้ตงาน: ผูกซ้ำได้อันเดิม · ลบหน้า/ลบเล่ม = โน้ตที่ผูกหายตาม · สำรองรวมลิงก์', async () => {
  const st = createStore(memoryDB()); await st.load();
  const [t] = await st.addTasks([{ title: 'การบ้าน', type: 'homework' }]);
  const b = await st.addBook({ title: 'x' });
  const p1 = st.pagesOf(b.id)[0], p2 = await st.addPage(b.id);
  const a1 = await st.linkPage(t.id, p1.id), again = await st.linkPage(t.id, p1.id);
  assert.equal(a1.id, again.id); assert.equal(a1.kind, 'page'); assert.equal(a1.page_id, p1.id);
  await st.linkPage(t.id, p2.id);
  assert.equal(st.attachmentsOf(t.id).length, 2);
  assert.ok(JSON.parse(st.exportJSON()).notes.some(n => n.kind === 'page' && n.page_id === p1.id));
  await st.removePage(p1.id);
  assert.deepEqual(st.attachmentsOf(t.id).map(a => a.page_id), [p2.id]);
  await st.deleteBook(b.id);
  assert.equal(st.attachmentsOf(t.id).length, 0);
});

/* ---------- 0.12 ชิ้นงานแบบ Canva ---------- */
const box = (id, k, x, y, w, h, extra = {}) => ({ id, k, x, y, w, h, r: 0, c: '#000', f: null, sw: 6, v: '', s: 36, ...extra });
const canvasPage = () => ({ ...page(), shapes: [box('h1', 'rect', 100, 100, 200, 100), box('h2', 'circle', 600, 600, 200, 200)],
  lines: [{ id: 'l1', a: { x: 300, y: 150, to: 'h1', side: 'e' }, b: { x: 600, y: 700, to: 'h2', side: 'w' }, c: '#000', w: 6, hd: 1, st: 'straight' }] });

test('0.12 รูปทรง: โครงปิดทุกชนิด · จุดในรูป (หมุนแล้วก็ถูก)', () => {
  for (const k of Object.keys(G.SHAPE_KINDS)) { const p = G.shapeOutline(k, 200, 100); assert.ok(p.length >= 6 && p.length % 2 === 0, k); assert.ok(Math.max(...p.filter((_, i) => i % 2 === 0)) <= 200.01, k); }
  const o = box('x', 'rect', 0, 0, 200, 20);
  assert.equal(G.inShape(o, 180, 10), true);
  assert.equal(G.inShape({ ...o, r: Math.PI / 2 }, 180, 10), false, 'หมุน 90° แล้วปลายขวาไม่อยู่ตรงนั้นแล้ว');
  assert.equal(G.inShape({ ...o, r: Math.PI / 2 }, 100, 90), true);
  assert.equal(G.inShape(box('d', 'diamond', 0, 0, 100, 100), 5, 5), false, 'มุมกรอบของข้าวหลามตัดไม่ใช่ตัวรูป');
});
test('0.12 เส้นเชื่อม: ปลายเกาะรูปทรง → ย้ายรูปแล้วเส้นตาม · ลบรูปแล้วปลายค้างที่เดิม', () => {
  const p = canvasPage();
  assert.deepEqual(G.linePts(p, p.lines[0]), [300, 150, 600, 700]);
  const moved = G.transformSel(p, { ...G.emptySel(), shapes: ['h2'] }, { dx: 100, dy: 0 });
  assert.deepEqual(G.linePts(moved, moved.lines[0]), [300, 150, 700, 700]);
  assert.equal(moved.lines[0], p.lines[0], 'เส้นที่ไม่ได้เลือกไม่ต้องแก้ข้อมูล');
  const gone = G.removeSel(p, { ...G.emptySel(), shapes: ['h2'] });
  assert.equal(gone.lines[0].b.to, undefined); assert.deepEqual([gone.lines[0].b.x, gone.lines[0].b.y], [600, 700]);
  assert.equal(gone.lines[0].a.to, 'h1');
  const s = G.snapEnd(p, 598, 702, 20);
  assert.equal(s.to, 'h2'); assert.equal(s.side, 'w');
  assert.equal(G.snapEnd(p, 450, 400, 20), null);
  const el = G.linePts(p, { ...p.lines[0], st: 'elbow' });
  assert.deepEqual(el, [300, 150, 450, 150, 450, 700, 600, 700], 'หักมุมออกตามด้านที่เกาะ');
  assert.equal(G.linePts(p, { ...p.lines[0], st: 'curve' }).length, 50);
});
test('0.12 เลือก/ชั้น/หมุน/ย่อขยาย/คัดลอก', () => {
  const p = canvasPage();
  assert.equal(G.hitItem(p, 150, 120, 5).o.id, 'h1');
  assert.equal(G.hitItem(p, 450, 425, 8).k, 'lines');
  assert.equal(G.hitItem(p, 900, 100, 5), null);
  const front = G.restack(p, { ...G.emptySel(), shapes: ['h1'] }, true);
  assert.equal(G.ordered(front).at(-1).o.id, 'h1');
  const back = G.restack(p, { ...G.emptySel(), texts: ['t1'] }, false);
  assert.equal(G.ordered(back)[0].o.id, 't1');
  const rot = G.transformSel(p, { ...G.emptySel(), shapes: ['h1'] }, { rot: Math.PI / 2, cx: 200, cy: 150 });
  assert.equal(rot.shapes[0].r, 1.5708); assert.equal(rot.shapes[0].x, 100);
  const f = G.resizeFrame({ cx: 200, cy: 150, w: 200, h: 100, r: 0 }, 1, 0, 150, 0);
  assert.deepEqual([f.cx, f.w, f.h], [225, 250, 100], 'ลากขอบขวา: ขอบซ้ายอยู่ที่เดิม');
  const c = G.resizeFrame({ cx: 200, cy: 150, w: 200, h: 100, r: 0 }, 1, 1, 200, 50, { keep: true });
  assert.equal(c.w / c.h, 2);
  const lasso = G.lassoPick(p, [0, 0, 1000, 0, 1000, 1000, 0, 1000]);
  assert.deepEqual([lasso.shapes.length, lasso.lines.length], [2, 1]);
  const { page: pp, sel } = G.pasteItems(p, G.copyItems(p, { ...G.emptySel(), shapes: ['h1', 'h2'], lines: ['l1'] }), 30);
  assert.equal(pp.shapes.length, 4); assert.equal(pp.lines.length, 2);
  const nl = pp.lines.find(l => l.id === sel.lines[0]);
  assert.deepEqual([nl.a.to, nl.b.to], sel.shapes, 'เส้นที่ก๊อปเกาะรูปทรงที่ก๊อปมา');
  assert.equal(G.isBlank(G.blankPage('b', 0)), true); assert.equal(G.isBlank(p), false);
  assert.deepEqual(G.norm({ strokes: [] }).shapes, []);
});
test('0.12 ค้างปากกา: ข้าวหลามตัด · สามเหลี่ยมตั้ง (ใช้เป็นรูปทรงจริงได้) · กรอบของรูป', () => {
  const dia = t => { const a = t * 4, i = Math.floor(a) % 4, f = a - Math.floor(a), P = [[300, 100], [500, 300], [300, 500], [100, 300], [300, 100]]; return [P[i][0] + (P[i + 1][0] - P[i][0]) * f, P[i][1] + (P[i + 1][1] - P[i][1]) * f]; };
  const r = G.recognize(wobble(dia));
  assert.equal(r?.kind, 'diamond'); assert.ok(Math.abs(r.box.x0 - 100) < 15 && Math.abs(r.box.y1 - 500) < 15);
  const tri = t => { const a = t * 3, i = Math.floor(a) % 3, f = a - Math.floor(a), P = [[300, 100], [500, 450], [100, 450], [300, 100]]; return [P[i][0] + (P[i + 1][0] - P[i][0]) * f, P[i][1] + (P[i + 1][1] - P[i][1]) * f]; };
  assert.equal(G.recognize(wobble(tri))?.upright, true);
});
