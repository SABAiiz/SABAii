// SABAii โครงใหม่ — กลไกแบบแอปเรียกรถ (ชั้นหลัง + แผ่นล่าง 3 ระดับ) แต่ชั้นหลังเป็น "โน้ตหน้างาน" ของแต่ละวิชา
//   หน้าแรก  : แผ่นล่าง = เพิ่มงาน 4 แบบ + ค้นหา + งานแนะนำ (เรียงตามกำหนดส่ง)
//              ดึงแผ่นลง → เห็นโน้ตของงานอันดับ 1 · ปัดขึ้น/ลง = งานถัดไป · ปัดซ้าย/ขวา = โน้ตถัดไปของงานเดียวกัน
//   งาน      : ปฏิทินเปิด/ปิดได้ (2 สัปดาห์ ↔ ทั้งเดือน) + การ์ดโปรเจกต์ต่อวิชาแบบ Canva → แตะเข้าไปเห็นงาน+โน้ตทั้งหมดของวิชา
//   ฉัน      : สรุป · ธีม · รีเซ็ตตัวอย่าง
// เก็บข้อมูลใน localStorage ของโครงนี้เอง (ไม่แตะฐานข้อมูลของแอปหลัก) · ใช้ตัวแกะข้อความไทยของ SABAii (src/domain)
import { draftsFromText } from '../src/domain/parse.js';
import { toYMD, fromYMD, addDaysYMD, daysBetween, dueSortKey, relDay, DOW_SHORT, DOW_LONG, MONTH_SHORT, MONTH_LONG, beYear } from '../src/domain/dates.js';

const $ = s => document.querySelector(s);
const KEY = 'sabaii-shell-v1';

/* ---------------- ตัวช่วย ---------------- */
function h(tag, props, ...kids) {
  const [name, ...cls] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (props != null && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { kids.unshift(props); props = null; }
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v; // ไอคอนคงที่เท่านั้น ไม่ใช่ข้อความผู้ใช้
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false && c !== '') el.append(c instanceof Node ? c : String(c));
  return el;
}
const P = {
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>', up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
  left: '<path d="M15 5l-7 7 7 7"/>', right: '<path d="M9 5l7 7-7 7"/>', plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  text: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>', mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>', tasks: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7M9 7h3"/>', me: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18a6.5 6.5 0 0111 0"/>',
  check: '<path d="M5 12l5 5 9-10"/>', moon: '<path d="M20 14A8 8 0 1110 4a6.5 6.5 0 0010 10z"/>', reset: '<path d="M4 12a8 8 0 108-8 8.5 8.5 0 00-6 2.5L4 8"/><path d="M4 3v5h5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', img: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
};
const ic = (n, extra = '') => `<svg class="i" ${extra} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
// ภาพประกอบปุ่มเพิ่มงาน 4 แบบ (สีเต็ม)
const ART = {
  speak: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="17" y="4" width="14" height="26" rx="7" fill="#0A6CF1"/><rect x="20" y="9" width="8" height="3" rx="1.5" fill="#fff" opacity=".5"/><path d="M11 22a13 13 0 0026 0" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M24 35v7M17 43h14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  attach: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="9" width="30" height="32" rx="4" style="fill:var(--sheet-bg)" stroke="currentColor" stroke-width="3"/><circle cx="16" cy="19" r="3.5" fill="#F4A340"/><path d="M8 37l10-10 7 7 4-4 7 7" fill="#0A6CF1" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><circle cx="37" cy="10" r="8" fill="#0A6CF1"/><path d="M37 6v8M33 10h8" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  type: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="4" y="14" width="40" height="24" rx="5" style="fill:var(--sheet-bg)" stroke="currentColor" stroke-width="3"/><g fill="currentColor"><rect x="10" y="20" width="4" height="4" rx="1"/><rect x="17" y="20" width="4" height="4" rx="1"/><rect x="24" y="20" width="4" height="4" rx="1"/><rect x="31" y="20" width="4" height="4" rx="1"/><rect x="14" y="28" width="20" height="4" rx="1"/></g><rect x="14" y="5" width="20" height="7" rx="3.5" fill="#0A6CF1"/></svg>`,
  shoot: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 15h8l3-5h14l3 5h8v25H6z" fill="currentColor"/><circle cx="24" cy="27" r="9" fill="#fff"/><circle cx="24" cy="27" r="5.5" fill="#0A6CF1"/><rect x="36" y="18" width="4" height="3" rx="1" fill="#fff"/></svg>`,
};

let toastT;
function toast(msg, action) {
  const el = $('#toast');
  el.replaceChildren(h('span', msg), action ? h('button', { onclick: () => { el.classList.remove('show'); action.fn(); } }, action.label) : null);
  el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), action ? 4500 : 2200);
}
const uid = p => p + Math.random().toString(36).slice(2, 9);
const today = () => toYMD(new Date());

