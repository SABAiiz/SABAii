// หน้า "งาน" (0.9.9) — แถบสัปดาห์ (ขยายเป็นทั้งเดือนได้) → งานเรียงตามวัน (รูปย่อจากโน้ตจริง ไม่มีรูป = ไอคอนวิชา · สอบเป็นการ์ดแดงนับถอยหลัง)
// การ์ดวิชาย้ายไปแท็บ "สมุด" แล้ว (features/notebook.js)
// หน้าวิชา — ทุกงานของวิชา + แถบโน้ต (ภาพย่อจากโน้ตจริง) + เพิ่มโน้ต/งาน · ย้อนกลับไปสมุด
import { h, ic, put, nameOf, subjIcon, NONE } from '../ui/kit.js';
import { toYMD, fromYMD, addDaysYMD, daysBetween, dueSortKey, relDay, DOW_SHORT, DOW_LONG, MONTH_SHORT, MONTH_LONG, beYear } from '../domain/dates.js';
import { isLive } from '../domain/tasks.js';
import { app, S, subj, today, dueInfo, dueLine, fullTitle, notesOf, urlOf } from './shared.js';
import { addTask, addNote, editTask, miniOf } from './add.js';
import { finish, focusSearch } from './home.js';
import { notesPanel, subjectBook } from './sketch.js';

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
  if (!tv.calOpen) { const start = addDaysYMD(t, -fromYMD(t).getDay()); return { days: Array.from({ length: 7 }, (_, i) => addDaysYMD(start, i)), month: null }; }
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
    tv.calOpen ? h('div.foot', h('span.lg', h('span', h('i.ex'), 'สอบ'), h('span', h('i.hw'), 'งานส่ง')),
      h('button', { onclick: toggleCal }, 'ย่อเหลือสัปดาห์เดียว')) : '',
    h('button.bar', { 'aria-label': tv.calOpen ? 'ย่อปฏิทิน' : 'ขยายปฏิทิน', onclick: toggleCal }));
  let y0 = null; // ลากลง = ขยาย · ลากขึ้น = ย่อ
  cal.addEventListener('pointerdown', e => { y0 = e.clientY; });
  cal.addEventListener('pointerup', e => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; if ((dy > 40 && !tv.calOpen) || (dy < -40 && tv.calOpen)) toggleCal(); });

  const pick = x => tv.filter === 'all' ? x.status !== 'done' : tv.filter === 'done' ? x.status === 'done'
    : tv.filter === 'exam' ? x.type === 'exam' && x.status !== 'done' : x.status !== 'done' && x.due_date && daysBetween(t, x.due_date) <= 3;

  // งานเรียงตามวัน (แตะวันในปฏิทิน = เฉพาะวันนั้น)
  const items = live().filter(x => tv.sel ? x.due_date === tv.sel : pick(x)).sort((a, b) => dueSortKey(a) - dueSortKey(b));
  const groups = new Map();
  for (const x of items) { const k = x.due_date || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); }
  const dayHead = k => !k ? 'ไม่มีกำหนดส่ง' : (() => { const n = daysBetween(t, k), d = fromYMD(k);
    return n < 0 ? `เลยกำหนด · ${relDay(k, t)}` : n <= 1 ? `${relDay(k, t)} · ${DOW_SHORT[d.getDay()]} ${d.getDate()}` : `${DOW_LONG[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`; })();
  const open = x => x.status === 'done' ? editTask(x.id) : app.openNotes(x.id);
  const timeline = h('section' + (tv.sel ? '.daylist' : '.tl'), { 'aria-label': 'งานเรียงตามวัน' },
    tv.sel ? h('h3', `${relDay(tv.sel, t)} · ${items.length ? items.length + ' งาน' : 'ว่าง'}`) : '',
    [...groups].map(([k, list]) => [tv.sel ? '' : h('p.tl-day', dayHead(k)), list.map(x => {
      const s = subj(x.subject_id), img = notesOf(x.id).find(n => n.kind === 'image' && n.blob);
      if (x.type === 'exam' && x.status !== 'done' && x.due_date) {
        const n = Math.max(0, daysBetween(t, x.due_date));
        return h('button.ti.exam', { onclick: () => open(x) }, h('span.cd', n === 0 ? h('b', 'วันนี้') : [h('b', String(n)), 'วัน']),
          h('span.tx', h('b', x.title), h('small', [nameOf(s), x.due_time, x.location].filter(Boolean).join(' · ') || 'สอบ')));
      }
      return h('button.ti' + (x.status === 'done' ? '.done' : ''), { onclick: () => open(x) },
        img ? h('span.th', { style: { backgroundImage: `url("${urlOf(img)}")` } }) : h('span.th.sub', { style: { '--c': s.color || '#69778F' }, html: subjIcon(s) }),
        h('span.tx', h('b', x.title), h('small', x.status === 'done' ? 'เสร็จแล้ว' : [nameOf(s) ? nameOf(s) + ' · ' : '', ...dueLine(x)])));
    })]));


  put(root,
    h('div.phead', h('h1', 'งาน'),
      h('button.monthchip', { onclick: toggleCal, 'aria-expanded': String(tv.calOpen), html: `<span>${MONTH_SHORT[curM.getMonth()]}</span>` + ic(tv.calOpen ? 'up' : 'down') }),
      h('button.iconbtn', { 'aria-label': 'ค้นหางาน', html: ic('search'), onclick: () => { location.hash = '#/home'; focusSearch(); } })),
    cal,
    h('div.filters', Object.entries(FILTERS).map(([k, v]) => h('button', { 'aria-pressed': String(tv.filter === k), onclick: () => { tv.filter = k; tv.sel = null; app.refresh(); } }, v))),
    items.length ? timeline : h('div.empty-note', tv.sel ? 'วันนี้ว่าง ไม่มีงาน' : tv.filter === 'done' ? 'ยังไม่มีงานที่เสร็จ' : tv.filter === 'all' ? 'ยังไม่มีงาน เพิ่มจากหน้าแรกได้เลย' : 'ไม่มีงานในหมวดนี้'),
  );
}
const subjExists = id => !!id && S().subjects.some(s => s.id === id);

