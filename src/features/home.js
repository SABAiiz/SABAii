// หน้าแรก — กลไกแบบแอปเรียกรถ: ชั้นหลังเต็มจอ + แผ่นล่าง 3 ระดับ (0.9.2: โครงเดิม หน้าตาชุดเดียวกับหน้าแนะนำ)
//   แผ่นขึ้น (กลาง/บน) : เพิ่มงาน 4 แบบ · ค้นหา + ชิปวัน · งานแนะนำ (ปักหมุดก่อน แล้วเรียงตามกำหนดส่ง)
//   แผ่นลง (ล่าง)      : ชั้นหลังคือ "โน้ตหน้างาน" 1 หน้า = 1 งาน · ปัดขึ้น/ลง = งานถัดไป · ปัดซ้าย/ขวา = โน้ตถัดไป
//                        แผ่นเหลือการ์ดงาน: เพิ่มโน้ต รูป/ข้อความ/เสียง + ทำเลย (จับเวลา) → เสร็จแล้ว
import { h, ic, ART, toast, badge, shortOf, tintOf, $, onBack, pushBack, dropBack, modalOpen } from '../ui/kit.js';
import { daysBetween } from '../domain/dates.js';
import { app, S, subj, task, ranked, today, dueLine, fullTitle, notesOf, urlOf } from './shared.js';
const DOWL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'], MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
import { addTask, addNote, editTask, noteEl } from './add.js';
import { notePane } from './notestyle.js';
import { initHandsfree, stopHandsfree } from './handsfree.js';

let sheet, paneHome, paneNote, stage;
const LOW = 300;
// มือถือที่มีแถบโฮมด้านล่าง: ยกแผ่นตอนดูโน้ตขึ้นเท่าแถบ ปุ่มจะไม่จมใต้แถบ
let safeB = 0;
function measureSafe() {
  const p = h('div', { style: { position: 'fixed', bottom: '0', height: '0', paddingBottom: 'env(safe-area-inset-bottom, 0px)', visibility: 'hidden' } });
  document.body.append(p); safeB = Math.round(p.getBoundingClientRect().height) || 0; p.remove();
  document.documentElement.style.setProperty('--low', LOW + safeB + 'px');
}
const snapPx = () => [LOW + safeB, Math.round(innerHeight * .58), innerHeight]; // บนสุด = ชิดขอบจอบน
let snapIdx = 2, vis = 0;
let pages = [], cur = 0, targeted = false; // targeted = เปิดโน้ตของงานที่เลือกไว้ (ไม่ต้องกลับไปงานอันดับ 1)
const hs = { q: '', when: 'all' };
export const TOP = 3; // งานแนะนำไม่เกิน 3 งาน — ยาวกว่านี้นักเรียนก็ไม่รู้จะเริ่มอะไรอยู่ดี ที่เหลืออยู่หน้างาน
let extra = null;  // งานนอก 3 อันดับที่ผู้ใช้เปิดโน้ตเอง (จากหน้างาน/หน้าวิชา) — ใส่ไว้ในชั้นโน้ตชั่วคราว
const WHEN = { all: 'ทั้งหมด', today: 'วันนี้', tomorrow: 'พรุ่งนี้', week: '7 วันนี้' };
export const homeState = () => ({ snapIdx, cur, pages: [...pages], noteMode: document.body.classList.contains('note-mode') });

export function initHome() {
  sheet = $('#sheet'); paneHome = $('#pane-home'); paneNote = $('#pane-note'); stage = $('#stage');
  measureSafe(); initSheetDrag(); initStage(); initNoteUi();
  stage.after(h('div', { id: 'stage-dim', 'aria-hidden': 'true' }));
  onBack(() => { if (!isNoteMode() || modalOpen()) return false; setSnap(2, true); return true; });
  addEventListener('resize', () => setSnap(snapIdx));
  app.openNotes = openNotes;
  setSnap(2);
}
export function renderHomeAll() { renderHome(); renderStage(); }

/* ---------------- แผ่นล่าง ---------------- */
const isNoteMode = () => document.body.classList.contains('note-mode');
/* ความลึกตอนดึงแผ่น (0.9.2): โน้ตด้านหลังย่อ + มืดตอนแผ่นเต็มจอ → ค่อย ๆ ขยาย/สว่างตามนิ้วจนเต็มเมื่อดึงลงสุด
   ที่จับเปลี่ยนเป็น "ปล่อยเพื่อดูโน้ต" เมื่อเลยจุดเข้าโหมดโน้ต · เข้าระดับแล้วสั่นเบา ๆ (Android) · ดันขึ้นเกินจอ = ยืดแล้วเด้งกลับ */