/* ---------------- ข้อมูล ---------------- */
const SUBJ_SEED = [
  { id: 'phy', name: 'ฟิสิกส์', short: 'ฟิส', color: '#D9443A', tint: '#FDECEA', aliases: ['ฟิสิก', 'physics'] },
  { id: 'math', name: 'คณิตศาสตร์', short: 'คณิต', color: '#2D6CC0', tint: '#E8F1FD', aliases: ['คณิต', 'เลข', 'math'] },
  { id: 'eng', name: 'ภาษาอังกฤษ', short: 'Eng', color: '#B7791F', tint: '#FFF4D6', aliases: ['อังกฤษ', 'eng', 'english'] },
  { id: 'thai', name: 'ภาษาไทย', short: 'ไทย', color: '#4A5568', tint: '#EDF0F4', aliases: ['ไทย'] },
  { id: 'chem', name: 'เคมี', short: 'เคมี', color: '#7C4DDB', tint: '#F0EAFD', aliases: ['chem'] },
];
function seed() {
  const t = today(), d = n => addDaysYMD(t, n);
  const dow = fromYMD(t).getDay(), nextDow = (k, plus = 0) => d(((k - dow + 7) % 7 || 7) + plus); // วัน k ถัดไป
  const note = (kind, text, extra = {}) => ({ id: uid('n'), kind, text, at: new Date(Date.now() - 86400000 * (1 + Math.random() * 3)).toISOString(), ...extra });
  return {
    subjects: SUBJ_SEED.map(s => ({ ...s })),
    tasks: [
      { id: 't1', subject_id: 'phy', title: 'แบบฝึกบทที่ 3', type: 'homework', due_date: d(1), due_time: '08:00', est: 40, status: 'todo',
        notes: [note('board', 'การบ้าน ฟิสิกส์ บทที่ 3\nแบบฝึกหัด ข้อ 1 – 12\nF = ma    v = u + at\n<em>ส่ง พรุ่งนี้ 08:00 !!</em>'), note('sticky', 'ข้อ 9–12 ใช้กราฟ\nหน้า 84 ในหนังสือ')] },
      { id: 't2', subject_id: 'math', title: 'ใบงานลำดับเลขคณิต', type: 'homework', due_date: nextDow(5), due_time: null, est: 25, status: 'todo',
        notes: [note('sheet', '<mark>สูตร aₙ = a₁ + (n − 1)d</mark>\n1. หาพจน์ที่ 20 ของ 3, 7, 11, …\n2. ลำดับมี a₅ = 17, d = 3 จงหา a₁\n3. หาผลบวก 15 พจน์แรกของ 2, 5, 8, …\n4. พจน์ใดของ 5, 9, 13, … มีค่า 101', { head: 'ใบงานที่ 6 · ลำดับเลขคณิต' }), note('sticky', 'ครูบอก\nทำแค่ข้อคี่ก็พอ\nส่งในห้อง ไม่ต้องส่งออนไลน์')] },
      { id: 't3', subject_id: 'eng', title: 'ท่องศัพท์ 20 คำ', type: 'exam', due_date: nextDow(1), due_time: null, est: 15, status: 'todo',
        notes: [note('sheet', 'Unit 5 · Travel\nitinerary · luggage · destination\ncustoms · boarding pass · delay\nsouvenir · reservation · departure', { head: 'Vocabulary quiz' })] },
      { id: 't4', subject_id: 'thai', title: 'สรุปเรื่องขุนช้างขุนแผน', type: 'homework', due_date: nextDow(2, 7), due_time: null, est: 30, status: 'todo', notes: [] },
      { id: 't5', subject_id: 'chem', title: 'รายงานแลปกรด-เบส', type: 'project', due_date: d(9), due_time: '16:00', est: 90, status: 'todo',
        notes: [note('board', 'แลป: ไทเทรตกรด–เบส\nฟีนอล์ฟทาลีน → ชมพู\n<em>ส่งรายงานกลุ่ม 4 คน</em>')] },
      { id: 't6', subject_id: 'phy', title: 'สอบกลางภาค บท 1–4', type: 'exam', due_date: d(12), due_time: '09:00', est: 120, status: 'todo', notes: [] },
      { id: 't7', subject_id: 'math', title: 'แบบฝึกหัด 4.2', type: 'homework', due_date: d(-1), due_time: null, est: 30, status: 'done', done_at: new Date().toISOString(), notes: [] },
    ],
    prefs: {},
  };
}
let db;
try { db = JSON.parse(localStorage.getItem(KEY)) || null; } catch { db = null; }
if (!db?.tasks) db = seed();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch { toast('ที่เก็บในเครื่องเต็ม — รูปล่าสุดอาจไม่ถูกบันทึก'); }
}
const subj = id => db.subjects.find(s => s.id === id) || { id: '', name: 'ไม่ระบุวิชา', short: '—', color: '#69778F', tint: '#EDF0F4' };
const task = id => db.tasks.find(t => t.id === id);
const open = () => db.tasks.filter(t => t.status !== 'done');
/** ลำดับงานแนะนำ: กำลังทำมาก่อน แล้วเรียงตามกำหนดส่ง (ใกล้สุดก่อน) */
const ranked = () => open().sort((a, b) => (b.status === 'doing') - (a.status === 'doing') || dueSortKey(a) - dueSortKey(b));

function dueInfo(t) {
  if (!t.due_date) return { text: 'ไม่มีกำหนดส่ง', urgent: false };
  const n = daysBetween(today(), t.due_date), d = fromYMD(t.due_date);
  const pre = t.type === 'exam' ? 'สอบ' : 'ส่ง';
  const day = n < 0 ? `เลยกำหนด ${relDay(t.due_date, today())}` : n === 0 ? 'วันนี้' : n === 1 ? 'พรุ่งนี้'
    : n < 7 ? DOW_LONG[d.getDay()] : n < 14 ? DOW_LONG[d.getDay()] + 'หน้า' : relDay(t.due_date, today());
  return { text: `${n < 0 ? '' : pre}${day}${t.due_time ? ' ' + t.due_time : ''}`, urgent: n <= 1 };
}
const dueLine = t => { const d = dueInfo(t); return [d.urgent ? h('em', d.text) : d.text, t.est ? ` · ~${t.est} นาที` : '']; };
const badge = s => h('span.badge', { style: { background: s.tint, color: s.color } }, s.short);
const fullTitle = t => `${subj(t.subject_id).short === '—' ? '' : subj(t.subject_id).name.replace(/^ภาษา/, '') + ' · '}${t.title}`;

/* ---------------- แผ่นล่าง (กลไกเดียวกับ shell/ride) ---------------- */
const sheet = $('#sheet'), paneHome = $('#pane-home'), paneNote = $('#pane-note');
const LOW = 300;
const snapPx = () => [LOW, Math.round(innerHeight * .58), innerHeight - 40];
let snapIdx = 2, vis = 0;
const isNote = () => vis < (snapPx()[0] + snapPx()[1]) / 2;
function setVis(v) {
  vis = v;
  document.documentElement.style.setProperty('--sheet-vis', v + 'px');
  sheet.classList.toggle('full', v >= snapPx()[2] - 2);
  const nm = isNote();
  if (nm !== document.body.classList.contains('note-mode')) { document.body.classList.toggle('note-mode', nm); onModeChange(nm); }
}
function setSnap(i) {
  snapIdx = Math.max(0, Math.min(2, i)); setVis(snapPx()[snapIdx]);
  if (snapIdx < 2) paneHome.scrollTop = 0;
}
let drag = null, suppressClick = false;
sheet.addEventListener('pointerdown', e => {
  if (e.button) return;
  drag = { y: e.clientY, vis, inBody: !!e.target.closest('.pane-home'), moved: false, hist: [[e.timeStamp, e.clientY]], id: e.pointerId };
});
window.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dy = e.clientY - drag.y;
  if (!drag.moved) {
    if (Math.abs(dy) < 8) return;
    if (sheet.classList.contains('full') && drag.inBody && (dy < 0 || paneHome.scrollTop > 0)) { drag = null; return; } // ปล่อยให้เลื่อนรายการ
    drag.moved = true; sheet.classList.add('dragging');
  }
  setVis(Math.max(LOW * .7, Math.min(innerHeight - 40, drag.vis - dy)));
  drag.hist.push([e.timeStamp, e.clientY]); if (drag.hist.length > 5) drag.hist.shift();
});
function endDrag(e) {
  if (!drag) return;
  const d = drag; drag = null;
  if (!d.moved) return;
  sheet.classList.remove('dragging'); suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
  const [t0, y0] = d.hist[0], v = (e.clientY - y0) / Math.max(1, e.timeStamp - t0);
  const target = vis - v * 180, s = snapPx();
  let best = 0; s.forEach((x, i) => { if (Math.abs(x - target) < Math.abs(s[best] - target)) best = i; });
  setSnap(best);
}
window.addEventListener('pointerup', endDrag); window.addEventListener('pointercancel', endDrag);
sheet.addEventListener('click', e => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); } }, true);
$('.grab').addEventListener('click', () => setSnap(snapIdx === 2 ? 0 : 2));
addEventListener('resize', () => setSnap(snapIdx));

