// 3 หน้าหลัก: หน้าหลัก · งาน · ฉัน
import { h, ICON, toast, confirmBox, subjectBadge, clear, put } from '../ui/dom.js';
import { openSheet } from '../ui/sheet.js';
import { toYMD, dueLabel, daysBetween, monthGrid, twoWeeks, fromYMD, MONTH_LONG, beYear, fullThaiDate, relDay, addDaysYMD, DOW_SHORT } from '../domain/dates.js';
import { recommend, applyFilter, search, summary, dayMarks, nextExam, FILTERS, isLive, TYPES } from '../domain/tasks.js';
import { openAdd } from './add.js';
import { openDetail } from './detail.js';
import { SUBJECT_COLORS } from '../data/store.js';

let store;
export const ui = { homeSnap: 'mid', peekIdx: 0, tasksView: 'subjects', subjectFilter: null, calOpen: false, calMonth: false, calSel: null, calCursor: null, homeLimit: 6, q: '' };
export function initViews(s) { store = s; }
const today = () => toYMD(new Date());
const thumbCache = new Map();
const thumbUrl = a => thumbCache.get(a.id) || (thumbCache.set(a.id, URL.createObjectURL(a.blob)), thumbCache.get(a.id));

export function taskCard(t, opts = {}) {
  const subj = store.subjectsById()[t.subject_id];
  const td = today();
  const n = t.due_date ? daysBetween(td, t.due_date) : null;
  const cls = t.status === 'done' ? '' : n != null && n < 0 ? 'late' : n != null && n <= 1 ? 'soon' : '';
  return h('div.card', { role: 'listitem' },
    subjectBadge(subj),
    h('button.tx', { style: { textAlign: 'left' }, onclick: () => openDetail(t.id), 'aria-label': `${subj?.name || 'ไม่ระบุวิชา'} ${t.title} ${dueLabel(t, td)}` },
      h('b', t.type === 'exam' && h('span.pill.exam', 'สอบ'), t.status === 'doing' && h('span.pill.doing', 'กำลังทำ'), t.status === 'done' && h('span.pill.done', 'เสร็จ'), t.title),
      h('span', { class: cls }, (subj ? subj.name + ' · ' : '') + dueLabel(t, td))),
    !opts.noGo && t.status !== 'done' && h('button.go', { onclick: () => openDetail(t.id) }, 'ทำเลย'));
}

// ---------------- หัวหน้าเหมือนกันทุกหน้า: โลโก้ + ชื่อหน้า ----------------
export function pageHead(title, { right, left } = {}) {
  return [
    h('div.lockup', h('div.mark', { role: 'img', 'aria-label': 'SABAii.com' }, h('span', { html: ICON.cap }), h('b', 'SABAii', h('span', '.com'))), h('div.tag', 'จัดการงานเรียนให้ง่ายขึ้น')),
    h('div.pagetitle', left && h('span.sideL', left), h('h1', title), right && h('span.side', right)),
  ];
}
function notifSheet() {
  const exam = nextExam(store.state.tasks, today());
  const due = recommend(store.state.tasks).filter(t => t.due_date && daysBetween(today(), t.due_date) <= 1);
  openSheet({ title: 'แจ้งเตือนในแอป', state: 'compact', body: h('div',
    h('p.hint', 'การแจ้งเตือนตอนปิดแอป (push) ยังไม่เปิดในรุ่นนี้ — ตอนนี้แสดงเฉพาะในแอป'),
    !due.length && !exam ? h('div.empty', { style: { marginTop: '10px' } }, h('b', 'ไม่มีอะไรด่วน'), 'ไม่มีงานครบกำหนดภายในพรุ่งนี้')
      : h('div.tlist', { style: { marginTop: '10px' } }, due.map(taskRow), exam && !due.includes(exam) && taskRow(exam))) });
}
const bellBtn = () => h('button.iconbtn', { 'aria-label': 'การแจ้งเตือน', onclick: notifSheet, html: ICON.bell });

export function taskRow(t) {
  const subj = store.subjectsById()[t.subject_id];
  const td = today();
  const n = t.due_date ? daysBetween(td, t.due_date) : null;
  const cls = n != null && n < 0 ? 'late' : n != null && n <= 1 ? 'soon' : '';
  const color = subj?.color || '#94A3B8';
  return h('div.trow', { role: 'listitem' },
    h('span.doc', { style: { background: color + '1F', color }, html: ICON.doc }),
    h('button.tx', { onclick: () => openDetail(t.id), 'aria-label': `${subj?.name || 'ไม่ระบุวิชา'} ${t.title} ${dueLabel(t, td)}` },
      h('b', t.source === 'sample' && h('span.pill.sample', 'ตัวอย่าง'), t.type === 'exam' && h('span.pill.exam', 'สอบ'), t.status === 'doing' && h('span.pill.doing', 'กำลังทำ'), `${subj ? subj.name.replace(/^ภาษา/, '') + ' · ' : ''}${t.title}`),
      h('span', { class: cls }, dueLabel(t, td))),
    h('button.go', { onclick: () => openDetail(t.id) }, 'ทำเลย'));
}

