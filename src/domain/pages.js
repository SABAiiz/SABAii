// สมุดจด (0.10) — เรขาคณิตของหน้ากระดาษ: ฟังก์ชันล้วน ไม่แตะ DOM/ที่เก็บข้อมูล (เทสต์ได้ใน Node)
// หน้าหนึ่งกว้าง 1000 หน่วย สูง 1414 (สัดส่วน A4) — จอไหนก็ย่อ/ขยายจากหน่วยนี้ ลายมือไม่เพี้ยน
// เส้น: { id, t: 'pen'|'hl', c: สี, w: ความหนา (หน่วย), p: [x, y, แรงกด(0–1), x, y, แรงกด, …] }
// ข้อความ: { id, x, y, w, s: ขนาดตัวอักษร, c, v, r? } · รูป: { id, x, y, w, h, blob, r? }
// 0.14 ชิ้นงานแบบ Canva — รูปทรง: { id, k: ชนิด, x, y, w, h, r: มุมหมุน (เรเดียน), c: สีเส้น, f: null|'tint'|'solid', sw: ความหนาเส้น, v: ข้อความในรูป, s: ขนาดตัวอักษร }
// เส้นเชื่อม: { id, a: ปลาย, b: ปลาย, c, w, hd: 0 ไม่มีหัว|1 หัวปลาย|2 สองหัว, st: 'straight'|'elbow'|'curve' } · ปลาย = { x, y, to?: id รูปทรง, side?: 'n'|'e'|'s'|'w' } (ติดรูปทรง = ย้ายรูปแล้วเส้นตาม)
// ทุกชิ้นมี z (ลำดับชั้น) ได้ — ไม่มี = ชั้นตามชนิด (รูป < รูปทรง < ลายมือ < เส้นเชื่อม < ข้อความ)
export const PAGE_W = 1000, PAGE_H = 1414;
export const PAPERS = { lined: 'มีเส้น', grid: 'ตาราง', dots: 'จุด', blank: 'ว่าง', cornell: 'คอร์เนลล์', todo: 'เช็กลิสต์', board: 'กระดานดำ' };
export const DARK_PAPERS = ['board'];
export const INKS = ['#0B1B4D', '#0A6CF1', '#E45465', '#16B76A', '#F4A340', '#8B5CF6'];
export const CHALKS = ['#FFFFFF', '#FFE066', '#FF8FA3', '#8CE99A', '#74C0FC', '#B197FC'];
export const HIGHLIGHTS = ['#FFE14D', '#7CF2B4', '#8FD3FF', '#FFA3C8', '#FFC078'];
export const SIZES = { pen: [3, 6, 11], hl: [22, 34, 48], text: [30, 40, 56], eraser: [14, 28, 50] };

let seq = 0;
export const pid = (p = 'k') => p + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);
export const blankPage = (book_id, order, paper = 'lined', now = new Date().toISOString()) =>
  ({ id: pid('p'), book_id, order, paper, strokes: [], texts: [], imgs: [], shapes: [], lines: [], created_at: now, updated_at: now });

