// สมุดจด (0.10) — เขียนในสมุดเหมือนแอปโน้ต: ปากกา · ปากกาเน้น · ยางลบ · บ่วงเลือก/ย้าย/ย่อขยาย · รูปทรง · ข้อความ · รูป · เลิกทำ/ทำซ้ำ · กระดาษ 4 แบบ
// เปลี่ยนหน้าแบบพลิกกระดาษ (ปุ่ม ‹ › · ปัดสองนิ้ว · ใช้ปากกาสไตลัสอยู่ = ปัดนิ้วเดียวได้) · ออก = หน้าเขียนย่อลงไปเป็นภาพย่อในหน้า "ทุกหน้า" ของสมุด
// เส้น/ข้อความเก็บเป็นหน่วยหน้ากระดาษ (domain/pages.js) วาดใหม่ได้ทุกขนาดจอ · ระหว่างเขียนบันทึกเงียบ ๆ ทุก 0.4 วินาที
import { h, put, toast, confirmBox, openModal, closeModal, onBack, pushBack, dropBack } from '../ui/kit.js';
import { app, S, subj, visibleSubjects } from './shared.js';
import { pickImage, prepareImage } from './images.js';
import { relDay, toYMD } from '../domain/dates.js';
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

function paper(ctx, kind, u) {
  ctx.fillStyle = '#FFFDF8'; ctx.fillRect(0, 0, PW, PH);
  const line = (x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  if (kind === 'lined') {
    ctx.strokeStyle = 'rgba(10,108,241,.2)'; ctx.lineWidth = Math.max(1.6, u * .8);
    for (let y = 170; y < PH - 40; y += 52) line(0, y, PW, y);
    ctx.strokeStyle = 'rgba(228,84,101,.42)'; line(118, 0, 118, PH);
  } else if (kind === 'grid') {
    for (let i = 0, x = 0; x <= PW; x += 40, i++) { ctx.strokeStyle = i % 5 ? 'rgba(10,108,241,.12)' : 'rgba(10,108,241,.24)'; ctx.lineWidth = Math.max(1.4, u * .7); line(x, 0, x, PH); }
    for (let i = 0, y = 0; y <= PH; y += 40, i++) { ctx.strokeStyle = i % 5 ? 'rgba(10,108,241,.12)' : 'rgba(10,108,241,.24)'; ctx.lineWidth = Math.max(1.4, u * .7); line(0, y, PW, y); }
  } else if (kind === 'dots') {
    ctx.fillStyle = 'rgba(11,27,77,.26)';
    const r = Math.max(2.2, u * .9);
    for (let y = 40; y < PH; y += 40) for (let x = 40; x < PW; x += 40) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
  }
}

function pathOf(ctx, p) {
  ctx.beginPath(); ctx.moveTo(p[0], p[1]);
  if (p.length === 6) { ctx.lineTo(p[3], p[4]); return; }
  for (let i = 3; i < p.length - 3; i += 3) ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 3]) / 2, (p[i + 1] + p[i + 4]) / 2);
  ctx.lineTo(p[p.length - 3], p[p.length - 2]);
}
export function drawStroke(ctx, s) {
  const p = s.p;
  if (!p.length) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = ctx.fillStyle = s.c;
  if (s.t === 'hl') { ctx.globalAlpha = .42; ctx.globalCompositeOperation = 'multiply'; ctx.lineCap = 'butt'; }
  if (p.length === 3) { ctx.beginPath(); ctx.arc(p[0], p[1], s.w / 2, 0, 7); ctx.fill(); ctx.restore(); return; }
  let lo = 1, hi = 0;
  for (let i = 2; i < p.length; i += 3) { if (p[i] < lo) lo = p[i]; if (p[i] > hi) hi = p[i]; }
  if (s.t === 'pen' && hi - lo > .06) {
    // ปากกาสไตลัส: กดแรง = เส้นหนา
    for (let i = 3; i < p.length; i += 3) {
      ctx.lineWidth = s.w * (.35 + p[i + 2] * 1.3);
      const ax = i > 3 ? (p[i - 3] + p[i - 6]) / 2 : p[i - 3], ay = i > 3 ? (p[i - 2] + p[i - 5]) / 2 : p[i - 2];
      const bx = (p[i] + p[i - 3]) / 2, by = (p[i + 1] + p[i - 2]) / 2;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(p[i - 3], p[i - 2], i === p.length - 3 ? p[i] : bx, i === p.length - 3 ? p[i + 1] : by); ctx.stroke();
    }
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

/** วาดหน้าทั้งหน้า — ctx ต้องตั้งสเกลเป็นหน่วยหน้ากระดาษไว้แล้ว · u = หน่วยต่อ 1 px บนจอ */
export function drawPage(ctx, page, u, { hide = null, onImg = null } = {}) {
  paper(ctx, page.paper, u);
  for (const o of page.imgs || []) {
    const el = imgEl(o, onImg);
    if (el) ctx.drawImage(el, o.x, o.y, o.w, o.h);
    else { ctx.fillStyle = '#EEF1F6'; ctx.fillRect(o.x, o.y, o.w, o.h); }
  }
  for (const s of page.strokes) drawStroke(ctx, s);
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

/* =================== หน้าเขียน =================== */
const ed = { open: false };
const pref = () => S().prefs.sketch || {};
const pagesNow = () => app.store.pagesOf(ed.book.id);

export async function openSketch(bookId, pageId = null, fromEl = null) {
  if (ed.open) return;
  const book = S().books.find(b => b.id === bookId);
  if (!book) return;
  const list = app.store.pagesOf(bookId);
  const idx = Math.max(0, list.findIndex(p => p.id === (pageId || book.last_page)));
  const pr = pref();
  Object.assign(ed, {
    open: true, book, idx, page: list[idx], tool: pr.tool || 'pen', shape: pr.shape || 'line',
    color: { pen: G.INKS[0], hl: G.HIGHLIGHTS[0], shape: G.INKS[0], text: G.INKS[0], ...pr.color },
    size: { pen: 1, hl: 1, text: 1, eraser: 1, shape: 1, ...pr.size },
    sel: null, editing: null, hist: new Map(), saveT: 0, busy: false,
  });
  if (ed.tool === 'img') ed.tool = 'pen';
  build();
  pushBack({ sketch: 1 });
  document.body.classList.add('sk-on');
  layout();
  if (fromEl && !reduced()) zoomFrom(fromEl.getBoundingClientRect());
  else requestAnimationFrame(() => ed.root?.classList.add('in'));
}
onBack(() => { if (!ed.open) return false; closeSketch(true); return true; });

function build() {
  const b = (cls, name, label, on, extra = {}) => h('button.' + cls, { type: 'button', 'aria-label': label, title: label, html: si(name), onclick: on, ...extra });
  ed.base = h('canvas.sk-base'); ed.ink = h('canvas.sk-ink');
  ed.selbox = h('div.sk-selbox', { hidden: true }, h('i.sk-handle'));
  ed.selbar = h('div.sk-selbar', { hidden: true },
    h('button', { type: 'button', onclick: () => selAction('copy'), html: si('copy') + '<span>ทำสำเนา</span>' }),
    h('button', { type: 'button', onclick: () => selAction('del'), html: si('trash') + '<span>ลบ</span>' }));
  ed.paperEl = h('div.sk-paper', ed.base, ed.ink, ed.selbox);
  ed.stage = h('div.sk-stage', ed.paperEl, ed.selbar);
  ed.title = h('b', ed.book.title);
  ed.count = h('small');
  ed.undoB = b('sk-ib', 'undo', 'เลิกทำ', undo); ed.redoB = b('sk-ib', 'redo', 'ทำซ้ำ', redo);
  ed.prevB = b('sk-turn', 'left', 'หน้าก่อน', () => turn(-1));
  ed.nextB = h('button.sk-turn', { type: 'button', onclick: () => turn(1) });
  ed.opts = h('div.sk-opts', { onmousedown: e => { if (ed.editing && e.target.closest('button')) e.preventDefault(); } }); // แตะสี/ขนาดตอนพิมพ์อยู่ ไม่ให้ช่องพิมพ์หลุด
  ed.tools = h('div.sk-tools', { role: 'toolbar', 'aria-label': 'เครื่องมือ' }, Object.entries(TOOLS).map(([k, l]) =>
    b('sk-tool', k, l, () => pickTool(k), { 'data-tool': k })));
  ed.menu = h('div.sk-menu', { hidden: true });
  ed.root = h('div.sk', { id: 'sk', role: 'dialog', 'aria-label': 'สมุด ' + ed.book.title, style: { '--c': ed.book.color } },
    h('header.sk-top',
      h('button.sk-ib.sk-close', { type: 'button', 'aria-label': 'ดูทุกหน้า', title: 'ดูทุกหน้า', onclick: () => closeSketch(), html: si('pages') }),
      h('div.sk-name', ed.title, ed.count),
      ed.undoB, ed.redoB, b('sk-ib', 'more', 'ตั้งค่าหน้า', toggleMenu)),
    ed.stage,
    h('div.sk-pager', ed.prevB, h('div.sk-dots'), ed.nextB),
    h('div.sk-bottom', ed.opts, ed.tools),
    ed.menu);
  document.body.append(ed.root);
  bindPointer();
  ed.ro = new ResizeObserver(() => layout());
  ed.ro.observe(ed.stage);
  ed.onKey = e => {
    if (!ed.open || document.querySelector('.confirm')) return;
    if (ed.editing && e.key !== 'Escape') return;
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') { if (ed.editing) ed.editing.ta.blur(); else if (!ed.menu.hidden) toggleMenu(); else if (ed.sel) setSel(null); else closeSketch(); e.preventDefault(); }
    else if (mod && e.key.toLowerCase() === 'z') { e.shiftKey ? redo() : undo(); e.preventDefault(); }
    else if (mod && e.key.toLowerCase() === 'y') { redo(); e.preventDefault(); }
    else if (e.key === 'ArrowRight' || e.key === 'PageDown') turn(1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') turn(-1);
    else if ((e.key === 'Delete' || e.key === 'Backspace') && ed.sel) selAction('del');
  };
  document.addEventListener('keydown', ed.onKey);
  paintChrome();
}

function layout() {
  if (!ed.open) return;
  const W = ed.stage.clientWidth - 20, H = ed.stage.clientHeight - 16;
  if (W <= 0 || H <= 0) return;
  ed.k = Math.min(W / PW, H / PH);
  ed.dpr = Math.min(3, devicePixelRatio || 1);
  const cw = Math.round(PW * ed.k), ch = Math.round(PH * ed.k);
  ed.paperEl.style.width = cw + 'px'; ed.paperEl.style.height = ch + 'px';
  for (const c of [ed.base, ed.ink]) { c.width = Math.round(cw * ed.dpr); c.height = Math.round(ch * ed.dpr); }
  redraw(); clearInk(); showSel();
  if (ed.editing) placeTA();
}
const setT = ctx => { const s = ed.k * ed.dpr; ctx.setTransform(s, 0, 0, s, 0, 0); return ctx; };
function redraw() {
  if (!ed.open || !ed.k) return;
  const ctx = setT(ed.base.getContext('2d'));
  ctx.clearRect(0, 0, PW, PH);
  drawPage(ctx, ed.page, 1 / ed.k, { hide: ed.editing?.id, onImg: redraw });
}
function clearInk() { const ctx = setT(ed.ink.getContext('2d')); ctx.clearRect(0, 0, PW, PH); return ctx; }

/* ---------- แถบเครื่องมือ ---------- */
function paintChrome() {
  const list = pagesNow(), n = list.length, i = ed.idx;
  put(ed.count, `หน้า ${i + 1} / ${n}`);
  ed.prevB.disabled = i === 0;
  const last = i === n - 1;
  ed.nextB.innerHTML = si(last ? 'plus' : 'right');
  ed.nextB.setAttribute('aria-label', last ? 'เพิ่มหน้าใหม่' : 'หน้าถัดไป'); ed.nextB.title = ed.nextB.getAttribute('aria-label');
  ed.nextB.classList.toggle('add', last);
  const dots = ed.root.querySelector('.sk-dots');
  const span = 7, a = Math.max(0, Math.min(n - span, i - 3));
  put(dots, list.slice(a, a + span).map((p, k) => h('button' + (a + k === i ? '.on' : ''), { type: 'button', 'aria-label': `ไปหน้า ${a + k + 1}`, onclick: () => turnTo(a + k) })));
  const hs = ed.hist.get(ed.page.id);
  ed.undoB.disabled = !hs?.u.length; ed.redoB.disabled = !hs?.r.length;
  ed.tools.querySelectorAll('.sk-tool').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.tool === ed.tool)));
  ed.tools.style.setProperty('--pen', ed.color.pen); ed.tools.style.setProperty('--hl', ed.color.hl);
  paintOpts();
}
function paintOpts() {
  const t = ed.tool, kids = [];
  if (t === 'shape') kids.push(h('div.sk-seg', Object.entries(SHAPES).map(([k, l]) =>
    h('button', { type: 'button', 'aria-label': l, title: l, 'aria-pressed': String(ed.shape === k), html: si(k), onclick: () => { ed.shape = k; paintOpts(); } }))));
  if (['pen', 'hl', 'shape', 'text'].includes(t)) {
    const pal = t === 'hl' ? G.HIGHLIGHTS : G.INKS;
    kids.push(h('div.sk-colors', pal.map(c => h('button', { type: 'button', 'aria-label': 'สี ' + c, 'aria-pressed': String(ed.color[t] === c), style: { '--sw': c },
      onclick: () => { ed.color[t] = c; if (ed.editing && t === 'text') { ed.editing.t.c = c; ed.editing.ta.style.color = c; ed.editing.ta.focus({ preventScroll: true }); } paintOpts(); } }))));
  }
  if (['pen', 'hl', 'shape', 'text', 'eraser'].includes(t)) {
    const key = t === 'shape' ? 'pen' : t, sz = G.SIZES[key];
    kids.push(h('div.sk-sizes', sz.map((v, i) => h('button', { type: 'button', 'aria-label': ['เล็ก', 'กลาง', 'ใหญ่'][i], 'aria-pressed': String(ed.size[t] === i),
      onclick: () => { ed.size[t] = i; if (ed.editing && t === 'text') { ed.editing.t.s = v; placeTA(); ed.editing.ta.focus({ preventScroll: true }); } paintOpts(); } },
      h('i', { style: { '--d': (t === 'text' ? [9, 13, 18] : t === 'eraser' ? [8, 13, 19] : t === 'hl' ? [8, 12, 17] : [4, 7, 11])[i] + 'px', '--sw': t === 'eraser' ? '#fff' : ed.color[t] } })))));
  }
  if (t === 'lasso') kids.push(h('p.sk-hint', ed.sel ? 'ลากในกรอบเพื่อย้าย · ลากมุมเพื่อย่อขยาย' : 'วนรอบสิ่งที่อยากย้าย หรือแตะที่รูป/ข้อความ'));
  if (t === 'eraser') kids.push(h('p.sk-hint.sm', 'ลากผ่านเส้น = ลบทั้งเส้น'));
  put(ed.opts, kids);
  ed.opts.dataset.tool = t;
}
async function pickTool(k) {
  if (ed.editing) commitText();
  if (k === 'img') return insertImage();
  if (k !== 'lasso') setSel(null);
  ed.tool = k; paintChrome();
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

/* ---------- นิ้ว/ปากกา/เมาส์ ---------- */
function bindPointer() {
  const el = ed.paperEl, ptrs = new Map();
  let g = null; // ท่าที่กำลังทำ
  let two = null, swipe = null, raf = 0;
  const at = e => { const r = el.getBoundingClientRect(); return [(e.clientX - r.left) / ed.k, (e.clientY - r.top) / ed.k, e.pointerType === 'pen' ? (e.pressure || .5) : .5]; };
  const avgX = () => [...ptrs.values()].reduce((s, p) => s + p.x, 0) / ptrs.size;
  const cancel = () => { if (g?.kind === 'ink' || g?.kind === 'shape' || g?.kind === 'loop') clearInk(); if (g?.kind === 'move' && g.base) { ed.page = g.base; redraw(); showSel(); } g = null; };
  const live = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; paintLive(); }); };
  function paintLive() {
    if (!g) return;
    const ctx = clearInk();
    if (g.kind === 'ink') drawStroke(ctx, g.s);
    else if (g.kind === 'shape') drawStroke(ctx, { t: 'pen', sh: 1, c: g.c, w: g.w, p: G.shapePoints(ed.shape, g.x0, g.y0, g.x1, g.y1) });
    else if (g.kind === 'erase') { ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, 7); ctx.fillStyle = 'rgba(11,27,77,.08)'; ctx.fill(); ctx.lineWidth = 1.5 / ed.k; ctx.strokeStyle = 'rgba(11,27,77,.45)'; ctx.stroke(); }
    else if (g.kind === 'loop') { ctx.beginPath(); ctx.moveTo(g.p[0], g.p[1]); for (let i = 2; i < g.p.length; i += 2) ctx.lineTo(g.p[i], g.p[i + 1]); ctx.setLineDash([8 / ed.k, 6 / ed.k]); ctx.lineWidth = 1.8 / ed.k; ctx.strokeStyle = '#0A6CF1'; ctx.stroke(); ctx.fillStyle = 'rgba(10,108,241,.06)'; ctx.fill(); }
  }

  el.addEventListener('pointerdown', e => {
    if (ed.busy || e.target.closest('.sk-ta')) return;
    if (e.pointerType === 'pen') ed.penSeen = true;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    el.setPointerCapture?.(e.pointerId);
    if (!ed.menu.hidden) toggleMenu();
    if (ptrs.size === 2) { cancel(); swipe = null; two = { x0: avgX() }; return; }
    if (ptrs.size > 2) return;
    // มีปากกาสไตลัส: นิ้วเดียว = ปัดเปลี่ยนหน้า ไม่วาด (กันมือแตะจอ)
    if (ed.penSeen && e.pointerType === 'touch') { swipe = { x0: e.clientX, y0: e.clientY }; return; }
    if (ed.editing) { commitText(); if (ed.tool === 'text') return; }
    e.preventDefault();
    start(at(e), e);
  });
  el.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (two) { el.style.setProperty('--drag', Math.max(-60, Math.min(60, (avgX() - two.x0) / 3)) + 'px'); return; }
    if (swipe || !g) return;
    const evs = e.getCoalescedEvents?.() || [e];
    for (const ev of evs.length ? evs : [e]) move(at(ev));
    live();
  });
  const up = e => {
    if (!ptrs.has(e.pointerId)) return;
    const p = ptrs.get(e.pointerId);
    ptrs.delete(e.pointerId);
    if (two) {
      if (!ptrs.size) { const dx = p.x - two.x0; two = null; el.style.removeProperty('--drag'); if (Math.abs(dx) > 50) turn(dx < 0 ? 1 : -1); }
      return;
    }
    if (swipe) { const dx = e.clientX - swipe.x0, dy = e.clientY - swipe.y0; swipe = null; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) turn(dx < 0 ? 1 : -1); return; }
    if (e.type === 'pointercancel') { cancel(); return; }
    if (g) end(at(e));
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);

  function start([x, y, pr]) {
    const t = ed.tool;
    if (t === 'pen' || t === 'hl') {
      g = { kind: 'ink', s: { id: G.pid('s'), t, c: ed.color[t], w: G.SIZES[t][ed.size[t]], p: [x, y, pr] } }; live();
    } else if (t === 'shape') g = { kind: 'shape', x0: x, y0: y, x1: x, y1: y, c: ed.color.shape, w: G.SIZES.pen[ed.size.shape] };
    else if (t === 'eraser') { g = { kind: 'erase', x, y, r: G.SIZES.eraser[ed.size.eraser], saved: false }; eraseAt(); live(); }
    else if (t === 'text') g = { kind: 'tap', x, y };
    else if (t === 'lasso') {
      const b = ed.sel && G.selBox(ed.page, ed.sel, textH), pad = 18 / ed.k;
      if (b && Math.hypot(x - b.x1, y - b.y1) < 30 / ed.k) g = { kind: 'move', mode: 'scale', x0: x, y0: y, base: ed.page, box: b };
      else if (b && x > b.x0 - pad && x < b.x1 + pad && y > b.y0 - pad && y < b.y1 + pad) g = { kind: 'move', mode: 'move', x0: x, y0: y, base: ed.page, box: b };
      else { setSel(null); g = { kind: 'loop', p: [x, y] }; }
    }
  }
  function move([x, y, pr]) {
    if (!g) return;
    if (g.kind === 'ink') { const p = g.s.p, lx = p[p.length - 3], ly = p[p.length - 2]; if (Math.hypot(x - lx, y - ly) > .6) p.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(pr * 100) / 100); }
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
    if (cur.kind === 'ink') {
      remember();
      const s = { ...cur.s, p: G.thin(cur.s.p, 1.2 / Math.max(.3, ed.k * 2)) };
      ed.page = { ...ed.page, strokes: [...ed.page.strokes, s] };
      clearInk(); changed();
    } else if (cur.kind === 'shape') {
      clearInk();
      if (Math.hypot(cur.x1 - cur.x0, cur.y1 - cur.y0) < 8) return;
      remember();
      ed.page = { ...ed.page, strokes: [...ed.page.strokes, { id: G.pid('s'), t: 'pen', sh: 1, c: cur.c, w: cur.w, p: G.shapePoints(ed.shape, cur.x0, cur.y0, cur.x1, cur.y1) }] };
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
      if (cur.moved) { const now = ed.page; ed.page = cur.base; remember(); ed.page = now; changed(); }
      showSel();
    }
  }
}
function textAt(x, y) { return [...ed.page.texts].reverse().find(t => x >= t.x - 10 && x <= t.x + t.w + 10 && y >= t.y - 10 && y <= t.y + textH(t) + 10); }
function pickAt(x, y) {
  const t = textAt(x, y); if (t) return { strokes: [], texts: [t.id], imgs: [] };
  const s = G.strokesHit(ed.page.strokes, x, y, 14 / ed.k).pop(); if (s) return { strokes: [s], texts: [], imgs: [] };
  const i = [...ed.page.imgs].reverse().find(o => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h);
  return i ? { strokes: [], texts: [], imgs: [i.id] } : null;
}