// ---------------- หน้าหลัก ----------------
// แผ่นขาวลากตามนิ้วได้ 3 จุดพัก: บนสุด (เต็มจอ) · กลาง (ใต้หัวโลโก้) · ล่าง (เหลือแถบ "จะเริ่มงานไหน?" แล้วเห็นโน้ตหน้างานด้านบน)
// ไม่ต้องกดอะไร ลากที่จับหรือหัวแผ่นได้เลย (เจ้าของขอ 16 พ.ย. 69)
export function homeView(root) {
  const quick = [['speak', 'mic', 'พูด'], ['attach', 'image', 'แนบรูป'], ['type', 'pen', 'พิมพ์'], ['camera', 'camera', 'ถ่ายรูป']];
  const input = h('input', { type: 'search', id: 'home-search', placeholder: 'ค้นหา', value: ui.q, 'aria-label': 'ค้นหางาน', oninput: e => { ui.q = e.target.value; ui.homeLimit = 6; renderList(); } });
  const listBox = h('div');
  const rec = () => search(recommend(store.state.tasks), ui.q, store.subjectsById());

  function renderList() {
    const r = rec(); const items = r.slice(0, ui.homeLimit);
    put(listBox, !items.length
      ? h('div.empty', h('b', ui.q ? 'ไม่เจองานที่ค้นหา' : 'วันนี้ยังไม่มีงานที่ต้องทำ'), ui.q ? 'ลองค้นด้วยชื่อวิชา' : 'มีงานใหม่เมื่อไหร่ กดปุ่มด้านบนได้เลย',
          !ui.q && h('div.row', { style: { marginTop: '12px', justifyContent: 'center' } },
            h('button.btn.blue', { style: { flex: 'none' }, onclick: () => openAdd('menu') }, '+ เพิ่มงานใหม่'),
            !store.state.tasks.some(t => t.source === 'sample') && h('button.btn.ghost', { style: { flex: 'none' }, onclick: addSamples }, 'ลองใส่งานตัวอย่าง')))
      : h('div', h('div.tlist', { role: 'list' }, items.map(taskRow)),
          r.length > items.length && h('button.more', { onclick: () => { ui.homeLimit += 10; renderList(); } }, `ดูอีก ${Math.min(10, r.length - items.length)} งาน`)));
  }

  const grip = h('div.grip', { role: 'slider', tabindex: '0', 'aria-label': 'ลากแผ่นขึ้นลง', 'aria-valuetext': ui.homeSnap },
    h('i'));
  const where = h('div.where-wrap.pad', h('div.where', h('span', { html: ICON.search }),
    h('button.q', { onclick: () => snapTo('mid', () => document.getElementById('home-search')?.focus()) }, 'จะเริ่มงานไหน?'),
    h('button.other', { onclick: () => openAdd('menu') }, 'อื่นๆ')));
  const scroller = h('div.scroller.pad',
    store.state.dbKind === 'memory' && h('p.storage-warn', 'เบราว์เซอร์นี้ไม่ให้เก็บข้อมูลถาวร — ปิดแอปแล้วงานจะหาย'),
    h('div.bar-title', h('h2', 'เพิ่มงานหลายอย่าง หลายครั้ง หลายเวลา')),
    h('div.qgrid2', quick.map(([k, ic, label]) => h('button.qb', { onclick: () => openAdd(k) }, h('span.ic', { html: ICON[ic] }), h('b', label)))),
    h('div.bar-title', h('h2', 'งานแนะนำวันนี้'), h('label.mini-search', h('span', { html: ICON.search }), input)),
    listBox);
  const sheet = h('section.hsheet', { 'aria-label': 'เพิ่มงานและงานวันนี้' }, grip, where, scroller);
  const head = h('div.hhead', h('div.bellpos', bellBtn()), pageHead('หน้าแรก'));
  const peekBox = h('div.peek');
  const home = h('div.home', head, peekBox, sheet);
  put(root, home);
  renderList();
  renderPeek();

  // ---- จุดพักของแผ่น ----
  const snaps = () => {
    const H = home.clientHeight;
    return { top: 0, mid: Math.min(head.offsetHeight, H - 200), bottom: Math.max(0, H - 112) };
  };
  function place(y, animate) {
    sheet.style.transition = animate ? 'transform .28s cubic-bezier(.2,.8,.2,1)' : 'none';
    sheet.style.transform = `translateY(${y}px)`;
    const s = snaps();
    home.dataset.snap = y >= s.bottom - 4 ? 'bottom' : y <= s.top + 4 ? 'top' : 'mid';
    sheet.style.height = `${home.clientHeight - y}px`;
  }
  function snapTo(name, after) {
    ui.homeSnap = name;
    place(snaps()[name], true);
    grip.setAttribute('aria-valuetext', name);
    if (name === 'bottom') renderPeek();
    if (after) setTimeout(after, 300);
  }
  requestAnimationFrame(() => place(snaps()[ui.homeSnap] ?? snaps().mid, false));
  const onResize = () => { if (!home.isConnected) return window.removeEventListener('resize', onResize); place(snaps()[ui.homeSnap], false); };
  window.addEventListener('resize', onResize);

  // ---- ลากตามนิ้ว: จับที่ที่จับ แถบ "จะเริ่มงานไหน?" หรือหัวข้อแรก · ในรายการลากได้เมื่อเลื่อนอยู่บนสุดแล้วดึงลง ----
  let drag = null;
  const startY = () => new DOMMatrixReadOnly(getComputedStyle(sheet).transform).m42;
  sheet.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    const onHandle = e.target.closest('.grip, .where-wrap') && !e.target.closest('button');
    const inList = !onHandle && e.target.closest('.scroller');
    if (!onHandle && !(inList && scroller.scrollTop <= 0)) return;
    drag = { y0: e.clientY, s0: startY(), t0: performance.now(), moved: false, id: e.pointerId, soft: !onHandle };
    if (onHandle) { try { sheet.setPointerCapture(e.pointerId); } catch {} } // แผ่นเตี้ย นิ้วหลุดออกนอกแผ่นตั้งแต่ขยับแรก
  });
  sheet.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moved) {
      if (Math.abs(dy) < 6) return;
      if (drag.soft && dy < 0) { drag = null; return; } // ในรายการ ลากขึ้น = เลื่อนรายการตามปกติ
      drag.moved = true;
      try { sheet.setPointerCapture(e.pointerId); } catch {}
    }
    e.preventDefault();
    const s = snaps();
    place(Math.min(s.bottom, Math.max(s.top, drag.s0 + dy)), false);
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (!d.moved) return;
    const y = startY(), s = snaps();
    const v = (e.clientY - d.y0) / Math.max(1, performance.now() - d.t0); // px/ms
    // ปล่อยตรงไหนไปจุดพักที่ใกล้สุด · ปัดเร็วระยะสั้น ไปจุดถัดไปตามทิศ
    let target = Object.entries(s).sort((a, b) => Math.abs(a[1] - y) - Math.abs(b[1] - y))[0][0];
    const dist = Math.abs(e.clientY - d.y0);
    if (dist < 160 && v > 0.5) target = d.s0 < s.mid - 4 ? 'mid' : 'bottom';
    if (dist < 160 && v < -0.5) target = d.s0 > s.mid + 4 ? 'mid' : 'top';
    snapTo(target);
  };
  sheet.addEventListener('pointerup', end);
  sheet.addEventListener('pointercancel', end);
  grip.addEventListener('keydown', e => {
    const order = ['top', 'mid', 'bottom'];
    const i = order.indexOf(ui.homeSnap);
    if (e.key === 'ArrowDown' && i < 2) { e.preventDefault(); snapTo(order[i + 1]); }
    if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); snapTo(order[i - 1]); }
  });

  // ---- ด้านบนเมื่อแผ่นลงล่าง: โน้ตหน้างานของงานที่ควรทำก่อน · ปัดหรือกดลูกศรไปงานถัดไป ----
  function renderPeek() {
    const list = recommend(store.state.tasks);
    if (!list.length) return put(peekBox, h('div.board', h('div.none', h('b', 'ยังไม่มีงาน'), 'เพิ่มงานจากปุ่ม "อื่นๆ" ด้านล่าง')));
    ui.peekIdx = Math.min(ui.peekIdx || 0, list.length - 1);
    const t = list[ui.peekIdx];
    const subj = store.subjectsById()[t.subject_id];
    const notes = store.attachmentsOf(t.id);
    const img = notes.find(a => a.kind === 'image' && a.blob);
    const txt = notes.find(a => a.kind === 'text');
    const go = d => { const n = ui.peekIdx + d; if (n >= 0 && n < list.length) { ui.peekIdx = n; renderPeek(); } };
    const board = h('div.board', { 'aria-label': 'โน้ตหน้างาน' },
      img ? h('img', { src: thumbUrl(img), alt: `โน้ตของ ${t.title}` }) : txt ? h('div.stick', txt.text)
        : h('div.none', h('b', 'ยังไม่มีโน้ตหน้างาน'), 'แนบรูปใบงาน รูปกระดาน หรือจดสิ่งที่ครูบอก'),
      notes.length > 1 && h('span.more-notes', `โน้ต ${notes.length}`),
      h('div.pager', h('button', { 'aria-label': 'งานก่อนหน้า', disabled: ui.peekIdx === 0, onclick: () => go(-1), html: ICON.up }),
        h('button', { 'aria-label': 'งานถัดไป', disabled: ui.peekIdx >= list.length - 1, onclick: () => go(1), html: ICON.down })));
    let sy = null;
    board.addEventListener('pointerdown', e => { if (!e.target.closest('button')) sy = e.clientY; });
    board.addEventListener('pointerup', e => { if (sy == null) return; const dy = e.clientY - sy; sy = null; if (dy < -50) go(1); else if (dy > 50) go(-1); });
    put(peekBox,
      h('div.ph', subjectBadge(subj), h('div.tx', h('b', t.title), h('span', `${subj?.name || 'ไม่ระบุวิชา'} · ${dueLabel(t, today())}`))),
      board,
      h('div.count', `งานที่ ${ui.peekIdx + 1} จาก ${list.length} · เรียงตามที่ควรทำก่อน`),
      h('div.acts', h('button.btn', { onclick: () => openDetail(t.id) }, notes.length ? 'ดูโน้ตทั้งหมด' : '+ เพิ่มโน้ต'), h('button.btn.green', { onclick: () => openDetail(t.id) }, 'ทำเลย')));
  }

  async function addSamples() {
    await store.addSamples();
    toast('ใส่งานตัวอย่าง 6 งานแล้ว — ลบได้ที่หน้า "ฉัน"');
  }
}