/* ---------- 0.14 ชิ้นงาน: ทุกอย่างบนหน้าเป็นชิ้นที่จับได้ ---------- */
export const KINDS = ['strokes', 'texts', 'imgs', 'shapes', 'lines'];
export const SHAPE_KINDS = { rect: 'สี่เหลี่ยม', round: 'สี่เหลี่ยมมน', circle: 'วงกลม', triangle: 'สามเหลี่ยม', diamond: 'ข้าวหลามตัด', hexagon: 'หกเหลี่ยม', star: 'ดาว', bubble: 'กล่องคำพูด', barrow: 'ลูกศรหนา' };
export const LINE_KINDS = { line: 'เส้นตรง', arrow: 'ลูกศร' };
export const LINE_STYLES = { straight: 'เส้นตรง', elbow: 'หักมุม', curve: 'โค้ง' };
/** หน้าเก่า (ก่อน 0.14) ไม่มีช่องรูปทรง/เส้นเชื่อม → เติมให้ครบ */
export const norm = p => p && (p.shapes && p.lines ? p : { ...p, shapes: p.shapes || [], lines: p.lines || [] });
export const isBlank = p => !p.strokes.length && !p.texts.length && !p.imgs.length && !(p.shapes || []).length && !(p.lines || []).length;
export const emptySel = () => ({ strokes: [], texts: [], imgs: [], shapes: [], lines: [] });
export const selCount = sel => sel ? KINDS.reduce((n, k) => n + (sel[k]?.length || 0), 0) : 0;
const inSel = (sel, k, id) => !!sel[k]?.includes(id);
const BASE_Z = { imgs: 0, shapes: 1, strokes: 2, lines: 3, texts: 4 };
const zOf = (k, o, i) => o.z ?? BASE_Z[k] + i * 1e-6;
/** ทุกชิ้นเรียงตามชั้น (ล่าง → บน) → [{ k, o }] */
export function ordered(page) {
  const out = [];
  for (const k of KINDS) (page[k] || []).forEach((o, i) => out.push({ k, o, z: zOf(k, o, i) }));
  return out.sort((a, b) => a.z - b.z);
}
/** เอาไว้หน้าสุด / หลังสุด */
export function restack(page, sel, front = true) {
  const all = ordered(page);
  if (!all.length) return page;
  let z = front ? all[all.length - 1].z : all[0].z;
  const pick = all.filter(x => inSel(sel, x.k, x.o.id));
  const map = new Map();
  for (const x of front ? pick : pick.reverse()) { z += front ? 1 : -1; map.set(x.o.id, z); }
  const out = { ...page };
  for (const k of KINDS) if (sel[k]?.length) out[k] = page[k].map(o => map.has(o.id) ? { ...o, z: map.get(o.id) } : o);
  return out;
}
const rotP = (x, y, cx, cy, a) => { if (!a) return [x, y]; const c = Math.cos(a), s = Math.sin(a), dx = x - cx, dy = y - cy; return [cx + dx * c - dy * s, cy + dx * s + dy * c]; };
export { rotP };
/** กรอบหมุนได้ของชิ้นแบบกล่อง (รูปทรง/รูป/ข้อความ) → { cx, cy, w, h, r } */
export const frameOf = (o, hgt = o.h) => ({ cx: o.x + o.w / 2, cy: o.y + hgt / 2, w: o.w, h: hgt, r: o.r || 0 });
/** กรอบตั้งตรงที่ล้อมกรอบหมุน */
export function frameBox(f) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const [x, y] = rotP(f.cx + sx * f.w / 2, f.cy + sy * f.h / 2, f.cx, f.cy, f.r);
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1 };
}
/** ย่อขยายกรอบด้วยมือจับ (hx, hy ∈ −1/0/1 · มุม = สองค่าไม่ศูนย์) · lx, ly = นิ้วในพิกัดของกรอบ (เทียบจุดกลาง ยังไม่หมุน) · keep = คงสัดส่วน */
export function resizeFrame(f, hx, hy, lx, ly, { keep = false, min = 16 } = {}) {
  const ax = -hx * f.w / 2, ay = -hy * f.h / 2;
  let w = hx ? Math.max(min, (lx - ax) * hx) : f.w, h = hy ? Math.max(min, (ly - ay) * hy) : f.h;
  if (keep && hx && hy) { const k = Math.max(w / f.w, h / f.h); w = f.w * k; h = f.h * k; }
  const [cx, cy] = rotP(f.cx + (hx ? ax + hx * w / 2 : 0), f.cy + (hy ? ay + hy * h / 2 : 0), f.cx, f.cy, f.r);
  return { cx, cy, w, h, r: f.r };
}

/** โครงรูปทรงเป็นจุด (พิกัดในกล่อง 0..w, 0..h ยังไม่หมุน) → [x, y, x, y, …] รูปปิด */
export function shapeOutline(k, w, h) {
  const o = [], P = (x, y) => o.push(r1(x), r1(y)), PI = Math.PI;
  const arc = (cx, cy, rx, ry, a0, a1, n = 6) => { for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; P(cx + rx * Math.cos(a), cy + ry * Math.sin(a)); } };
  if (k === 'circle') for (let i = 0; i < 48; i++) { const a = i / 48 * PI * 2; P(w / 2 + w / 2 * Math.cos(a), h / 2 + h / 2 * Math.sin(a)); }
  else if (k === 'round') { const r = Math.min(w, h) * .2; arc(w - r, r, r, r, -PI / 2, 0); arc(w - r, h - r, r, r, 0, PI / 2); arc(r, h - r, r, r, PI / 2, PI); arc(r, r, r, r, PI, PI * 1.5); }
  else if (k === 'triangle') { P(w / 2, 0); P(w, h); P(0, h); }
  else if (k === 'diamond') { P(w / 2, 0); P(w, h / 2); P(w / 2, h); P(0, h / 2); }
  else if (k === 'hexagon') { P(w * .25, 0); P(w * .75, 0); P(w, h / 2); P(w * .75, h); P(w * .25, h); P(0, h / 2); }
  else if (k === 'star') for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, f = i % 2 ? .4 : 1; P((Math.cos(a) * f / .951 + 1) / 2 * w, (Math.sin(a) * f + 1) / 1.809 * h); }
  else if (k === 'bubble') { const bh = h * .78, r = Math.min(w * .2, bh * .3); arc(w - r, r, r, r, -PI / 2, 0); arc(w - r, bh - r, r, r, 0, PI / 2); P(w * .42, bh); P(w * .2, h); P(w * .26, bh); arc(r, bh - r, r, r, PI / 2, PI); arc(r, r, r, r, PI, PI * 1.5); }
  else if (k === 'barrow') { P(0, h * .3); P(w * .62, h * .3); P(w * .62, 0); P(w, h / 2); P(w * .62, h); P(w * .62, h * .7); P(0, h * .7); }
  else { P(0, 0); P(w, 0); P(w, h); P(0, h); }
  return o;
}
/** ช่องข้อความในรูปทรง (สัดส่วนของกล่อง): กว้าง · จุดกลางแนวตั้ง */
export const shapeTextArea = k => ({ triangle: [.56, .66], diamond: [.6, .5], star: [.44, .56], bubble: [.8, .39], hexagon: [.7, .5], circle: [.72, .5], barrow: [.56, .5] })[k] || [.84, .5];
/** จุดอยู่บนรูปทรงไหม */
export function inShape(o, x, y) {
  const [lx, ly] = rotP(x, y, o.x + o.w / 2, o.y + o.h / 2, -(o.r || 0));
  return inPoly(lx - o.x, ly - o.y, shapeOutline(o.k, o.w, o.h));
}

