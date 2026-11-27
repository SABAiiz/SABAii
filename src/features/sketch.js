// สมุดจด (0.10) — เขียนในสมุดเหมือนแอปโน้ต: ปากกา · ปากกาเน้น · ยางลบ · บ่วงเลือก/ย้าย/ย่อขยาย · รูปทรง · ข้อความ · รูป · เลิกทำ/ทำซ้ำ · กระดาษ 4 แบบ
// เปลี่ยนหน้าแบบพลิกกระดาษ (ปุ่ม ‹ › · ปัดสองนิ้ว · ใช้ปากกาสไตลัสอยู่ = ปัดนิ้วเดียวได้) · ออก = หน้าเขียนย่อลงไปเป็นภาพย่อในหน้า "ทุกหน้า" ของสมุด
// เส้น/ข้อความเก็บเป็นหน่วยหน้ากระดาษ (domain/pages.js) วาดใหม่ได้ทุกขนาดจอ · ระหว่างเขียนบันทึกเงียบ ๆ ทุก 0.4 วินาที
import { h, put, toast, confirmBox, openModal, closeModal, onBack, pushBack, dropBack } from '../ui/kit.js';
import { app, S, subj } from './shared.js';
import { pickImage, prepareImage } from './images.js';
import { relDay, toYMD, MONTH_SHORT, beYear } from '../domain/dates.js';
import * as G from '../domain/pages.js';
import { SUBJECT_COLORS } from '../data/store.js';

const { PAGE_W: PW, PAGE_H: PH } = G;
const FONT = '"Anuphan", "Noto Sans Thai Looped", sans-serif';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- ไอคอนเครื่องมือ ---------- */
const P = {
  pen: '<path d="M4 20l1.2-4.6L15.6 5a2.1 2.1 0 013 3L8.2 18.4z"/><path d="M13.5 7l3 3"/>',
  hl: '<path d="M9 14l-3 3v3h3l3-3"/><path d="M9 14l6.5-9.5a2 2 0 013 0l1 1a2 2 0 010 3L12 17z"/><path d="M14 20h7"/>',
  eraser: '<path d="M8.5 20H20M4.6 15.2l8.8-8.8a2 2 0 012.8 0l3.4 3.4a2 2 0 010 2.8L13 19.2a2.7 2.7 0 01-3.8 0l-4.6-4.6a2 2 0 010-2.8"/><path d="M9.5 10.3l6.2 6.2"/>',
  lasso: '<path d="M7.5 15.5C4.6 14.4 3 12.6 3 10.5 3 6.9 7 4 12 4s9 2.9 9 6.5-4 6.5-9 6.5c-.9 0-1.8-.1-2.6-.3"/><circle cx="8" cy="17" r="2"/><path d="M8 19c0 1.2-.6 2-2 2"/>',
  shape: '<circle cx="8" cy="8" r="4.5"/><rect x="11.5" y="11.5" width="9" height="9" rx="1.5"/>',
  text: '<path d="M5 6V4.5h14V6M12 4.5v15M9 19.5h6"/>',
  img: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>', redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  pages: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  down: '<path d="M7 10l5 5 5-5"/>', dup: '<rect x="7" y="3" width="13" height="17" rx="2"/><path d="M4 7v12a2 2 0 002 2h9"/><path d="M13.5 9v6M10.5 12h6"/>', zoom: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M8 11h6"/>',
  left: '<path d="M15 5l-7 7 7 7"/>', right: '<path d="M9 5l7 7-7 7"/>', plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
  line: '<path d="M5 19L19 5"/>', arrow: '<path d="M5 19L19 5M10 5h9v9"/>', rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>', circle: '<ellipse cx="12" cy="12" rx="8.5" ry="7"/>',
  clear: '<path d="M4 20h16M6 16l10-10M8 6l10 10" opacity=".9"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
};
export const si = n => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
const TOOLS = { pen: 'ปากกา', hl: 'ปากกาเน้น', eraser: 'ยางลบ', lasso: 'เลือก/ย้าย', shape: 'รูปทรง', text: 'ข้อความ', img: 'ใส่รูป' };
const SHAPES = { line: 'เส้นตรง', arrow: 'ลูกศร', rect: 'สี่เหลี่ยม', circle: 'วงกลม' };

/* =================== วาดหน้ากระดาษ (ใช้ทั้งหน้าเขียนและภาพย่อ) =================== */
const imgs = new Map(); // id → { el, ready, wait:Set }
function imgEl(o, onload) {
  let c = imgs.get(o.id);
  if (!c && o.blob) {
    const el = new Image();
    c = { el, ready: false, wait: new Set() };
    el.onload = () => { c.ready = true; c.wait.forEach(f => f()); c.wait.clear(); };
    el.src = URL.createObjectURL(o.blob);
    imgs.set(o.id, c);
  }
  if (c && !c.ready && onload) c.wait.add(onload);
  return c?.ready ? c.el : null;
}

function paper(ctx, kind, u, H = PH) {
  ctx.fillStyle = '#FFFDF8'; ctx.fillRect(0, 0, PW, H);
  const line = (x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  if (kind === 'lined') {
    ctx.strokeStyle = 'rgba(10,108,241,.2)'; ctx.lineWidth = Math.max(1.6, u * .8);
    for (let y = 170; y < H - 40; y += 52) line(0, y, PW, y);
    ctx.strokeStyle = 'rgba(228,84,101,.42)'; line(118, 0, 118, H);
  } else if (kind === 'grid') {
    for (let i = 0, x = 0; x <= PW; x += 40, i++) { ctx.strokeStyle = i % 5 ? 'rgba(10,108,241,.12)' : 'rgba(10,108,241,.24)'; ctx.lineWidth = Math.max(1.4, u * .7); line(x, 0, x, H); }
    for (let i = 0, y = 0; y <= H; y += 40, i++) { ctx.strokeStyle = i % 5 ? 'rgba(10,108,241,.12)' : 'rgba(10,108,241,.24)'; ctx.lineWidth = Math.max(1.4, u * .7); line(0, y, PW, y); }
  } else if (kind === 'dots') {
    ctx.fillStyle = 'rgba(11,27,77,.26)';
    const r = Math.max(2.2, u * .9);
    for (let y = 40; y < H; y += 40) for (let x = 40; x < PW; x += 40) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
  } else if (kind === 'cornell') {
    // คอร์เนลล์: ช่องคำถาม/คีย์เวิร์ดซ้าย · จดบันทึกขวา · สรุปล่าง
    ctx.strokeStyle = 'rgba(10,108,241,.18)'; ctx.lineWidth = Math.max(1.6, u * .8);
    const sy = H - 264; // ช่องสรุปอยู่ท้ายหน้าเสมอ (หน้ายาวขึ้น ช่องจดยาวตาม)
    for (let y = 222; y < sy - 20; y += 52) line(300, y, PW, y);
    for (let y = sy + 100; y < H - 30; y += 52) line(0, y, PW, y);
    ctx.strokeStyle = 'rgba(11,27,77,.32)'; ctx.lineWidth = Math.max(2.6, u * 1.2);
    line(0, 140, PW, 140); line(300, 140, 300, sy); line(0, sy, PW, sy);
    ctx.fillStyle = 'rgba(11,27,77,.3)'; ctx.font = `600 22px ${FONT}`; ctx.textBaseline = 'top';
    ctx.fillText('คำถาม · คีย์เวิร์ด', 28, 158); ctx.fillText('จดบันทึก', 328, 158); ctx.fillText('สรุป', 28, sy + 18);
  } else if (kind === 'todo') {
    ctx.strokeStyle = 'rgba(10,108,241,.18)'; ctx.lineWidth = Math.max(1.6, u * .8);
    ctx.lineJoin = 'round';
    for (let y = 214; y < H - 40; y += 70) {
      line(60, y, PW - 60, y);
      ctx.save(); ctx.strokeStyle = 'rgba(11,27,77,.3)'; ctx.lineWidth = Math.max(2.4, u); ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(64, y - 46, 34, 34, 7); else ctx.rect(64, y - 46, 34, 34); ctx.stroke(); ctx.restore();
    }
    ctx.strokeStyle = 'rgba(11,27,77,.32)'; ctx.lineWidth = Math.max(2.6, u * 1.2); line(60, 130, PW - 60, 130);
  } else if (kind === 'board') {
    // กระดานดำ: เขียวเข้ม แสงตรงกลาง รอยชอล์กจาง ๆ
    ctx.fillStyle = '#23443A'; ctx.fillRect(0, 0, PW, H);
    const gr = ctx.createRadialGradient(PW / 2, PH * .4, 60, PW / 2, PH * .45, PH * .8);
    gr.addColorStop(0, 'rgba(255,255,255,.07)'); gr.addColorStop(1, 'rgba(0,0,0,.18)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, PW, H);
    ctx.fillStyle = 'rgba(255,255,255,.025)';
    for (const [x, y, rx, ry] of [[260, 300, 210, 60], [700, 820, 260, 70], [380, 1150, 240, 50], [760, 260, 160, 40]]) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -.2, 0, 7); ctx.fill(); }
  }
}