// ---------------- หน้างาน ----------------
export function tasksView(root) {
  const s = store.state;
  const td = today();
  const exam = nextExam(s.tasks, td);
  const examTxt = exam ? (daysBetween(td, exam.due_date) === 0 ? 'วันนี้' : `อีก ${daysBetween(td, exam.due_date)} วัน`) : '';
  const calBtn = h('button.calbtn', { 'aria-expanded': String(ui.calOpen), 'aria-controls': 'cal', onclick: () => { ui.calOpen = !ui.calOpen; if (!ui.calOpen) ui.calSel = null; tasksView(root); } },
    h('span', { html: ICON.cal }), ui.calOpen ? 'ปิดปฏิทิน' : exam ? h('span', 'สอบ ', h('em', examTxt)) : 'ปฏิทิน');

  const views = [['subjects', 'ตามวิชา'], ...Object.entries(FILTERS).map(([k, f]) => [k, f.label])];
  const chips = h('div.chips', { role: 'group', 'aria-label': 'มุมมอง' }, views.map(([k, label]) =>
    h('button', { 'aria-pressed': String(ui.tasksView === k && !ui.subjectFilter), onclick: () => { ui.tasksView = k; ui.subjectFilter = null; tasksView(root); } }, label)));
  const searchIn = h('input', { type: 'search', placeholder: 'ค้นหาชื่องาน วิชา รายละเอียด', value: ui.q, 'aria-label': 'ค้นหางาน', oninput: e => { ui.q = e.target.value; renderBody(); } });

  const body = h('div');
  put(root, 
    pageHead('งาน', { right: calBtn }),
    ui.calOpen && calendar(() => tasksView(root)),
    h('label.search', { style: { marginTop: '10px' } }, h('span', { html: ICON.search }), searchIn),
    h('div', { style: { marginTop: '8px' } }, chips),
    body);
  renderBody();

  function renderBody() {
    const by = store.subjectsById();
    if (ui.calOpen && ui.calSel) return put(body, dayPanel(ui.calSel));
    if (ui.calOpen) {
      const upcoming = recommend(s.tasks).filter(t => t.due_date && daysBetween(td, t.due_date) >= 0);
      return put(body, h('div.sec-title', h('h2', 'รายการงานและสอบถัดไป')),
        upcoming.length ? h('div.tlist', { role: 'list' }, upcoming.slice(0, 30).map(t => dateRow(t))) : h('div.empty', h('b', 'ยังไม่มีงานข้างหน้า')));
    }
    if (ui.subjectFilter) {
      const subj = by[ui.subjectFilter];
      const items = search(s.tasks.filter(t => isLive(t) && (t.subject_id || null) === (ui.subjectFilter === '_none' ? null : ui.subjectFilter)), ui.q, by);
      const open = recommend(items), done = items.filter(t => t.status === 'done');
      return put(body, 
        h('div.sec-title', h('h2', subj?.name || 'ไม่ระบุวิชา'), h('button.btn', { style: { height: '36px' }, onclick: () => { ui.subjectFilter = null; tasksView(root); } }, '← ทุกวิชา')),
        open.length ? h('div.tlist', { role: 'list' }, open.map(taskRow)) : h('div.empty', h('b', 'ไม่มีงานค้างในวิชานี้')),
        done.length > 0 && h('div.sec-title', h('h2', 'เสร็จแล้ว'), h('span', `${done.length} งาน`)),
        done.length > 0 && h('div.tlist', { role: 'list' }, done.slice(0, 20).map(taskRow)),
        h('button.btn.blue.block', { style: { marginTop: '12px' }, onclick: () => openAdd('form', { subject_id: subj?.id || null }) }, '+ เพิ่มงานในวิชานี้'));
    }
    if (ui.tasksView === 'subjects' && !ui.q) return put(body, drawers());
    const key = ui.tasksView === 'subjects' ? 'all' : ui.tasksView;
    const items = search(applyFilter(s.tasks, key, td), ui.q, by);
    put(body, items.length ? h('div.tlist', { role: 'list', style: { marginTop: '12px' } }, items.map(taskRow))
      : h('div.empty', { style: { marginTop: '12px' } }, h('b', ui.q ? 'ไม่เจองานที่ค้นหา' : key === 'done' ? 'ยังไม่มีงานที่เสร็จ' : 'ไม่มีงานในมุมมองนี้'), key !== 'done' && !ui.q && h('div', h('button.btn.blue', { onclick: () => openAdd('menu') }, '+ เพิ่มงานใหม่'))));
  }

  function drawers() {
    const by = store.subjectsById();
    const groups = [...s.subjects.filter(x => !x.hidden).sort((a, b) => a.order - b.order), { id: '_none', name: 'ไม่ระบุวิชา', color: '#94A3B8' }];
    const cards = groups.map(g => {
      const items = s.tasks.filter(t => isLive(t) && (t.subject_id || '_none') === g.id && (g.id !== '_none' || !t.subject_id));
      const open = recommend(items);
      if (g.id === '_none' && !items.length) return null;
      const notes = s.attachments.filter(a => items.some(t => t.id === a.task_id)).slice(-2).reverse();
      const thumbs = notes.length ? notes.map(a => a.kind === 'image' && a.blob ? h('span', h('img', { src: thumbUrl(a), alt: '' })) : h('span.t', a.text))
        : [h('span.t', { style: { background: g.color + '1A', color: 'var(--text-2)', display: 'grid', placeItems: 'center', fontSize: '11px' } }, 'ยังไม่มีโน้ต')];
      const next = open[0];
      const late = next?.due_date && daysBetween(td, next.due_date) < 0;
      return h('button.drawer', { onclick: () => { ui.subjectFilter = g.id; tasksView(root); }, 'aria-label': `${g.name} ค้าง ${open.length} งาน` },
        h('div.thumbs', thumbs),
        h('div.nm', h('span.dot', { style: { background: g.color } }), h('b', g.name), open.length > 0 && h('span.cnt', { style: { color: g.color } }, `${open.length} งาน`)),
        h('div.nx', next ? h('span', { class: late ? 'late' : '' }, `${next.title.slice(0, 22)} · ${dueLabel(next, td)}`) : 'ไม่มีงานค้าง'));
    }).filter(Boolean);
    return h('div.drawers', cards);
  }

  function dateRow(t) {
    const d = fromYMD(t.due_date);
    const subj = store.subjectsById()[t.subject_id];
    return h('button.card', { role: 'listitem', onclick: () => openDetail(t.id) },
      h('span', { style: { width: '54px', textAlign: 'center', flex: 'none', background: 'var(--blue-light)', borderRadius: '12px', padding: '6px 0', color: 'var(--blue)' } },
        h('b', { style: { display: 'block', fontSize: '15px' } }, relDay(t.due_date, td).replace(/ \d+ .+$/, '')), h('small', `${d.getDate()} ${MONTH_LONG[d.getMonth()].slice(0, 3)}`)),
      h('span.tx', h('b', t.type === 'exam' && h('span.pill.exam', 'สอบ'), `${subj?.name ? subj.name + ' — ' : ''}${t.title}`),
        h('span', t.due_time ? (t.type === 'exam' ? `เวลา ${t.due_time}${t.end_time ? '–' + t.end_time : ''}` : `ส่งภายใน ${t.due_time}`) : 'ไม่ระบุเวลา')));
  }

  function dayPanel(ymd) {
    const items = s.tasks.filter(t => isLive(t) && t.due_date === ymd);
    const exams = items.filter(t => t.type === 'exam'), others = items.filter(t => t.type !== 'exam');
    const n = daysBetween(td, ymd);
    // ก่อนวันสอบ บอกงานวิชาเดียวกันที่ยังค้างให้ทำก่อน
    const prep = exams.length ? recommend(s.tasks).filter(t => t.type !== 'exam' && exams.some(e => e.subject_id && e.subject_id === t.subject_id) && (!t.due_date || t.due_date <= ymd)) : [];
    return h('div',
      h('div.sec-title', h('h2', fullThaiDate(ymd)), h('span', n === 0 ? 'วันนี้' : n > 0 ? `อีก ${n} วัน` : `${-n} วันก่อน`)),
      !items.length && h('div.empty', h('b', 'ไม่มีงานหรือสอบวันนี้')),
      exams.length > 0 && h('div.tlist', { role: 'list' }, exams.map(t => taskRow(t))),
      others.length > 0 && h('div.tlist', { role: 'list', style: { marginTop: '8px' } }, others.map(t => taskRow(t))),
      prep.length > 0 && h('div.sec-title', h('h2', 'ควรทำก่อนวันนั้น')),
      prep.length > 0 && h('div.tlist', { role: 'list' }, prep.slice(0, 5).map(t => taskRow(t))),
      h('div.row', { style: { marginTop: '12px' } },
        h('button.btn', { onclick: () => openAdd('form', { due_date: ymd }) }, '+ งานวันนี้'),
        h('button.btn', { onclick: () => openAdd('exam', { due_date: ymd }) }, '+ สอบวันนี้')));
  }
}