/* ---------- เส้นเชื่อม ---------- */
const SIDES = { n: [.5, 0, 0, -1], e: [1, .5, 1, 0], s: [.5, 1, 0, 1], w: [0, .5, -1, 0] };
/** จุดเกาะบนขอบรูปทรง (หมุนตามรูป) → { x, y, nx, ny } */
export function anchorOf(o, side) {
  const [u, v, nx, ny] = SIDES[side] || SIDES.e, cx = o.x + o.w / 2, cy = o.y + o.h / 2, r = o.r || 0;
  // รูปทรงที่ขอบไม่ถึงกรอบ (สามเหลี่ยม/ดาว/กล่องคำพูด) — ขยับจุดเกาะเข้ามาที่ขอบจริง
  let lx = u * o.w, ly = v * o.h;
  if (o.k === 'triangle' && (side === 'e' || side === 'w')) lx = side === 'e' ? o.w * .75 : o.w * .25;
  if (o.k === 'bubble' && side === 's') ly = o.h * .78;
  if (o.k === 'bubble' && (side === 'e' || side === 'w')) ly = o.h * .39;
  if (o.k === 'star' && side === 's') ly = o.h * .87;
  const [x, y] = rotP(o.x + lx, o.y + ly, cx, cy, r), [ex, ey] = rotP(nx, ny, 0, 0, r);
  return { x, y, nx: ex, ny: ey };
}
/** ปลายเส้น → ตำแหน่งจริง (ติดรูปทรงอยู่ = ตามรูปทรง · รูปทรงหายแล้ว = ที่เก็บไว้) */
export function endOf(page, e) {
  const o = e.to && (page.shapes || []).find(s => s.id === e.to);
  return o ? anchorOf(o, e.side) : { x: e.x, y: e.y, nx: null, ny: null };
}
/** หาจุดเกาะใกล้นิ้วที่สุด (ระยะ tol · นิ้วอยู่ในรูปทรง = จุดเกาะที่ใกล้สุดของรูปนั้น) → { to, side, x, y } หรือ null */
export function snapEnd(page, x, y, tol, skip = null) {
  let best = null, bd = tol;
  for (const o of page.shapes || []) {
    if (o.id === skip) continue;
    const inside = inShape(o, x, y);
    for (const side of Object.keys(SIDES)) {
      const a = anchorOf(o, side), d = Math.hypot(a.x - x, a.y - y);
      if (d < bd || inside && (!best || best.to !== o.id || d < best.d)) { if (d < bd) bd = d; best = { to: o.id, side, x: a.x, y: a.y, d }; }
    }
  }
  return best;
}
/** จุดของเส้นเชื่อม (เส้นโค้งแบ่งเป็นช่วงย่อย) → [x, y, …] */
export function linePts(page, l) {
  const A = endOf(page, l.a), B = endOf(page, l.b), dx = B.x - A.x, dy = B.y - A.y;
  const dirOf = (E, sx, sy) => E.nx != null ? [E.nx, E.ny] : Math.abs(sx) >= Math.abs(sy) ? [Math.sign(sx) || 1, 0] : [0, Math.sign(sy) || 1];
  if (l.st === 'curve') {
    const na = dirOf(A, dx, dy), nb = dirOf(B, -dx, -dy), d = Math.max(40, Math.hypot(dx, dy) * .42), out = [];
    const c1 = [A.x + na[0] * d, A.y + na[1] * d], c2 = [B.x + nb[0] * d, B.y + nb[1] * d];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, m = 1 - t;
      out.push(r1(m * m * m * A.x + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t * t * t * B.x), r1(m * m * m * A.y + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t * t * t * B.y));
    }
    return out;
  }
  if (l.st === 'elbow') {
    const hA = A.nx != null ? Math.abs(A.nx) > Math.abs(A.ny) : Math.abs(dx) >= Math.abs(dy);
    const hB = B.nx != null ? Math.abs(B.nx) > Math.abs(B.ny) : hA;
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    const mid = hA && hB ? [mx, A.y, mx, B.y] : !hA && !hB ? [A.x, my, B.x, my] : hA ? [B.x, A.y] : [A.x, B.y];
    return [A.x, A.y, ...mid, B.x, B.y].map(r1);
  }
  return [A.x, A.y, B.x, B.y].map(r1);
}
const polyBox = (p, pad = 0) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); y0 = Math.min(y0, p[i + 1]); x1 = Math.max(x1, p[i]); y1 = Math.max(y1, p[i + 1]); } return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad }; };
export const lineBox = (page, l) => polyBox(linePts(page, l), l.w / 2 + (l.hd ? l.w * 2 : 0));
export function nearLine(page, l, x, y, tol) {
  const p = linePts(page, l);
  for (let i = 2; i < p.length; i += 2) if (distSeg(x, y, p[i - 2], p[i - 1], p[i], p[i + 1]) <= tol + l.w / 2) return true;
  return false;
}
/** กรอบตั้งตรงของชิ้นใดก็ได้ */
export function itemBox(page, k, o, textH = t => t.s * 1.5) {
  if (k === 'strokes') return strokeBox(o);
  if (k === 'lines') return lineBox(page, o);
  return frameBox(frameOf(o, k === 'texts' ? textH(o) : o.h));
}
/** ชิ้นบนสุดที่อยู่ใต้นิ้ว → { k, o } หรือ null */
export function hitItem(page, x, y, tol, textH = t => t.s * 1.5) {
  const all = ordered(page);
  for (let i = all.length - 1; i >= 0; i--) {
    const { k, o } = all[i];
    if (k === 'strokes') { if (strokesHit([o], x, y, tol).length) return { k, o }; }
    else if (k === 'lines') { if (nearLine(page, o, x, y, tol)) return { k, o }; }
    else if (k === 'shapes') { if (inShape(o, x, y) || o.f == null && nearOutline(o, x, y, tol)) return { k, o }; }
    else {
      const f = frameOf(o, k === 'texts' ? textH(o) : o.h), [lx, ly] = rotP(x, y, f.cx, f.cy, -f.r), pad = k === 'texts' ? tol : 0;
      if (Math.abs(lx - f.cx) <= f.w / 2 + pad && Math.abs(ly - f.cy) <= f.h / 2 + pad) return { k, o };
    }
  }
  return null;
}
function nearOutline(o, x, y, tol) {
  const [lx, ly] = rotP(x, y, o.x + o.w / 2, o.y + o.h / 2, -(o.r || 0)), p = shapeOutline(o.k, o.w, o.h), n = p.length;
  for (let i = 0; i < n; i += 2) if (distSeg(lx - o.x, ly - o.y, p[i], p[i + 1], p[(i + 2) % n], p[(i + 3) % n]) <= tol + (o.sw || 0)) return true;
  return false;
}

