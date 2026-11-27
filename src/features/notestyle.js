// หน้าตาหน้าโน้ตงาน 6 แบบ (ผู้ใช้เลือกตอนเข้าแอปครั้งแรก หรือที่หน้าฉัน) — โครงเหมือนกันทุกแบบ:
//   ชื่องาน · กำหนดส่ง · แก้ไข · เพิ่มโน้ต รูป/ข้อความ/เสียง · ทำเลย → ทำเสร็จแล้ว
// ปุ่ม "รูป" ไม่บังคับกล้อง — มือถือจะถามเองว่าถ่ายใหม่หรือเลือกจากคลัง (เลยไม่ต้องมีปุ่ม + ลอยซ้ำอีกอัน)
// ไฟล์นี้สร้างเนื้อในแผ่นล่างตอนดูโน้ต ส่วนชั้นหลัง (รูป/พื้น/ปุ่มบน) แต่งด้วยคลาส body.ns-1 … ns-6 ใน app.css
import { h, ic, toast, shortOf, nameOf } from '../ui/kit.js';
import { S, dueInfo, urlOf } from './shared.js';

export const NOTE_STYLES = [
  { id: 1, name: 'เรียบหรู', desc: 'สีวิชาจาง ๆ ด้านบน รูปมีขอบขาว ป้ายวิชาและกำหนดส่งอยู่เหนือชื่องาน' },
  { id: 2, name: 'ภาพเต็มจอ', desc: 'รูปโน้ตเบลอเป็นพื้นหลัง แผ่นล่างเป็นกระจกฝ้าสีเข้ม' },
  { id: 3, name: 'ใบงาน', desc: 'การ์ดลอยแบบตั๋ว ส่ง / ใช้เวลา / โน้ต อ่านทีเดียวจบ' },
  { id: 4, name: 'สมุดกราฟ', desc: 'กระดาษกราฟ รูปแบบโพลารอยด์ ชื่องานลายมือ ปุ่มแบบสติกเกอร์' },
  { id: 5, name: 'สีวิชาเต็มหัว', desc: 'ครึ่งบนเป็นสีของวิชา ปัดเพื่อเริ่มทำ กันกดพลาด' },
  { id: 6, name: 'การ์ดลอย', desc: 'แผ่นล่างลอยเหมือนวิดเจ็ต กล่องกำหนดส่งกับกล่องโน้ต' },
];
export const noteStyle = () => { const v = Number(S().prefs.note_style); return v >= 1 && v <= 6 ? v : 1; };
export const styleName = id => NOTE_STYLES.find(x => x.id === id)?.name || NOTE_STYLES[0].name;
export const stylePreview = id => `assets/note-styles/ns-${id}.jpg`;
export function applyNoteStyle() {
  const v = noteStyle();
  for (const x of NOTE_STYLES) document.body.classList.toggle('ns-' + x.id, x.id === v);
}