function calendar(rerender) {
  const td = today();
  const marks = dayMarks(store.state.tasks);
  const cursor = ui.calCursor || td;
  const cd = fromYMD(cursor);
  const cells = ui.calMonth ? monthGrid(cd.getFullYear(), cd.getMonth()) : twoWeeks(cursor);
  const shift = dir => {
    const d = fromYMD(cursor);
    if (ui.calMonth) d.setMonth(d.getMonth() + dir, 1); else d.setDate(d.getDate() + dir * 14);
    ui.calCursor = toYMD(d); rerender();
  };
  const title = ui.calMonth ? `${MONTH_LONG[cd.getMonth()]} ${beYear(cd.getFullYear())}` : `${relDay(cells[0].ymd, td).replace(/^(วันนี้|พรุ่งนี้|เมื่อวาน)$/, m => m)} – ${relDay(cells[13].ymd, td)}`;
  return h('section.cal', { id: 'cal', 'aria-label': 'ปฏิทิน' },
    h('div.ch', h('button', { 'aria-label': 'ก่อนหน้า', onclick: () => shift(-1), html: ICON.left }), h('b', { 'aria-live': 'polite' }, title), h('button', { 'aria-label': 'ถัดไป', onclick: () => shift(1), html: ICON.right })),
    h('div.wk', { role: 'grid' },
      ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'].map(d => h('div.h', { role: 'columnheader' }, d)),
      cells.map(c => {
        const m = marks[c.ymd] || {};
        const label = [fullThaiDate(c.ymd), m.task && `งาน ${m.task}`, m.exam && `สอบ ${m.exam}`, m.done && `เสร็จ ${m.done}`].filter(Boolean).join(' · ');
        return h('button.d' + (c.inMonth ? '' : '.out') + (c.ymd === td ? '.today' : '') + (m.exam > 0 ? '.exam' : ''),
          { role: 'gridcell', 'aria-selected': String(ui.calSel === c.ymd), 'aria-label': label, onclick: () => { ui.calSel = ui.calSel === c.ymd ? null : c.ymd; rerender(); } },
          c.day, h('span.m', m.task > 0 && h('i.m-task'), m.exam > 0 && h('i.m-exam'), m.done > 0 && h('i.m-done')));
      })),
    h('div.legend', h('span', h('i.m-task'), 'งาน'), h('span', h('i.m-exam'), 'สอบ'), h('span', h('i.m-done'), 'เสร็จแล้ว')),
    h('button.toggle', { onclick: () => { ui.calMonth = !ui.calMonth; rerender(); } }, ui.calMonth ? 'ย่อเหลือ 2 สัปดาห์' : 'ดูทั้งเดือน'));
}

