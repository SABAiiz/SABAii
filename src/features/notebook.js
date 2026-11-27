// หน้า "สมุด" (0.9.9) — ที่เก็บของที่ไม่มีวันส่ง: ค้นในโน้ตทุกงาน · การ์ดวิชาแบบ B (ไอคอนวิชาในวงสีอ่อน) → หน้าวิชา
// ภาพที่ใช้ตัดสินใจ: mockups/sabaii-notebook.jpg · mockups/sabaii-notebook-covers.jpg (เจ้าของเลือกแบบ B)
// 0.11: วิชา = สมุด (แบบ ข ที่เจ้าของเลือก: การ์ดขาวเดิม + หน้าโน้ตจริงซ้อนโผล่มุมขวา · ป้ายสอบใกล้) · โปรเจกต์ของตัวเองเป็นการ์ดยาว · + เพิ่ม = วิชา/โปรเจกต์ใหม่
// ภาพที่ใช้ตัดสินใจ: mockups/sabaii-notebook-subjects.jpg (แบบ ข + ข้อ 4–5)
import { h, ic, put, subjIcon, nameOf, NONE } from '../ui/kit.js';
import { isLive } from '../domain/tasks.js';
import { app, S, subj, notesOf, visibleSubjects } from './shared.js';
import { searchNotes as search } from '../domain/notebook.js';
import { searchPages } from '../domain/pages.js';
import { bookDialog, openSketch, si, thumb, subjectBook, projectBooks, bookFace } from './sketch.js';
import { daysBetween } from '../domain/dates.js';
import { today } from './shared.js';

const nb = { q: '' };
const live = () => S().tasks.filter(isLive);
const subjExists = id => !!id && S().subjects.some(s => s.id === id);


function results(box) {
  const hits = search(nb.q, live(), id => notesOf(id));
  const pageHits = searchPages(nb.q, S().books, id => app.store.pagesOf(id));
  const n = hits.length + pageHits.length;
  put(box, !nb.q.trim() ? '' : n
    ? [h('p.sec2.nb-rs', `เจอ ${n} รายการ`), pageHits.map(({ book: b, page: p, text }) => {
        const no = p ? app.store.pagesOf(b.id).findIndex(x => x.id === p.id) + 1 : 0;
        const f = bookFace(b);
        return h('button.nb-hit', { onclick: () => { location.hash = f.subject && subjectBook(f.subject.id)?.id === b.id ? '#/subject/' + f.subject.id : '#/book/' + b.id; setTimeout(() => openSketch(b.id, p?.id), 30); } },
          h('span.si-box', { style: { '--c': f.color }, html: si('pen') }),
          h('span.tx', h('b', p ? snippet(text, nb.q) : f.title), h('small', p ? `${f.title} · หน้า ${no}` : 'ชื่อสมุด')));
      }), hits.map(({ task: t, note: n }) => {
        const s = subj(t.subject_id);
        return h('button.nb-hit', { onclick: () => app.openNotes(t.id) },
          h('span.si-box', { style: { '--c': s.color || '#69778F' }, html: subjIcon(s) }),
          h('span.tx', h('b', n ? snippet(n.text, nb.q) : t.title), h('small', [nameOf(s), n ? t.title : 'ชื่องาน'].filter(Boolean).join(' · '))));
      })]
    : h('p.empty-note', `ไม่เจอ "${nb.q.trim()}" ในโน้ต`));
}
const snippet = (text, q) => { const i = text.toLowerCase().indexOf(q.trim().toLowerCase()); const a = Math.max(0, i - 18); return (a ? '…' : '') + text.slice(a, a + 70).replace(/\s+/g, ' '); };

/** สอบที่ใกล้ที่สุดของวิชา (ภายใน 7 วัน) → "สอบพรุ่งนี้" · "สอบ 3 วัน" */
function examSoon(tasks) {
  const n = tasks.filter(t => t.type === 'exam' && t.status !== 'done' && t.due_date).map(t => daysBetween(today(), t.due_date)).filter(d => d >= 0 && d <= 7).sort((a, b) => a - b)[0];
  return n == null ? null : n === 0 ? 'สอบวันนี้' : n === 1 ? 'สอบพรุ่งนี้' : `สอบ ${n} วัน`;
}
/** หน้าโน้ตจริงล่าสุด 2 แผ่นซ้อนโผล่มุมการ์ด */
const peeks = b => !b ? [] : app.store.pagesOf(b.id).filter(p => !p.cover && (p.strokes.length || p.texts.length || p.imgs.length))
  .sort((a, c) => (c.updated_at || '').localeCompare(a.updated_at || '')).slice(0, 2).reverse()
  .map((p, i, a) => h('span.nb-peek' + (a.length === 2 && i === 0 ? '.back' : ''), thumb(p, 96)));