/** เนื้อในแผ่นล่างตอนดูโน้ต · act = { edit, add(kind), start, finish } */
export function notePane(t, s, notes, timer, act) {
  const doing = t.status === 'doing', due = dueInfo(t), n = notes.length;
  const color = s?.color || '#69778F';
  const editBtn = () => h('button.iconbtn.nedit', { 'aria-label': 'แก้ไขงาน', onclick: act.edit, html: ic('edit') });
  const pill = (kind, icon, label, cls = '') => h('button.pill' + cls, { onclick: () => act.add(kind), 'aria-label': `เพิ่มโน้ต${label}`, html: ic(icon) + `<span>${label}</span>` });
  const pills = cls => [pill('photo', 'camera', 'รูป', cls), pill('text', 'text', 'ข้อความ', cls), pill('voice', 'mic', 'เสียง', cls), pill('book', 'notebook', 'สมุด', cls)];
  const title = () => h('h2', h('span.ht', t.title));
  const extras = [t.est_min ? `~${t.est_min} นาที` : '', t.place || ''].filter(Boolean).join(' · ');
  const button = (label, sub) => doing
    ? h('button.cta.doing', { onclick: act.finish, html: ic('check') + 'ทำเสร็จแล้ว' })
    : h('button.cta', { onclick: act.start }, label, sub ? h('small', sub) : '', h('span.ctai', { html: ic('play') }));
  const subjName = nameOf(s) || 'ไม่ระบุวิชา';
  const v = noteStyle();

  if (v === 3) {
    const lab = due.text.replace(/^(ส่ง|สอบ)/, '') || due.text;
    const field = (k, val, cls = '') => h('div.tkf' + cls, h('small', k), h('b', val));
    return [
      h('div.tk-a',
        h('div.tk-lab', { style: { '--c': color } }, `ใบงาน · ${subjName}`, doing ? timer : ''),
        title(), editBtn(),
        h('div.tk-fields',
          field(t.type === 'exam' ? 'สอบ' : 'ส่ง', lab, due.urgent ? '.red' : ''),
          field('ใช้เวลา', t.est_min ? `~${t.est_min} นาที` : 'ไม่ระบุ'),
          field('โน้ต', n ? `${n} รายการ` : 'ยังไม่มี'))),
      h('div.tk-cut', { 'aria-hidden': 'true' }),
      h('div.tk-b', pills('.sq'), doing ? button() : h('button.cta', { onclick: act.start, html: 'ทำเลย' + ic('arrow') })),
    ];
  }

  if (v === 5) {
    return [
      h('div.ntitle',
        h('div', h('div.n5due' + (due.urgent ? '.urgent' : ''), h('span', { html: ic('clock') }), due.text, doing ? timer : h('small', '· ยังไม่เริ่ม')), title()),
        editBtn()),
      h('div.n5add', h('span', 'เพิ่มโน้ต'), pills('.round')),
      slider(doing ? 'ปัดเพื่อทำเสร็จ' : 'ปัดเพื่อเริ่มทำ', doing ? act.finish : act.start, doing),
    ];
  }

  if (v === 6) {
    const img = notes.find(a => a.kind === 'image' && a.blob);
    return [
      h('div.b6hd',
        h('span.b6badge', { style: { background: color }, 'aria-hidden': 'true' }, shortOf(s)),
        h('div.b6t', title(), h('small', subjName, extras ? ` · ${extras}` : '', doing ? timer : '')),
        editBtn()),
      h('div.b6bento',
        h('div.bx.bdue' + (due.urgent ? '.urgent' : ''), h('small', 'กำหนดส่ง'), h('b', due.text.replace(/^(ส่ง|สอบ)/, '') || due.text)),
        h('div.bx.bnote', img ? h('img', { src: urlOf(img), alt: '' }) : '', h('div', h('small', 'โน้ต'), h('b', n ? `${n} รายการ` : 'ยังไม่มี')))),
      h('div.pills.seg6', pills()),
      button('ทำเลย', 'เริ่มจับเวลา'),
    ];
  }

  // แบบ 1 · 2 · 4 ใช้โครงเดียวกัน ต่างกันที่ CSS
  return [
    h('div.ntitle',
      h('div',
        h('div.nchips',
          h('span.nsubj', { style: { '--c': color } }, subjName),
          h('span.ndue' + (due.urgent ? '.urgent' : ''), due.text + (v === 4 && due.urgent ? '!' : '')),
          extras ? h('span.nx', extras) : '', doing ? timer : ''),
        title()),
      editBtn()),
    h('div.lbl', 'เพิ่มโน้ตให้งานนี้'),
    h('div.pills', pills()),
    button('ทำเลย', v === 1 || v === 4 ? 'เริ่มจับเวลา' : ''),
  ];
}

/** ปุ่มปัดขวาเพื่อเริ่ม/เสร็จ (แบบ 5) — แตะเฉย ๆ ไม่ทำงาน (กันกดพลาด) · คีย์บอร์ด Enter/Space ใช้ได้ */
function slider(label, run, doing) {
  const th = h('span.th', { html: ic(doing ? 'check' : 'arrow') });
  const el = h('button.cta.slide' + (doing ? '.doing' : ''), { 'aria-label': label.replace('ปัดเพื่อ', '') },
    th, h('span.sl', label), h('span.chev', { 'aria-hidden': 'true' }, '›››'));
  let d = null;
  const max = () => el.clientWidth - th.offsetWidth - 10;
  el.addEventListener('pointerdown', e => {
    if (e.button) return;
    e.stopPropagation(); // ไม่ให้แผ่นล่างลากตาม
    d = { x: e.clientX, id: e.pointerId, dx: 0 };
    el.setPointerCapture?.(e.pointerId);
    th.style.transition = 'none';
  });
  el.addEventListener('pointermove', e => {
    if (!d || e.pointerId !== d.id) return;
    d.dx = Math.max(0, Math.min(max(), e.clientX - d.x));
    th.style.transform = `translateX(${d.dx}px)`;
    el.style.setProperty('--p', (d.dx / max()).toFixed(2));
  });
  const end = () => {
    if (!d) return;
    const done = d.dx > max() * .72, tap = d.dx < 6; d = null;
    th.style.transition = ''; th.style.transform = done ? `translateX(${max()}px)` : ''; el.style.removeProperty('--p');
    if (done) { if (navigator.vibrate) navigator.vibrate(12); setTimeout(run, 120); }
    else if (tap) toast('ปัดปุ่มไปทางขวาเพื่อ' + label.replace('ปัดเพื่อ', ''));
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('click', e => { if (e.detail === 0) run(); }); // จากคีย์บอร์ด
  return el;
}