// ---------------- หน้าฉัน ----------------
// โครงแบบหน้า "ฉัน" ที่นักเรียนคุ้น: หัวโปรไฟล์ + ตัวเลข → ปุ่มลัด 4 ช่อง → การ์ดสถิติ 7 วัน → รายการเมนู
// ไม่มีโทเคน เหรียญ ร้านค้า เช็คอิน อันดับ (สเปกข้อ 0) · ตัวเลขทุกตัวนับจากงานจริง
export function meView(root) {
  const s = store.state;
  const td = today();
  const sum = summary(s.tasks, td);
  const name = s.prefs.display_name || '';
  const theme = s.prefs.theme || 'system';
  const THEME = { light: 'สว่าง', dark: 'มืด', system: 'ตามเครื่อง' };
  const hasSamples = s.tasks.some(t => t.source === 'sample');

  // งานที่ทำเสร็จในแต่ละวัน 7 วันล่าสุด (นับจากเวลาที่กดเสร็จจริง)
  const days = Array.from({ length: 7 }, (_, i) => addDaysYMD(td, i - 6));
  const doneByDay = Object.fromEntries(days.map(d => [d, 0]));
  for (const t of s.tasks) if (isLive(t) && t.status === 'done' && t.completed_at) { const d = toYMD(new Date(t.completed_at)); if (d in doneByDay) doneByDay[d]++; }
  const week = Object.values(doneByDay).reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...Object.values(doneByDay));

  const menuItem = (ic, color, label, value, onclick, sub) => h('button.mrow', { onclick },
    h('span.mic', { style: { background: color }, html: ICON[ic] }),
    h('span.mk', label, sub && h('small', sub)),
    value != null && h('span.mv', value),
    h('span.chev', { html: ICON.right }));

  put(root,
    h('div.mehead',
      h('div.mtop', h('span.mname', name || 'ยังไม่ได้ตั้งชื่อ'), h('button.iconbtn', { 'aria-label': 'ตั้งค่า', onclick: settingsSheet, html: ICON.gear })),
      h('div.mrow1',
        h('div.bigav', (name || 'ฉ').slice(0, 1)),
        h('div.mstats', [['งานทั้งหมด', sum.total], ['เสร็จแล้ว', sum.done], ['ใกล้กำหนด', sum.soon]].map(([k, v]) => h('div', h('b', v), h('span', k))))),
      h('div.mchips', h('span.chip', 'นักเรียน'), h('span.chip.warn', h('i'), 'ยังไม่มีบัญชี · ข้อมูลอยู่ในเครื่องนี้')),
      h('button.btn.blue.block', { onclick: editName }, name ? 'แก้ไขชื่อที่แสดง' : 'ตั้งชื่อที่แสดง')),
    h('div.mtiles',
      tile('book', '#1769D2', 'วิชาของฉัน', `${s.subjects.filter(x => !x.hidden).length} วิชา`, subjectsSheet),
      tile('theme', '#0F376B', 'ธีมสี', THEME[theme], settingsSheet),
      tile('save', '#16B76A', 'สำรองข้อมูล', `${sum.total} งาน`, exportData),
      tile('spark', '#F4A340', 'งานตัวอย่าง', hasSamples ? 'ลบออก' : 'ลองใส่', toggleSamples)),
    h('section.mcard', { 'aria-label': 'สรุป 7 วัน' },
      h('div.mstats', [['งานเสร็จ', sum.done], ['ใน 7 วัน', week], ['ยังไม่เสร็จ', sum.open]].map(([k, v]) => h('div', h('b', v), h('span', k)))),
      h('div.week', { role: 'img', 'aria-label': `งานที่ทำเสร็จ 7 วันล่าสุด รวม ${week} งาน` }, days.map(d => {
        const n = doneByDay[d];
        return h('div.wcol' + (d === td ? '.today' : ''),
          h('div.wbar', h('i', { style: { height: `${n ? Math.max(10, (n / max) * 100) : 0}%` } }), n > 0 && h('em', n)),
          h('span', DOW_SHORT[fromYMD(d).getDay()]));
      })),
      week === 0 && h('p.hint', { style: { textAlign: 'center', marginTop: '6px' } }, 'ยังไม่มีงานที่ทำเสร็จใน 7 วันนี้')),
    h('div.mlist',
      menuItem('book', '#1769D2', 'วิชาของฉัน', `${s.subjects.length} วิชา`, subjectsSheet),
      menuItem('bell', '#E45465', 'การแจ้งเตือน', 'ยังไม่เปิดในรุ่นนี้', notifSheet, 'ตอนนี้ดูงานด่วนได้ในแอป'),
      menuItem('theme', '#0F376B', 'ธีมสี', THEME[theme], settingsSheet),
      menuItem('save', '#16B76A', 'สำรองข้อมูล', 'ไฟล์ JSON', exportData, 'ไม่รวมรูป'),
      menuItem('restore', '#0EA5B7', 'กู้คืนจากไฟล์สำรอง', null, restoreSheet),
      menuItem('spark', '#F4A340', 'งานตัวอย่าง', hasSamples ? 'ลบออก' : 'ลองใส่', toggleSamples),
      menuItem('lock', '#64748B', 'ข้อมูลและความเป็นส่วนตัว', s.dbKind === 'indexeddb' ? 'เก็บในเครื่อง' : 'ชั่วคราว', privacySheet),
      menuItem('info', '#8B5CF6', 'เกี่ยวกับ SABAii.com', `รุ่น ${globalThis.SABAII_VERSION || ''}`, aboutSheet)),
    h('p.mfoot', `SABAii.com · รุ่น ${globalThis.SABAII_VERSION || ''}`));

  function tile(ic, color, label, sub, onclick) {
    return h('button.mtile', { onclick }, h('span.mic', { style: { background: color }, html: ICON[ic] }), h('b', label), h('small', sub));
  }
  function editName() {
    const inp = h('input.in', { id: 'me-name', value: name, maxlength: 40, 'aria-label': 'ชื่อที่แสดง', placeholder: 'ชื่อเล่น' });
    const sh = openSheet({ title: 'ชื่อที่แสดง', state: 'compact', body: h('div', inp, h('p.hint', 'ไม่ต้องใส่ชื่อจริง ไม่ต้องบอกโรงเรียน')),
      foot: h('button.btn.blue.block', { onclick: async () => { await store.setPref('display_name', inp.value.trim()); sh.close(); } }, 'บันทึก') });
    setTimeout(() => inp.focus(), 280);
  }
  function settingsSheet() {
    const sh = openSheet({ title: 'ตั้งค่า', state: 'compact' });
    const render = () => sh.setBody(
      h('label.f', 'ธีมสี'),
      h('div.seg', Object.entries(THEME).map(([k, l]) => h('button', { 'aria-pressed': String((store.state.prefs.theme || 'system') === k), onclick: async () => { await store.setPref('theme', k); applyTheme(k); render(); } }, l))),
      h('label.f', 'ภาษา · เขตเวลา'),
      h('p', { style: { fontSize: '15px' } }, `ไทย · ${Intl.DateTimeFormat().resolvedOptions().timeZone || 'ตามเครื่อง'}`),
      h('p.hint', 'วันที่แสดงเป็นปี พ.ศ. · เขตเวลาตามเครื่อง'));
    render();
  }
  function privacySheet() {
    openSheet({ title: 'ข้อมูลและความเป็นส่วนตัว', state: 'compact', body: h('div',
      h('p', { style: { fontSize: '15px', lineHeight: 1.6 } }, 'งาน วิชา และโน้ตทั้งหมดเก็บอยู่ในเบราว์เซอร์ของเครื่องนี้เท่านั้น ยังไม่มีการส่งขึ้นเซิร์ฟเวอร์'),
      h('p.hint', 'ถ้าล้างข้อมูลเบราว์เซอร์หรือลบแอป ข้อมูลจะหาย — สำรองเป็นไฟล์ไว้ก่อน'),
      h('button.btn.danger.block', { style: { marginTop: '14px' }, onclick: wipe }, 'ลบข้อมูลทั้งหมดในเครื่อง')) });
  }
  function aboutSheet() {
    openSheet({ title: 'เกี่ยวกับ SABAii.com', state: 'compact', body: h('div',
      h('p', { style: { fontSize: '15px' } }, 'แอปจัดการงานเรียน: เพิ่มงานง่าย รู้ว่าต้องทำอะไร และไม่พลาดกำหนดส่ง'),
      h('p.hint', `รุ่น ${globalThis.SABAII_VERSION || ''} · รุ่นทดลอง ยังไม่มีบัญชี การซิงก์ และการแจ้งเตือนตอนปิดแอป`)) });
  }
  async function toggleSamples() {
    if (hasSamples) {
      if (!await confirmBox({ title: 'ลบงานตัวอย่าง?', body: 'ลบเฉพาะงานที่ติดป้าย "ตัวอย่าง" งานของคุณเองไม่หาย', ok: 'ลบงานตัวอย่าง', danger: true })) return;
      const n = await store.removeSamples(); toast(`ลบงานตัวอย่าง ${n} งานแล้ว`);
    } else { await store.addSamples(); toast('ใส่งานตัวอย่าง 6 งานแล้ว'); }
  }
  function exportData() {
    const json = store.exportJSON();
    const ta = h('textarea.in', { id: 'backup-json', rows: 8, readonly: true, 'aria-label': 'ข้อมูลสำรอง', style: { fontSize: '12px', fontFamily: 'ui-monospace, monospace' } }, json);
    const copy = h('button.btn.blue', { onclick: async () => {
      try { await navigator.clipboard.writeText(json); toast('คัดลอกแล้ว — วางเก็บไว้ในโน้ตหรือแชทของตัวเอง'); }
      catch { ta.focus(); ta.select(); toast('เลือกข้อความให้แล้ว กดคัดลอกเองได้เลย'); }
    } }, 'คัดลอก');
    const dl = h('button.btn', { onclick: () => {
      const a = h('a', { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: `sabaii-backup-${today()}.json` });
      document.body.append(a); a.click(); a.remove();
    } }, 'ดาวน์โหลดไฟล์');
    openSheet({ title: 'สำรองข้อมูล', state: 'expanded', body: h('div',
      h('p.hint', `${store.state.tasks.length} งาน · ${store.state.subjects.length} วิชา · ไม่รวมรูป — เก็บข้อความนี้ไว้ แล้วกู้คืนได้จากเมนู "กู้คืนจากไฟล์สำรอง"`), ta),
      foot: h('div.row', dl, copy) });
  }
  function restoreSheet() {
    const file = h('input', { type: 'file', id: 'restore-file', accept: 'application/json,.json' });
    const ta = h('textarea.in', { id: 'restore-text', rows: 5, placeholder: 'หรือวางข้อความที่คัดลอกไว้ตอนสำรอง' });
    const run = async raw => {
      try { const r = await store.restoreBackup(raw); toast(`กู้คืน ${r.added} งาน${r.skipped ? ` · ข้าม ${r.skipped} งานที่มีอยู่แล้ว` : ''}`); sh.close(); }
      catch (e) { toast(e.message); }
    };
    const sh = openSheet({ title: 'กู้คืนจากไฟล์สำรอง', state: 'expanded', body: h('div',
      h('p.hint', 'งานที่มีอยู่แล้วจะไม่ถูกเขียนทับ กู้ซ้ำได้ไม่เกิดงานซ้ำ'),
      h('label.f', { for: 'restore-file' }, 'เลือกไฟล์'), file,
      h('label.f', { for: 'restore-text' }, 'หรือวางข้อความ'), ta),
      foot: h('button.btn.blue.block', { onclick: () => ta.value.trim() && run(ta.value) }, 'กู้คืนจากข้อความ') });
    file.onchange = async () => { const f = file.files?.[0]; if (f) run(await f.text()); };
  }
  async function wipe() {
    if (!await confirmBox({ title: 'ลบข้อมูลทั้งหมด?', body: 'งาน วิชา และโน้ตในเครื่องนี้จะหายถาวร แนะนำให้สำรองข้อมูลก่อน', ok: 'ลบทั้งหมด', danger: true })) return;
    indexedDB.deleteDatabase('sabaii');
    location.reload();
  }
}

