// หน้า "งาน" — ปฏิทินเปิด/ปิดได้ (2 สัปดาห์ ↔ ทั้งเดือน) + การ์ดโปรเจกต์ต่อวิชาแบบ Canva
// หน้าวิชา — ทุกงานของวิชา + แถบโน้ต (ภาพย่อจากโน้ตจริง) + เพิ่มโน้ต/งาน
import { h, ic, put, badge, tintOf, nameOf, NONE } from '../ui/kit.js';
import { toYMD, fromYMD, addDaysYMD, daysBetween, dueSortKey, relDay, DOW_SHORT, MONTH_SHORT, MONTH_LONG, beYear } from '../domain/dates.js';
import { isLive } from '../domain/tasks.js';
import { app, S, subj, today, dueInfo, dueLine, fullTitle, notesOf, visibleSubjects } from './shared.js';
import { addTask, addNote, editTask, miniOf } from './add.js';
import { finish, focusSearch } from './home.js';

const tv = { calOpen: false, cursor: null, sel: null, filter: 'all' };
const FILTERS = { all: 'ทั้งหมด', soon: 'ใกล้ส่ง', exam: 'สอบ', done: 'เสร็จแล้ว' };
const live = () => S().tasks.filter(isLive);

function marksByDay() {
  const m = {};
  for (const t of live()) if (t.due_date && t.status !== 'done') (m[t.due_date] ||= { ex: 0, hw: 0 })[t.type === 'exam' ? 'ex' : 'hw']++;
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
function toggleCal() { tv.calOpen = !tv.calOpen; if (!tv.calOpen) tv.cursor = null; app.refresh(); }
function shiftMonth(n) { const c = fromYMD((tv.cursor || today().slice(0, 7)) + '-01'); c.setMonth(c.getMonth() + n); tv.cursor = toYMD(c).slice(0, 7); app.refresh(); }

export function tasksView(root) {
  const t = today(), curM = fromYMD(tv.cursor ? tv.cursor + '-01' : t);
  const marks = marksByDay(), { days, month } = calDays();
  const cal = h('section.cal', { 'aria-label': 'ปฏิทิน' },
    tv.calOpen ? h('div.nav2',
      h('button', { 'aria-label': 'เดือนก่อนหน้า', html: ic('left'), onclick: () => shiftMonth(-1) }),
      h('b', `${MONTH_LONG[curM.getMonth()]} ${beYear(curM.getFullYear())}`),
      h('button', { 'aria-label': 'เดือนถัดไป', html: ic('right'), onclick: () => shiftMonth(1) })) : '',
    h('div.dow', DOW_SHORT.map(d => h('span', d.replace('.', '')))),
    h('div.days', days.map(d => {
      const k = marks[d], dd = fromYMD(d), n = k ? k.ex + k.hw : 0;
      return h('button.day' + (d === t ? '.today' : '') + (d === tv.sel ? '.sel' : '') + (month && dd.getMonth() + 1 !== month ? '.out' : ''),
        { onclick: () => { tv.sel = tv.sel === d ? null : d; app.refresh(); }, 'aria-pressed': String(d === tv.sel), 'aria-label': `${dd.getDate()} ${MONTH_LONG[dd.getMonth()]}${n ? ` · ${n} งาน` : ''}` },
        String(dd.getDate()), h('span.dots', k?.ex ? h('i.ex') : '', k?.hw ? h('i.hw') : ''));
    })),
    h('div.foot', h('span.lg', h('span', h('i.ex'), 'สอบ'), h('span', h('i.hw'), 'งานส่ง')),
      h('button', { onclick: toggleCal }, tv.calOpen ? 'ย่อเหลือ 2 สัปดาห์' : 'ดูทั้งเดือน')),
    h('button.bar', { 'aria-label': tv.calOpen ? 'ย่อปฏิทิน' : 'ขยายปฏิทิน', onclick: toggleCal }));
  let y0 = null; // ลากลง = ขยาย · ลากขึ้น = ย่อ
  cal.addEventListener('pointerdown', e => { y0 = e.clientY; });
  cal.addEventListener('pointerup', e => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; if ((dy > 40 && !tv.calOpen) || (dy < -40 && tv.calOpen)) toggleCal(); });

  const dayList = tv.sel ? (() => {
    const items = live().filter(x => x.due_date === tv.sel).sort((a, b) => dueSortKey(a) - dueSortKey(b));
    return h('div.daylist', h('h3', `${relDay(tv.sel, t)} · ${items.length ? items.length + ' งาน' : 'ว่าง'}`),
      h('ul.tlist', items.map(x => h('li.trow', h('button.main', { onclick: () => x.status === 'done' ? editTask(x.id) : app.openNotes(x.id) }, badge(subj(x.subject_id)),
        h('div', h('b', fullTitle(x)), h('small', x.status === 'done' ? 'เสร็จแล้ว' : dueLine(x))))))));
  })() : '';

  const pick = x => tv.filter === 'all' ? x.status !== 'done' : tv.filter === 'done' ? x.status === 'done'
    : tv.filter === 'exam' ? x.type === 'exam' && x.status !== 'done' : x.status !== 'done' && x.due_date && daysBetween(t, x.due_date) <= 3;
  const cards = [...visibleSubjects(), ...S().subjects.filter(s => s.hidden), NONE].map(s => {
    const all = live().filter(x => (x.subject_id || '') === s.id && (s.id || !subjExists(x.subject_id)));
    const list = all.filter(pick).sort((a, b) => dueSortKey(a) - dueSortKey(b));
    if (!list.length) return null;
    const notes = all.flatMap(x => notesOf(x.id)), first = list[0], d = dueInfo(first);
    return h('button.proj', { onclick: () => { location.hash = '#/subject/' + (s.id || 'none'); }, 'aria-label': `${s.name} ${list.length} งาน` },
      cover(notes, s),
      h('div.ph', h('b', nameOf(s) || 'ไม่ระบุวิชา'), h('span.cnt', { style: { background: tintOf(s), color: s.color } }, `${list.length} งาน`)),
      h('small', tv.filter === 'done' ? first.title : [d.urgent ? h('em', first.title) : first.title, ' · ', d.text]));
  }).filter(Boolean);

  put(root,
    h('div.phead', h('h1', 'งาน'),
      h('button.monthchip', { onclick: toggleCal, 'aria-expanded': String(tv.calOpen), html: ic('cal') + `<span>${MONTH_SHORT[curM.getMonth()]} ${beYear(curM.getFullYear())}</span>` + ic(tv.calOpen ? 'up' : 'down') }),
      h('button.iconbtn', { 'aria-label': 'ค้นหางาน', html: ic('search'), onclick: () => { location.hash = '#/home'; focusSearch(); } })),
    cal, dayList,
    h('div.filters', Object.entries(FILTERS).map(([k, v]) => h('button', { 'aria-pressed': String(tv.filter === k), onclick: () => { tv.filter = k; app.refresh(); } }, v))),
    cards.length ? h('div.grid', cards, h('button.proj.new', { onclick: () => addTask('text') }, '+ งานใหม่'))
      : h('div.empty-note', tv.filter === 'done' ? 'ยังไม่มีงานที่เสร็จ' : tv.filter === 'all' ? 'ยังไม่มีงาน — เพิ่มจากหน้าแรกได้เลย' : 'ไม่มีงานในหมวดนี้'),
  );
}
const subjExists = id => !!id && S().subjects.some(s => s.id === id);