function pathOf(ctx, p) {
  ctx.beginPath(); ctx.moveTo(p[0], p[1]);
  if (p.length === 6) { ctx.lineTo(p[3], p[4]); return; }
  for (let i = 3; i < p.length - 3; i += 3) ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 3]) / 2, (p[i + 1] + p[i + 4]) / 2);
  ctx.lineTo(p[p.length - 3], p[p.length - 2]);
}
export function drawStroke(ctx, s, dark = false) {
  const p = s.p;
  if (!p.length) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = ctx.fillStyle = s.c;
  if (s.t === 'hl') { ctx.globalAlpha = dark ? .5 : .42; ctx.globalCompositeOperation = dark ? 'screen' : 'multiply'; ctx.lineCap = 'butt'; }
  if (p.length === 3) { ctx.beginPath(); ctx.arc(p[0], p[1], G.inkWidth(s.w, p[2]) / 2, 0, 7); ctx.fill(); ctx.restore(); return; }
  const o = s.t === 'pen' && !s.sh && G.inkOutline(p, s.w);
  if (o) {
    // หมึก: เติมสีระหว่างขอบซ้าย/ขวา (หนา-บางตามแรงกด/ความเร็ว หัวท้ายเรียว)
    const { L, R, rad, P } = o, n = L.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < n - 1; i++) { const m = mid(L[i], L[i + 1]); ctx.quadraticCurveTo(L[i][0], L[i][1], m[0], m[1]); }
    ctx.lineTo(L[n - 1][0], L[n - 1][1]);
    ctx.arc(P[n - 1][0], P[n - 1][1], rad[n - 1], Math.atan2(L[n - 1][1] - P[n - 1][1], L[n - 1][0] - P[n - 1][0]), Math.atan2(R[n - 1][1] - P[n - 1][1], R[n - 1][0] - P[n - 1][0]), true);
    for (let i = n - 2; i > 0; i--) { const m = mid(R[i], R[i - 1]); ctx.quadraticCurveTo(R[i][0], R[i][1], m[0], m[1]); }
    ctx.lineTo(R[0][0], R[0][1]);
    ctx.arc(P[0][0], P[0][1], rad[0], Math.atan2(R[0][1] - P[0][1], R[0][0] - P[0][0]), Math.atan2(L[0][1] - P[0][1], L[0][0] - P[0][0]), true);
    ctx.fill();
  } else if (s.sh) { // รูปทรง: มุมคม ไม่ปัดโค้ง
    ctx.lineWidth = s.w; ctx.beginPath(); ctx.moveTo(p[0], p[1]);
    for (let i = 3; i < p.length; i += 3) ctx.lineTo(p[i], p[i + 1]);
    ctx.stroke();
  } else { ctx.lineWidth = s.w; pathOf(ctx, p); ctx.stroke(); }
  ctx.restore();
}

const mctx = (() => { let c; return () => c ||= document.createElement('canvas').getContext('2d'); })();
const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
/** ตัดบรรทัดภาษาไทยตามคำ (ไม่มีเว้นวรรค) · คำยาวเกินบรรทัดตัดทีละตัวอักษร */
export function wrapText(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = seg ? [...seg.segment(para)].map(x => x.segment) : [...para];
    let line = '';
    for (const w of words) {
      if (ctx.measureText(line + w).width <= maxW || !line) {
        if (!line && ctx.measureText(w).width > maxW) { for (const ch of w) { if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ''; } line += ch; } }
        else line += w;
      } else { out.push(line.trimEnd()); line = w.trimStart(); }
    }
    out.push(line);
  }
  return out;
}
const textLines = t => { const c = mctx(); c.font = `500 ${t.s}px ${FONT}`; return wrapText(c, t.v || ' ', t.w); };
const textH = t => Math.max(1, textLines(t).length) * t.s * 1.45;

/* =================== หน้าปก + สารบัญอัตโนมัติ (0.11) ===================
   เรียบ ๆ แบบหน้าแรกของสมุดจริง: แถบสีสันปก · ป้ายเล็ก · ชื่อเล่มตัวใหญ่ · เส้นบาง · สารบัญมีจุดนำสายตาถึงเลขหน้า
   สารบัญดึงหัวข้อจากข้อความตัวใหญ่บนสุดของแต่ละหน้าเอง (G.pageTitle) */