/** จุดบนเส้น (x, y) ทีละคู่ */
export function* pts(s) { for (let i = 0; i < s.p.length; i += 3) yield [s.p[i], s.p[i + 1], s.p[i + 2]]; }

/** ระยะจากจุดถึงส่วนของเส้นตรง */
export function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** ยางลบแบบลบทั้งเส้น: เส้นไหนโดนวงยาง (รัศมี r) คืน id ออกมา */
export function strokesHit(strokes, x, y, r) {
  const out = [];
  for (const s of strokes) {
    const pad = r + s.w / 2, p = s.p;
    if (p.length === 3) { if (Math.hypot(p[0] - x, p[1] - y) <= pad) out.push(s.id); continue; }
    for (let i = 3; i < p.length; i += 3) if (distSeg(x, y, p[i - 3], p[i - 2], p[i], p[i + 1]) <= pad) { out.push(s.id); break; }
  }
  return out;
}

/** จุดอยู่ในรูปหลายเหลี่ยมไหม (ray casting) · poly = [x, y, x, y, …] */
export function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** บ่วงเลือก: เส้นที่จุดเกินครึ่งอยู่ในบ่วง · ข้อความ/รูปที่จุดกลางอยู่ในบ่วง */
export function lassoPick(page, poly) {
  if (poly.length < 6) return emptySel();
  const strokes = page.strokes.filter(s => { let n = 0, k = 0; for (const [x, y] of pts(s)) { n++; if (inPoly(x, y, poly)) k++; } return n && k / n >= 0.5; }).map(s => s.id);
  const mid = o => inPoly(o.x + (o.w || 0) / 2, o.y + (o.h || o.s || 0) / 2, poly);
  const lmid = l => { const p = linePts(page, l), i = Math.floor(p.length / 4) * 2; return inPoly(p[i], p[i + 1], poly) && inPoly(p[0], p[1], poly) && inPoly(p[p.length - 2], p[p.length - 1], poly); };
  return { strokes, texts: page.texts.filter(mid).map(t => t.id), imgs: page.imgs.filter(mid).map(i => i.id), shapes: (page.shapes || []).filter(mid).map(o => o.id), lines: (page.lines || []).filter(lmid).map(l => l.id) };
}

