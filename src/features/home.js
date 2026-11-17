// หน้าแรก — กลไกแบบแอปเรียกรถ: ชั้นหลังเต็มจอ + แผ่นล่าง 3 ระดับ
//   แผ่นขึ้น (กลาง/บน) : เพิ่มงาน 4 แบบ · ค้นหา + ชิปวัน · งานแนะนำ (ปักหมุดก่อน แล้วเรียงตามกำหนดส่ง)
//   แผ่นลง (ล่าง)      : ชั้นหลังคือ "โน้ตหน้างาน" 1 หน้า = 1 งาน · ปัดขึ้น/ลง = งานถัดไป · ปัดซ้าย/ขวา = โน้ตถัดไป
//                        แผ่นเหลือการ์ดงาน: เพิ่มโน้ต รูป/ข้อความ/เสียง + ทำเลย (จับเวลา) → เสร็จแล้ว
import { h, ic, ART, toast, badge, shortOf, tintOf, $, onBack, pushBack, dropBack, modalOpen } from '../ui/kit.js';
import { daysBetween } from '../domain/dates.js';
import { app, S, subj, task, ranked, today, dueLine, fullTitle, notesOf } from './shared.js';
import { addTask, addNote, editTask, noteEl } from './add.js';

let sheet, paneHome, paneNote, stage;
const LOW = 300;
const snapPx = () => [LOW, Math.round(innerHeight * .58), innerHeight]; // บนสุด = ชิดขอบจอบน
let snapIdx = 2, vis = 0;
let pages = [], cur = 0, targeted = false; // targeted = เปิดโน้ตของงานที่เลือกไว้ (ไม่ต้องกลับไปงานอันดับ 1)
const hs = { q: '', when: 'all', limit: 8 };
const WHEN = { all: 'ทั้งหมด', today: 'วันนี้', tomorrow: 'พรุ่งนี้', week: '7 วันนี้' };
export const homeState = () => ({ snapIdx, cur, pages: [...pages], noteMode: document.body.classList.contains('note-mode') });

export function initHome() {
  sheet = $('#sheet'); paneHome = $('#pane-home'); paneNote = $('#pane-note'); stage = $('#stage');
  initSheetDrag(); initStage(); initNoteUi();
  onBack(() => { if (!isNoteMode() || modalOpen()) return false; setSnap(2, true); return true; });
  addEventListener('resize', () => setSnap(snapIdx));
  app.openNotes = openNotes;
  setSnap(2);
}
export function renderHomeAll() { renderHome(); renderStage(); }