let hintEl = null, lastSnap = 2;
function pullDepth(v) {
  const [lo, , hi] = snapPx(), p = Math.max(0, Math.min(1, (hi - v) / Math.max(1, hi - lo)));
  const r = document.documentElement.style;
  r.setProperty('--pull', p.toFixed(3));
  r.setProperty('--stage-tf', p > .995 || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'none' : `scale(${(.9 + .1 * p).toFixed(4)})`);
  hintEl ||= $('.grab .hint');
  if (hintEl) hintEl.textContent = sheet.classList.contains('dragging') && v < snapPx()[1] - 12 ? 'ปล่อยเพื่อดูโน้ต' : 'ดึงลงเพื่อดูโน้ตหน้างาน';
}
function setVis(v) {
  vis = v;
  document.documentElement.style.setProperty('--sheet-vis', v + 'px');
  pullDepth(v);
  sheet.classList.toggle('full', v >= snapPx()[2] - 2);
  sheet.dataset.snap = ['low', 'mid', 'top'][snapIdx];
  const nm = v < (snapPx()[0] + snapPx()[1]) / 2;
  if (nm !== isNoteMode()) {
    document.body.classList.toggle('note-mode', nm);
    app.updateNav?.();
    if (nm) { if (!targeted) goPage(0, false); else syncNote(); if (!history.state?.note) pushBack({ note: 1 }); }
    else { stopHandsfree(); if (extra) { extra = null; renderStage(); } } // ออกจากโหมดโน้ต = ปิดกล้อง + เอางานที่เปิดชั่วคราวออก
    targeted = false;
  }
}
export function setSnap(i, fromBack = false, felt = false) {
  snapIdx = Math.max(0, Math.min(2, i));
  if (felt && snapIdx !== lastSnap) navigator.vibrate?.(8);
  lastSnap = snapIdx;
  over(0);
  setVis(snapPx()[snapIdx]);
  if (snapIdx < 2) paneHome.scrollTop = 0;
  if (snapIdx > 0 && !fromBack) dropBack('note');
}
/** ปล่อยนิ้ว → ไปจุดที่ใกล้ที่สุด โดยนับแรงปัดด้วย (ปัดเร็วข้ามจุดได้) */
function settle(hist) {
  sheet.classList.remove('dragging');
  const [t0, y0] = hist[0], [t1, y1] = hist[hist.length - 1];
  const v = (y1 - y0) / Math.max(1, t1 - t0); // พิกเซล/มิลลิวินาที (+ = ลง)
  const target = vis - v * 180, s = snapPx();
  let best = 0; s.forEach((x, i) => { if (Math.abs(x - target) < Math.abs(s[best] - target)) best = i; });
  setSnap(best, false, true);
}
/** ดันแผ่นขึ้นเกินขอบจอ: ของในแผ่นยืดตามนิ้วแบบหนืด (ไม่เกิน 44px) แล้วเด้งกลับตอนปล่อย */
function over(px) { sheet.style.setProperty('--over', Math.min(44, Math.max(0, px * .3)).toFixed(1) + 'px'); }
const clampVis = v => { over(v - innerHeight); return Math.max(LOW * .7, Math.min(innerHeight, v)); };
function initSheetDrag() {
  // ลากได้ทั้งแผ่น (รวมบนปุ่ม) — แผ่นตามนิ้วทันที ไม่ต้องกด · แตะเฉย ๆ ไม่ขยับ
  let drag = null, suppress = false;
  sheet.addEventListener('pointerdown', e => {
    if (e.button) return;
    const inBody = !!e.target.closest('.pane-home');
    if (e.pointerType === 'touch' && inBody && sheet.classList.contains('full')) return; // ตอนเต็มจอ นิ้วในรายการ = เลื่อนรายการ (ดูตัวรับ touch ด้านล่าง)
    drag = { y: e.clientY, vis, inBody, moved: false, hist: [[e.timeStamp, e.clientY]], id: e.pointerId };
  });
  addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y;
    if (!drag.moved) {
      if (Math.abs(dy) < 6) return;
      if (sheet.classList.contains('full') && drag.inBody && (dy < 0 || paneHome.scrollTop > 0)) { drag = null; return; } // ให้เลื่อนรายการแทน
      drag.moved = true; sheet.classList.add('dragging'); // นับจากจุดที่นิ้วแตะ แผ่นจะติดนิ้วพอดี
    }
    setVis(clampVis(drag.vis - (e.clientY - drag.y)));
    drag.hist.push([e.timeStamp, e.clientY]); if (drag.hist.length > 5) drag.hist.shift();
  });
  const end = () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.moved) return;
    suppress = true; setTimeout(() => { suppress = false; }, 0);
    settle(d.hist);
  };
  addEventListener('pointerup', end); addEventListener('pointercancel', end);
  sheet.addEventListener('click', e => { if (suppress) { e.stopPropagation(); e.preventDefault(); } }, true);
  $('.grab').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSnap(snapIdx - 1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSnap(snapIdx + 1); }
  });

  // แผ่นเต็มจอ + รายการเลื่อนอยู่บนสุด + นิ้วดึงลง → แผ่นลงตามนิ้ว (เหมือน Bolt) · นอกนั้นเลื่อนรายการตามปกติ
  let tp = null;
  paneHome.addEventListener('touchstart', e => {
    tp = sheet.classList.contains('full') && e.touches.length === 1 ? { y0: e.touches[0].clientY, active: false, hist: [] } : null;
  }, { passive: true });
  paneHome.addEventListener('touchmove', e => {
    if (!tp) return;
    const y = e.touches[0].clientY, dy = y - tp.y0;
    if (!tp.active) {
      if (paneHome.scrollTop > 0 || dy < -4) { tp = null; return; }
      if (dy < 6) return;
      tp.active = true; tp.vis = vis; sheet.classList.add('dragging');
    }
    e.preventDefault();
    setVis(clampVis(tp.vis - (y - tp.y0)));
    tp.hist.push([e.timeStamp, y]); if (tp.hist.length > 5) tp.hist.shift();
  }, { passive: false });
  const tend = () => { const d = tp; tp = null; if (d?.active && d.hist.length) settle(d.hist); else sheet.classList.remove('dragging'); };
  paneHome.addEventListener('touchend', tend); paneHome.addEventListener('touchcancel', tend);
}