/* ---------------- ชั้นหลัง: โน้ตหน้างาน ---------------- */
const stage = $('#stage');
let pages = [], cur = 0; // pages = id งานตามลำดับแนะนำ

function noteEl(n, i) {
  const tilt = i % 2 ? 'tilt-r' : 'tilt-l';
  const when = h('span.ntag', { html: ic(n.kind === 'sticky' ? 'text' : 'camera') }, (n.kind === 'sticky' ? 'จดเมื่อ ' : 'ถ่ายเมื่อ ') + shortWhen(n.at));
  // รูปจริง: โชว์ทั้งรูป (ไม่ตัดขอบ — ตัวหนังสือบนกระดานอยู่ชิดขอบบ่อย) พื้นหลังเป็นรูปเดียวกันแบบเบลอ · แตะ = ดูเต็มจอ
  if (n.kind === 'photo') return h('div.nitem.photo.' + tilt, { style: { '--src': `url("${n.src}")` } },
    h('button.zoom', { 'aria-label': 'ดูรูปเต็มจอ', onclick: () => viewPhoto(n.src) }, h('img', { src: n.src, alt: 'รูปที่แนบไว้' })), when);
  if (n.kind === 'sticky') return h('div.nitem.sticky.' + tilt, n.text, when);
  if (n.kind === 'sheet') return h('div.nitem.sheet.' + tilt, n.head ? h('h4', n.head) : null, rich(n.text), when);
  return h('div.nitem.board.' + tilt, rich(n.text), when);
}
/** ข้อความตัวอย่างมี <em>/<mark> — แปลงเป็น element เอง ไม่ใช้ innerHTML กับข้อความผู้ใช้ */
function rich(text) {
  const box = h('div.txt');
  String(text).split(/(<em>.*?<\/em>|<mark>.*?<\/mark>)/).forEach(part => {
    const m = part.match(/^<(em|mark)>(.*)<\/\1>$/);
    box.append(m ? h(m[1], m[2]) : part);
  });
  return box;
}
function shortWhen(iso) { const d = new Date(iso); return `${DOW_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }

function renderStage() {
  const keep = pages[cur];
  pages = ranked().map(t => t.id);
  stage.replaceChildren(...pages.map(id => {
    const t = task(id), s = subj(t.subject_id);
    const row = h('div.nrow', t.notes.length ? t.notes.map(noteEl) : h('div.nitem.empty',
      h('div', h('b', 'ยังไม่มีโน้ตของงานนี้'), h('p.muted', 'ถ่ายกระดาน ใบงาน หรือจดสิ่งที่ครูบอกไว้ตรงนี้'),
        h('button.go', { onclick: () => addNote(id, 'photo') }, '+ เพิ่มรูป'))));
    return h('section.npage', { 'data-id': id }, h('div.wash', { style: { background: `linear-gradient(180deg, ${s.tint}, transparent 70%)` } }), row);
  }));
  const i = Math.max(0, pages.indexOf(keep));
  goPage(i, false);
}
function goPage(i, smooth = true) {
  cur = Math.max(0, Math.min(pages.length - 1, i));
  stage.scrollTo({ top: cur * innerHeight, behavior: smooth ? 'smooth' : 'instant' });
  syncNote();
}
let scrollT;
stage.addEventListener('scroll', () => {
  clearTimeout(scrollT);
  scrollT = setTimeout(() => { const i = Math.round(stage.scrollTop / innerHeight); if (i !== cur) { cur = i; syncNote(); } }, 60);
});
// เมาส์: ลากชั้นหลังขึ้นลงได้เหมือนนิ้ว (นิ้วใช้การเลื่อนของเบราว์เซอร์เอง)
let sdrag = null;
stage.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button) return; sdrag = { y: e.clientY, x: e.clientX, top: stage.scrollTop, row: e.target.closest('.nrow'), left: e.target.closest('.nrow')?.scrollLeft }; });
addEventListener('pointermove', e => {
  if (!sdrag) return;
  const dy = e.clientY - sdrag.y, dx = e.clientX - sdrag.x;
  if (!sdrag.axis && Math.hypot(dx, dy) > 6) { sdrag.axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x'; stage.classList.add('free'); sdrag.row?.style.setProperty('scroll-snap-type', 'none'); }
  if (sdrag.axis === 'y') stage.scrollTop = sdrag.top - dy;
  if (sdrag.axis === 'x' && sdrag.row) sdrag.row.scrollLeft = sdrag.left - dx;
});
addEventListener('pointerup', e => {
  if (!sdrag) return;
  const d = sdrag; sdrag = null; stage.classList.remove('free');
  if (d.axis === 'y') { const dy = e.clientY - d.y; goPage(Math.round(d.top / innerHeight) + (dy < -50 ? 1 : dy > 50 ? -1 : 0)); }
  if (d.axis === 'x' && d.row) { d.row.style.removeProperty('scroll-snap-type'); }
});
addEventListener('keydown', e => {
  if (!document.body.classList.contains('note-mode') || $('#modal').classList.contains('show') || route().name !== 'home') return;
  if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); goPage(cur + 1); }
  if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goPage(cur - 1); }
  if (e.key === 'Escape') setSnap(2);
});

/* ปุ่มบนชั้นโน้ต + แผ่นล่างตอนดูโน้ต */
$('#note-back').innerHTML = ic('back');
$('#note-add').innerHTML = ic('plus');
$('#note-back').onclick = () => setSnap(2);
$('#note-add').onclick = () => pages[cur] && addNote(pages[cur], 'pick');
$('#note-peek').onclick = () => goPage(cur + 1 < pages.length ? cur + 1 : 0);
let tick;
function syncNote() {
  const t = task(pages[cur]);
  clearInterval(tick);
  if (!t) {
    paneNote.replaceChildren(h('div.empty-note', h('b', 'ไม่มีงานค้าง 🎉'), h('p', 'เพิ่มงานจากหน้าแรกได้เลย')), h('button.cta', { onclick: () => setSnap(2) }, 'กลับหน้าแรก'));
    $('#note-chip').replaceChildren(); $('#note-pager').replaceChildren(); $('#note-peek').hidden = true; return;
  }
  const s = subj(t.subject_id);
  $('#note-chip').replaceChildren(badge(s), `โน้ต ${t.notes.length} รายการ`);
  $('#note-pager').replaceChildren(...pages.slice(0, 8).map((_, i) => h('i', { class: i === cur ? 'on' : '' })), h('small', `${cur + 1} / ${pages.length}`));
  const nxt = task(pages[cur + 1]);
  $('#note-peek').hidden = pages.length < 2;
  $('#note-peek').innerHTML = ic(nxt ? 'up' : 'reset');
  $('#note-peek').append(nxt ? `ปัดขึ้น · ${subj(nxt.subject_id).short}` : 'กลับงานแรก');
  const timer = h('span.timer');
  const upd = () => { const m = Math.floor((Date.now() - Date.parse(t.started_at)) / 1000); timer.textContent = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  if (t.status === 'doing') { upd(); tick = setInterval(upd, 1000); }
  paneNote.replaceChildren(
    h('div.ntitle', h('div', h('h2', fullTitle(t)), h('div.meta', dueLine(t), t.status === 'doing' ? timer : null)),
      h('button.iconbtn', { 'aria-label': 'แก้ไขงาน', onclick: () => editTask(t.id), html: ic('edit') })),
    h('hr'),
    h('div.lbl', 'เพิ่มโน้ตให้งานนี้'),
    h('div.pills',
      h('button.pill', { onclick: () => addNote(t.id, 'photo'), html: ic('camera') + 'รูป' }),
      h('button.pill', { onclick: () => addNote(t.id, 'text'), html: ic('text') + 'ข้อความ' }),
      h('button.pill', { onclick: () => addNote(t.id, 'voice'), html: ic('mic') + 'เสียง' })),
    t.status === 'doing'
      ? h('button.cta.doing', { onclick: () => finish(t.id), html: ic('check') + 'เสร็จแล้ว' })
      : h('button.cta', { onclick: () => start(t.id) }, 'ทำเลย'),
  );
}
function start(id) { const t = task(id); t.status = 'doing'; t.started_at = new Date().toISOString(); save(); refresh(); toast('เริ่มจับเวลาแล้ว · สู้ ๆ'); }
function finish(id) {
  const t = task(id), prev = { status: t.status, started_at: t.started_at };
  t.status = 'done'; t.done_at = new Date().toISOString(); save(); refresh();
  toast('เสร็จแล้ว เก่งมาก!', { label: 'เลิกทำ', fn: () => { Object.assign(t, prev); delete t.done_at; save(); refresh(); } });
}
/** ดูรูปเต็มจอ (แตะที่ใดก็ได้เพื่อปิด) */
function viewPhoto(src) {
  const box = h('div.viewer', { role: 'dialog', 'aria-label': 'รูปเต็มจอ', onclick: () => box.remove() },
    h('img', { src, alt: 'รูปที่แนบไว้' }), h('button.fab', { 'aria-label': 'ปิด', html: ic('close') }));
  const onKey = e => { if (e.key === 'Escape') { box.remove(); removeEventListener('keydown', onKey); } };
  addEventListener('keydown', onKey);
  document.body.append(box);
}
/** เปิดโน้ตของงาน: ดึงแผ่นลง แล้วเลื่อนชั้นหลังไปหน้าของงานนั้น */
function openNotes(id) {
  if (route().name !== 'home') location.hash = '#/home';
  const i = pages.indexOf(id);
  setSnap(0); goPage(i < 0 ? 0 : i, true);
}
function onModeChange(noteMode) {
  updateNav();
  if (noteMode) syncNote();
}

/* ---------------- หน้าแรก (ในแผ่นล่าง) ---------------- */
const home = { q: '', when: 'all', limit: 6 };
const WHEN = { all: 'ทั้งหมด', today: 'วันนี้', tomorrow: 'พรุ่งนี้', week: '7 วันนี้' };
function renderHome() {
  const keepFocus = document.activeElement?.id === 'home-q';
  const q = home.q.trim().toLowerCase();
  let list = ranked();
  if (home.when !== 'all') list = list.filter(t => { const n = t.due_date ? daysBetween(today(), t.due_date) : 99; return home.when === 'today' ? n <= 0 : home.when === 'tomorrow' ? n === 1 : n <= 7; });
  if (q) list = list.filter(t => (t.title + ' ' + subj(t.subject_id).name).toLowerCase().includes(q));
  const input = h('input', { id: 'home-q', placeholder: 'ค้นหางาน...', value: home.q, 'aria-label': 'ค้นหางาน', autocomplete: 'off', oninput: e => { home.q = e.target.value; renderHome(); } });
  paneHome.replaceChildren(
    h('div.brandrow', h('div.brand', 'SABA', h('span', 'ii'), h('b', '.')), h('a.avatar', { href: '#/me', 'aria-label': 'หน้าฉัน' }, (db.prefs.name || 'น')[0])),
    h('h1.big', 'เพิ่มงานกันเลย'),
    h('p.sub', 'หลายอย่าง หลายครั้ง หลายเวลา — โยนมาได้หมด'),
    h('div.tiles',
      tile('speak', 'พูด', 'สั่งด้วยเสียง', () => addTask('voice')),
      tile('attach', 'แนบรูป', 'จากอัลบั้ม/แชท', () => addTask('photo')),
      tile('type', 'พิมพ์', 'พิมพ์สั้นๆ ก็รู้เรื่อง', () => addTask('text')),
      tile('shoot', 'ถ่ายรูป', 'กระดาน · ใบงาน', () => addTask('camera'))),
    h('label.search', h('span', { html: ic('search') }), input,
      h('button.chip', { type: 'button', onclick: () => { const ks = Object.keys(WHEN); home.when = ks[(ks.indexOf(home.when) + 1) % ks.length]; renderHome(); }, 'aria-label': 'กรองตามวัน', html: ic('cal') + `<span>${WHEN[home.when]}</span>` })),
    h('div.sec', h('h2', 'งานแนะนำวันนี้'), h('span', `เรียงให้แล้ว · ${list.length} งาน`)),
    list.length ? h('ul.tlist', list.slice(0, home.limit).map((t, i) => h('li.trow',
      h('button.main', { onclick: () => openNotes(t.id) }, badge(subj(t.subject_id)), h('div', h('b', fullTitle(t)), h('small', dueLine(t)))),
      h('button.go' + (t.status === 'doing' ? '.doing' : i === 0 ? '.dark' : ''), { onclick: () => openNotes(t.id) }, t.status === 'doing' ? 'กำลังทำ' : 'ทำเลย'))))
      : h('div.empty-note', q || home.when !== 'all' ? 'ไม่พบงานที่ตรงกับที่ค้นหา' : 'วันนี้ยังไม่มีงานที่ต้องทำ — เพิ่มงานด้านบนได้เลย'),
    list.length > home.limit ? h('button.more', { onclick: () => { home.limit += 10; renderHome(); } }, `ดูอีก ${list.length - home.limit} งาน`) : null,
  );
  if (keepFocus) { const el = $('#home-q'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
}
const tile = (art, name, sub, onclick) => h('button.tile', { onclick, html: ART[art] + `<b>${name}</b><small>${sub}</small>` });

/* ---------------- กล่องล่าง (modal) ---------------- */
const modal = $('#modal'), mscrim = $('#modal-scrim');
let modalClose = null;
function openModal(title, body, foot, onClose) {
  modalClose?.(true);
  modal.replaceChildren(h('div.mhead', h('h2', title), h('button.iconbtn', { 'aria-label': 'ปิด', onclick: () => closeModal(), html: ic('close') })), h('div.mbody', body), foot ? h('div.mfoot', foot) : null);
  modal.hidden = false; requestAnimationFrame(() => { modal.classList.add('show'); mscrim.classList.add('show'); });
  modalClose = silent => { modalClose = null; modal.classList.remove('show'); mscrim.classList.remove('show'); setTimeout(() => { if (!modal.classList.contains('show')) modal.hidden = true; }, 300); if (!silent) onClose?.(); };
}
const closeModal = () => modalClose?.();
mscrim.onclick = () => closeModal();
addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('show')) closeModal(); });

function pickFile(camera) {
  return new Promise(res => {
    const f = $('#file');
    if (camera) f.setAttribute('capture', 'environment'); else f.removeAttribute('capture');
    f.value = ''; f.onchange = () => res(f.files[0] || null); f.click();
  });
}
/** ย่อรูปเหลือด้านยาว 1000 px (เก็บในเครื่องได้หลายรูป) */
function shrink(file) {
  return new Promise((res, rej) => {
    if (!/^image\//.test(file.type)) return rej(new Error('ไม่ใช่ไฟล์รูป'));
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1000 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', .78));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('เปิดรูปไม่ได้')); };
    img.src = url;
  });
}
const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
function listen(onText, onEnd) {
  const rec = new SR(); rec.lang = 'th-TH'; rec.interimResults = true; rec.continuous = true;
  rec.onresult = e => onText([...e.results].map(r => r[0].transcript).join(' '));
  rec.onend = () => onEnd(); rec.onerror = () => {};
  try { rec.start(); } catch { onEnd(); }
  return rec;
}
const subjOptions = sel => [h('option', { value: '' }, 'ไม่ระบุวิชา'), ...db.subjects.map(s => h('option', { value: s.id, selected: s.id === sel }, s.name))];

/** เพิ่มงาน: text = พิมพ์ · voice = พูด · photo/camera = รูป (รูปกลายเป็นโน้ตแรกของงาน) */
async function addTask(kind, preset = '') {
  if (kind === 'voice' && !SR) { toast('เครื่องนี้ใช้พูดไม่ได้ — พิมพ์แทนนะ'); return addTask('text'); }
  let photo = null;
  if (kind === 'photo' || kind === 'camera') {
    const f = await pickFile(kind === 'camera'); if (!f) return;
    try { photo = await shrink(f); } catch (e) { toast(e.message); return; }
  }
  const ta = h('textarea.field', { id: 'add-text', placeholder: photo ? 'งานในรูปคืออะไร? เช่น "ฟิสิกส์ แบบฝึกบท 4 ส่งศุกร์"' : 'เช่น "คณิต ใบงาน 7 ส่งศุกร์"\nหลายงานก็ได้ บรรทัดละงาน', value: preset });
  ta.value = preset;
  let rec = null;
  const body = h('div', photo ? h('img.preview', { src: photo, alt: 'รูปที่เลือก' }) : null,
    kind === 'voice' ? h('div', { style: { textAlign: 'center' } }, h('div.mic', { html: ic('mic') }), h('p.muted', 'กำลังฟัง… พูดชื่องาน วิชา และวันส่ง')) : null,
    h('label.flabel', { for: 'add-text' }, photo ? 'ชื่องาน (ยังไม่มีระบบอ่านรูปอัตโนมัติ)' : 'งานที่ต้องทำ'), ta);
  const next = h('button.btn.primary', { onclick: () => { rec?.stop(); review(ta.value, photo); } }, 'ตรวจสอบก่อนบันทึก');
  openModal(kind === 'voice' ? 'พูดงาน' : photo ? 'งานจากรูป' : 'พิมพ์งาน', body, next, () => rec?.abort());
  if (kind === 'voice') rec = listen(t => { ta.value = t; }, () => {});
  else setTimeout(() => ta.focus(), 320);
}
function review(text, photo) {
  const drafts = draftsFromText(text, { now: new Date(), subjects: db.subjects });
  if (!drafts.length) { if (!photo) return toast('ยังไม่ได้พิมพ์อะไรเลย'); drafts.push({ title: 'งานจากรูป', subject_id: null, type: 'homework', due_date: null, due_time: null, flags: { noSubject: true, noDate: true } }); }
  const rows = drafts.map((d, i) => {
    const title = h('input.field', { value: d.title, 'aria-label': `ชื่องานที่ ${i + 1}` });
    const sub = h('select.field', { 'aria-label': 'วิชา' }, subjOptions(d.subject_id));
    const date = h('input.field', { type: 'date', value: d.due_date || '', 'aria-label': 'วันส่ง' });
    const time = h('input.field', { type: 'time', value: d.due_time || '', 'aria-label': 'เวลาส่ง' });
    const warn = [d.flags?.noSubject && 'ไม่รู้วิชา', d.flags?.noDate && 'ไม่รู้วันส่ง', d.flags?.noTime && 'ไม่ได้บอกเวลา — จะไม่เดาให้'].filter(Boolean);
    const el = h('div.draft', title, h('div', { style: { marginTop: '8px' } }, sub), h('div.frow', { style: { marginTop: '8px' } }, date, time), warn.length ? h('p.warn', warn.join(' · ')) : null);
    return { el, get: () => ({ title: title.value.trim(), subject_id: sub.value || null, due_date: date.value || null, due_time: time.value || null, type: d.type || 'homework' }) };
  });
  const saveBtn = h('button.btn.primary', {
    onclick: () => {
      const items = rows.map(r => r.get()).filter(x => x.title);
      if (!items.length) return toast('ใส่ชื่องานก่อนนะ');
      saveBtn.disabled = true; // กันกดสองที
      const added = items.map((x, i) => ({ id: uid('t'), ...x, est: null, status: 'todo', notes: photo && i === 0 ? [{ id: uid('n'), kind: 'photo', src: photo, at: new Date().toISOString() }] : [] }));
      db.tasks.push(...added); save(); closeModal(); refresh();
      toast(`บันทึก ${added.length} งานแล้ว`, { label: 'ดูโน้ต', fn: () => openNotes(added[0].id) });
    },
  }, `บันทึก ${rows.length} งาน`);
  openModal('ตรวจสอบก่อนบันทึก', h('div', rows.map(r => r.el)), [h('button.btn.ghost', { onclick: () => addTask('text', text) }, 'แก้ข้อความ'), saveBtn]);
}

/** เพิ่มโน้ตให้งาน: photo · text · voice · pick (ให้เลือก) */
async function addNote(id, kind) {
  const t = task(id); if (!t) return;
  if (kind === 'pick') return openModal('เพิ่มโน้ต', h('div.pills', { style: { flexDirection: 'column' } },
    h('button.pill', { onclick: () => addNote(id, 'camera'), html: ic('camera') + 'ถ่ายรูป' }),
    h('button.pill', { onclick: () => addNote(id, 'photo'), html: ic('img') + 'เลือกรูป' }),
    h('button.pill', { onclick: () => addNote(id, 'text'), html: ic('text') + 'จดข้อความ' }),
    h('button.pill', { onclick: () => addNote(id, 'voice'), html: ic('mic') + 'พูดเป็นข้อความ' })));
  if (kind === 'photo' || kind === 'camera') {
    closeModal();
    const f = await pickFile(kind === 'camera'); if (!f) return;
    try { t.notes.push({ id: uid('n'), kind: 'photo', src: await shrink(f), at: new Date().toISOString() }); } catch (e) { return toast(e.message); }
    save(); refresh(); toast('เพิ่มรูปแล้ว'); return;
  }
  if (kind === 'voice' && !SR) { toast('เครื่องนี้ใช้พูดไม่ได้ — จดแทนนะ'); kind = 'text'; }
  const ta = h('textarea.field', { id: 'note-text', placeholder: 'ครูบอกอะไร? จำอะไรไว้? เช่น "ทำแค่ข้อคี่"' });
  let rec = null;
  openModal(`โน้ต · ${fullTitle(t)}`, h('div', kind === 'voice' ? h('div', { style: { textAlign: 'center' } }, h('div.mic', { html: ic('mic') }), h('p.muted', 'กำลังฟัง…')) : null, ta),
    h('button.btn.primary', { onclick: () => { rec?.stop(); const v = ta.value.trim(); if (!v) return toast('ยังว่างอยู่'); t.notes.push({ id: uid('n'), kind: 'sticky', text: v, at: new Date().toISOString() }); save(); closeModal(); refresh(); toast('จดโน้ตแล้ว'); } }, 'บันทึกโน้ต'),
    () => rec?.abort());
  if (kind === 'voice') rec = listen(v => { ta.value = v; }, () => {}); else setTimeout(() => ta.focus(), 320);
}

function editTask(id) {
  const t = task(id);
  const title = h('input.field', { id: 'e-title', value: t.title });
  const sub = h('select.field', { id: 'e-subj' }, subjOptions(t.subject_id));
  const date = h('input.field', { type: 'date', id: 'e-date', value: t.due_date || '' });
  const time = h('input.field', { type: 'time', id: 'e-time', value: t.due_time || '' });
  const est = h('input.field', { type: 'number', id: 'e-est', min: 5, step: 5, value: t.est ? String(t.est) : '', placeholder: 'ไม่ระบุ' });
  const exam = h('input', { type: 'checkbox', id: 'e-exam', checked: t.type === 'exam' });
  openModal('แก้ไขงาน', h('div',
    h('label.flabel', { for: 'e-title' }, 'ชื่องาน'), title, h('label.flabel', { for: 'e-subj' }, 'วิชา'), sub,
    h('div.frow', h('div', h('label.flabel', { for: 'e-date' }, 'วันส่ง'), date), h('div', h('label.flabel', { for: 'e-time' }, 'เวลา'), time)),
    h('div.frow', h('div', h('label.flabel', { for: 'e-est' }, 'ใช้เวลาประมาณ (นาที)'), est), h('label.flabel', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '36px' } }, exam, 'เป็นการสอบ')),
    t.notes.length ? h('div', h('label.flabel', `โน้ต ${t.notes.length} รายการ`), h('div.strip', t.notes.map(n => h('div', { style: { position: 'relative' } }, mini(n, 96, 128),
      h('button.fab', { style: { position: 'absolute', right: '4px', top: '4px', width: '28px', height: '28px' }, 'aria-label': 'ลบโน้ตนี้', html: ic('trash'), onclick: () => { t.notes = t.notes.filter(x => x !== n); save(); refresh(); editTask(id); } }))))) : null),
  [h('button.btn.danger', { onclick: () => { const i = db.tasks.indexOf(t); db.tasks.splice(i, 1); save(); closeModal(); refresh(); toast('ลบงานแล้ว', { label: 'กู้คืน', fn: () => { db.tasks.splice(i, 0, t); save(); refresh(); } }); } }, 'ลบ'),
   h('button.btn.primary', { onclick: () => { if (!title.value.trim()) return toast('ใส่ชื่องานก่อนนะ'); Object.assign(t, { title: title.value.trim(), subject_id: sub.value || null, due_date: date.value || null, due_time: time.value || null, est: +est.value || null, type: exam.checked ? 'exam' : (t.type === 'exam' ? 'homework' : t.type) }); save(); closeModal(); refresh(); toast('บันทึกแล้ว'); } }, 'บันทึก')]);
}
/** ภาพย่อแบบ Canva: วาดโน้ตจริงขนาดเต็ม (กว้าง 300) แล้วย่อลงทั้งแผ่น — สัดส่วนตัวหนังสือเหมือนของจริง ไม่ใช่ข้อความยัดกล่อง */
const MINI_W = 300;
function mini(n, w, hgt, cls = '') {
  const k = w / MINI_W, inner = h('div.mini-in', { style: { width: MINI_W + 'px', height: Math.round(hgt / k) + 'px', transform: `scale(${k})` } }, noteEl(n, 0));
  return h('div.mini' + cls, { style: { width: w + 'px', height: hgt + 'px' }, 'aria-hidden': 'true' }, inner);
}
/** ปกการ์ดวิชา: โน้ตล่าสุด 1–2 แผ่นวางซ้อนเอียงบนพื้นสีวิชา */
function cover(notes, s) {
  // แผ่นหลัง = รูป/กระดาน/ใบงานแผ่นแรก (เห็นว่าวิชานี้มีอะไร) · แผ่นหน้า = โน้ตล่าสุด
  const main = notes.find(n => n.kind !== 'sticky'), latest = notes[notes.length - 1];
  const last = [...new Set([main || notes[notes.length - 2], latest].filter(Boolean))];
  return h('div.cover', { style: { background: s.tint } },
    last.length ? last.map((n, i) => mini(n, 82, 108, last.length === 2 ? (i ? '.front' : '.back') : '.solo'))
      : h('div.cover-empty', badge(s), h('small', 'ยังไม่มีโน้ต')));
}

/* ---------------- หน้า "งาน" ---------------- */
const page = $('#page');
const tv = { calOpen: false, cursor: null, sel: null, filter: 'all' };
const FILTERS = { all: 'ทั้งหมด', soon: 'ใกล้ส่ง', exam: 'สอบ', done: 'เสร็จแล้ว' };
function marksByDay() {
  const m = {};
  for (const t of db.tasks) if (t.due_date && t.status !== 'done') (m[t.due_date] ||= { ex: 0, hw: 0 })[t.type === 'exam' ? 'ex' : 'hw']++;
  return m;
}
function calDays() {
  const t = today();
  if (!tv.calOpen) { const start = addDaysYMD(t, -fromYMD(t).getDay()); return { days: Array.from({ length: 14 }, (_, i) => addDaysYMD(start, i)), month: null }; }
  const c = tv.cursor || t.slice(0, 7), [y, m] = c.split('-').map(Number);
  const first = new Date(y, m - 1, 1), start = addDaysYMD(toYMD(first), -first.getDay());
  const weeks = Math.ceil((first.getDay() + new Date(y, m, 0).getDate()) / 7);
  return { days: Array.from({ length: weeks * 7 }, (_, i) => addDaysYMD(start, i)), month: m };
}
function renderTasks() {
  const t = today(), cur = fromYMD(tv.cursor ? tv.cursor + '-01' : t);
  const marks = marksByDay(), { days, month } = calDays();
  const cal = h('section.cal', { 'aria-label': 'ปฏิทิน' },
    tv.calOpen ? h('div.nav2',
      h('button', { 'aria-label': 'เดือนก่อน', html: ic('left'), onclick: () => { shiftMonth(-1); } }),
      `${MONTH_LONG[cur.getMonth()]} ${beYear(cur.getFullYear())}`,
      h('button', { 'aria-label': 'เดือนถัดไป', html: ic('right'), onclick: () => { shiftMonth(1); } })) : null,
    h('div.dow', DOW_SHORT.map(d => h('span', d.replace('.', '')))),
    h('div.days', days.map(d => {
      const k = marks[d], dd = fromYMD(d);
      return h('button.day' + (d === t ? '.today' : '') + (d === tv.sel ? '.sel' : '') + (month && dd.getMonth() + 1 !== month ? '.out' : ''),
        { onclick: () => { tv.sel = tv.sel === d ? null : d; renderTasks(); }, 'aria-label': `${dd.getDate()} ${MONTH_LONG[dd.getMonth()]}${k ? ` · ${k.ex + k.hw} งาน` : ''}` },
        String(dd.getDate()), h('span.dots', k?.ex ? h('i.ex') : null, k?.hw ? h('i.hw') : null));
    })),
    h('div.foot', h('span.lg', h('span', h('i', { style: { background: 'var(--error)' } }), 'สอบ'), h('span', h('i', { style: { background: 'var(--blue)' } }), 'งานส่ง')),
      h('button', { onclick: toggleCal }, tv.calOpen ? 'ย่อเหลือ 2 สัปดาห์' : 'ดูทั้งเดือน')),
    h('button.bar', { 'aria-label': tv.calOpen ? 'ย่อปฏิทิน' : 'ขยายปฏิทิน', onclick: toggleCal }));
  // ลากแถบใต้ปฏิทินลง = ขยาย · ขึ้น = ย่อ
  let y0 = null;
  cal.addEventListener('pointerdown', e => { y0 = e.clientY; });
  cal.addEventListener('pointerup', e => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; if (dy > 40 && !tv.calOpen) toggleCal(); else if (dy < -40 && tv.calOpen) toggleCal(); });

  const dayList = tv.sel ? (() => {
    const items = db.tasks.filter(x => x.due_date === tv.sel);
    return h('div.daylist', h('h3', `${relDay(tv.sel, t)} · ${items.length ? items.length + ' งาน' : 'ว่าง'}`),
      h('ul.tlist', items.map(x => h('li.trow', h('button.main', { onclick: () => x.status === 'done' ? editTask(x.id) : openNotes(x.id) }, badge(subj(x.subject_id)), h('div', h('b', fullTitle(x)), h('small', x.status === 'done' ? 'เสร็จแล้ว' : dueLine(x))))))));
  })() : null;

  const pick = x => tv.filter === 'all' ? x.status !== 'done' : tv.filter === 'done' ? x.status === 'done'
    : tv.filter === 'exam' ? x.type === 'exam' && x.status !== 'done' : x.status !== 'done' && x.due_date && daysBetween(t, x.due_date) <= 3;
  const cards = [...db.subjects, { id: '' }].map(s => {
    const all = db.tasks.filter(x => (x.subject_id || '') === s.id), list = all.filter(pick).sort((a, b) => dueSortKey(a) - dueSortKey(b));
    if (!list.length) return null;
    const ss = subj(s.id), notes = all.flatMap(x => x.notes), first = list[0], d = dueInfo(first);
    return h('button.proj', { onclick: () => { location.hash = '#/subject/' + (s.id || 'none'); } },
      cover(notes, ss),
      h('div.ph', h('b', ss.name.replace(/^ภาษา/, '')), h('span.cnt', { style: { background: ss.tint, color: ss.color } }, `${list.length} งาน`)),
      h('small', tv.filter === 'done' ? first.title : [d.urgent ? h('em', first.title) : first.title, ' · ', d.text]));
  }).filter(Boolean);

  page.replaceChildren(
    h('div.phead', h('h1', 'งาน'),
      h('button.monthchip', { onclick: toggleCal, 'aria-expanded': String(tv.calOpen), html: ic('cal') + `<span>${MONTH_SHORT[cur.getMonth()]} ${beYear(cur.getFullYear())}</span>` + ic(tv.calOpen ? 'up' : 'down') }),
      h('button.iconbtn', { 'aria-label': 'ค้นหางาน', html: ic('search'), onclick: () => { location.hash = '#/home'; setSnap(2); setTimeout(() => $('#home-q')?.focus(), 350); } })),
    ...[cal, dayList].filter(Boolean),
    h('div.filters', Object.entries(FILTERS).map(([k, v]) => h('button', { 'aria-pressed': String(tv.filter === k), onclick: () => { tv.filter = k; renderTasks(); } }, v))),
    cards.length ? h('div.grid', cards, h('button.proj.new', { onclick: () => addTask('text') }, '+ งานใหม่')) : h('div.empty-note', tv.filter === 'done' ? 'ยังไม่มีงานที่เสร็จ' : 'ไม่มีงานในหมวดนี้'),
  );
}
function toggleCal() { tv.calOpen = !tv.calOpen; if (!tv.calOpen) tv.cursor = null; renderTasks(); }
function shiftMonth(n) { const c = fromYMD((tv.cursor || today().slice(0, 7)) + '-01'); c.setMonth(c.getMonth() + n); tv.cursor = toYMD(c).slice(0, 7); renderTasks(); }

/* ---------------- หน้าวิชา (โปรเจกต์) ---------------- */
function renderSubject(id) {
  const sid = id === 'none' ? '' : id, s = subj(sid);
  const list = db.tasks.filter(x => (x.subject_id || '') === sid).sort((a, b) => (a.status === 'done') - (b.status === 'done') || dueSortKey(a) - dueSortKey(b));
  page.replaceChildren(
    h('div.phead', h('button.iconbtn', { 'aria-label': 'กลับหน้างาน', html: ic('back'), onclick: () => { location.hash = '#/tasks'; } }),
      badge(s), h('h1', { style: { fontSize: '24px' } }, s.name)),
    h('p.muted', { style: { marginBottom: '12px' } }, `${list.filter(x => x.status !== 'done').length} งานค้าง · โน้ต ${list.reduce((n, x) => n + x.notes.length, 0)} รายการ`),
    h('div.board', list.map(t => h('article.tcard' + (t.status === 'done' ? '.done' : ''),
      h('div.top', h('div', h('b', t.title), h('small.muted', { style: { display: 'block' } }, t.status === 'done' ? 'เสร็จแล้ว' : dueLine(t))),
        h('button.iconbtn', { 'aria-label': 'แก้ไขงาน', html: ic('edit'), onclick: () => editTask(t.id) })),
      h('div.strip', t.notes.map(n => mini(n, 96, 128)), h('button.s-add', { 'aria-label': 'เพิ่มโน้ต', onclick: () => addNote(t.id, 'pick') }, '+')),
      t.status !== 'done' ? h('div.row-actions', h('button', { onclick: () => openNotes(t.id) }, 'เปิดโน้ตเต็มจอ'), h('button', { onclick: () => finish(t.id) }, 'เสร็จแล้ว')) : null)),
      h('button.proj.new', { style: { minHeight: '64px' }, onclick: () => addTask('text', s.id ? s.name.replace(/^ภาษา/, '') + ' ' : '') }, `+ เพิ่มงาน${s.id ? 'วิชานี้' : ''}`)),
  );
}

/* ---------------- หน้า "ฉัน" ---------------- */
function renderMe() {
  const t = today(), weekAgo = addDaysYMD(t, -6);
  const doneWeek = db.tasks.filter(x => x.status === 'done' && x.done_at && toYMD(new Date(x.done_at)) >= weekAgo).length;
  const exam = open().filter(x => x.type === 'exam' && x.due_date >= t).sort((a, b) => dueSortKey(a) - dueSortKey(b))[0];
  const name = h('input.field', { value: db.prefs.name || '', placeholder: 'ชื่อเล่น', 'aria-label': 'ชื่อเล่น', onchange: e => { db.prefs.name = e.target.value.trim(); save(); renderHome(); } });
  page.replaceChildren(
    h('div.phead', h('h1', 'ฉัน')),
    h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } }, h('span.avatar', { style: { width: '56px', height: '56px', fontSize: '22px' } }, (db.prefs.name || 'น')[0]), name),
    h('div.stats',
      h('div.stat', h('b', String(open().length)), h('small', 'งานค้าง')),
      h('div.stat', h('b', String(doneWeek)), h('small', 'เสร็จ 7 วันนี้')),
      h('div.stat', h('b', exam ? String(Math.max(0, daysBetween(t, exam.due_date))) : '—'), h('small', exam ? `วันถึงสอบ${subj(exam.subject_id).short}` : 'ยังไม่มีสอบ'))),
    h('button.list-btn', { html: ic('moon') + '<span>สลับธีมสว่าง / มืด</span>', onclick: () => { const r = document.documentElement; r.dataset.theme = (r.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark' ? 'light' : 'dark'; db.prefs.theme = r.dataset.theme; save(); } }),
    h('button.list-btn', { html: ic('reset') + '<span>รีเซ็ตเป็นข้อมูลตัวอย่าง</span>', onclick: () => { if (!confirm('ลบข้อมูลในโครงนี้ทั้งหมดแล้วใช้ตัวอย่างใหม่?')) return; db = seed(); save(); refresh(); toast('รีเซ็ตแล้ว'); } }),
    h('p.muted', { style: { marginTop: '16px' } }, 'นี่คือโครงทดลอง — ข้อมูลอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น แยกจากแอป SABAii หลัก'),
  );
}

/* ---------------- เมนูล่าง + เส้นทาง ---------------- */
const nav = $('#nav');
const NAV = { home: ['home', 'หน้าหลัก'], tasks: ['tasks', 'งาน'], me: ['me', 'ฉัน'] };
nav.querySelectorAll('a').forEach(a => { const [i, l] = NAV[a.dataset.r]; a.innerHTML = ic(i) + `<span>${l}</span>`; });
function route() { const [, name = 'home', arg] = (location.hash || '#/home').split('/'); return { name: name || 'home', arg }; }
let navAway = false;
function updateNav() {
  const r = route(), here = r.name === 'subject' ? 'tasks' : r.name;
  nav.classList.toggle('away', navAway || (r.name === 'home' && document.body.classList.contains('note-mode')));
  nav.querySelectorAll('a').forEach(a => { if (a.dataset.r === here) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
}
// เมนูล่างหลบเองเวลาเลื่อนลง โผล่กลับเวลาเลื่อนขึ้น
function autoHide(el) {
  let last = 0;
  el.addEventListener('scroll', () => {
    const y = el.scrollTop, dy = y - last; last = y;
    if (Math.abs(dy) < 4) return;
    const away = dy > 0 && y > 40;
    if (away !== navAway) { navAway = away; updateNav(); }
  }, { passive: true });
}
autoHide(page); autoHide(paneHome);

function renderPage() {
  const r = route();
  navAway = false;
  page.hidden = r.name === 'home';
  if (r.name === 'tasks') renderTasks();
  else if (r.name === 'me') renderMe();
  else if (r.name === 'subject') renderSubject(r.arg);
  if (!page.hidden) page.scrollTop = 0;
  updateNav();
}
function refresh() {
  renderHome(); renderStage();
  const r = route();
  if (r.name === 'tasks') renderTasks(); else if (r.name === 'me') renderMe(); else if (r.name === 'subject') renderSubject(r.arg);
}
addEventListener('hashchange', renderPage);

/* ---------------- เริ่ม ---------------- */
if (db.prefs.theme) document.documentElement.dataset.theme = db.prefs.theme;
renderHome(); renderStage(); setSnap(2); renderPage();
window.__shell = { db: () => db, setSnap, goPage, openNotes, state: () => ({ cur, pages: [...pages], snapIdx, noteMode: document.body.classList.contains('note-mode') }) };