export function notebookView(root) {
  const res = h('div.nb-results');
  const input = h('input', { id: 'nb-q', type: 'search', placeholder: 'ค้นในโน้ต สมุด และชื่องาน…', value: nb.q, 'aria-label': 'ค้นในสมุด', autocomplete: 'off',
    oninput: e => { nb.q = e.target.value; results(res); grid.hidden = projWrap.hidden = !!nb.q.trim(); } });

  const cards = [...visibleSubjects(), NONE].map(s => {
    const tasks = live().filter(x => s.id ? x.subject_id === s.id : !subjExists(x.subject_id));
    if (!s.id && !tasks.length) return null;
    const open = tasks.filter(x => x.status !== 'done').length;
    const b = s.id ? subjectBook(s.id) : null, n = b ? app.store.pagesOf(b.id).length : 0;
    const name = nameOf(s) || 'ไม่ระบุวิชา', ex = examSoon(tasks); // มีป้ายสอบ = ตัดคำว่าค้างออก ไม่ให้ชนป้าย
    const meta = b ? `${n} หน้า${open && !ex ? ` · ค้าง ${open}` : ''}` : open ? `ค้าง ${open} งาน` : s.id ? 'แตะเพื่อเริ่มจด' : '';
    return h('button.nb-card', { onclick: () => { app.svTab = 'notes'; location.hash = '#/subject/' + (s.id || 'none'); }, 'aria-label': `${s.name || name} · ${meta}${ex ? ' · ' + ex : ''}`, style: { '--c': s.color || '#69778F' } },
      peeks(b),
      h('span.si-box', { html: subjIcon(s) }),
      h('b', name), ex ? h('small.ex', [ex, b ? `${n} หน้า` : ''].filter(Boolean).join(' · ')) : h('small', meta));
  }).filter(Boolean);
  cards.push(h('button.nb-add', { type: 'button', onclick: () => bookDialog(), 'aria-label': 'เพิ่มวิชาหรือโปรเจกต์' },
    h('span', { html: ic('plus') }), h('b', 'เพิ่ม'), h('small', 'วิชา/โปรเจกต์')));
  const grid = h('section.nb-grid', { 'aria-label': 'วิชา', hidden: !!nb.q.trim() }, h('h2.sec2', 'วิชา'), h('div.nb-cards', cards));

  const projs = projectBooks();
  const projWrap = h('section.nb-projs', { 'aria-label': 'โปรเจกต์ของฉัน', hidden: !!nb.q.trim() },
    h('h2.sec2', 'โปรเจกต์ของฉัน'),
    projs.length ? projs.map(b => {
      const f = bookFace(b), n = app.store.pagesOf(b.id).length;
      return h('button.nb-proj', { type: 'button', onclick: () => { location.hash = '#/book/' + b.id; }, 'aria-label': `โปรเจกต์ ${f.title} · ${n} หน้า` },
        h('span.nb-book', { style: { '--c': f.color } }), h('span.tx', h('b', f.title), h('small', `${n} หน้า · แก้ล่าสุด ${lastDay(b.updated_at)}`)), h('i', { html: ic('right') }));
    }) : h('button.nb-proj.empty', { type: 'button', onclick: () => bookDialog() }, h('span.nb-book.ghost'), h('span.tx', h('b', 'เริ่มโปรเจกต์แรก'), h('small', 'งานกลุ่ม · ติวสอบ · ชมรม — เล่มของตัวเอง')), h('i', { html: ic('plus') })));

  put(root,
    h('div.phead', h('h1', 'สมุด')),
    h('label.nb-search', h('span', { html: ic('search') }), input),
    res, grid, projWrap);
  results(res);
}
const lastDay = iso => { const n = daysBetween(iso.slice(0, 10), today()); return n <= 0 ? 'วันนี้' : n === 1 ? 'เมื่อวาน' : `${n} วันก่อน`; };
