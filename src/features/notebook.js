// หน้า "สมุด" (0.10.0) — เน้นก่อนสอบ (เจ้าของเลือกจอ 4–6 ใน mockups/sabaii-plan-exam.jpg แต่ใช้ชื่อแท็บ "สมุด")
//   สอบที่ใกล้สุดอยู่บนสุด: นับถอยหลัง · อ่านแล้วกี่ชิ้น · ที่ครูบอกว่าออกสอบ · รูปกระดาน · สอบถัดไป
//   ไม่มีสอบ = คลังรูปกระดานทุกวิชา เรียงตามวัน (แทนแกลเลอรี่) · ค้นในโน้ต · วิชาเป็นแถวเล็ก → หน้าวิชาเดิม
// หน้าสอบ (#/exam/<id>) — โน้ตของวิชานั้นตั้งแต่สอบครั้งก่อน เรียงตามวัน · ติ๊กอ่านแล้วทีละชิ้น · อ่านทีละชิ้นเต็มจอ
import { h, ic, put, subjIcon, nameOf, NONE, toast } from '../ui/kit.js';
import { isLive } from '../domain/tasks.js';
import { toYMD, toHM, fromYMD, daysBetween, DOW_SHORT, MONTH_SHORT } from '../domain/dates.js';
import { app, S, subj, today, notesOf, urlOf, visibleSubjects } from './shared.js';
import { searchNotes as search, upcomingExams, examScope, isExamHint, noteQuote, readCount } from '../domain/notebook.js';
import { addTask, editTask, viewPhoto } from './add.js';

const nb = { q: '' };
const live = () => S().tasks.filter(isLive);
const subjExists = id => !!id && S().subjects.some(s => s.id === id);
const scopeOf = ex => examScope(ex, live(), notesOf);
const sbox = (s, cls = '') => h('span.si-box' + cls, { style: { '--c': s.color || '#69778F' }, html: subjIcon(s) });