/** กรอบล้อมของเส้น */
export function strokeBox(s) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts(s)) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  const r = s.w / 2;
  return { x0: x0 - r, y0: y0 - r, x1: x1 + r, y1: y1 + r };
}

/** กรอบล้อมของสิ่งที่เลือกทั้งหมด (textH = ความสูงข้อความจริงที่วัดจากหน้าจอ ถ้ามี) */
export function selBox(page, sel, textH = t => t.s * 1.5) {
  const bs = [];
  for (const k of KINDS) for (const o of page[k] || []) if (inSel(sel, k, o.id)) bs.push(itemBox(page, k, o, textH));
  if (!bs.length) return null;
  return bs.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }));
}

function r1(v) { return Math.round(v * 10) / 10; }
/** ย้าย/ย่อขยาย/หมุนสิ่งที่เลือก: จุด → หมุนรอบ (cx, cy) ด้วย rot → ย่อขยายรอบ (ox, oy) ด้วย k → เลื่อน (dx, dy)
 *  คืนหน้าใหม่ (ไม่แก้ของเดิม เลิกทำได้) · เส้นเชื่อมที่ติดรูปทรงซึ่งไม่ได้เลือกด้วย = หลุดออกมาเป็นปลายอิสระ */
export function transformSel(page, sel, { dx = 0, dy = 0, k = 1, ox = 0, oy = 0, rot = 0, cx = 0, cy = 0 }, textH = t => t.s * 1.5) {
  const M = (x, y) => { [x, y] = rotP(x, y, cx, cy, rot); return [r1(ox + (x - ox) * k + dx), r1(oy + (y - oy) * k + dy)]; };
  const box = (o, hgt) => { const [nx, ny] = M(o.x + o.w / 2, o.y + hgt / 2), w = o.w * k; return { x: r1(nx - w / 2), y: r1(ny - hgt * k / 2), w: r1(w), ...(rot || o.r ? { r: Math.round(((o.r || 0) + rot) * 1e4) / 1e4 } : {}) }; };
  const end = e => {
    if (e.to && inSel(sel, 'shapes', e.to) && (page.shapes || []).some(s => s.id === e.to)) return e;
    const p = endOf(page, e), [x, y] = M(p.x, p.y);
    return { x, y };
  };
  return {
    ...page,
    strokes: page.strokes.map(s => !inSel(sel, 'strokes', s.id) ? s : { ...s, w: r1(s.w * k), p: s.p.flatMap((v, i, a) => i % 3 ? [] : [...M(v, a[i + 1]), a[i + 2]]) }),
    texts: page.texts.map(t => !inSel(sel, 'texts', t.id) ? t : { ...t, ...box(t, textH(t)), s: r1(t.s * k) }),
    imgs: page.imgs.map(i => !inSel(sel, 'imgs', i.id) ? i : { ...i, ...box(i, i.h), h: r1(i.h * k) }),
    shapes: (page.shapes || []).map(o => !inSel(sel, 'shapes', o.id) ? o : { ...o, ...box(o, o.h), h: r1(o.h * k), ...(o.v ? { s: r1(o.s * k) } : {}), sw: r1((o.sw || 0) * Math.sqrt(k)) }),
    lines: (page.lines || []).map(l => {
      if (inSel(sel, 'lines', l.id)) return { ...l, a: end(l.a), b: end(l.b), w: r1(l.w * Math.sqrt(k)) };
      // เส้นที่ไม่ได้เลือกแต่ติดรูปทรงที่ย้ายอยู่ ตามไปเอง (คำนวณตอนวาด) ไม่ต้องแก้
      return l;
    }),
  };
}
/** เส้นที่เกาะรูปทรงที่กำลังจะหาย → ตรึงปลายไว้ที่ตำแหน่งปัจจุบัน */
const freeze = (page, gone) => (page.lines || []).map(l => {
  const f = e => e.to && gone.has(e.to) ? (({ x, y }) => ({ x: r1(x), y: r1(y) }))(endOf(page, e)) : e;
  const a = f(l.a), b = f(l.b);
  return a === l.a && b === l.b ? l : { ...l, a, b };
});
export function removeSel(page, sel) {
  const gone = new Set(sel.shapes || []), lines = freeze(page, gone);
  return { ...page, strokes: page.strokes.filter(s => !inSel(sel, 'strokes', s.id)), texts: page.texts.filter(t => !inSel(sel, 'texts', t.id)), imgs: page.imgs.filter(i => !inSel(sel, 'imgs', i.id)),
    shapes: (page.shapes || []).filter(o => !gone.has(o.id)), lines: lines.filter(l => !inSel(sel, 'lines', l.id)) };
}
/** ทำสำเนาสิ่งที่เลือก (เลื่อนลงขวานิด) → { page, sel ของสำเนา } · เส้นที่เกาะรูปทรงที่ก๊อปด้วย = เกาะสำเนา */
export function duplicateSel(page, sel, off = 30) { return pasteItems(page, copyItems(page, sel), off); }
/** เก็บชิ้นที่เลือกไว้วาง (คัดลอก) */
export function copyItems(page, sel) {
  const out = {};
  for (const k of KINDS) out[k] = (page[k] || []).filter(o => inSel(sel, k, o.id)).map(o => ({ ...o }));
  const keep = new Set(out.shapes.map(o => o.id));
  out.lines = out.lines.map(l => { const f = e => e.to && !keep.has(e.to) ? (({ x, y }) => ({ x, y }))(endOf(page, e)) : e; return { ...l, a: f(l.a), b: f(l.b) }; });
  return out;
}
/** วางชิ้นที่คัดลอกไว้ (id ใหม่ทั้งหมด เลื่อน off) → { page, sel } */
export function pasteItems(page, items, off = 30) {
  const m = new Map(), nid = id => { const n = pid(id[0]); m.set(id, n); return n; };
  const sel = emptySel(), out = { ...norm(page) };
  const mv = e => e.to ? { ...e, to: m.get(e.to) } : { x: r1(e.x + off), y: r1(e.y + off) };
  for (const k of ['strokes', 'texts', 'imgs', 'shapes', 'lines']) {
    const add = (items[k] || []).map(o => {
      const id = nid(o.id);
      if (k === 'strokes') return { ...o, id, p: o.p.map((v, i) => i % 3 === 2 ? v : r1(v + off)) };
      if (k === 'lines') return { ...o, id, a: mv(o.a), b: mv(o.b) };
      return { ...o, id, x: r1(o.x + off), y: r1(o.y + off) };
    });
    sel[k] = add.map(o => o.id);
    out[k] = [...(out[k] || []), ...add];
  }
  return { page: out, sel };
}
/** แก้ทุกชิ้นที่เลือกด้วย f(o, k) (เช่นเปลี่ยนสี) */
export function editSel(page, sel, f) {
  const out = { ...page };
  for (const k of KINDS) if (sel[k]?.length) out[k] = page[k].map(o => inSel(sel, k, o.id) ? f(o, k) : o);
  return out;
}

