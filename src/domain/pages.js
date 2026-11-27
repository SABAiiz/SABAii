// สมุดจด (0.10) — เรขาคณิตของหน้ากระดาษ: ฟังก์ชันล้วน ไม่แตะ DOM/ที่เก็บข้อมูล (เทสต์ได้ใน Node)
// หน้าหนึ่งกว้าง 1000 หน่วย สูง 1414 (สัดส่วน A4) — จอไหนก็ย่อ/ขยายจากหน่วยนี้ ลายมือไม่เพี้ยน
// เส้น: { id, t: 'pen'|'hl', c: สี, w: ความหนา (หน่วย), p: [x, y, แรงกด(0–1), x, y, แรงกด, …] }
// ข้อความ: { id, x, y, w, s: ขนาดตัวอักษร, c, v } · รูป: { id, x, y, w, h, blob }
export const PAGE_W = 1000, PAGE_H = 1414;
export const PAPERS = { lined: 'มีเส้น', grid: 'ตาราง', dots: 'จุด', blank: 'ว่าง' };
export const INKS = ['#0B1B4D', '#1F2937', '#0A6CF1', '#E45465', '#16B76A', '#F4A340', '#8B5CF6'];
export const HIGHLIGHTS = ['#FFE14D', '#7CF2B4', '#8FD3FF', '#FFA3C8', '#FFC078'];
export const SIZES = { pen: [3, 6, 11], hl: [22, 34, 48], text: [30, 40, 56], eraser: [14, 28, 50] };

let seq = 0;
export const pid = (p = 'k') => p + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);
export const blankPage = (book_id, order, paper = 'lined', now = new Date().toISOString()) =>
  ({ id: pid('p'), book_id, order, paper, strokes: [], texts: [], imgs: [], created_at: now, updated_at: now });

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
  if (poly.length < 6) return { strokes: [], texts: [], imgs: [] };
  const strokes = page.strokes.filter(s => { let n = 0, k = 0; for (const [x, y] of pts(s)) { n++; if (inPoly(x, y, poly)) k++; } return n && k / n >= 0.5; }).map(s => s.id);
  const mid = o => inPoly(o.x + (o.w || 0) / 2, o.y + (o.h || o.s || 0) / 2, poly);
  return { strokes, texts: page.texts.filter(mid).map(t => t.id), imgs: page.imgs.filter(mid).map(i => i.id) };
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
  for (const s of page.strokes) if (sel.strokes.includes(s.id)) bs.push(strokeBox(s));
  for (const t of page.texts) if (sel.texts.includes(t.id)) bs.push({ x0: t.x, y0: t.y, x1: t.x + t.w, y1: t.y + textH(t) });
  for (const i of page.imgs) if (sel.imgs.includes(i.id)) bs.push({ x0: i.x, y0: i.y, x1: i.x + i.w, y1: i.y + i.h });
  if (!bs.length) return null;
  return bs.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }));
}

const r1 = v => Math.round(v * 10) / 10;
/** ย้าย/ย่อขยายสิ่งที่เลือก: จุด (x, y) → ox + (x − ox)·k + dx — คืนหน้าใหม่ (ไม่แก้ของเดิม เลิกทำได้) */
export function transformSel(page, sel, { dx = 0, dy = 0, k = 1, ox = 0, oy = 0 }) {
  const X = x => r1(ox + (x - ox) * k + dx), Y = y => r1(oy + (y - oy) * k + dy);
  return {
    ...page,
    strokes: page.strokes.map(s => !sel.strokes.includes(s.id) ? s : { ...s, w: r1(s.w * k), p: s.p.map((v, i) => i % 3 === 0 ? X(v) : i % 3 === 1 ? Y(v) : v) }),
    texts: page.texts.map(t => !sel.texts.includes(t.id) ? t : { ...t, x: X(t.x), y: Y(t.y), w: r1(t.w * k), s: r1(t.s * k) }),
    imgs: page.imgs.map(i => !sel.imgs.includes(i.id) ? i : { ...i, x: X(i.x), y: Y(i.y), w: r1(i.w * k), h: r1(i.h * k) }),
  };
}
export function removeSel(page, sel) {
  return { ...page, strokes: page.strokes.filter(s => !sel.strokes.includes(s.id)), texts: page.texts.filter(t => !sel.texts.includes(t.id)), imgs: page.imgs.filter(i => !sel.imgs.includes(i.id)) };
}
/** ทำสำเนาสิ่งที่เลือก (เลื่อนลงขวานิด) → { page, sel ของสำเนา } */
export function duplicateSel(page, sel, off = 30) {
  const m = new Map();
  const nid = id => { const n = pid(id[0]); m.set(id, n); return n; };
  const ns = page.strokes.filter(s => sel.strokes.includes(s.id)).map(s => ({ ...s, id: nid(s.id), p: s.p.map((v, i) => i % 3 === 2 ? v : r1(v + off)) }));
  const nt = page.texts.filter(t => sel.texts.includes(t.id)).map(t => ({ ...t, id: nid(t.id), x: t.x + off, y: t.y + off }));
  const ni = page.imgs.filter(i => sel.imgs.includes(i.id)).map(i => ({ ...i, id: nid(i.id), x: i.x + off, y: i.y + off }));
  return { page: { ...page, strokes: [...page.strokes, ...ns], texts: [...page.texts, ...nt], imgs: [...page.imgs, ...ni] },
    sel: { strokes: ns.map(s => s.id), texts: nt.map(t => t.id), imgs: ni.map(i => i.id) } };
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
    for (const p of pagesOf(b.id)) for (const t of p.texts || []) if ((t.v || '').toLowerCase().includes(k)) out.push({ book: b, page: p, text: t.v });
  }
  return out.slice(0, 30);
}