export function subjectView(root, id) {
  const sid = id === 'none' ? '' : id, s = sid ? subj(sid) : NONE;
  const list = live().filter(x => sid ? x.subject_id === sid : !subjExists(x.subject_id))
    .sort((a, b) => (a.status === 'done') - (b.status === 'done') || dueSortKey(a) - dueSortKey(b));
  // 0.11: หน้าวิชา = สมุดของวิชา — หัววิชา + ตัวเลข · แท็บ "โน้ต" (ทุกหน้าของสมุด) / "งาน" (ของเดิม)
  const open = list.filter(x => x.status !== 'done');
  const book = sid ? subjectBook(sid) : null, nPages = book ? app.store.pagesOf(book.id).length : 0;
  const exam = open.filter(x => x.type === 'exam' && x.due_date && daysBetween(today(), x.due_date) >= 0).sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  const tab = sid ? (app.svTab || 'notes') : 'tasks';
  const setTab = k => { app.svTab = k; app.refresh(); };
  const exLabel = exam && (() => { const n = daysBetween(today(), exam.due_date); return n === 0 ? 'วันนี้' : n === 1 ? 'พรุ่งนี้' : `${n} วัน`; })();
  put(root,
    h('div.phead', h('button.iconbtn', { 'aria-label': 'กลับสมุด', html: ic('back'), onclick: () => { location.hash = '#/notebook'; } })),
    h('div.sv-hero', h('span.si-box.lg', { style: { '--c': s.color || '#69778F' }, html: subjIcon(s) }),
      h('div', h('small', sid ? 'วิชา' : 'งานที่ยังไม่ได้ระบุวิชา'), h('h1', s.name))),
    h('div.sv-stats',
      sid ? h('span', h('b', String(nPages)), 'หน้าโน้ต') : '',
      h('span', h('b', String(open.length)), 'งานค้าง'),
      exam ? h('span.ex', h('b', exLabel), exam.title) : ''),
    sid ? h('div.sv-tabs', { role: 'tablist' }, [['notes', `โน้ต${nPages ? ' ' + nPages : ''}`], ['tasks', `งาน${list.length ? ' ' + list.length : ''}`]].map(([k, l]) =>
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === k), onclick: () => setTab(k) }, l))) : '',
    tab === 'notes' ? notesPanel(sid) : h('div.board', list.map(t => h('article.tcard' + (t.status === 'done' ? '.done' : ''),
      h('div.top', h('div', h('b', t.title), h('small.muted.block', t.status === 'done' ? 'เสร็จแล้ว' : dueLine(t))),
        h('button.iconbtn', { 'aria-label': `แก้ไข ${t.title}`, html: ic('edit'), onclick: () => editTask(t.id) })),
      h('div.strip', notesOf(t.id).map(a => miniOf(a)), t.status !== 'done' ? h('button.s-add', { 'aria-label': 'เพิ่มโน้ต', onclick: () => addNote(t.id, 'pick') }, '+') : ''),
      t.status !== 'done'
        ? h('div.row-actions', h('button', { onclick: () => app.openNotes(t.id) }, 'เปิดโน้ตเต็มจอ'), h('button', { onclick: () => finish(t.id) }, 'ทำเสร็จแล้ว'))
        : h('div.row-actions', h('button', { onclick: () => app.store.patchTask(t.id, { status: 'todo' }) }, 'ยังไม่เสร็จ')))),
      h('button.proj.new.slim', { onclick: () => addTask('text', sid ? nameOf(s) + ' ' : '') }, sid ? '+ เพิ่มงานวิชานี้' : '+ เพิ่มงาน')),
  );
}