/** รูปทรง → จุดของเส้น (วาดด้วยปากกาเหมือนเส้นธรรมดา ลบ/ย้ายได้เหมือนกัน) */
export function shapePoints(kind, x0, y0, x1, y1) {
  const out = [], add = (x, y) => out.push(r1(x), r1(y), 0.5);
  if (kind === 'line' || kind === 'arrow') {
    add(x0, y0); add(x1, y1);
    if (kind === 'arrow') {
      const a = Math.atan2(y1 - y0, x1 - x0), L = Math.min(46, Math.hypot(x1 - x0, y1 - y0) * 0.4);
      add(x1 + L * Math.cos(a + 2.6), y1 + L * Math.sin(a + 2.6)); add(x1, y1); add(x1 + L * Math.cos(a - 2.6), y1 + L * Math.sin(a - 2.6));
    }
  } else if (kind === 'rect') { add(x0, y0); add(x1, y0); add(x1, y1); add(x0, y1); add(x0, y0); }
  else if (kind === 'circle') {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2;
    for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2; add(cx + rx * Math.cos(a), cy + ry * Math.sin(a)); }
  }
  return out;
}

/** ลดจุดที่ชิดกันเกินไป (นิ้วสั่น/เมาส์ส่งถี่) — เก็บจุดแรกและจุดสุดท้ายเสมอ */
export function thin(p, min = 1.2) {
  if (p.length <= 6) return p.slice();
  const out = [p[0], p[1], p[2]];
  for (let i = 3; i < p.length - 3; i += 3) {
    const lx = out[out.length - 3], ly = out[out.length - 2];
    if (Math.hypot(p[i] - lx, p[i + 1] - ly) >= min) out.push(p[i], p[i + 1], p[i + 2]);
  }
  out.push(p[p.length - 3], p[p.length - 2], p[p.length - 1]);
  return out;
}

