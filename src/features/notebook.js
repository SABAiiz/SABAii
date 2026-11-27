// หน้า "สมุด" (0.9.9) — ที่เก็บของที่ไม่มีวันส่ง: ค้นในโน้ตทุกงาน · การ์ดวิชาแบบ B (ไอคอนวิชาในวงสีอ่อน) → หน้าวิชา
// ภาพที่ใช้ตัดสินใจ: mockups/sabaii-notebook.jpg · mockups/sabaii-notebook-covers.jpg (เจ้าของเลือกแบบ B)
// 0.10: ชั้น "สมุดจด" บนสุด — สมุดที่เขียนได้เหมือนแอปโน้ต (features/sketch.js) · ค้นเจอข้อความที่พิมพ์ในสมุดด้วย
import { h, ic, put, subjIcon, nameOf, NONE } from '../ui/kit.js';
import { isLive } from '../domain/tasks.js';
import { app, S, subj, notesOf, visibleSubjects } from './shared.js';
import { searchNotes as search } from '../domain/notebook.js';
import { searchPages } from '../domain/pages.js';
import { coverEl, bookDialog, openSketch, si } from './sketch.js';

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
        return h('button.nb-hit', { onclick: () => { location.hash = '#/book/' + b.id; setTimeout(() => openSketch(b.id, p?.id), 30); } },
          h('span.si-box', { style: { '--c': b.color }, html: si('pen') }),
          h('span.tx', h('b', p ? snippet(text, nb.q) : b.title), h('small', p ? `สมุด ${b.title} · หน้า ${no}` : 'ชื่อสมุด')));
      }), hits.map(({ task: t, note: n }) => {
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
    oninput: e => { nb.q = e.target.value; results(res); grid.hidden = shelf.hidden = !!nb.q.trim(); } });

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

  const books = [...S().books].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  const shelf = h('section.bk-shelf-wrap', { 'aria-label': 'สมุดจด', hidden: !!nb.q.trim() },
    h('h2.sec2', 'สมุดจด', books.length ? h('small', ` · ${books.length} เล่ม`) : ''),
    h('div.bk-shelf',
      h('button.bk-new', { type: 'button', onclick: () => bookDialog(), 'aria-label': 'สร้างสมุดใหม่' }, h('i', { html: ic('plus') }), h('b', 'สมุดใหม่'), h('small', books.length ? 'เขียนได้เลย' : 'จด วาด แปะรูป')),
      books.map(coverEl)));

  put(root,
    h('div.phead', h('h1', 'สมุด')),
    h('label.nb-search', h('span', { html: ic('search') }), input),
    res, shelf, grid);
  results(res);
}