function subjectsSheet() {
  const sh = openSheet({ title: 'รายวิชา', state: 'expanded' });
  const render = () => {
    const list = [...store.state.subjects].sort((a, b) => a.order - b.order);
    const newIn = h('input.in', { placeholder: 'ชื่อวิชาใหม่', 'aria-label': 'ชื่อวิชาใหม่', maxlength: 40 });
    sh.setBody(
      list.map((s, i) => h('div.subjrow',
        h('button.sw', { style: { background: s.color }, 'aria-label': `เปลี่ยนสี ${s.name}`, onclick: async () => { const c = SUBJECT_COLORS[(SUBJECT_COLORS.indexOf(s.color) + 1) % SUBJECT_COLORS.length]; await store.updateSubject(s.id, { color: c }); render(); } }),
        h('input.in', { value: s.name, 'aria-label': 'ชื่อวิชา', maxlength: 40, style: { opacity: s.hidden ? .5 : 1 }, onchange: async e => { const v = e.target.value.trim(); if (v) await store.updateSubject(s.id, { name: v }); } }),
        h('button.small', { 'aria-label': 'เลื่อนขึ้น', disabled: i === 0, onclick: async () => { const p = list[i - 1]; await store.updateSubject(s.id, { order: p.order }); await store.updateSubject(p.id, { order: s.order }); render(); } }, '↑'),
        h('button.small', { 'aria-label': s.hidden ? 'แสดงวิชา' : 'ซ่อนวิชา', onclick: async () => { await store.updateSubject(s.id, { hidden: !s.hidden }); render(); } }, s.hidden ? '👁' : '—'),
        h('button.small', { 'aria-label': `ลบ ${s.name}`, onclick: async () => {
          const n = store.state.tasks.filter(t => isLive(t) && t.subject_id === s.id).length;
          if (!await confirmBox({ title: `ลบวิชา ${s.name}?`, body: n ? `มี ${n} งานในวิชานี้ งานจะไม่หาย แต่จะกลายเป็น "ไม่ระบุวิชา"` : 'ไม่มีงานในวิชานี้', ok: 'ลบวิชา', danger: true })) return;
          await store.deleteSubject(s.id); render();
        } }, '🗑'))),
      h('div.row', { style: { marginTop: '12px' } }, newIn,
        h('button.btn.blue', { style: { flex: 'none' }, onclick: async () => { const v = newIn.value.trim(); if (!v) return; await store.ensureSubject(v); render(); } }, 'เพิ่ม')));
  };
  render();
}

export function applyTheme(t) {
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