/* ---------- การเลือก ---------- */
function setSel(sel) { ed.sel = sel; showSel(); if (ed.tool === 'lasso') paintOpts(); }
function showSel() {
  const b = ed.sel && G.selBox(ed.page, ed.sel, textH);
  ed.selbox.hidden = ed.selbar.hidden = !b;
  if (!b) return;
  const k = ed.k, pad = 8;
  Object.assign(ed.selbox.style, { left: b.x0 * k - pad + 'px', top: b.y0 * k - pad + 'px', width: (b.x1 - b.x0) * k + pad * 2 + 'px', height: (b.y1 - b.y0) * k + pad * 2 + 'px' });
  const pr = ed.paperEl.getBoundingClientRect(), sr = ed.stage.getBoundingClientRect();
  const top = pr.top - sr.top + b.y0 * k - pad - 50;
  ed.selbar.style.left = Math.max(8, Math.min(sr.width - 200, pr.left - sr.left + ((b.x0 + b.x1) / 2) * k - 100)) + 'px';
  ed.selbar.style.top = (top < 4 ? pr.top - sr.top + b.y1 * k + pad + 10 : top) + 'px';
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
  const t = { id: G.pid('t'), x: Math.max(20, Math.min(x, PW - 220)), y: Math.max(10, y - s * .7), w: 0, s, c: ed.color.text, v: '' };
  t.w = Math.max(200, Math.min(620, PW - 30 - t.x));
  editText(t, true);
}
function editText(t, isNew = false) {
  const ta = h('textarea.sk-ta', { value: t.v, 'aria-label': 'พิมพ์ข้อความ', rows: 1, spellcheck: false });
  ed.editing = { id: t.id, t: { ...t }, isNew, ta };
  ta.addEventListener('input', fitTA);
  ta.addEventListener('blur', () => setTimeout(() => { if (ed.editing?.ta === ta) commitText(); }, 0));
  ed.paperEl.append(ta);
  redraw(); placeTA();
  requestAnimationFrame(() => { ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length); });
}
function placeTA() {
  const { ta, t } = ed.editing, k = ed.k;
  Object.assign(ta.style, { left: t.x * k + 'px', top: t.y * k + 'px', width: t.w * k + 'px', fontSize: t.s * k + 'px', color: t.c });
  fitTA();
}
function fitTA() { const ta = ed.editing?.ta; if (!ta) return; ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
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
  const o = { id: G.pid('i'), x: Math.round((PW - w) / 2), y: Math.round((PH - hh) / 2.4), w: Math.round(w), h: Math.round(hh), blob };
  imgs.set(o.id, { el, ready: true, wait: new Set() });
  remember();
  ed.page = { ...ed.page, imgs: [...ed.page.imgs, o] };
  ed.tool = 'lasso'; changed(); setSel({ strokes: [], texts: [], imgs: [o.id] });
  toast('ลากเพื่อย้าย · ลากมุมเพื่อย่อขยาย');
}