/** ค้นในข้อความที่พิมพ์ลงหน้าสมุด (ไม่สนตัวพิมพ์เล็ก/ใหญ่) → [{ book, page, text }] */
export function searchPages(q, books, pagesOf) {
  const k = q.trim().toLowerCase();
  if (!k) return [];
  const out = [];
  for (const b of books) {
    if ((b.title || '').toLowerCase().includes(k)) out.push({ book: b, page: null, text: b.title });
    for (const p of pagesOf(b.id)) for (const t of [...p.texts || [], ...p.shapes || []]) if ((t.v || '').toLowerCase().includes(k)) out.push({ book: b, page: p, text: t.v });
  }
  return out.slice(0, 30);
}

/* ---------- 0.10.1 หมึก: เส้นหนา-บางตามแรงกด/ความเร็ว + หัวท้ายเรียว ---------- */
/** ความหนาของปากกาที่จุดหนึ่ง (แรงกด 0–1) */
export const inkWidth = (w, pr) => w * (.35 + pr * 1.3);
/** แรงกดจำลองจากความเร็วสำหรับนิ้ว/เมาส์ (px/ms บนจอ) — ช้า = หนา เร็ว = บาง · ค่อย ๆ เปลี่ยน ไม่กระตุก */
export function speedPressure(prev, v) {
  const target = Math.max(.28, Math.min(.78, .78 - v * .2));
  return Math.round((prev * .72 + target * .28) * 100) / 100;
}
/** ขอบซ้าย/ขวาของเส้นหมึก → เติมสีเป็นรูปปิด (สวยกว่าการลากเส้นความหนาเดียว) · คืน null ถ้าจุดน้อยเกินไป */
export function inkOutline(p, w) {
  const n = p.length / 3;
  if (n < 3) return null;
  const P = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    const x = i === 0 || i === n - 1 ? p[i * 3] : (p[a * 3] + 2 * p[i * 3] + p[b * 3]) / 4;
    const y = i === 0 || i === n - 1 ? p[i * 3 + 1] : (p[a * 3 + 1] + 2 * p[i * 3 + 1] + p[b * 3 + 1]) / 4;
    P.push([x, y, p[i * 3 + 2]]);
  }
  const L = [], R = [], rad = [];
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const taper = Math.min(1, .42 + i * .12, .3 + (n - 1 - i) * .14);
    const r = inkWidth(w, P[i][2]) / 2 * taper;
    rad.push(r);
    L.push([P[i][0] - dy * r, P[i][1] + dx * r]); R.push([P[i][0] + dy * r, P[i][1] - dx * r]);
  }
  return { L, R, rad, P };
}