/* ---------------- ชั้นหลัง: โน้ตหน้างาน ---------------- */
function renderStage() {
  const keep = pages[cur];
  pages = ranked().slice(0, TOP).map(t => t.id);
  if (extra && task(extra) && !pages.includes(extra)) pages.push(extra); else if (!task(extra)) extra = null;
  stage.replaceChildren(...pages.map(id => {
    const t = task(id), s = subj(t.subject_id), notes = notesOf(id);
    const row = h('div.nrow', notes.length ? notes.map(noteEl) : h('div.nitem.empty',
      h('div', h('b', 'ยังไม่มีโน้ตของงานนี้'), h('p.muted', 'ถ่ายกระดาน ใบงาน หรือจดสิ่งที่ครูบอกไว้ตรงนี้'),
        h('button.go', { onclick: () => addNote(id, 'camera') }, '+ ถ่ายรูป'))));
    const img = notes.find(a => a.kind === 'image' && a.blob);
    return h('section.npage', { 'data-id': id, style: { '--tint': tintOf(s), '--sc': s.color || '#69778F', ...(img ? { '--ph': `url("${urlOf(img)}")` } : {}) } },
      h('div.wash'), h('div.wm', { 'aria-hidden': 'true' }, s.id ? shortOf(s) : ''), row);
  }));
  if (!pages.length) stage.append(h('section.npage', h('div.nrow', h('div.nitem.empty', h('div', h('b', 'ยังไม่มีงาน'), h('p.muted', 'เพิ่มงานแล้วรูปกระดาน ใบงาน และโน้ตจะมาอยู่ตรงนี้'))))));
  goPage(Math.max(0, pages.indexOf(keep)), false);
}
export function goPage(i, smooth = true) {
  cur = Math.max(0, Math.min(pages.length - 1, i));
  stage.scrollTo({ top: cur * innerHeight, behavior: smooth ? 'smooth' : 'instant' });
  syncNote();
  depth();
}
/* ความลึกของชั้นโน้ต (ทำงานเฉพาะตอนดูโน้ต · ปิดเมื่อเครื่องตั้งลดการเคลื่อนไหว)
   ปัดซ้ายขวา: การ์ดข้าง ๆ หมุนเข้าหากลางและถอยลึกเล็กน้อย · ปัดขึ้นลง: แถวการ์ดของหน้าถัดไปเลื่อนช้ากว่าหน้า (parallax) แล้วขยายเข้าที่
   คำนวณใน requestAnimationFrame ครั้งเดียวต่อเฟรม ใช้แค่ transform/opacity */