/* ---------- เมนูหน้า: กระดาษ · เพิ่ม/ลบ/ล้างหน้า ---------- */
function toggleMenu() {
  if (!ed.menu.hidden) { ed.menu.hidden = true; return; }
  put(ed.menu,
    h('p.sk-mh', 'กระดาษหน้านี้'),
    h('div.sk-papers', Object.entries(G.PAPERS).map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(ed.page.paper === k), onclick: () => setPaper(k) }, h('i.pp.pp-' + k), h('span', l)))),
    h('button.sk-mi', { type: 'button', onclick: () => { ed.menu.hidden = true; addAfter(); }, html: si('plus') + '<span>แทรกหน้าใหม่ถัดจากหน้านี้</span>' }),
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
  setSel(null); redraw(); paintChrome();
}

/* ---------- พลิกหน้า ---------- */
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
  await flush();
  const dir = i > ed.idx ? 1 : -1, list2 = pagesNow();
  const next = list2[i];
  const flipper = h('canvas.sk-flip' + (dir > 0 ? '.fwd' : '.back'), { width: ed.base.width, height: ed.base.height });
  const fx = flipper.getContext('2d');
  if (dir > 0) fx.drawImage(ed.base, 0, 0);
  else { setT(fx); drawPage(fx, next, 1 / ed.k); }
  const shade = h('i.sk-shade' + (dir > 0 ? '.fwd' : '.back'));
  ed.idx = i; ed.page = next;
  if (dir > 0) redraw();
  ed.paperEl.append(flipper, shade);
  paintChrome();
  const dur = reduced() ? 160 : 520;
  const frames = reduced() ? [{ opacity: 1 }, { opacity: 0 }]
    : dir > 0 ? [{ transform: 'rotateY(0deg)', filter: 'brightness(1)' }, { transform: 'rotateY(-62deg)', filter: 'brightness(.94)', offset: .55 }, { transform: 'rotateY(-96deg)', filter: 'brightness(.8)' }]
      : [{ transform: 'rotateY(-96deg)', filter: 'brightness(.8)' }, { transform: 'rotateY(-40deg)', filter: 'brightness(.95)', offset: .45 }, { transform: 'rotateY(0deg)', filter: 'brightness(1)' }];
  if (reduced() && dir < 0) frames.reverse();
  const a = flipper.animate(frames, { duration: dur, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' });
  shade.animate([{ opacity: dir > 0 ? 0 : .5 }, { opacity: .5, offset: .5 }, { opacity: dir > 0 ? .5 : 0 }], { duration: dur, fill: 'forwards' });
  try { await a.finished; } catch {}
  if (dir < 0) redraw();
  flipper.remove(); shade.remove();
  ed.busy = false;
  app.store.updateBook(ed.book.id, { last_page: ed.page.id }).catch(() => {});
}

/* ---------- เข้า/ออก: หน้าเขียนขยายจากภาพย่อ · ออกแล้วย่อกลับไปที่ภาพย่อในหน้า "ทุกหน้า" ---------- */
function zoomFrom(r) {
  const root = ed.root, pe = ed.paperEl;
  root.classList.add('zoom');
  requestAnimationFrame(() => root.classList.add('in'));
  const pr = pe.getBoundingClientRect();
  const s = r.width / pr.width;
  pe.animate([{ transform: `translate(${r.left - pr.left}px, ${r.top - pr.top}px) scale(${s})`, borderRadius: '6px' }, { transform: 'none' }],
    { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' }).finished.finally(() => root.classList.remove('zoom'));
}
export async function closeSketch(fromPop = false) {
  if (!ed.open || ed.closing) return;
  ed.closing = true;
  if (ed.editing) commitText();
  setSel(null);
  try { await flush(false); } catch {}
  app.store.setPref('sketch', { tool: ed.tool, shape: ed.shape, color: ed.color, size: ed.size }, false).catch(() => {});
  await app.store.updateBook(ed.book.id, { last_page: ed.page.id }).catch(() => {}); // แจ้งทั้งแอป → หน้า "ทุกหน้า" วาดภาพย่อใหม่
  if (!fromPop) dropBack('sketch');
  const root = ed.root, pe = ed.paperEl, pageId = ed.page.id;
  document.removeEventListener('keydown', ed.onKey);
  ed.ro.disconnect();
  if (!location.hash.startsWith('#/book/')) location.hash = '#/book/' + ed.book.id;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const target = document.querySelector(`.bk-thumb[data-id="${pageId}"]`);
  document.body.classList.remove('sk-on');
  if (target && !reduced()) {
    target.scrollIntoView({ block: 'center' });
    const r = target.querySelector('canvas').getBoundingClientRect(), pr = pe.getBoundingClientRect();
    target.classList.add('landing');
    root.classList.add('out');
    await pe.animate([{ transform: 'none' }, { transform: `translate(${r.left - pr.left}px, ${r.top - pr.top}px) scale(${r.width / pr.width})`, borderRadius: '4px' }],
      { duration: 440, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' }).finished.catch(() => {});
    target.classList.remove('landing');
  } else {
    root.classList.add('out');
    await new Promise(r => setTimeout(r, 200));
  }
  root.remove();
  Object.assign(ed, { open: false, closing: false, root: null });
}

/* =================== หน้า "ทุกหน้า" ของสมุด (#/book/<id>) =================== */
let shown = null; // ภาพย่อค่อย ๆ โผล่เฉพาะตอนเพิ่งเปิดสมุด (วาดใหม่ตอนข้อมูลเปลี่ยนไม่ต้องเล่นซ้ำ)
const fmtDay = iso => { const d = toYMD(new Date(iso)), t = toYMD(new Date()); return d === t ? 'วันนี้' : relDay(d, t); };
export function bookView(root, id) {
  const b = S().books.find(x => x.id === id);
  if (!b) { shown = null; put(root, h('div.phead', h('button.iconbtn', { 'aria-label': 'กลับ', html: si('back'), onclick: () => { location.hash = '#/notebook'; } }), h('h1', 'ไม่พบสมุด'))); return; }
  const list = app.store.pagesOf(id);
  const s = b.subject_id ? subj(b.subject_id) : null;
  const anim = shown !== id; shown = id;
  put(root,
    h('div.phead.bk-head',
      h('button.iconbtn', { 'aria-label': 'กลับไปสมุด', html: si('back'), onclick: () => { location.hash = '#/notebook'; } }),
      h('h1', b.title),
      h('button.iconbtn', { 'aria-label': 'ตั้งค่าสมุด', html: si('more'), onclick: () => bookMenu(b) })),
    h('p.bk-meta', { style: { '--c': b.color } }, h('i'), [s?.id ? s.name : null, `${list.length} หน้า`, 'แก้ล่าสุด ' + fmtDay(b.updated_at)].filter(Boolean).join(' · ')),
    h('div.bk-grid' + (anim ? '.anim' : ''), list.map((p, i) => h('button.bk-thumb' + (p.id === b.last_page ? '.last' : ''), { type: 'button', 'data-id': p.id, 'aria-label': `หน้า ${i + 1}`, style: { '--n': i },
      onclick: e => openSketch(id, p.id, e.currentTarget.querySelector('canvas')) }, thumb(p, 300), h('span', String(i + 1)))),
    h('button.bk-thumb.bk-add', { type: 'button', 'aria-label': 'เพิ่มหน้าใหม่', onclick: async () => { const p = await app.store.addPage(id); await app.store.updateBook(id, { last_page: p.id }); openSketch(id, p.id, document.querySelector(`.bk-thumb[data-id="${p.id}"] canvas`)); } },
      h('i', { html: si('plus') }), h('span', 'หน้าใหม่'))),
    h('button.bk-go', { type: 'button', style: { '--c': b.color }, onclick: () => openSketch(id, null, document.querySelector(`.bk-thumb[data-id="${b.last_page}"] canvas`)), html: si('pen') + '<span>เขียนต่อ</span>' }));
}

function bookMenu(b) {
  const m = openModal({
    title: b.title, label: 'ตั้งค่าสมุด',
    body: [
      h('button.sk-mi', { type: 'button', onclick: () => { closeModal(); bookDialog(b); }, html: si('edit') + '<span>เปลี่ยนชื่อ / สีปก</span>' }),
      h('button.sk-mi.danger', { type: 'button', onclick: async () => {
        closeModal();
        const ok = await confirmBox({ title: `ลบสมุด "${b.title}"?`, body: `ทุกหน้า (${app.store.pagesOf(b.id).length} หน้า) จะหายไป กู้คืนไม่ได้`, ok: 'ลบสมุด', danger: true });
        if (!ok) return;
        location.hash = '#/notebook';
        await app.store.deleteBook(b.id);
        toast('ลบสมุดแล้ว');
      }, html: si('trash') + '<span>ลบสมุดนี้</span>' }),
    ],
  });
  return m;
}

/** รอให้การถอยประวัติของกล่องที่เพิ่งปิดเสร็จ (มี popstate) หรือไม่เกิน 0.35 วินาที */
const settled = () => new Promise(res => {
  const done = () => { clearTimeout(t); removeEventListener('popstate', done); requestAnimationFrame(() => res()); };
  const t = setTimeout(done, 350);
  addEventListener('popstate', done);
});

/** กล่องสร้างสมุดใหม่ / แก้ชื่อและสีปก */
export function bookDialog(b = null) {
  const st = { title: b?.title || '', color: b?.color || SUBJECT_COLORS[S().books.length % SUBJECT_COLORS.length], paper: b?.paper || 'lined', subject_id: b?.subject_id || null };
  const name = h('input.bk-in', { value: st.title, placeholder: 'เช่น สรุปฟิสิกส์ บทที่ 4', maxLength: 40, 'aria-label': 'ชื่อสมุด', oninput: e => { st.title = e.target.value; prev(); } });
  const cover = h('div.bk-cover.preview', { 'aria-hidden': 'true' });
  const prev = () => { cover.style.setProperty('--c', st.color); put(cover, h('span.bk-label', h('b', st.title.trim() || 'สมุดจด'), h('small', b ? `${app.store.pagesOf(b.id).length} หน้า` : 'หน้าใหม่'))); };
  const colors = h('div.bk-colors');
  const paintColors = () => put(colors, SUBJECT_COLORS.map(c => h('button', { type: 'button', 'aria-label': 'สีปก ' + c, 'aria-pressed': String(st.color === c), style: { '--sw': c }, onclick: () => { st.color = c; paintColors(); prev(); } })));
  const papers = h('div.sk-papers');
  const paintPapers = () => put(papers, Object.entries(G.PAPERS).map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(st.paper === k), onclick: () => { st.paper = k; paintPapers(); } }, h('i.pp.pp-' + k), h('span', l))));
  const subs = visibleSubjects();
  const chips = b ? null : h('div.bk-subs', subs.map(s => h('button', { type: 'button', style: { '--c': s.color }, onclick: () => { st.title = s.name; st.color = s.color; st.subject_id = s.id; name.value = s.name; paintColors(); prev(); } }, s.name)));
  paintColors(); paintPapers(); prev();
  const go = h('button.btn.primary.wide', { type: 'button', onclick: async () => {
    const title = st.title.trim() || 'สมุดจด';
    if (b) { await app.store.updateBook(b.id, { title, color: st.color }); closeModal(); return; }
    const nb = await app.store.addBook({ ...st, title });
    const back = settled();
    closeModal();
    await back; // ปิดกล่องแล้วเบราว์เซอร์ถอยประวัติ — รอให้เสร็จก่อน ไม่งั้นจะถอยทับหน้าสมุดที่เพิ่งเปิด
    location.hash = '#/book/' + nb.id;
    setTimeout(() => openSketch(nb.id), 30);
  } }, b ? 'บันทึก' : 'สร้างแล้วเริ่มเขียน');
  openModal({
    title: b ? 'แก้สมุด' : 'สมุดใหม่', label: b ? 'แก้สมุด' : 'สร้างสมุดใหม่',
    isDirty: () => !b && !!st.title.trim(),
    body: h('div.bk-form', h('div.bk-pv', cover), name, chips ? [h('p.bk-lb', 'ตั้งตามวิชา'), chips] : '', h('p.bk-lb', 'สีปก'), colors, b ? '' : [h('p.bk-lb', 'กระดาษ'), papers]),
    foot: go,
  });
  if (!b) setTimeout(() => name.focus(), 320);
}

/** ปกสมุดบนชั้น (หน้าสมุด) */
export function coverEl(b) {
  const list = app.store.pagesOf(b.id);
  const last = list.find(p => p.id === b.last_page) || list[list.length - 1];
  return h('button.bk-cover', { type: 'button', style: { '--c': b.color }, 'aria-label': `สมุด ${b.title} · ${list.length} หน้า`,
    onclick: () => { shown = null; location.hash = '#/book/' + b.id; setTimeout(() => openSketch(b.id), 30); } },
    last ? h('span.bk-peek', thumb(last, 200)) : '',
    h('span.bk-label', h('b', b.title), h('small', `${list.length} หน้า`)));
}