/* ---------------- แผ่นล่าง ---------------- */
const isNoteMode = () => document.body.classList.contains('note-mode');
function setVis(v) {
  vis = v;
  document.documentElement.style.setProperty('--sheet-vis', v + 'px');
  sheet.classList.toggle('full', v >= snapPx()[2] - 2);
  sheet.dataset.snap = ['low', 'mid', 'top'][snapIdx];
  const nm = v < (snapPx()[0] + snapPx()[1]) / 2;
  if (nm !== isNoteMode()) {
    document.body.classList.toggle('note-mode', nm);
    app.updateNav?.();
    if (nm) { if (!targeted) goPage(0, false); else syncNote(); if (!history.state?.note) pushBack({ note: 1 }); }
    targeted = false;
  }
}
export function setSnap(i, fromBack = false) {
  snapIdx = Math.max(0, Math.min(2, i));
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
  setSnap(best);
}
const clampVis = v => Math.max(LOW * .7, Math.min(innerHeight, v));
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
  pages = ranked().map(t => t.id);
  stage.replaceChildren(...pages.map(id => {
    const t = task(id), s = subj(t.subject_id), notes = notesOf(id);
    const row = h('div.nrow', notes.length ? notes.map(noteEl) : h('div.nitem.empty',
      h('div', h('b', 'ยังไม่มีโน้ตของงานนี้'), h('p.muted', 'ถ่ายกระดาน ใบงาน หรือจดสิ่งที่ครูบอกไว้ตรงนี้'),
        h('button.go', { onclick: () => addNote(id, 'camera') }, '+ ถ่ายรูป'))));
    return h('section.npage', { 'data-id': id }, h('div.wash', { style: { background: `linear-gradient(180deg, ${tintOf(s)}, transparent 70%)` } }), row);
  }));
  if (!pages.length) stage.append(h('section.npage', h('div.nrow', h('div.nitem.empty', h('div', h('b', 'ยังไม่มีงาน'), h('p.muted', 'เพิ่มงานแล้วรูปกระดาน ใบงาน และโน้ตจะมาอยู่ตรงนี้'))))));
  goPage(Math.max(0, pages.indexOf(keep)), false);
}
export function goPage(i, smooth = true) {
  cur = Math.max(0, Math.min(pages.length - 1, i));
  stage.scrollTo({ top: cur * innerHeight, behavior: smooth ? 'smooth' : 'instant' });
  syncNote();
}
function initStage() {
  let t;
  stage.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => { const i = Math.round(stage.scrollTop / innerHeight); if (i !== cur) { cur = i; syncNote(); } }, 60); });
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
  paneNote.replaceChildren(
    h('div.ntitle', h('div', h('h2', fullTitle(t)), h('div.meta', dueLine(t), t.place ? ` · ${t.place}` : '', t.status === 'doing' ? timer : '')),
      h('button.iconbtn', { 'aria-label': 'แก้ไขงาน', onclick: () => editTask(t.id), html: ic('edit') })),
    h('hr'),
    h('div.lbl', 'เพิ่มโน้ตให้งานนี้'),
    h('div.pills',
      h('button.pill', { onclick: () => addNote(t.id, 'camera'), html: ic('camera') + 'รูป' }),
      h('button.pill', { onclick: () => addNote(t.id, 'text'), html: ic('text') + 'ข้อความ' }),
      h('button.pill', { onclick: () => addNote(t.id, 'voice'), html: ic('mic') + 'เสียง' })),
    t.status === 'doing'
      ? h('button.cta.doing', { onclick: () => finish(t.id), html: ic('check') + 'ทำเสร็จแล้ว' })
      : h('button.cta', { onclick: () => start(t.id) }, 'ทำเลย'),
  );
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
  const name = S().prefs.display_name;
  const hasSamples = S().tasks.some(t => t.source === 'sample' && !t.deleted_at);
  const input = h('input', { id: 'home-q', type: 'search', placeholder: 'ค้นหางาน...', value: hs.q, 'aria-label': 'ค้นหางาน', autocomplete: 'off', oninput: e => { hs.q = e.target.value; renderHome(); } });
  const empty = !S().tasks.some(t => !t.deleted_at && t.status !== 'done');
  paneHome.replaceChildren(
    h('div.brandrow', h('div.brand', 'SABA', h('span', 'ii'), h('b', '.')), h('a.avatar', { href: '#/me', 'aria-label': 'หน้าฉัน' }, (name || 'ฉ').slice(0, 1))),
    h('h1.big', name ? `เพิ่มงานกันเลย ${name}` : 'เพิ่มงานกันเลย'),
    h('p.sub', 'หลายอย่าง หลายครั้ง หลายเวลา — โยนมาได้หมด'),
    h('div.tiles',
      tile('speak', 'พูด', 'สั่งด้วยเสียง', () => addTask('voice')),
      tile('attach', 'แนบรูป', 'จากอัลบั้ม/แชท', () => addTask('photo')),
      tile('type', 'พิมพ์', 'พิมพ์สั้นๆ ก็รู้เรื่อง', () => addTask('text')),
      tile('shoot', 'ถ่ายรูป', 'กระดาน · ใบงาน', () => addTask('camera'))),
    h('label.search', h('span', { html: ic('search') }), input,
      h('button.chip', { type: 'button', 'aria-label': `กรองตามวัน: ${WHEN[hs.when]}`, onclick: () => { const ks = Object.keys(WHEN); hs.when = ks[(ks.indexOf(hs.when) + 1) % ks.length]; renderHome(); }, html: ic('cal') + `<span>${WHEN[hs.when]}</span>` })),
    h('div.sec', h('h2', 'งานแนะนำวันนี้'), h('span', list.length ? `เรียงให้แล้ว · ${list.length} งาน` : '')),
    list.length ? h('ul.tlist', list.slice(0, hs.limit).map((t, i) => h('li.trow',
      h('button.main', { onclick: () => openNotes(t.id) }, badge(subj(t.subject_id)),
        h('div', h('b', t.pinned_at ? h('span', { html: ic('pin'), class: 'pinmark', 'aria-label': 'ปักหมุด' }) : '', fullTitle(t)),
          h('small', dueLine(t), t.source === 'sample' ? h('span.tag', 'ตัวอย่าง') : ''))),
      h('button.go' + (t.status === 'doing' ? '.doing' : i === 0 ? '.dark' : ''), { onclick: () => openNotes(t.id) }, t.status === 'doing' ? 'กำลังทำ' : 'ทำเลย'))))
      : empty ? h('div.empty-note', h('b', 'วันนี้ยังไม่มีงานที่ต้องทำ'), h('p', 'เพิ่มงานด้วยปุ่มด้านบน'),
          h('div.row2', h('button.btn.primary', { onclick: () => addTask('text') }, '+ เพิ่มงานใหม่'),
            h('button.btn.ghost', { onclick: async () => { await app.store.addSamples(); toast('ใส่งานตัวอย่าง 6 งานแล้ว · ลบได้ในหน้าฉัน'); } }, 'ลองงานตัวอย่าง')))
      : h('div.empty-note', 'ไม่พบงานที่ตรงกับที่ค้นหา'),
    list.length > hs.limit ? h('button.more', { onclick: () => { hs.limit += 10; renderHome(); } }, `ดูอีก ${list.length - hs.limit} งาน`) : '',
    hasSamples && list.length ? h('p.muted.center', 'มีงานตัวอย่างอยู่ · ลบทั้งหมดได้ในหน้า "ฉัน"') : '',
  );
  if (keepFocus) { const el = $('#home-q'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
}
const tile = (art, name, sub, onclick) => h('button.tile', { onclick, 'aria-label': `${name} — ${sub}`, html: ART[art] + `<b>${name}</b><small>${sub}</small>` });
export const focusSearch = () => { setSnap(2); setTimeout(() => $('#home-q')?.focus(), 350); };