/** "พ. 25 พ.ย." · วันนี้ · เมื่อวาน */
function dayName(ymd) {
  const n = daysBetween(ymd, today()), d = fromYMD(ymd);
  return n === 0 ? 'วันนี้' : n === 1 ? 'เมื่อวาน' : `${DOW_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}
/** วัน เวลา ห้องของสอบ: "อา. 29 พ.ย. 10:00 · ห้อง 412" */
const examWhen = ex => { const d = fromYMD(ex.due_date); return [`${DOW_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`, ex.due_time, ex.place ? 'ห้อง ' + ex.place.replace(/^ห้อง\s*/, '') : ''].filter(Boolean).join(' '); };
const countdown = ex => { const n = daysBetween(today(), ex.due_date); return n === 0 ? h('span.cd', h('b.word', 'วันนี้')) : h('span.cd', h('b', String(n)), h('small', 'วัน')); };
const quoteOf = n => noteQuote(n.text || '');
const meter = (done, all) => h('span.meter', h('i', { style: { width: all ? Math.round(done / all * 100) + '%' : '0' } }));

function results(box) {
  const hits = search(nb.q, live(), id => notesOf(id));
  put(box, !nb.q.trim() ? '' : hits.length
    ? [h('p.sec2.nb-rs', `เจอ ${hits.length} รายการ`), hits.map(({ task: t, note: n }) => {
        const s = subj(t.subject_id);
        return h('button.nb-hit', { onclick: () => app.openNotes(t.id) }, sbox(s),
          h('span.tx', h('b', n ? snippet(n.text, nb.q) : t.title), h('small', [nameOf(s), n ? t.title : 'ชื่องาน'].filter(Boolean).join(' · '))));
      })]
    : h('p.empty-note', `ไม่เจอ "${nb.q.trim()}" ในโน้ต`));
}
const snippet = (text, q) => { const i = text.toLowerCase().indexOf(q.trim().toLowerCase()); const a = Math.max(0, i - 18); return (a ? '…' : '') + text.slice(a, a + 70).replace(/\s+/g, ' '); };

/** การ์ดแดง: สอบที่ใกล้ที่สุด */
function examCard(ex) {
  const s = subj(ex.subject_id), { items } = scopeOf(ex), read = readCount(items);
  const nImg = items.filter(x => x.note.kind === 'image').length, nHint = items.filter(x => isExamHint(x.note)).length;
  const chips = [nHint ? `ครูบอกออกสอบ ${nHint}` : '', nImg ? `รูป ${nImg}` : '', items.length - nImg ? `โน้ต ${items.length - nImg}` : ''].filter(Boolean);
  return h('button.nb-exam', { onclick: () => { location.hash = '#/exam/' + ex.id; }, 'aria-label': `${ex.title} · เปิดของที่ต้องอ่าน` },
    h('span.top', countdown(ex), h('span.tx', h('b', ex.title), h('small', [nameOf(s), examWhen(ex)].filter(Boolean).join(' · ')))),
    items.length
      ? [h('span.prog', h('span', `อ่านแล้ว ${read}/${items.length}`), meter(read, items.length)), h('span.chips', chips.map(c => h('span', c)))]
      : h('span.none', ex.subject_id ? `ยังไม่มีโน้ต${nameOf(s)} ถ่ายรูปกระดานเก็บไว้ในงานของวิชานี้ แล้วจะมารวมที่นี่` : 'สอบนี้ยังไม่ระบุวิชา แตะเพื่อดูหรือแก้ไข'));
}

/** คลังรูป: รูปโน้ตทุกงาน ใหม่สุดก่อน แบ่งตามวัน */
function gallery() {
  const imgs = S().attachments.filter(a => a.kind === 'image' && a.blob && live().some(t => t.id === a.task_id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30);
  if (!imgs.length) return null;
  const days = new Map();
  for (const a of imgs) { const k = dayName(toYMD(new Date(a.created_at))); if (!days.has(k)) days.set(k, []); days.get(k).push(a); }
  return h('section.nb-gal', { 'aria-label': 'รูปกระดานล่าสุด' },
    h('h2.sec2', 'รูปล่าสุด', h('small', `ทุกวิชา · ${imgs.length} รูป`)),
    [...days].map(([k, list]) => [h('p.nb-day', k), h('div.nb-tiles', list.map(a => {
      const t = live().find(x => x.id === a.task_id), s = subj(t?.subject_id);
      return h('button.nb-tile', { style: { backgroundImage: `url("${urlOf(a)}")` }, 'aria-label': `รูป ${t?.title || ''}`, onclick: () => viewPhoto(urlOf(a)) },
        nameOf(s) ? h('i', nameOf(s)) : '');
    }))]));
}

export function notebookView(root) {
  const res = h('div.nb-results');
  const input = h('input', { id: 'nb-q', type: 'search', placeholder: 'ค้นในโน้ตและชื่องาน…', value: nb.q, 'aria-label': 'ค้นในสมุด', autocomplete: 'off',
    oninput: e => { nb.q = e.target.value; results(res); body.hidden = !!nb.q.trim(); } });

  const exams = upcomingExams(live(), today()), ex = exams[0];
  const parts = [];
  if (ex) {
    parts.push(examCard(ex));
    const { items } = scopeOf(ex);
    const hints = items.filter(x => isExamHint(x.note)).slice(0, 3);
    if (hints.length) parts.push(h('h2.sec2', 'ครูบอกว่าออกสอบ'), hints.map(({ note: n, task: t }) => {
      const q = quoteOf(n);
      return h('button.nb-said', { onclick: () => app.openNotes(t.id) }, h('span', { html: ic('mic') }),
        h('span.tx', h('b', q.said ? `“${q.text}”` : q.text), h('small', [q.said ? 'ฟังครู' : 'จดเอง', dayName(toYMD(new Date(n.created_at))), t.title].join(' · '))));
    }));
    const pics = items.filter(x => x.note.kind === 'image' && x.note.blob);
    if (pics.length) parts.push(h('h2.sec2', 'รูปกระดาน', h('a', { href: '#/exam/' + ex.id }, `ดูทั้งหมด ${pics.length}`)),
      h('div.nb-strip', pics.slice(0, 4).map(({ note: n }) => h('button' + (n.read_at ? '.seen' : ''), { style: { backgroundImage: `url("${urlOf(n)}")` }, 'aria-label': 'ดูรูปเต็มจอ', onclick: () => viewPhoto(urlOf(n)) })),
        pics.length > 4 ? h('a.more4', { href: '#/exam/' + ex.id }, `+${pics.length - 4}`) : ''));
    if (exams.length > 1) parts.push(h('h2.sec2', 'สอบถัดไป'), exams.slice(1, 4).map(x => {
      const s = subj(x.subject_id), n = scopeOf(x).items.length;
      return h('button.nb-next', { onclick: () => { location.hash = '#/exam/' + x.id; } }, countdown(x),
        h('span.tx', h('b', x.title), h('small', [examWhen(x), n ? `โน้ต ${n}` : 'ยังไม่มีโน้ต'].join(' · '))), sbox(s));
    }));
  } else {
    parts.push(h('div.nb-noexam', h('span', { html: ic('cal') }),
      h('span.tx', h('b', 'ยังไม่มีสอบที่จดไว้'), 'มีสอบเมื่อไหร่ โน้ตของวิชานั้นจะมารวมให้เอง'),
      h('button', { onclick: () => addTask('text', 'สอบ') }, '+ วันสอบ')));
  }

  // วิชา: แถวเล็ก เลื่อนข้าง → หน้าวิชาเดิม
  // วิชาที่มีโน้ตเยอะขึ้นก่อน (เท่ากัน = ตามลำดับที่ตั้งไว้)
  const cards = [...visibleSubjects(), NONE].map(s => {
    const tasks = live().filter(x => s.id ? x.subject_id === s.id : !subjExists(x.subject_id));
    if (!s.id && !tasks.length) return null;
    return { s, tasks, notes: tasks.reduce((n, x) => n + notesOf(x.id).length, 0) };
  }).filter(Boolean).sort((a, b) => b.notes - a.notes).map(({ s, tasks, notes }) => {
    const open = tasks.filter(x => x.status !== 'done').length;
    return h('button.nb-card', { onclick: () => { location.hash = '#/subject/' + (s.id || 'none'); }, 'aria-label': `${s.name} · โน้ต ${notes} · ค้าง ${open} งาน`, style: { '--c': s.color || '#69778F' } },
      sbox(s), h('span', h('b', nameOf(s) || 'ไม่ระบุวิชา'), h('small', `โน้ต ${notes}`)));
  });
  parts.push(h('section.nb-grid', { 'aria-label': 'วิชา' }, h('h2.sec2', 'วิชา'), h('div.nb-cards', cards)));
  parts.push(gallery());

  const body = h('div.nb-body', { hidden: !!nb.q.trim() }, parts);
  put(root, h('div.phead', h('h1', 'สมุด')), h('label.nb-search', h('span', { html: ic('search') }), input), res, body);
  results(res);
}

/** หน้าสอบ: ทุกอย่างที่ต้องอ่าน เรียงตามวันที่เรียน (ใหม่สุดก่อน) */
export function examView(root, id) {
  const ex = live().find(t => t.id === id);
  if (!ex) { location.hash = '#/notebook'; return; }
  const s = subj(ex.subject_id), { from, items } = scopeOf(ex), read = readCount(items);
  const n = daysBetween(today(), ex.due_date);
  const when = ex.due_date ? (n < 0 ? 'สอบไปแล้ว' : n === 0 ? 'สอบวันนี้' : `อีก ${n} วัน`) : '';
  const range = !ex.subject_id ? 'โน้ตที่แนบกับสอบนี้' : from ? `รวมโน้ต${nameOf(s)}ตั้งแต่สอบครั้งก่อน (${dayName(from)})` : `รวมโน้ต${nameOf(s)}ทั้งหมด`;
  const groups = new Map();
  for (const x of items) { if (!groups.has(x.day)) groups.set(x.day, []); groups.get(x.day).push(x); }
  const toggle = async x => { await app.store.patchAttachment(x.note.id, { read_at: x.note.read_at ? null : new Date().toISOString() }); };

  put(root,
    h('header.ex-head',
      h('div.row', h('button.iconbtn', { 'aria-label': 'กลับสมุด', html: ic('back'), onclick: () => { location.hash = '#/notebook'; } }),
        h('button.iconbtn', { 'aria-label': 'แก้ไขสอบนี้', html: ic('edit'), onclick: () => editTask(ex.id) })),
      h('h1', ex.title),
      h('p', [nameOf(s), when, ex.due_date ? examWhen(ex) : ''].filter(Boolean).join(' · ')),
      h('p.range', range),
      items.length ? h('div.prog', h('span', `อ่านแล้ว ${read}/${items.length}`), meter(read, items.length)) : ''),
    items.length && read < items.length ? h('button.btn.primary.ex-read', { onclick: () => reader(items.filter(x => !x.note.read_at)) }, h('span', { html: ic('play') }), 'อ่านทีละชิ้น · เริ่มที่ยังไม่อ่าน') : '',
    items.length && read === items.length ? h('p.ex-all', 'อ่านครบทุกชิ้นแล้ว') : '',
    items.length
      ? [...groups].map(([day, list]) => [h('p.ex-day', h('span', dayName(day)), h('small', `${list.length} ชิ้น`)), list.map(x => {
          const nt = x.note, img = nt.kind === 'image' && nt.blob, q = quoteOf(nt), hint = isExamHint(nt);
          const open = () => img ? viewPhoto(urlOf(nt)) : app.openNotes(x.task.id);
          return h('div.ex-item' + (nt.read_at ? '.done' : ''),
            h('button.ex-open', { onclick: open },
              img ? h('span.th', { style: { backgroundImage: `url("${urlOf(nt)}")` } }) : h('span.th.txt', { html: ic(q.said ? 'mic' : 'text') }),
              h('span.tx', h('b', img ? x.task.title : (q.said ? `“${q.text}”` : q.text)),
                h('small', [img ? 'รูป' : q.said ? 'ฟังครู' : 'โน้ต', toHM(new Date(nt.created_at)), img ? '' : x.task.title].filter(Boolean).join(' · '), hint ? h('span.hint', 'ออกสอบ') : ''))),
            h('button.ex-chk' + (nt.read_at ? '.on' : ''), { 'aria-label': nt.read_at ? 'ยังไม่ได้อ่าน' : 'อ่านแล้ว', 'aria-pressed': String(!!nt.read_at), html: ic('check'), onclick: () => toggle(x) }));
        })])
      : h('div.empty-note', ex.subject_id ? `ยังไม่มีโน้ต${nameOf(s)}ในช่วงนี้ — ถ่ายรูปกระดานหรือจดโน้ตในงานของวิชานี้ แล้วจะมาอยู่ที่นี่` : 'ใส่วิชาให้สอบนี้ (ปุ่มแก้ไขด้านบน) แล้วโน้ตของวิชานั้นจะมารวมที่นี่'),
  );
}

/** อ่านทีละชิ้นเต็มจอ: "อ่านแล้ว" = ติ๊กแล้วไปชิ้นถัดไป · แตะพื้นหลัง/Esc = ปิด */
function reader(list) {
  let i = 0;
  const box = h('div.reader', { role: 'dialog', 'aria-label': 'อ่านทีละชิ้น' });
  const onKey = e => { if (e.key === 'Escape') close(); };
  const close = () => { box.remove(); removeEventListener('keydown', onKey); };
  const show = () => {
    if (i >= list.length) { close(); toast('อ่านครบแล้ว'); return; }
    const x = list[i], nt = x.note, img = nt.kind === 'image' && nt.blob, q = quoteOf(nt);
    put(box,
      h('div.rd-top', h('span', `${i + 1}/${list.length} · ${dayName(x.day)} · ${x.task.title}`), h('button', { 'aria-label': 'ปิด', html: ic('close'), onclick: close })),
      h('div.rd-body', img ? h('img', { src: urlOf(nt), alt: 'รูปโน้ต' }) : h('div.rd-text' + (q.said ? '.said' : ''), q.said ? `“${q.text}”` : q.text)),
      h('div.rd-foot', h('button.btn', { onclick: () => { i++; show(); } }, 'ข้าม'),
        h('button.btn.primary', { onclick: async () => { await app.store.patchAttachment(nt.id, { read_at: new Date().toISOString() }); i++; show(); } }, 'อ่านแล้ว · ถัดไป')));
  };
  addEventListener('keydown', onKey);
  document.body.append(box);
  show();
}
