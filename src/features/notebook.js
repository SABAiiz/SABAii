// หน้า "สมุด" (0.9.9) — ที่เก็บของที่ไม่มีวันส่ง: ค้นในโน้ตทุกงาน · การ์ดวิชาแบบ B (ไอคอนวิชาในวงสีอ่อน) → หน้าวิชา
// ภาพที่ใช้ตัดสินใจ: mockups/sabaii-notebook.jpg · mockups/sabaii-notebook-covers.jpg (เจ้าของเลือกแบบ B)
import { h, ic, put, subjIcon, nameOf, NONE } from '../ui/kit.js';
import { isLive } from '../domain/tasks.js';
import { app, S, subj, notesOf, visibleSubjects } from './shared.js';
import { searchNotes as search } from '../domain/notebook.js';

const nb = { q: '' };
const live = () => S().tasks.filter(isLive);
const subjExists = id => !!id && S().subjects.some(s => s.id === id);


function results(box) {
  const hits = search(nb.q, live(), id => notesOf(id));
  put(box, !nb.q.trim() ? '' : hits.length
    ? [h('p.sec2.nb-rs', `เจอ ${hits.length} รายการ`), hits.map(({ task: t, note: n }) => {
        const s = subj(t.subject_id);
        return h('button.nb-hit', { onclick: () => app.openNotes(t.id) },
          h('span.si-box', { style: { '--c': s.color || '#69778F' }, html: subjIcon(s) }),
          h('span.tx', h('b', n ? snippet(n.text, nb.q) : t.title), h('small', [nameOf(s), n ? t.title : 'ชื่องาน'].filter(Boolean).join(' · '))));
      })]
    : h('p.empty-note', `ไม่เจอ "${nb.q.trim()}" ในโน้ต`));
}
const snippet = (text, q) => { const i = text.toLowerCase().indexOf(q.trim().toLowerCase()); const a = Math.max(0, i - 18); return (a ? '…' : '') + text.slice(a, a + 70).replace(/\s+/g, ' '); };

export function notebookView(root) {
  const res = h('div.nb-results');
  const input = h('input', { id: 'nb-q', type: 'search', placeholder: 'ค้นในโน้ตและชื่องาน…', value: nb.q, 'aria-label': 'ค้นในสมุด', autocomplete: 'off',
    oninput: e => { nb.q = e.target.value; results(res); grid.hidden = !!nb.q.trim(); } });

  const cards = [...visibleSubjects(), NONE].map(s => {
    const tasks = live().filter(x => s.id ? x.subject_id === s.id : !subjExists(x.subject_id));
    if (!s.id && !tasks.length) return null;
    const notes = tasks.flatMap(x => notesOf(x.id)), open = tasks.filter(x => x.status !== 'done').length;
    const name = nameOf(s) || 'ไม่ระบุวิชา';
    return h('button.nb-card', { onclick: () => { location.hash = '#/subject/' + (s.id || 'none'); }, 'aria-label': `${s.name || name} · โน้ต ${notes.length} · ค้าง ${open} งาน`, style: { '--c': s.color || '#69778F' } },
      h('span.si-box', { html: subjIcon(s) }),
      h('b', name), h('small', `โน้ต ${notes.length} · ค้าง ${open} งาน`));
  }).filter(Boolean);
  const grid = h('section.nb-grid', { 'aria-label': 'วิชา', hidden: !!nb.q.trim() }, h('h2.sec2', 'วิชา'), h('div.nb-cards', cards));

  put(root,
    h('div.phead', h('h1', 'สมุด')),
    h('label.nb-search', h('span', { html: ic('search') }), input),
    res, grid);
  results(res);
}