/** ปกการ์ดวิชา: รูป/โน้ตหลัก 1 แผ่น + โน้ตล่าสุด วางซ้อนเอียงบนพื้นสีวิชา */
function cover(notes, s) {
  const main = notes.find(n => n.kind === 'image'), latest = notes[notes.length - 1];
  const two = [...new Set([main || notes[notes.length - 2], latest].filter(Boolean))];
  return h('div.cover', { style: { background: tintOf(s) } },
    two.length ? two.map((n, i) => miniOf(n, 82, 108, two.length === 2 ? (i ? '.front' : '.back') : '.solo'))
      : h('div.cover-empty', badge(s), h('small', 'ยังไม่มีโน้ต')));
}

export function subjectView(root, id) {
  const sid = id === 'none' ? '' : id, s = sid ? subj(sid) : NONE;
  const list = live().filter(x => sid ? x.subject_id === sid : !subjExists(x.subject_id))
    .sort((a, b) => (a.status === 'done') - (b.status === 'done') || dueSortKey(a) - dueSortKey(b));
  const nNotes = list.reduce((n, x) => n + notesOf(x.id).length, 0);
  put(root,
    h('div.phead', h('button.iconbtn', { 'aria-label': 'กลับหน้างาน', html: ic('back'), onclick: () => { location.hash = '#/tasks'; } }),
      badge(s), h('h1.mid', s.name)),
    h('p.muted', { style: { marginBottom: '12px' } }, `${list.filter(x => x.status !== 'done').length} งานค้าง · โน้ต ${nNotes} รายการ`),
    h('div.board', list.map(t => h('article.tcard' + (t.status === 'done' ? '.done' : ''),
      h('div.top', h('div', h('b', t.title), h('small.muted.block', t.status === 'done' ? 'เสร็จแล้ว' : dueLine(t))),
        h('button.iconbtn', { 'aria-label': `แก้ไข ${t.title}`, html: ic('edit'), onclick: () => editTask(t.id) })),
      h('div.strip', notesOf(t.id).map(a => miniOf(a)), t.status !== 'done' ? h('button.s-add', { 'aria-label': 'เพิ่มโน้ต', onclick: () => addNote(t.id, 'pick') }, '+') : ''),
      t.status !== 'done'
        ? h('div.row-actions', h('button', { onclick: () => app.openNotes(t.id) }, 'เปิดโน้ตเต็มจอ'), h('button', { onclick: () => finish(t.id) }, 'ทำเสร็จแล้ว'))
        : h('div.row-actions', h('button', { onclick: () => app.store.patchTask(t.id, { status: 'todo' }) }, 'ยังไม่เสร็จ')))),
      h('button.proj.new.slim', { onclick: () => addTask('text', sid ? nameOf(s) + ' ' : '') }, sid ? '+ เพิ่มงานวิชานี้' : '+ เพิ่มงาน')),
  );
}