/* ---------- 0.10.1 ค้างปากกาไว้ = รูปทรงเป๊ะ ---------- */
/** ลดจุดแบบ Ramer–Douglas–Peucker · pts = [[x, y], …] */
export function rdp(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let idx = 0, max = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = distSeg(pts[i][0], pts[i][1], a[0], a[1], b[0], b[1]); if (d > max) { max = d; idx = i; } }
  if (max <= eps) return [a, b];
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
}
const turnAt = (a, b, c) => { const t = Math.abs(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0])); return Math.min(t, Math.PI * 2 - t); };
/** เดาว่าลายมือนี้ตั้งใจเป็นรูปอะไร → { kind: 'line'|'circle'|'rect'|'triangle'|'poly', p: จุดของรูปทรง } หรือ null (ไม่เข้าข่าย) */
export function recognize(p) {
  const pts = []; for (const [x, y] of pts3(p)) pts.push([x, y]);
  if (pts.length < 4) return null;
  let L = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  pts.forEach(([x, y], i) => { if (i) L += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
  const diag = Math.hypot(x1 - x0, y1 - y0), f = pts[0], l = pts[pts.length - 1], d = Math.hypot(l[0] - f[0], l[1] - f[1]);
  if (diag < 40 || !L) return null;
  const flat = q => q.flatMap(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10, .5]);
  const dev = pts.reduce((m, [x, y]) => Math.max(m, distSeg(x, y, f[0], f[1], l[0], l[1])), 0);
  if (d > 40 && (d / L > .92 || dev < Math.max(8, d * .07))) return { kind: 'line', p: flat([f, l]), ends: [f, l] };
  if (d > diag * .3) return null; // ไม่ตรงและไม่ปิด
  // วงกลม/วงรี: ทุกจุดห่างจากวงรีในกรอบน้อย
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.max(1, (x1 - x0) / 2), ry = Math.max(1, (y1 - y0) / 2);
  const err = pts.reduce((s, [x, y]) => s + Math.abs(Math.hypot((x - cx) / rx, (y - cy) / ry) - 1), 0) / pts.length;
  // มุม: ลดจุดแล้วตัดจุดที่เกือบเป็นเส้นตรงทิ้ง (วนรอบ เพราะจุดเริ่มอาจอยู่กลางด้าน)
  let v = rdp(pts, diag * .07);
  if (Math.hypot(v[0][0] - v[v.length - 1][0], v[0][1] - v[v.length - 1][1]) < diag * .3) v = v.slice(0, -1);
  for (let changed = true; changed && v.length > 3;) {
    changed = false;
    for (let i = 0; i < v.length; i++) {
      const a = v[(i - 1 + v.length) % v.length], b = v[i], c = v[(i + 1) % v.length];
      if (turnAt(a, b, c) < .5 || Math.hypot(b[0] - a[0], b[1] - a[1]) < diag * .1) { v.splice(i, 1); changed = true; break; }
    }
  }
  const box = { x0, y0, x1, y1 }, near = (q, x, y) => Math.hypot(q[0] - x, q[1] - y) < diag * .17;
  const fits = targets => targets.every(([x, y]) => v.some(q => near(q, x, y)));
  if (err < .13 && v.length > 4 || err < .09) return { kind: 'circle', p: shapePoints('circle', x0, y0, x1, y1), box };
  if (v.length === 3) return { kind: 'triangle', p: flat([...v, v[0]]), box, upright: fits([[cx, y0], [x0, y1], [x1, y1]]) };
  if (v.length === 4) {
    const straight = v.every((b, i) => { const a = v[(i + 1) % 4], ang = Math.abs(Math.atan2(a[1] - b[1], a[0] - b[0])) % (Math.PI / 2); return Math.min(ang, Math.PI / 2 - ang) < .2; });
    if (straight) return { kind: 'rect', p: shapePoints('rect', x0, y0, x1, y1), box };
    if (fits([[cx, y0], [x1, cy], [cx, y1], [x0, cy]])) return { kind: 'diamond', p: flat([[cx, y0], [x1, cy], [cx, y1], [x0, cy], [cx, y0]]), box };
    return { kind: 'poly', p: flat([...v, v[0]]) };
  }
  if (err < .2) return { kind: 'circle', p: shapePoints('circle', x0, y0, x1, y1), box };
  return null;
}
function* pts3(p) { for (let i = 0; i < p.length; i += 3) yield [p[i], p[i + 1]]; }

/* ---------- 0.11 หน้าปก + สารบัญอัตโนมัติ ---------- */
/** หัวข้อของหน้า = ข้อความตัวใหญ่ที่อยู่บนสุด (ตัวใหญ่ ≥ 38 ในครึ่งบนก่อน · ไม่มีก็เอาข้อความบนสุดถ้าอยู่ช่วงบน) · ไม่มี = null */
export function pageTitle(p) {
  const ts = (p.texts || []).filter(t => (t.v || '').trim()).sort((a, b) => a.y - b.y || a.x - b.x);
  const pick = ts.find(t => t.s >= 38 && t.y < 700) || ts.find(t => t.y < 420);
  if (!pick) return null;
  const line = pick.v.trim().split('\n')[0].trim();
  return line.length > 60 ? line.slice(0, 59) + '…' : line;
}
/** แถวสารบัญของหน้าปก: ทุกหน้าที่ไม่ใช่หน้าปก → { n: เลขหน้าในเล่ม, id, title (ไม่มีหัวข้อ = null) } */
export function tocOf(pages) {
  return pages.map((p, i) => ({ n: i + 1, id: p.id, title: pageTitle(p), cover: !!p.cover })).filter(r => !r.cover);
}