/** หน้าตาของเล่ม: สมุดวิชาใช้ชื่อ/สีของวิชา (เปลี่ยนชื่อวิชาแล้วตามเอง) · เล่มอื่นเป็น "โปรเจกต์" */
export function bookFace(b) {
  const s = b?.subject_id && S().subjects.find(x => x.id === b.subject_id);
  return { title: s ? s.name : b?.title || 'สมุดจด', color: s ? s.color : b?.color || '#0B1B4D', kind: s ? 'วิชา' : 'โปรเจกต์', subject: s || null };
}
const thaiDate = iso => { const d = new Date(iso); return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${String(beYear(d.getFullYear())).slice(-2)}`; };
function coverInfo(page) {
  const b = S().books.find(x => x.id === page.book_id);
  if (!b) return null;
  const pages = app.store.pagesOf(b.id);
  return { ...bookFace(b), created: b.created_at, total: pages.length, toc: G.tocOf(pages), year: beYear(new Date(b.created_at).getFullYear()) };
}
const fitText = (ctx, t, w) => { if (ctx.measureText(t).width <= w) return t; while (t.length > 1 && ctx.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; };
const COVER_ROW = 78, COVER_END = PH - 110;
/** ตำแหน่งทุกอย่างบนหน้าปก (หน่วยหน้า) — ใช้ทั้งตอนวาดและตอนทำปุ่มแตะสารบัญ */
export function coverLayout(info) {
  const c = mctx(); c.font = `700 88px ${FONT}`;
  const lines = wrapText(c, info.title, 820).slice(0, 3);
  const titleY = 280, rule = titleY + lines.length * 102 + 30, meta = rule + 34, head = meta + 120; // เว้นบนให้พ้นแถบปุ่มลอย
  const room = Math.max(0, Math.floor((COVER_END - (head + 78)) / COVER_ROW));
  const rows = info.toc.length > room ? info.toc.slice(0, Math.max(0, room - 1)) : info.toc;
  return { lines, titleY, rule, meta, head, rows: rows.map((r, i) => ({ ...r, y: head + 92 + i * COVER_ROW })), more: info.toc.length - rows.length };
}
function drawCover(ctx, info, H) {
  const L = coverLayout(info), ink = '#0B1B4D', mute = '#7A8499';
  ctx.save();
  ctx.fillStyle = info.color; ctx.fillRect(0, 0, 26, H);
  ctx.fillStyle = 'rgba(11,27,77,.08)'; ctx.fillRect(26, 0, 2, H);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = info.color; ctx.font = `700 26px ${FONT}`;
  ctx.fillText(`${info.kind} · ${info.year}`, 96, 236);
  ctx.fillStyle = ink; ctx.font = `700 88px ${FONT}`;
  L.lines.forEach((l, i) => ctx.fillText(l, 92, L.titleY + 72 + i * 102));
  ctx.fillStyle = ink; ctx.fillRect(96, L.rule, 808, 3);
  ctx.fillStyle = mute; ctx.font = `500 28px ${FONT}`;
  ctx.fillText(`เริ่ม ${thaiDate(info.created)}   ·   ${info.total} หน้า`, 96, L.meta + 30);
  ctx.fillStyle = ink; ctx.font = `700 36px ${FONT}`;
  ctx.fillText('สารบัญ', 96, L.head + 34);
  if (!L.rows.length) {
    ctx.fillStyle = mute; ctx.font = `500 28px ${FONT}`;
    ctx.fillText('พิมพ์หัวข้อตัวใหญ่ไว้บนสุดของแต่ละหน้า', 96, L.head + 104);
    ctx.fillText('แล้วสารบัญจะขึ้นตรงนี้เอง', 96, L.head + 146);
  }
  for (const r of L.rows) {
    const y = r.y + 30;
    ctx.fillStyle = info.color; ctx.font = `700 26px Inter, ${FONT}`;
    ctx.fillText(String(r.n).padStart(2, '0'), 96, y);
    ctx.font = `500 32px ${FONT}`; ctx.fillStyle = r.title ? ink : mute;
    const t = fitText(ctx, r.title || `หน้า ${r.n}`, 560);
    ctx.fillText(t, 160, y);
    const tw = ctx.measureText(t).width;
    ctx.fillStyle = mute; ctx.font = `600 26px Inter, ${FONT}`;
    const num = String(r.n), nw = ctx.measureText(num).width;
    ctx.fillText(num, 904 - nw, y);
    ctx.fillStyle = 'rgba(11,27,77,.28)';
    for (let x = 160 + tw + 20; x < 904 - nw - 18; x += 14) { ctx.beginPath(); ctx.arc(x, y - 8, 2.2, 0, 7); ctx.fill(); }
  }
  if (L.more > 0) { ctx.fillStyle = mute; ctx.font = `500 26px ${FONT}`; ctx.fillText(`และอีก ${L.more} หน้า — ดูได้ที่ "ทุกหน้า"`, 160, (L.rows.at(-1)?.y ?? L.head + 40) + COVER_ROW + 30); }
  ctx.restore();
}

/** ความสูงหน้า (หน่วย) — หน้ายาวขึ้นเองเมื่อเขียนใกล้ท้ายหน้า */
export const pageH = p => Math.max(PH, p.h || 0);
const boxes = new WeakMap(); // กรอบของแต่ละเส้น (ไว้ข้ามเส้นที่อยู่นอกจอ)
const boxOf = s => { let b = boxes.get(s); if (!b) boxes.set(s, b = G.strokeBox(s)); return b; };

/** วาดหน้าทั้งหน้า — ctx ต้องตั้งสเกลเป็นหน่วยหน้ากระดาษไว้แล้ว · u = หน่วยต่อ 1 px บนจอ · view = ช่วง y ที่เห็น (ข้ามของนอกจอ) */
export function drawPage(ctx, page, u, { hide = null, onImg = null, H = pageH(page), view = null } = {}) {
  paper(ctx, page.cover ? 'blank' : page.paper, u, H);
  if (page.cover) { const info = coverInfo(page); if (info) drawCover(ctx, info, H); }
  const dark = !page.cover && G.DARK_PAPERS.includes(page.paper);
  const off = (y0, y1) => view && (y1 < view[0] || y0 > view[1]);
  for (const o of page.imgs || []) {
    if (off(o.y, o.y + o.h)) continue;
    const el = imgEl(o, onImg);
    if (el) ctx.drawImage(el, o.x, o.y, o.w, o.h);
    else { ctx.fillStyle = '#EEF1F6'; ctx.fillRect(o.x, o.y, o.w, o.h); }
  }
  for (const s of page.strokes) { if (view) { const b = boxOf(s); if (off(b.y0, b.y1)) continue; } drawStroke(ctx, s, dark); }
  ctx.textBaseline = 'top';
  for (const t of page.texts || []) {
    if (t.id === hide) continue;
    ctx.font = `500 ${t.s}px ${FONT}`; ctx.fillStyle = t.c;
    textLines(t).forEach((l, i) => ctx.fillText(l, t.x, t.y + i * t.s * 1.45 + t.s * .12));
  }
}

/** ภาพย่อหน้ากระดาษ (canvas) */
export function thumb(page, px = 300) {
  const c = h('canvas.pg-thumb', { width: px, height: Math.round(px * PH / PW), 'aria-hidden': 'true' });
  const go = () => { const ctx = c.getContext('2d'); const k = px / PW; ctx.setTransform(k, 0, 0, k, 0, 0); drawPage(ctx, page, 1 / k * (px / 120), { onImg: go }); };
  go();
  return c;
}

/* =================== หน้าเขียน — กระดาษเต็มจอ (0.10.2) ===================
   กระดาษกว้างเต็มจอ ขอบชนขอบ (จอใหญ่กว้างสุด 900 px อยู่กลาง) · แถบปุ่มลอยอยู่บนกระดาษ
   หน้ายาวลงไปได้เรื่อย ๆ เหมือนแอปโน้ต (เขียนใกล้ท้ายหน้า → หน้ายาวขึ้นเอง) · สองนิ้ว = เลื่อน/ซูม/ปัดเปลี่ยนหน้า
   ผืนวาดเท่าจอเสมอ วาดเฉพาะส่วนที่เห็น → ซูมแล้วเส้นคม หน้ายาวแค่ไหนก็ไม่หนัก */
const ed = { open: false };
const pref = () => S().prefs.sketch || {};
const pagesNow = () => app.store.pagesOf(ed.book.id);
const isDark = () => !ed.page?.cover && G.DARK_PAPERS.includes(ed.page?.paper);
const palOf = t => t === 'hl' ? G.HIGHLIGHTS : isDark() ? G.CHALKS : G.INKS;
const bag = t => t !== 'hl' && isDark() ? ed.dcolor : ed.color;
const col = t => bag(t)[t === 'shape' ? 'shape' : t];
const DESK = '#E4E9F1';
const BOTTOM_ROOM = 150; // เลื่อนท้ายหน้าพ้นแถบเครื่องมือได้

export async function openSketch(bookId, pageId = null, fromEl = null) {
  if (ed.open) return;
  const book = S().books.find(b => b.id === bookId);
  if (!book) return;
  const list = app.store.pagesOf(bookId);
  const idx = Math.max(0, list.findIndex(p => p.id === (pageId || book.last_page)));
  const pr = pref();
  Object.assign(ed, {
    open: true, closing: false, book, idx, page: list[idx], tool: pr.tool || 'pen', shape: pr.shape || 'line',
    color: { pen: G.INKS[0], hl: G.HIGHLIGHTS[0], shape: G.INKS[0], text: G.INKS[0], ...pr.color },
    dcolor: { pen: G.CHALKS[0], shape: G.CHALKS[0], text: G.CHALKS[0], ...pr.dcolor }, // สีชอล์กบนกระดานดำ
    z: 1, vx: 0, vy: 0, H: pageH(list[idx]),
    size: { pen: 1, hl: 1, text: 1, eraser: 1, shape: 1, ...pr.size },
    sel: null, editing: null, hist: new Map(), saveT: 0, busy: false, penSeen: false,
  });
  if (ed.tool === 'img') ed.tool = 'pen';
  build();
  pushBack({ sketch: 1 });
  document.body.classList.add('sk-on');
  layout();
  if (fromEl && !reduced()) zoomFrom(fromEl.getBoundingClientRect());
  else requestAnimationFrame(() => ed.root?.classList.add('in'));
  if (!pr.tipped) setTimeout(() => ed.open && toast('สองนิ้ว = เลื่อน/ซูม · ปัดสองนิ้ว = เปลี่ยนหน้า · วาดแล้วค้าง = รูปทรงเป๊ะ'), 900);
}
onBack(() => { if (!ed.open) return false; closeSketch(true); return true; });

function build() {
  const b = (cls, name, label, on, extra = {}) => h('button.' + cls, { type: 'button', 'aria-label': label, title: label, html: si(name), onclick: on, ...extra });
  ed.base = h('canvas.sk-base'); ed.ink = h('canvas.sk-ink');
  ed.selbox = h('div.sk-selbox', { hidden: true }, h('i.sk-handle'));
  ed.toc = h('div.sk-toc');
  ed.layer = h('div.sk-layer', ed.toc, ed.selbox); // ชั้นเดียวกับหน้ากระดาษ (หน่วยหน้า) — สารบัญแตะได้ · กรอบเลือก · ช่องพิมพ์
  ed.selbar = h('div.sk-selbar', { hidden: true },
    h('button', { type: 'button', onclick: () => selAction('copy'), html: si('copy') + '<span>ทำสำเนา</span>' }),
    h('button', { type: 'button', onclick: () => selAction('del'), html: si('trash') + '<span>ลบ</span>' }));
  ed.zoomB = h('button.sk-zoom', { type: 'button', hidden: true, 'aria-label': 'กลับขนาดเดิม', onclick: () => resetZoom() });
  ed.sbar = h('i.sk-sbar');
  ed.stage = h('div.sk-stage', ed.base, ed.ink, ed.layer, ed.sbar);
  ed.count = h('b');
  ed.strip = h('div.sk-strip', { hidden: true, role: 'listbox', 'aria-label': 'ทุกหน้า' });
  ed.undoB = b('sk-ib', 'undo', 'เลิกทำ', undo); ed.redoB = b('sk-ib', 'redo', 'ทำซ้ำ', redo);
  ed.prevB = b('sk-pg', 'left', 'หน้าก่อน', () => turn(-1));
  ed.nextB = h('button.sk-pg', { type: 'button', onclick: () => turn(1) });
  ed.opts = h('div.sk-opts', { onmousedown: e => { if (ed.editing && e.target.closest('button')) e.preventDefault(); } }); // แตะสี/ขนาดตอนพิมพ์อยู่ ไม่ให้ช่องพิมพ์หลุด
  ed.tools = h('div.sk-tools', { role: 'toolbar', 'aria-label': 'เครื่องมือ' }, Object.entries(TOOLS).map(([k, l]) =>
    b('sk-tool', k, l, () => pickTool(k), { 'data-tool': k })));
  ed.menu = h('div.sk-menu', { hidden: true });
  ed.root = h('div.sk', { id: 'sk', role: 'dialog', 'aria-label': 'สมุด ' + ed.book.title, style: { '--c': ed.book.color } },
    ed.stage, ed.selbar, ed.zoomB,
    h('header.sk-top',
      h('button.sk-ib.sk-close', { type: 'button', 'aria-label': 'ดูทุกหน้า', title: 'ดูทุกหน้า', onclick: () => closeSketch(), html: si('pages') }),
      h('div.sk-pages', ed.prevB, h('button.sk-name', { type: 'button', 'aria-label': 'เลือกหน้า', onclick: toggleStrip }, ed.count, h('i', { html: si('down') })), ed.nextB),
      h('span.sk-gap'),
      ed.undoB, ed.redoB, b('sk-ib', 'more', 'ตั้งค่าหน้า', toggleMenu)),
    h('div.sk-bottom', ed.strip, ed.opts, ed.tools),
    ed.menu);
  document.body.append(ed.root);
  bindPointer();
  ed.ro = new ResizeObserver(() => layout());
  ed.ro.observe(ed.stage);
  ed.onKey = e => {
    if (!ed.open || document.querySelector('.confirm')) return;
    if (ed.editing && e.key !== 'Escape') return;
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') { if (ed.editing) ed.editing.ta.blur(); else if (!ed.menu.hidden) toggleMenu(); else if (!ed.strip.hidden) toggleStrip(); else if (ed.z > 1) resetZoom(); else if (ed.sel) setSel(null); else closeSketch(); e.preventDefault(); }
    else if (mod && e.key.toLowerCase() === 'z') { e.shiftKey ? redo() : undo(); e.preventDefault(); }
    else if (mod && e.key.toLowerCase() === 'y') { redo(); e.preventDefault(); }
    else if (e.key === 'ArrowRight') turn(1);
    else if (e.key === 'ArrowLeft') turn(-1);
    else if (e.key === 'ArrowDown' || e.key === 'PageDown') scrollBy(e.key === 'ArrowDown' ? 80 : ed.sh * .8);
    else if (e.key === 'ArrowUp' || e.key === 'PageUp') scrollBy(e.key === 'ArrowUp' ? -80 : -ed.sh * .8);
    else if ((e.key === 'Delete' || e.key === 'Backspace') && ed.sel) selAction('del');
  };
  document.addEventListener('keydown', ed.onKey);
  paintChrome();
}

/* ---------- มุมมอง: ผืนวาดเท่าจอ · หน้ากระดาษเลื่อน/ซูมอยู่ข้างใต้ ---------- */
const sc = () => ed.k * ed.z; // px บนจอต่อ 1 หน่วยหน้ากระดาษ
function layout() {
  if (!ed.open) return;
  const W = ed.stage.clientWidth, Hs = ed.stage.clientHeight;
  if (W <= 0 || Hs <= 0) return;
  ed.sw = W; ed.sh = Hs;
  ed.k = Math.min(W, 900) / PW;
  ed.dpr = Math.min(3, devicePixelRatio || 1);
  for (const c of [ed.base, ed.ink]) { c.width = Math.round(W * ed.dpr); c.height = Math.round(Hs * ed.dpr); }
  fitH();
  setView(ed.z, ed.vx, ed.vy);
  clearInk();
  if (ed.editing) { placeTA(); keepTAInView(); }
}
/** หน้าต้องยาวอย่างน้อยเต็มจอ */
function fitH() { ed.H = Math.max(pageH(ed.page), Math.ceil((ed.sh - BOTTOM_ROOM * .3) / ed.k)); }
function clampView(z, vx, vy) {
  const s = ed.k * z, pw = PW * s, ph = ed.H * s;
  vx = pw <= ed.sw ? (ed.sw - pw) / 2 : Math.max(ed.sw - pw, Math.min(0, vx));
  vy = Math.max(Math.min(0, ed.sh - ph - BOTTOM_ROOM), Math.min(0, vy));
  return [vx, vy];
}
function setView(z, vx, vy) {
  z = Math.max(1, Math.min(4, z));
  [vx, vy] = clampView(z, vx, vy);
  const moved = vy !== ed.vy;
  Object.assign(ed, { z, vx, vy });
  const s = sc();
  ed.layer.style.transform = `translate(${vx}px, ${vy}px) scale(${s})`;
  ed.layer.style.setProperty('--inv', String(1 / s));
  ed.layer.style.height = ed.H + 'px';
  ed.zoomB.hidden = z <= 1.02;
  ed.zoomB.innerHTML = si('zoom') + `<span>${Math.round(z * 100)}%</span>`;
  scrollbar(moved);
  requestRedraw();
  if (ed.sel) showSel();
}
function scrollbar(flash) {
  const ph = ed.H * sc();
  if (ph <= ed.sh + 2) { ed.sbar.hidden = true; return; }
  ed.sbar.hidden = false;
  const th = Math.max(36, ed.sh * ed.sh / (ph + BOTTOM_ROOM)), max = ph + BOTTOM_ROOM - ed.sh;
  ed.sbar.style.height = th + 'px';
  ed.sbar.style.transform = `translateY(${(-ed.vy / max) * (ed.sh - th)}px)`;
  if (flash) { ed.sbar.classList.add('show'); clearTimeout(ed.sbarT); ed.sbarT = setTimeout(() => ed.sbar.classList.remove('show'), 700); }
}
/** เลื่อนมุมมองไปทีละนิดแบบนุ่ม ๆ (z, vx, vy ปลายทาง) */
function glide(z, vx, vy, ms = 260) {
  if (reduced()) return setView(z, vx, vy);
  const a = { z: ed.z, vx: ed.vx, vy: ed.vy }, t0 = performance.now();
  cancelAnimationFrame(ed.glideR);
  const f = now => {
    const t = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - t, 3);
    setView(a.z + (z - a.z) * e, a.vx + (vx - a.vx) * e, a.vy + (vy - a.vy) * e);
    if (t < 1) ed.glideR = requestAnimationFrame(f);
  };
  ed.glideR = requestAnimationFrame(f);
}
function scrollBy(dy) { glide(ed.z, ed.vx, ed.vy - dy, 220); }
function resetZoom() {
  const cy = (ed.sh / 2 - ed.vy) / sc(); // คงจุดกลางจอไว้
  glide(1, 0, ed.sh / 2 - cy * ed.k);
}
function requestRedraw() { if (ed.rr) return; ed.rr = requestAnimationFrame(() => { ed.rr = 0; redraw(); }); }
const setT = ctx => { const s = sc() * ed.dpr; ctx.setTransform(s, 0, 0, s, ed.vx * ed.dpr, ed.vy * ed.dpr); return ctx; };
function redraw() {
  if (!ed.open || !ed.k) return;
  const ctx = ed.base.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = DESK; ctx.fillRect(0, 0, ed.base.width, ed.base.height);
  setT(ctx);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, PW, ed.H); ctx.clip();
  drawPage(ctx, ed.page, 1 / sc(), { hide: ed.editing?.id, onImg: requestRedraw, H: ed.H, view: [-ed.vy / sc() - 60, (ed.sh - ed.vy) / sc() + 60] });
  ctx.restore();
}
function clearInk() { const ctx = ed.ink.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ed.ink.width, ed.ink.height); return setT(ctx); }
/** เขียนใกล้ท้ายหน้า → หน้ายาวขึ้นอีก (เหมือนแอปโน้ต) */
function grow(y) {
  if (y < ed.H - 420) return;
  ed.H = Math.ceil((y + 1100) / 100) * 100;
  ed.page = { ...ed.page, h: ed.H };
  setView(ed.z, ed.vx, ed.vy);
}

/* ---------- แถบเครื่องมือ ---------- */
function paintChrome() {
  const list = pagesNow(), n = list.length, i = ed.idx;
  put(ed.count, `${i + 1} / ${n}`);
  ed.prevB.disabled = i === 0;
  const last = i === n - 1;
  ed.nextB.innerHTML = si(last ? 'plus' : 'right');
  ed.nextB.setAttribute('aria-label', last ? 'เพิ่มหน้าใหม่' : 'หน้าถัดไป'); ed.nextB.title = ed.nextB.getAttribute('aria-label');
  ed.nextB.classList.toggle('add', last);
  const hs = ed.hist.get(ed.page.id);
  ed.undoB.disabled = !hs?.u.length; ed.redoB.disabled = !hs?.r.length;
  ed.tools.querySelectorAll('.sk-tool').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.tool === ed.tool)));
  ed.tools.style.setProperty('--pen', col('pen')); ed.tools.style.setProperty('--hl', ed.color.hl);
  ed.root.classList.toggle('dark-paper', isDark());
  if (!ed.strip.hidden) paintStrip();
  paintToc();
  paintOpts();
}
function paintOpts() {
  const t = ed.tool, kids = [];
  if (t === 'shape') kids.push(h('div.sk-seg', Object.entries(SHAPES).map(([k, l]) =>
    h('button', { type: 'button', 'aria-label': l, title: l, 'aria-pressed': String(ed.shape === k), html: si(k), onclick: () => { ed.shape = k; paintOpts(); } }))));
  if (['pen', 'hl', 'shape', 'text'].includes(t)) {
    const pal = palOf(t), cur = col(t);
    const set = c => { bag(t)[t] = c; if (ed.editing && t === 'text') { ed.editing.t.c = c; ed.editing.ta.style.color = c; ed.editing.ta.focus({ preventScroll: true }); } paintChrome(); };
    const own = !pal.includes(cur);
    const picker = h('input', { type: 'color', value: own ? cur : pal[0], 'aria-label': 'เลือกสีเอง', oninput: e => set(e.target.value) });
    kids.push(h('div.sk-colors', pal.map(c => h('button', { type: 'button', 'aria-label': 'สี ' + c, 'aria-pressed': String(cur === c), style: { '--sw': c }, onclick: () => set(c) })),
      h('label.sk-own' + (own ? '.on' : ''), { title: 'เลือกสีเอง', style: own ? { '--sw': cur } : null }, picker)));
  }
  if (['pen', 'hl', 'shape', 'text', 'eraser'].includes(t)) {
    const key = t === 'shape' ? 'pen' : t, sz = G.SIZES[key];
    kids.push(h('div.sk-sizes', sz.map((v, i) => h('button', { type: 'button', 'aria-label': ['เล็ก', 'กลาง', 'ใหญ่'][i], 'aria-pressed': String(ed.size[t] === i),
      onclick: () => { ed.size[t] = i; if (ed.editing && t === 'text') { ed.editing.t.s = v; placeTA(); ed.editing.ta.focus({ preventScroll: true }); } paintOpts(); } },
      h('i', { style: { '--d': (t === 'text' ? [9, 13, 18] : t === 'eraser' ? [8, 13, 19] : t === 'hl' ? [8, 12, 17] : [4, 7, 11])[i] + 'px', '--sw': t === 'eraser' ? '#fff' : col(t) } })))));
  }
  if (t === 'lasso') kids.push(h('p.sk-hint', ed.sel ? 'ลากในกรอบเพื่อย้าย · ลากมุมเพื่อย่อขยาย' : 'วนรอบสิ่งที่อยากย้าย หรือแตะที่รูป/ข้อความ'));
  if (t === 'eraser') kids.push(h('p.sk-hint.sm', 'ลากผ่านเส้น = ลบทั้งเส้น'));
  if (t === 'text') kids.push(h('p.sk-hint.sm.tip', 'แตะตรงไหนก็พิมพ์ได้'));
  if (t === 'shape') kids.push(h('p.sk-hint.tip', 'เคล็ดลับ: ใช้ปากกาวาดแล้วค้างไว้ = รูปทรงเป๊ะ'));
  put(ed.opts, kids);
  ed.opts.dataset.tool = t;
}
async function pickTool(k) {
  if (ed.editing) commitText();
  if (k === 'img') return insertImage();
  if (k !== 'lasso') setSel(null);
  ed.tool = k; paintChrome();
}

/** หน้าปก: แถวสารบัญแตะแล้วพลิกไปหน้านั้น */
function paintToc() {
  const info = ed.page.cover && coverInfo(ed.page);
  put(ed.toc, info ? coverLayout(info).rows.map(r => h('a', { href: '#', role: 'button', style: { top: r.y - 18 + 'px' }, 'aria-label': `ไปหน้า ${r.n}${r.title ? ' ' + r.title : ''}`,
    onclick: e => { e.preventDefault(); turnTo(pagesNow().findIndex(p => p.id === r.id)); } })) : '');
}

/* ---------- ประวัติ (เลิกทำ/ทำซ้ำ) แยกตามหน้า ---------- */
const snap = p => ({ strokes: p.strokes.slice(), texts: p.texts.map(t => ({ ...t })), imgs: p.imgs.map(i => ({ ...i })) });
function remember() {
  let hs = ed.hist.get(ed.page.id);
  if (!hs) ed.hist.set(ed.page.id, hs = { u: [], r: [] });
  hs.u.push(snap(ed.page)); if (hs.u.length > 100) hs.u.shift();
  hs.r = [];
}
function undo() { step('u', 'r'); }
function redo() { step('r', 'u'); }
function step(from, to) {
  if (ed.editing) commitText();
  const hs = ed.hist.get(ed.page.id);
  if (!hs?.[from].length) return;
  hs[to].push(snap(ed.page));
  ed.page = { ...ed.page, ...hs[from].pop() };
  setSel(null); changed();
}
function changed() { redraw(); paintChrome(); queueSave(); }
function queueSave() { clearTimeout(ed.saveT); ed.saveT = setTimeout(flush, 400); }
async function flush(notify = false) {
  clearTimeout(ed.saveT);
  if (!ed.page) return;
  ed.page = await app.store.savePage(ed.page, notify);
}

/* ---------- นิ้ว/ปากกา/เมาส์ ----------
   นิ้วเดียว/ปากกา/เมาส์ = ใช้เครื่องมือ · สองนิ้ว = เลื่อนขึ้นลง / ถ่างซูม / ปัดซ้ายขวาเปลี่ยนหน้า
   ถ้าใช้ปากกาสไตลัสอยู่ นิ้วเดียว = เลื่อนแทน (มือแตะจอไม่เป็นเส้น) */
function bindPointer() {
  const el = ed.stage, ptrs = new Map();
  let g = null; // ท่าที่กำลังทำ
  let two = null, raf = 0;
  const at = e => { const r = el.getBoundingClientRect(), s = sc(); return [(e.clientX - r.left - ed.vx) / s, (e.clientY - r.top - ed.vy) / s, e.pointerType === 'pen' ? (e.pressure || .5) : null, e.timeStamp]; };
  const center = () => { const v = [...ptrs.values()]; return { cx: v.reduce((s, p) => s + p.x, 0) / v.length, cy: v.reduce((s, p) => s + p.y, 0) / v.length, d: v.length > 1 ? Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y) : 0 }; };
  const cancel = () => { clearTimeout(g?.hold); if (g?.kind === 'ink' || g?.kind === 'shape' || g?.kind === 'loop' || g?.kind === 'erase') clearInk(); if (g?.kind === 'move' && g.base) { ed.page = g.base; redraw(); showSel(); } if (g?.kind === 'erase' && g.saved) changed(); g = null; };
  const live = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; paintLive(); }); };
  function paintLive() {
    if (!g) return;
    const ctx = clearInk();
    const S = sc(), dk = isDark();
    if (g.kind === 'ink') drawStroke(ctx, g.s, dk);
    else if (g.kind === 'shape') drawStroke(ctx, { t: 'pen', sh: 1, c: g.c, w: g.w, p: G.shapePoints(ed.shape, g.x0, g.y0, g.x1, g.y1) }, dk);
    else if (g.kind === 'erase') { ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, 7); ctx.fillStyle = dk ? 'rgba(255,255,255,.12)' : 'rgba(11,27,77,.08)'; ctx.fill(); ctx.lineWidth = 1.5 / S; ctx.strokeStyle = dk ? 'rgba(255,255,255,.6)' : 'rgba(11,27,77,.45)'; ctx.stroke(); }
    else if (g.kind === 'loop') { ctx.beginPath(); ctx.moveTo(g.p[0], g.p[1]); for (let i = 2; i < g.p.length; i += 2) ctx.lineTo(g.p[i], g.p[i + 1]); ctx.setLineDash([8 / S, 6 / S]); ctx.lineWidth = 1.8 / S; ctx.strokeStyle = dk ? '#74C0FC' : '#0A6CF1'; ctx.stroke(); ctx.fillStyle = 'rgba(10,108,241,.06)'; ctx.fill(); }
  }
  // ท่าเลื่อน/ซูม (สองนิ้ว หรือนิ้วเดียวตอนใช้สไตลัส) — ปล่อยแล้วไหลต่อนิด ๆ
  function panStart() {
    cancelAnimationFrame(ed.glideR); cancelAnimationFrame(ed.flingR);
    const q = center(), r = el.getBoundingClientRect();
    two = { ...q, c0x: q.cx, c0y: q.cy, d0: q.d || 1, z0: ed.z, vx0: ed.vx, vy0: ed.vy, ux: (q.cx - r.left - ed.vx) / sc(), uy: (q.cy - r.top - ed.vy) / sc(), rl: r.left, rt: r.top, mode: null, n: ptrs.size, hist: [] };
  }
  function panMove() {
    const q = center(), dx = q.cx - two.c0x, dy = q.cy - two.c0y, ratio = two.n > 1 && ptrs.size > 1 ? q.d / two.d0 : 1;
    if (!two.mode) {
      if (Math.abs(ratio - 1) > .08) two.mode = 'zoom';
      else if (Math.hypot(dx, dy) > 10) two.mode = Math.abs(dx) > Math.abs(dy) * 1.2 && ed.z === 1 && two.n > 1 ? 'swipe' : 'pan';
    }
    two.hist.push([performance.now(), q.cx, q.cy]); if (two.hist.length > 6) two.hist.shift();
    if (two.mode === 'zoom') { const z = Math.max(1, Math.min(4, two.z0 * ratio)), s = ed.k * z; setView(z, q.cx - two.rl - two.ux * s, q.cy - two.rt - two.uy * s); }
    else if (two.mode === 'pan') setView(ed.z, two.vx0 + dx, two.vy0 + dy);
    else if (two.mode === 'swipe') ed.stage.style.setProperty('--drag', Math.max(-70, Math.min(70, dx / 3)) + 'px');
    two.last = q;
  }
  function panEnd() {
    const t = two; two = null;
    ed.stage.style.removeProperty('--drag');
    if (t.mode === 'swipe') { const dx = (t.last?.cx ?? t.c0x) - t.c0x; if (Math.abs(dx) > 50) turn(dx < 0 ? 1 : -1); return; }
    if (t.mode === 'zoom' && ed.z < 1.08) { resetZoom(); return; }
    if (t.mode === 'pan' && t.hist.length > 2 && !reduced()) { // ไหลต่อ
      const [a, b] = [t.hist[0], t.hist[t.hist.length - 1]], dt = Math.max(16, b[0] - a[0]);
      let vx = (b[1] - a[1]) / dt * 16, vy = (b[2] - a[2]) / dt * 16;
      if (performance.now() - b[0] > 80) return;
      const f = () => { vx *= .93; vy *= .93; setView(ed.z, ed.vx + vx, ed.vy + vy); if (Math.hypot(vx, vy) > .4) ed.flingR = requestAnimationFrame(f); };
      if (Math.hypot(vx, vy) > 2) ed.flingR = requestAnimationFrame(f);
    }
    if (t.mode === 'pen-swipe') return;
    // นิ้วเดียวตอนใช้สไตลัส: ปัดแรง ๆ ซ้ายขวา = เปลี่ยนหน้า
    if (t.n === 1 && ed.z === 1 && t.last) { const dx = t.last.cx - t.c0x, dy = t.last.cy - t.c0y; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) turn(dx < 0 ? 1 : -1); }
  }

  el.addEventListener('pointerdown', e => {
    if (ed.busy || e.target.closest('.sk-ta, .sk-toc a')) return;
    if (e.pointerType === 'pen') ed.penSeen = true;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    el.setPointerCapture?.(e.pointerId);
    if (!ed.menu.hidden) toggleMenu();
    if (!ed.strip.hidden) toggleStrip();
    cancelAnimationFrame(ed.flingR);
    if (ptrs.size === 2) { cancel(); panStart(); return; }
    if (ptrs.size > 2) return;
    if (ed.penSeen && e.pointerType === 'touch') { panStart(); return; }
    if (ed.editing) { commitText(); if (ed.tool === 'text') return; }
    e.preventDefault();
    start(at(e), e);
  });
  el.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (two) { panMove(); return; }
    if (!g) return;
    const evs = e.getCoalescedEvents?.() || [e];
    for (const ev of evs.length ? evs : [e]) move(at(ev));
    live();
  });
  const up = e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (two) { if (!ptrs.size) panEnd(); return; }
    if (e.type === 'pointercancel') { cancel(); return; }
    if (g) end(at(e));
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  // ล้อเมาส์ = เลื่อน · ctrl/ถ่างบนทัชแพด = ซูม
  ed.root.addEventListener('wheel', e => {
    if (e.target.closest('.sk-strip, .sk-menu')) return;
    e.preventDefault();
    cancelAnimationFrame(ed.glideR);
    const r = el.getBoundingClientRect();
    if (e.ctrlKey) {
      const z = Math.max(1, Math.min(4, ed.z * Math.exp(-e.deltaY * .01))), s = ed.k * z;
      const ux = (e.clientX - r.left - ed.vx) / sc(), uy = (e.clientY - r.top - ed.vy) / sc();
      setView(z, e.clientX - r.left - ux * s, e.clientY - r.top - uy * s);
      clearTimeout(ed.wheelT); ed.wheelT = setTimeout(() => { if (ed.z < 1.05) resetZoom(); }, 200);
    } else setView(ed.z, ed.vx - e.deltaX, ed.vy - e.deltaY);
  }, { passive: false });

  function start([x, y, pr, ts]) {
    const t = ed.tool;
    if (t === 'pen' || t === 'hl') {
      g = { kind: 'ink', real: pr != null, ts, s: { id: G.pid('s'), t, c: col(t), w: G.SIZES[t][ed.size[t]], p: [x, y, pr ?? .62] } }; live();
      if (t === 'pen') armHold();
    } else if (t === 'shape') g = { kind: 'shape', x0: x, y0: y, x1: x, y1: y, c: col('shape'), w: G.SIZES.pen[ed.size.shape] };
    else if (t === 'eraser') { g = { kind: 'erase', x, y, r: G.SIZES.eraser[ed.size.eraser], saved: false }; eraseAt(); live(); }
    else if (t === 'text') g = { kind: 'tap', x, y };
    else if (t === 'lasso') {
      const b = ed.sel && G.selBox(ed.page, ed.sel, textH), pad = 18 / sc();
      if (b && Math.hypot(x - b.x1, y - b.y1) < 30 / sc()) g = { kind: 'move', mode: 'scale', x0: x, y0: y, base: ed.page, box: b };
      else if (b && x > b.x0 - pad && x < b.x1 + pad && y > b.y0 - pad && y < b.y1 + pad) g = { kind: 'move', mode: 'move', x0: x, y0: y, base: ed.page, box: b };
      else { setSel(null); g = { kind: 'loop', p: [x, y] }; }
    }
  }
  // ค้างปากกาไว้ครู่หนึ่ง → ลายมือกลายเป็นรูปทรงเป๊ะ (เส้นตรง วงกลม สี่เหลี่ยม สามเหลี่ยม)
  function armHold() { clearTimeout(g.hold); g.hold = setTimeout(snapShape, 520); }
  function snapShape() {
    if (g?.kind !== 'ink' || g.s.sh || g.s.t !== 'pen') return;
    const r = G.recognize(g.s.p);
    if (!r) return;
    g.s = { ...g.s, sh: 1, p: r.p };
    navigator.vibrate?.(12);
    ed.stage.classList.remove('snap'); void ed.stage.offsetWidth; ed.stage.classList.add('snap');
    live();
  }
  function move([x, y, pr, ts]) {
    if (!g) return;
    if (g.kind === 'ink') {
      if (g.s.sh) return; // กลายเป็นรูปทรงแล้ว
      const p = g.s.p, lx = p[p.length - 3], ly = p[p.length - 2], dist = Math.hypot(x - lx, y - ly);
      if (dist <= .6) return;
      if (!g.real) { const dt = Math.max(1, ts - g.ts); pr = G.speedPressure(p[p.length - 1], dist * sc() / dt); }
      g.ts = ts;
      p.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(pr * 100) / 100);
      if (dist * sc() > 1.5 && g.s.t === 'pen') armHold();
    }
    else if (g.kind === 'shape') { g.x1 = x; g.y1 = y; }
    else if (g.kind === 'erase') { g.x = x; g.y = y; eraseAt(); }
    else if (g.kind === 'loop') g.p.push(x, y);
    else if (g.kind === 'move') {
      const { box: b } = g;
      const tf = g.mode === 'move' ? { dx: x - g.x0, dy: y - g.y0 }
        : { k: Math.max(.15, Math.min(6, Math.max((x - b.x0) / Math.max(10, b.x1 - b.x0), (y - b.y0) / Math.max(10, b.y1 - b.y0)))), ox: b.x0, oy: b.y0 };
      ed.page = G.transformSel(g.base, ed.sel, tf); g.moved = true;
      redraw(); showSel();
    }
  }
  function eraseAt() {
    const ids = G.strokesHit(ed.page.strokes, g.x, g.y, g.r);
    if (!ids.length) return;
    if (!g.saved) { remember(); g.saved = true; }
    ed.page = { ...ed.page, strokes: ed.page.strokes.filter(s => !ids.includes(s.id)) };
    redraw();
  }
  function end([x, y]) {
    const cur = g; g = null;
    clearTimeout(cur.hold);
    if (cur.kind === 'ink') {
      remember();
      const s = cur.s.sh ? cur.s : { ...cur.s, p: G.thin(cur.s.p, 1.2 / Math.max(.3, sc() * 2)) };
      ed.page = { ...ed.page, strokes: [...ed.page.strokes, s] };
      grow(G.strokeBox(s).y1);
      clearInk(); changed();
    } else if (cur.kind === 'shape') {
      clearInk();
      if (Math.hypot(cur.x1 - cur.x0, cur.y1 - cur.y0) < 8) return;
      remember();
      ed.page = { ...ed.page, strokes: [...ed.page.strokes, { id: G.pid('s'), t: 'pen', sh: 1, c: cur.c, w: cur.w, p: G.shapePoints(ed.shape, cur.x0, cur.y0, cur.x1, cur.y1) }] };
      grow(Math.max(cur.y0, cur.y1));
      changed();
    } else if (cur.kind === 'erase') { clearInk(); if (cur.saved) changed(); }
    else if (cur.kind === 'tap') {
      const hit = textAt(cur.x, cur.y);
      if (hit) editText(hit); else newText(cur.x, cur.y);
    } else if (cur.kind === 'loop') {
      clearInk();
      const len = cur.p.length;
      let sel;
      if (len < 10 || Math.hypot(cur.p[len - 2] - cur.p[0], cur.p[len - 1] - cur.p[1]) < 4 && len < 16) sel = pickAt(x, y);
      else sel = G.lassoPick(ed.page, cur.p);
      setSel(sel && (sel.strokes.length || sel.texts.length || sel.imgs.length) ? sel : null);
    } else if (cur.kind === 'move') {
      if (cur.moved) { const now = ed.page; ed.page = cur.base; remember(); ed.page = now; grow(G.selBox(ed.page, ed.sel, textH)?.y1 || 0); changed(); }
      showSel();
    }
  }
}
function textAt(x, y) { return [...ed.page.texts].reverse().find(t => x >= t.x - 10 && x <= t.x + t.w + 10 && y >= t.y - 10 && y <= t.y + textH(t) + 10); }
function pickAt(x, y) {
  const t = textAt(x, y); if (t) return { strokes: [], texts: [t.id], imgs: [] };
  const s = G.strokesHit(ed.page.strokes, x, y, 14 / sc()).pop(); if (s) return { strokes: [s], texts: [], imgs: [] };
  const i = [...ed.page.imgs].reverse().find(o => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h);
  return i ? { strokes: [], texts: [], imgs: [i.id] } : null;
}

/* ---------- การเลือก ---------- */
function setSel(sel) { ed.sel = sel; showSel(); if (ed.tool === 'lasso') paintOpts(); }
function showSel() {
  const b = ed.sel && G.selBox(ed.page, ed.sel, textH);
  ed.selbox.hidden = ed.selbar.hidden = !b;
  if (!b) return;
  const pad = 8 / sc(), s = sc();
  Object.assign(ed.selbox.style, { left: b.x0 - pad + 'px', top: b.y0 - pad + 'px', width: b.x1 - b.x0 + pad * 2 + 'px', height: b.y1 - b.y0 + pad * 2 + 'px' });
  const sx = ed.vx + ((b.x0 + b.x1) / 2) * s, top = ed.vy + b.y0 * s - 62;
  ed.selbar.style.left = Math.max(8, Math.min(ed.sw - 200, sx - 100)) + 'px';
  ed.selbar.style.top = Math.max(64, Math.min(ed.sh - 190, top < 64 ? ed.vy + b.y1 * s + 18 : top)) + 'px';
}
function selAction(kind) {
  if (!ed.sel) return;
  remember();
  if (kind === 'del') { ed.page = G.removeSel(ed.page, ed.sel); setSel(null); }
  else { const r = G.duplicateSel(ed.page, ed.sel); ed.page = r.page; setSel(r.sel); }
  changed(); showSel();
}

/* ---------- ข้อความ ---------- */
function newText(x, y) {
  const s = G.SIZES.text[ed.size.text];
  const t = { id: G.pid('t'), x: Math.max(20, Math.min(x, PW - 220)), y: Math.max(10, y - s * .7), w: 0, s, c: col('text'), v: '' };
  t.w = Math.max(200, Math.min(620, PW - 30 - t.x));
  editText(t, true);
}
function editText(t, isNew = false) {
  const ta = h('textarea.sk-ta', { value: t.v, 'aria-label': 'พิมพ์ข้อความ', rows: 1, spellcheck: false });
  ed.editing = { id: t.id, t: { ...t }, isNew, ta };
  ta.addEventListener('input', () => { fitTA(); keepTAInView(); });
  ta.addEventListener('blur', () => setTimeout(() => { if (ed.editing?.ta === ta) commitText(); }, 0));
  ed.layer.append(ta);
  redraw(); placeTA();
  requestAnimationFrame(() => { ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length); });
}
function placeTA() {
  const { ta, t } = ed.editing;
  Object.assign(ta.style, { left: t.x + 'px', top: t.y + 'px', width: t.w + 'px', fontSize: t.s + 'px', color: t.c });
  fitTA();
}
function fitTA() { const ta = ed.editing?.ta; if (!ta) return; ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
/** คีย์บอร์ดมือถือขึ้นมาบังช่องพิมพ์ → เลื่อนหน้าให้เห็น */
function keepTAInView() {
  const e = ed.editing; if (!e) return;
  const bottom = ed.vy + (e.t.y + e.ta.offsetHeight) * sc(), top = ed.vy + e.t.y * sc();
  const room = ed.sh - 130;
  if (bottom > room) glide(ed.z, ed.vx, ed.vy - (bottom - room), 180);
  else if (top < 70) glide(ed.z, ed.vx, ed.vy + (70 - top), 180);
}
function commitText() {
  const e = ed.editing;
  if (!e) return;
  ed.editing = null;
  e.ta.remove();
  const v = e.ta.value.replace(/\s+$/, '');
  const t = { ...e.t, v };
  const old = ed.page.texts.find(x => x.id === t.id);
  if (!v && !old) { redraw(); return; }
  if (old && old.v === v && old.c === t.c && old.s === t.s) { redraw(); return; }
  remember();
  ed.page = { ...ed.page, texts: v ? (old ? ed.page.texts.map(x => x.id === t.id ? t : x) : [...ed.page.texts, t]) : ed.page.texts.filter(x => x.id !== t.id) };
  if (v) grow(t.y + textH(t));
  changed();
}

/* ---------- รูป ---------- */
async function insertImage() {
  const file = await pickImage();
  if (!file || !ed.open) return;
  let blob;
  try { ({ blob } = await prepareImage(file)); } catch (e) { toast(e.message); return; }
  const el = new Image(); el.src = URL.createObjectURL(blob);
  try { await el.decode(); } catch { toast('เปิดรูปนี้ไม่ได้'); return; }
  const r = el.naturalHeight / el.naturalWidth;
  let w = 640, hh = w * r; if (hh > 820) { hh = 820; w = hh / r; }
  const cy = (ed.sh * .42 - ed.vy) / sc(); // กลางจอที่กำลังดูอยู่
  const o = { id: G.pid('i'), x: Math.round((PW - w) / 2), y: Math.round(Math.max(40, cy - hh / 2)), w: Math.round(w), h: Math.round(hh), blob };
  imgs.set(o.id, { el, ready: true, wait: new Set() });
  remember();
  ed.page = { ...ed.page, imgs: [...ed.page.imgs, o] };
  grow(o.y + o.h);
  ed.tool = 'lasso'; changed(); setSel({ strokes: [], texts: [], imgs: [o.id] });
  toast('ลากเพื่อย้าย · ลากมุมเพื่อย่อขยาย');
}

/* ---------- แถบภาพย่อทุกหน้า (แตะ "x / y") ---------- */
function toggleStrip() {
  if (ed.editing) commitText();
  ed.menu.hidden = true;
  ed.strip.hidden = !ed.strip.hidden;
  ed.root.classList.toggle('strip-on', !ed.strip.hidden);
  if (!ed.strip.hidden) paintStrip();
}
function paintStrip() {
  const list = pagesNow();
  put(ed.strip, list.map((p, i) => h('button.sk-film' + (i === ed.idx ? '.on' : ''), { type: 'button', role: 'option', 'aria-selected': String(i === ed.idx), 'aria-label': `หน้า ${i + 1}`,
    onclick: () => { toggleStrip(); turnTo(i); } }, thumb(p.id === ed.page.id ? ed.page : p, 120), h('span', String(i + 1)))),
    h('button.sk-film.add', { type: 'button', 'aria-label': 'เพิ่มหน้าใหม่', onclick: async () => { toggleStrip(); await flush(); const p = await app.store.addPage(ed.book.id); turnTo(pagesNow().findIndex(x => x.id === p.id)); }, html: '<i>' + si('plus') + '</i><span>ใหม่</span>' }));
  requestAnimationFrame(() => ed.strip.querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }));
}

/* ---------- เมนูหน้า: กระดาษ · เพิ่ม/ลบ/ล้างหน้า ---------- */
function toggleMenu() {
  if (!ed.menu.hidden) { ed.menu.hidden = true; return; }
  ed.strip.hidden = true; ed.root.classList.remove('strip-on');
  put(ed.menu,
    h('p.sk-mh', 'กระดาษหน้านี้'),
    h('div.sk-papers', Object.entries(G.PAPERS).map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(ed.page.paper === k), onclick: () => setPaper(k) }, h('i.pp.pp-' + k), h('span', l)))),
    h('button.sk-mi', { type: 'button', onclick: () => { ed.menu.hidden = true; addAfter(); }, html: si('plus') + '<span>แทรกหน้าใหม่ถัดจากหน้านี้</span>' }),
    h('button.sk-mi', { type: 'button', onclick: () => { ed.menu.hidden = true; dupPage(); }, html: si('dup') + '<span>ทำสำเนาหน้านี้</span>' }),
    h('button.sk-mi', { type: 'button', onclick: () => { ed.menu.hidden = true; clearPage(); }, html: si('eraser') + '<span>ล้างหน้านี้</span>' }),
    h('button.sk-mi.danger', { type: 'button', onclick: () => { ed.menu.hidden = true; delPage(); }, html: si('trash') + '<span>ลบหน้านี้</span>' }));
  ed.menu.hidden = false;
}
function setPaper(k) {
  ed.page = { ...ed.page, paper: k };
  app.store.updateBook(ed.book.id, { paper: k }).catch(() => {});
  ed.menu.hidden = true; changed();
}
function clearPage() {
  if (!ed.page.strokes.length && !ed.page.texts.length && !ed.page.imgs.length) return;
  remember(); ed.page = { ...ed.page, strokes: [], texts: [], imgs: [] }; setSel(null); changed();
  toast('ล้างหน้าแล้ว', { label: 'เลิกทำ', run: undo });
}
async function dupPage() { await flush(); const p = await app.store.duplicatePage(ed.page.id); if (p) { await turnTo(pagesNow().findIndex(x => x.id === p.id)); toast('ทำสำเนาหน้าแล้ว'); } }
async function addAfter() { await flush(); const p = await app.store.addPage(ed.book.id, ed.page.id); turnTo(pagesNow().findIndex(x => x.id === p.id)); }
async function delPage() {
  const n = pagesNow().length;
  const ok = await confirmBox({ title: n > 1 ? `ลบหน้า ${ed.idx + 1}?` : 'ล้างหน้าเดียวของสมุด?', body: 'ลบแล้วกู้คืนไม่ได้', ok: 'ลบ', danger: true });
  if (!ok || !ed.open) return;
  clearTimeout(ed.saveT);
  if (n === 1) { ed.page = { ...ed.page, strokes: [], texts: [], imgs: [] }; ed.hist.delete(ed.page.id); await flush(); redraw(); paintChrome(); return; }
  await app.store.removePage(ed.page.id);
  ed.hist.delete(ed.page.id);
  const list = pagesNow(); ed.idx = Math.min(ed.idx, list.length - 1); ed.page = list[ed.idx];
  fitH(); setView(1, 0, 0);
  setSel(null); redraw(); paintChrome();
}

/* ---------- พลิกหน้า: ภาพหน้าเดิมพลิกออกทางซ้ายทั้งจอ ---------- */
async function turn(d) {
  if (ed.busy) return;
  const n = pagesNow().length;
  if (d > 0 && ed.idx === n - 1) {
    await flush();
    const p = await app.store.addPage(ed.book.id);
    return turnTo(pagesNow().findIndex(x => x.id === p.id), true);
  }
  turnTo(ed.idx + d);
}
async function turnTo(i, fresh = false) {
  const list = pagesNow();
  if (i < 0 || i >= list.length || i === ed.idx || ed.busy) { if (fresh === false && i === ed.idx) paintChrome(); return; }
  ed.busy = true;
  if (ed.editing) commitText();
  setSel(null);
  cancelAnimationFrame(ed.flingR); cancelAnimationFrame(ed.glideR);
  await flush();
  const dir = i > ed.idx ? 1 : -1, next = pagesNow()[i];
  const flipper = h('canvas.sk-flip', { width: ed.base.width, height: ed.base.height });
  const fx = flipper.getContext('2d');
  if (dir > 0) fx.drawImage(ed.base, 0, 0);
  ed.idx = i; ed.page = next; fitH();
  Object.assign(ed, { z: 1, vx: 0, vy: 0 }); setView(1, 0, 0); redraw();
  if (dir < 0) { fx.drawImage(ed.base, 0, 0); } // หน้าก่อนหน้าพลิกกลับเข้ามา
  const shade = h('i.sk-shade');
  ed.stage.append(flipper, shade);
  paintChrome();
  const dur = reduced() ? 160 : 560;
  const frames = reduced() ? [{ opacity: 1 }, { opacity: 0 }]
    : dir > 0 ? [{ transform: 'rotateY(0deg)', filter: 'brightness(1)' }, { transform: 'rotateY(-60deg)', filter: 'brightness(.95)', offset: .55 }, { transform: 'rotateY(-98deg)', filter: 'brightness(.78)' }]
      : [{ transform: 'rotateY(-98deg)', filter: 'brightness(.78)' }, { transform: 'rotateY(-40deg)', filter: 'brightness(.95)', offset: .45 }, { transform: 'rotateY(0deg)', filter: 'brightness(1)' }];
  if (reduced() && dir < 0) frames.reverse();
  const a = flipper.animate(frames, { duration: dur, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' });
  shade.animate([{ opacity: dir > 0 ? 0 : .45 }, { opacity: .45, offset: .5 }, { opacity: dir > 0 ? .45 : 0 }], { duration: dur, fill: 'forwards' });
  try { await a.finished; } catch {}
  flipper.remove(); shade.remove();
  ed.busy = false;
  app.store.updateBook(ed.book.id, { last_page: ed.page.id }).catch(() => {});
}

/* ---------- เข้า/ออก: กระดาษเต็มจอขยายจากภาพย่อ · ออกแล้วย่อกลับไปที่ภาพย่อในหน้า "ทุกหน้า" ---------- */
/** ส่วนบนของหน้า (สัดส่วนเดียวกับภาพย่อ) อยู่ตรงไหนบนจอ → transform + clip ที่ทำให้มันไปทับกรอบ r พอดี */
function fitTo(r) {
  const sr = ed.stage.getBoundingClientRect(), s = sc();
  const x0 = ed.vx, y0 = ed.vy, w = PW * s, hgt = PH * s;
  const k = r.width / w;
  return {
    transform: `translate(${r.left - sr.left - x0 * k}px, ${r.top - sr.top - y0 * k}px) scale(${k})`,
    clipPath: `inset(${y0}px ${Math.max(0, sr.width - x0 - w)}px ${Math.max(0, sr.height - y0 - hgt)}px ${x0}px round ${6 / k}px)`,
  };
}
function zoomFrom(r) {
  const root = ed.root;
  root.classList.add('zoom');
  requestAnimationFrame(() => root.classList.add('in'));
  redraw();
  ed.stage.animate([fitTo(r), { transform: 'none', clipPath: 'inset(0px 0px 0px 0px round 0px)' }],
    { duration: 440, easing: 'cubic-bezier(.2,.8,.2,1)' }).finished.finally(() => root.classList.remove('zoom'));
}
export async function closeSketch(fromPop = false) {
  if (!ed.open || ed.closing) return;
  ed.closing = true;
  if (ed.editing) commitText();
  setSel(null);
  cancelAnimationFrame(ed.flingR); cancelAnimationFrame(ed.glideR);
  try { await flush(false); } catch {}
  app.store.setPref('sketch', { tool: ed.tool, shape: ed.shape, color: ed.color, dcolor: ed.dcolor, size: ed.size, tipped: true }, false).catch(() => {});
  await app.store.updateBook(ed.book.id, { last_page: ed.page.id }).catch(() => {}); // แจ้งทั้งแอป → หน้า "ทุกหน้า" วาดภาพย่อใหม่
  if (!fromPop) dropBack('sketch');
  const root = ed.root, pageId = ed.page.id;
  document.removeEventListener('keydown', ed.onKey);
  ed.ro.disconnect();
  app.svTab = 'notes';
  if (location.hash !== homeOf(ed.book)) location.hash = homeOf(ed.book);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const target = document.querySelector(`.bk-thumb[data-id="${pageId}"]`);
  document.body.classList.remove('sk-on');
  if (target && !reduced()) {
    target.scrollIntoView({ block: 'center' });
    setView(1, 0, 0); redraw(); // ภาพย่อเป็นส่วนบนของหน้า → กลับไปบนสุดก่อนย่อ
    const r = target.querySelector('canvas').getBoundingClientRect();
    target.classList.add('landing');
    root.classList.add('out');
    await ed.stage.animate([{ transform: 'none', clipPath: 'inset(0px 0px 0px 0px round 0px)' }, fitTo(r)],
      { duration: 460, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' }).finished.catch(() => {});
    target.classList.remove('landing');
  } else {
    root.classList.add('out');
    await new Promise(r => setTimeout(r, 200));
  }
  root.remove();
  Object.assign(ed, { open: false, closing: false, root: null });
}

/* =================== เล่ม: สมุดของวิชา · โปรเจกต์ · ตารางทุกหน้า (#/book/<id>) =================== */
/** สมุดของวิชา (เล่มแรกที่ผูกวิชานั้น) */
export const subjectBook = sid => S().books.filter(b => b.subject_id === sid).sort((a, b) => a.created_at.localeCompare(b.created_at))[0] || null;
/** โปรเจกต์ = เล่มที่ไม่ใช่สมุดหลักของวิชาไหน */
export const projectBooks = () => S().books.filter(b => !(b.subject_id && S().subjects.some(s => s.id === b.subject_id) && subjectBook(b.subject_id)?.id === b.id))
  .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
/** หน้าที่ปิดสมุดแล้วกลับไป: สมุดวิชา → หน้าวิชา · โปรเจกต์ → หน้ารวมของเล่ม */
const homeOf = b => { const s = bookFace(b).subject; return s ? '#/subject/' + s.id : '#/book/' + b.id; };
/** เปิดสมุดของวิชา (ยังไม่มี = สร้างพร้อมหน้าปก แล้วเปิดที่หน้าปก) */
export async function openSubjectBook(sid, pageId = null, fromEl = null) {
  let b = subjectBook(sid);
  if (!b) { const s = subj(sid); b = await app.store.addBook({ title: s.name, color: s.color, subject_id: sid, cover: true }); }
  app.svTab = 'notes';
  if (location.hash !== homeOf(b)) location.hash = homeOf(b);
  setTimeout(() => openSketch(b.id, pageId, fromEl), 30);
}

let shown = null; // ภาพย่อค่อย ๆ โผล่เฉพาะตอนเพิ่งเปิด (วาดใหม่ตอนข้อมูลเปลี่ยนไม่ต้องเล่นซ้ำ)
const fmtDay = iso => { const d = toYMD(new Date(iso)), t = toYMD(new Date()); return d === t ? 'วันนี้' : relDay(d, t); };
/** ตารางภาพย่อทุกหน้าของเล่ม (ใช้ทั้งหน้าวิชาและหน้าโปรเจกต์) + ปุ่ม "เขียนต่อ" */
export function pageGrid(b) {
  const list = app.store.pagesOf(b.id);
  const anim = shown !== b.id; shown = b.id;
  const open = (p, el) => openSketch(b.id, p?.id || null, el);
  return [
    h('div.bk-grid' + (anim ? '.anim' : ''), list.map((p, i) => h('button.bk-thumb' + (p.id === b.last_page ? '.last' : ''), { type: 'button', 'data-id': p.id, 'aria-label': `หน้า ${i + 1}`, style: { '--n': i },
      onclick: e => open(p, e.currentTarget.querySelector('canvas')) }, thumb(p, 300), h('span', h('b', String(i + 1)), h('small', p.cover ? 'หน้าปก' : G.pageTitle(p) || '')))),
    h('button.bk-thumb.bk-add', { type: 'button', 'aria-label': 'เพิ่มหน้าใหม่', onclick: async () => { const p = await app.store.addPage(b.id); await app.store.updateBook(b.id, { last_page: p.id }); open(p, document.querySelector(`.bk-thumb[data-id="${p.id}"] canvas`)); } },
      h('i', { html: si('plus') }), h('span', h('b', 'หน้าใหม่')))),
    h('button.bk-go', { type: 'button', onclick: () => open(null, document.querySelector(`.bk-thumb[data-id="${b.last_page}"] canvas`)), html: si('pen') + '<span>เขียนต่อ</span>' }),
  ];
}
/** แผงโน้ตในหน้าวิชา: มีสมุดแล้ว = ทุกหน้า · ยังไม่มี = ชวนเริ่มจด */
export function notesPanel(sid) {
  const b = subjectBook(sid);
  if (b) return pageGrid(b);
  shown = null;
  const s = subj(sid);
  return h('div.sv-empty', { style: { '--c': s.color } },
    h('div.sv-stack', h('i'), h('i'), h('i', h('b', s.name))),
    h('b', `เริ่มสมุด${s.name}`), h('p', 'ได้หน้าปกพร้อมสารบัญ แล้วเขียนต่อได้เลย'),
    h('button.btn.primary.auto', { type: 'button', onclick: () => openSubjectBook(sid) }, 'เริ่มจด'));
}

/** หน้ารวมของโปรเจกต์ */
export function bookView(root, id) {
  const b = S().books.find(x => x.id === id);
  if (!b) { shown = null; put(root, h('div.phead', h('button.iconbtn', { 'aria-label': 'กลับ', html: si('back'), onclick: () => { location.hash = '#/notebook'; } }), h('h1', 'ไม่พบสมุด'))); return; }
  const f = bookFace(b);
  if (f.subject && subjectBook(f.subject.id)?.id === b.id) { app.svTab = 'notes'; location.replace('#/subject/' + f.subject.id); return; }
  const list = app.store.pagesOf(id);
  put(root,
    h('div.phead.bk-head',
      h('button.iconbtn', { 'aria-label': 'กลับไปสมุด', html: si('back'), onclick: () => { location.hash = '#/notebook'; } }),
      h('span'), h('button.iconbtn', { 'aria-label': 'ตั้งค่าสมุด', html: si('more'), onclick: () => bookMenu(b) })),
    h('div.sv-hero', h('span.sv-book', { style: { '--c': f.color } }),
      h('div', h('small', f.subject ? `โปรเจกต์ · ${f.subject.name}` : 'โปรเจกต์'), h('h1', f.title), h('p', `${list.length} หน้า · แก้ล่าสุด ${fmtDay(b.updated_at)}`))),
    pageGrid(b));
}

function bookMenu(b) {
  openModal({
    title: b.title, label: 'ตั้งค่าสมุด',
    body: [
      h('button.sk-mi', { type: 'button', onclick: () => { closeModal(); bookDialog(b); }, html: si('edit') + '<span>เปลี่ยนชื่อ / สีปก</span>' }),
      h('button.sk-mi.danger', { type: 'button', onclick: async () => {
        closeModal();
        const ok = await confirmBox({ title: `ลบ "${b.title}"?`, body: `ทุกหน้า (${app.store.pagesOf(b.id).length} หน้า) จะหายไป กู้คืนไม่ได้`, ok: 'ลบทั้งเล่ม', danger: true });
        if (!ok) return;
        location.hash = '#/notebook';
        await app.store.deleteBook(b.id);
        toast('ลบแล้ว');
      }, html: si('trash') + '<span>ลบทั้งเล่ม</span>' }),
    ],
  });
}

/** รอให้การถอยประวัติของกล่องที่เพิ่งปิดเสร็จ (มี popstate) หรือไม่เกิน 0.35 วินาที */
const settled = () => new Promise(res => {
  const done = () => { clearTimeout(t); removeEventListener('popstate', done); requestAnimationFrame(() => res()); };
  const t = setTimeout(done, 350);
  addEventListener('popstate', done);
});

/** กล่องเล่มใหม่ (โปรเจกต์ / วิชาใหม่) — หรือแก้ชื่อและสีของโปรเจกต์ (ส่ง b) */
export function bookDialog(b = null) {
  const st = { kind: 'project', title: b?.title || '', color: b?.color || SUBJECT_COLORS[(S().books.length + 4) % SUBJECT_COLORS.length], paper: b?.paper || 'lined', cover: true };
  const name = h('input.bk-in', { value: st.title, maxLength: 40, 'aria-label': 'ชื่อ', oninput: e => { st.title = e.target.value; prev(); } });
  const pv = h('div.nb-book.big', { 'aria-hidden': 'true' });
  const prev = () => {
    pv.style.setProperty('--c', st.color);
    put(pv, h('b', st.title.trim() || (st.kind === 'subject' ? 'วิชาใหม่' : 'โปรเจกต์')), h('small', st.kind === 'subject' ? 'วิชา' : 'โปรเจกต์'));
    name.placeholder = st.kind === 'subject' ? 'ชื่อวิชา เช่น ประวัติศาสตร์' : 'เช่น โครงงานวิทย์ · ติวสอบเข้า';
  };
  const seg = b ? null : h('div.nb-seg');
  const paintSeg = () => seg && put(seg, [['project', 'โปรเจกต์'], ['subject', 'วิชาใหม่']].map(([k, l]) =>
    h('button', { type: 'button', 'aria-pressed': String(st.kind === k), onclick: () => { st.kind = k; paintSeg(); prev(); } }, l)));
  const colors = h('div.bk-colors');
  const paintColors = () => put(colors, SUBJECT_COLORS.map(c => h('button', { type: 'button', 'aria-label': 'สีปก ' + c, 'aria-pressed': String(st.color === c), style: { '--sw': c }, onclick: () => { st.color = c; paintColors(); prev(); } })));
  const firsts = h('div.nb-firsts');
  const paintFirsts = () => put(firsts, [[true, 'หน้าปก + สารบัญ', 'เปิดมาเจอหน้าปก สารบัญขึ้นเอง'], [false, 'เริ่มเขียนเลย', 'ไม่มีหน้าปก']].map(([v, l, d]) =>
    h('button', { type: 'button', 'aria-pressed': String(st.cover === v), onclick: () => { st.cover = v; paintFirsts(); } }, h('i.' + (v ? 'pf-cover' : 'pf-plain'), { style: { '--c': st.color } }), h('span', h('b', l), h('small', d)))));
  const papers = h('div.sk-papers');
  const paintPapers = () => put(papers, Object.entries(G.PAPERS).map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(st.paper === k), onclick: () => { st.paper = k; paintPapers(); } }, h('i.pp.pp-' + k), h('span', l))));
  paintSeg(); paintColors(); paintFirsts(); paintPapers(); prev();
  const go = h('button.btn.primary.wide', { type: 'button', onclick: async () => {
    const title = st.title.trim();
    if (!title) { name.focus(); toast(st.kind === 'subject' ? 'ตั้งชื่อวิชาก่อน' : 'ตั้งชื่อโปรเจกต์ก่อน'); return; }
    if (b) { await app.store.updateBook(b.id, { title, color: st.color }); closeModal(); return; }
    let target;
    if (st.kind === 'subject') {
      const s = await app.store.ensureSubject(title);
      await app.store.updateSubject(s.id, { color: st.color, hidden: false });
      target = subjectBook(s.id) || await app.store.addBook({ title, color: st.color, paper: st.paper, subject_id: s.id, cover: st.cover });
    } else target = await app.store.addBook({ title, color: st.color, paper: st.paper, cover: st.cover });
    const back = settled();
    closeModal();
    await back; // ปิดกล่องแล้วเบราว์เซอร์ถอยประวัติ — รอให้เสร็จก่อน ไม่งั้นจะถอยทับหน้าที่เพิ่งเปิด
    app.svTab = 'notes';
    location.hash = homeOf(target);
    setTimeout(() => openSketch(target.id), 40);
  } }, b ? 'บันทึก' : 'สร้างแล้วเปิดหน้าแรก');
  openModal({
    title: b ? 'แก้โปรเจกต์' : 'เล่มใหม่', label: b ? 'แก้โปรเจกต์' : 'สร้างเล่มใหม่',
    isDirty: () => !b && !!st.title.trim(),
    body: h('div.bk-form', seg, h('div.bk-pv', pv), name, h('p.bk-lb', 'สีปก'), colors,
      b ? '' : [h('p.bk-lb', 'หน้าแรก'), firsts, h('p.bk-lb', 'กระดาษ'), papers]),
    foot: go,
  });
  if (!b) setTimeout(() => name.focus(), 320);
}