const calm = matchMedia('(prefers-reduced-motion: reduce)');
let depthRaf = 0;
function depth() { if (!depthRaf && !calm.matches) depthRaf = requestAnimationFrame(depthFrame); }
function depthFrame() {
  depthRaf = 0;
  if (!isNoteMode()) return;
  const vh = innerHeight, top = stage.scrollTop;
  for (const pg of stage.children) {
    const off = (pg.offsetTop - top) / vh;
    if (Math.abs(off) > 1.2) continue;
    const row = pg.querySelector('.nrow'); if (!row) continue;
    const a = Math.min(1, Math.abs(off));
    row.style.transform = a > .002 ? `translate3d(0,${(off * -12).toFixed(2)}vh,0) scale(${(1 - a * .07).toFixed(4)})` : '';
    const mid = row.scrollLeft + row.clientWidth / 2;
    for (const it of row.children) {
      const o = Math.max(-1, Math.min(1, (it.offsetLeft + it.offsetWidth / 2 - mid) / (it.offsetWidth + 14)));
      const k = Math.abs(o);
      it.style.transform = k > .002 ? `perspective(900px) rotateY(${(o * -9).toFixed(2)}deg) scale(${(1 - k * .08).toFixed(4)})` : '';
      it.style.opacity = k > .002 ? (1 - k * .3).toFixed(3) : '';
    }
  }
}
function initStage() {
  stage.addEventListener('scroll', depth, { capture: true, passive: true }); // capture = ได้ทั้งเลื่อนขึ้นลงของชั้นและปัดซ้ายขวาในแถว
  addEventListener('resize', depth);
  let t;
  // จดว่าอยู่หน้าไหนเมื่อเลื่อนหยุดตรงหน้าแล้วเท่านั้น (ถ้าเครื่องยุ่ง ตัวจับเวลาอาจมาก่อนเลื่อนเสร็จ — ยังไม่ตรงหน้าให้รอต่อ)
  const settle = () => { const r = stage.scrollTop / innerHeight, i = Math.round(r); if (Math.abs(r - i) > .02) { t = setTimeout(settle, 60); return; } if (i !== cur) { cur = i; syncNote(); } };
  stage.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(settle, 60); });
  // เมาส์ลากได้เหมือนนิ้ว (นิ้วใช้การเลื่อนของเบราว์เซอร์)
  let d = null;
  stage.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button || e.target.closest('button')) return; const row = e.target.closest('.nrow'); d = { y: e.clientY, x: e.clientX, top: stage.scrollTop, row, left: row?.scrollLeft }; });
  addEventListener('pointermove', e => {
    if (!d) return;
    const dy = e.clientY - d.y, dx = e.clientX - d.x;
    if (!d.axis && Math.hypot(dx, dy) > 6) { d.axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x'; stage.classList.add('free'); d.row?.style.setProperty('scroll-snap-type', 'none'); }
    if (d.axis === 'y') stage.scrollTop = d.top - dy;
    if (d.axis === 'x' && d.row) d.row.scrollLeft = d.left - dx;
  });
  addEventListener('pointerup', e => {
    if (!d) return;
    const x = d; d = null; stage.classList.remove('free');
    if (x.axis === 'y') { const dy = e.clientY - x.y; goPage(Math.round(x.top / innerHeight) + (dy < -50 ? 1 : dy > 50 ? -1 : 0)); }
    if (x.axis === 'x' && x.row) x.row.style.removeProperty('scroll-snap-type');
  });
  addEventListener('keydown', e => {
    if (!isNoteMode() || modalOpen() || $('.viewer') || !$('#page').hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); goPage(cur + 1); }
    if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goPage(cur - 1); }
  });
}
function initNoteUi() {
  $('#note-back').innerHTML = ic('back');
  $('#note-add').innerHTML = ic('plus');
  $('#note-back').onclick = () => setSnap(2);
  $('#note-add').onclick = () => pages[cur] && addNote(pages[cur], 'pick');
  $('#note-peek').onclick = () => goPage(cur + 1 < pages.length ? cur + 1 : 0);
  initHandsfree({
    note: d => { const row = stage.children[cur]?.querySelector('.nrow'), it = row?.querySelector('.nitem'); if (it) row.scrollBy({ left: d * (it.offsetWidth + 14), behavior: 'smooth' }); },
    task: d => goPage(cur + d),
  });
}
let tick;
function syncNote() {
  clearInterval(tick);
  const t = task(pages[cur]);
  if (!t) {
    paneNote.replaceChildren(h('div.empty-note', h('b', 'ไม่มีงานค้าง'), h('p', 'เพิ่มงานจากหน้าแรกได้เลย')), h('button.cta', { onclick: () => setSnap(2) }, 'กลับหน้าแรก'));
    $('#note-chip').replaceChildren(); $('#note-pager').replaceChildren(); $('#note-peek').hidden = true; return;
  }
  const s = subj(t.subject_id), n = notesOf(t.id).length;
  $('#note-chip').replaceChildren(badge(s), n ? `โน้ต ${n} รายการ` : 'ยังไม่มีโน้ต');
  $('#note-pager').replaceChildren(...pages.slice(0, 8).map((_, i) => h('i', { class: i === cur ? 'on' : '' })), h('small', `${cur + 1} / ${pages.length}`));
  const nxt = task(pages[cur + 1]);
  $('#note-peek').hidden = pages.length < 2;
  $('#note-peek').innerHTML = ic(nxt ? 'up' : 'reset');
  $('#note-peek').append(nxt ? `ปัดขึ้น · ${shortOf(subj(nxt.subject_id))}` : 'กลับงานแรก');
  const timer = h('span.timer');
  const upd = () => { const sec = Math.max(0, Math.floor((Date.now() - Date.parse(t.started_at || t.updated_at)) / 1000)); timer.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`; };
  if (t.status === 'doing') { upd(); tick = setInterval(upd, 1000); }
  paneNote.style.setProperty('--sc', s.color || '#69778F');
  paneNote.replaceChildren(...notePane(t, s, notesOf(t.id), timer, {
    edit: () => editTask(t.id), add: kind => addNote(t.id, kind), start: () => start(t.id), finish: () => finish(t.id) }));
}
async function start(id) { await app.store.patchTask(id, { status: 'doing', started_at: new Date().toISOString() }); toast('เริ่มจับเวลาแล้ว · สู้ ๆ'); }
export async function finish(id) {
  const t = task(id), prev = { status: t.status, started_at: t.started_at || null };
  await app.store.patchTask(id, { status: 'done' });
  toast('เยี่ยม! ทำเสร็จแล้ว', { label: 'เลิกทำ', run: () => app.store.patchTask(id, prev) });
}
/** เปิดโน้ตของงาน: ดึงแผ่นลง แล้วเลื่อนชั้นหลังไปหน้าของงานนั้น */
export function openNotes(id) {
  if (!$('#page').hidden) location.hash = '#/home';
  if (!pages.includes(id)) { extra = id; renderStage(); }
  const i = pages.indexOf(id);
  targeted = true; setSnap(0); targeted = false; goPage(i < 0 ? 0 : i, true);
}

/* ---------------- หน้าแรก (ในแผ่นล่าง) ---------------- */
function renderHome() {
  const keepFocus = document.activeElement?.id === 'home-q';
  const q = hs.q.trim().toLowerCase(), td = today();
  let list = ranked();
  if (hs.when !== 'all') list = list.filter(t => { const n = t.due_date ? daysBetween(td, t.due_date) : 99; return hs.when === 'today' ? n <= 0 : hs.when === 'tomorrow' ? n === 1 : n <= 7; });
  if (q) list = list.filter(t => `${t.title} ${t.description || ''} ${subj(t.subject_id).name}`.toLowerCase().includes(q));
  const focus = !q && hs.when === 'all'; // ไม่ได้ค้นหา/กรอง = โชว์แค่ 3 งานแรก
  const shown = focus ? list.slice(0, TOP) : list;
  const name = S().prefs.display_name;
  const input = h('input', { id: 'home-q', type: 'search', placeholder: 'ค้นหางาน...', value: hs.q, 'aria-label': 'ค้นหางาน', autocomplete: 'off', oninput: e => { hs.q = e.target.value; renderHome(); } });
  const empty = !S().tasks.some(t => !t.deleted_at && t.status !== 'done');
  paneHome.replaceChildren(
    h('div.brandrow', h('span.hdate', (d => `${DOWL[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`)(new Date())), h('a.avatar.grad', { href: '#/me', 'aria-label': 'หน้าฉัน' }, (name || 'ฉ').slice(0, 1))),
    h('h1.big', name ? [h('span.g', `${name},`), h('br')] : '', 'จดงานอะไรดี?'),
    h('div.tiles',
      tile('speak', 'พูด', 'พูดเอง หรือฟังครู', () => addTask('voice')),
      tile('attach', 'แนบรูป', 'จากอัลบั้ม/แชท', () => addTask('photo')),
      tile('type', 'พิมพ์', 'พิมพ์สั้นๆ ก็รู้เรื่อง', () => addTask('text')),
      tile('shoot', 'ถ่ายรูป', 'กระดาน · ใบงาน', () => addTask('camera'))),
    h('label.search', h('span', { html: ic('search') }), input,
      h('button.chip', { type: 'button', 'aria-label': `กรองตามวัน: ${WHEN[hs.when]}`, onclick: () => { const ks = Object.keys(WHEN); hs.when = ks[(ks.indexOf(hs.when) + 1) % ks.length]; renderHome(); }, html: ic('cal') + `<span>${WHEN[hs.when]}</span>` })),
    h('div.sec', h('h2', !focus ? 'ผลการค้นหา' : 'ใกล้ส่ง'), h('span', !focus && list.length ? `${list.length} งาน` : '')),
    list.length ? h('ul.tlist', shown.map((t, i) => h('li.trow', { style: { '--c': subj(t.subject_id).color || '#69778F', '--k': i } },
      h('button.main', { onclick: () => openNotes(t.id) }, thumbOf(t) || badge(subj(t.subject_id)),
        h('div', h('b', t.pinned_at ? h('span', { html: ic('pin'), class: 'pinmark', 'aria-label': 'ปักหมุด' }) : '', fullTitle(t)),
          h('small', dueLine(t), t.source === 'sample' ? h('span.tag', 'ตัวอย่าง') : t.source === 'teacher' ? h('span.tag.teach', 'ฟังครู') : ''))),
      h('button.go' + (t.status === 'doing' ? '.doing' : ''), { onclick: () => openNotes(t.id), 'aria-label': `${t.status === 'doing' ? 'กำลังทำ' : 'ทำเลย'} ${t.title}` }, t.status === 'doing' ? 'กำลังทำ' : h('i')))))
      : empty ? h('div.empty-note', h('b', 'วันนี้ยังไม่มีงานที่ต้องทำ'), h('p', 'เพิ่มงานด้วยปุ่มด้านบน'),
          h('div.row2', h('button.btn.primary', { onclick: () => addTask('text') }, '+ เพิ่มงานใหม่'),
            h('button.btn.ghost', { onclick: async () => { await app.store.addSamples(); toast('ใส่งานตัวอย่าง 6 งานแล้ว · ลบได้ในหน้าฉัน'); } }, 'ลองงานตัวอย่าง')))
      : h('div.empty-note', 'ไม่พบงานที่ตรงกับที่ค้นหา'),
  );
  if (keepFocus) { const el = $('#home-q'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
}
const tile = (art, name, sub, onclick) => h('button.tile', { onclick, 'data-art': art, 'aria-label': `${name} — ${sub}`, html: `<span class="ti-ic">${ART[art]}</span><b>${name}</b><small>${sub}</small>` });
/** รูปย่อจากรูปโน้ตล่าสุดของงาน (ไม่มีรูป = ใช้ป้ายวิชาเดิม) */
const thumbOf = t => { const img = [...notesOf(t.id)].reverse().find(n => n.kind === 'image' && n.blob); return img ? h('span.thumb', { style: { backgroundImage: `url("${urlOf(img)}")` } }) : null; };
export const focusSearch = () => { setSnap(2); setTimeout(() => $('#home-q')?.focus(), 350); };
