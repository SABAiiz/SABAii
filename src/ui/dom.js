// ตัวช่วยสร้าง DOM เล็ก ๆ — ไม่มี framework · ข้อความผู้ใช้ผ่าน textContent เสมอ (ไม่มี innerHTML กับข้อมูลผู้ใช้)

/** h('button.go', { onclick }, 'ทำเลย') */
export function h(tag, props, ...kids) {
  const [name, ...cls] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (props != null && props !== false && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { kids.unshift(props); props = null; }
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className += ' ' + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v; // ใช้กับไอคอน SVG คงที่เท่านั้น
    else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false || k === '') continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}
export const clear = el => { el.replaceChildren(); return el; };
/** แทนลูกทั้งหมด โดยข้าม false/null/'' (ใช้แทน replaceChildren ตรง ๆ) */
export const put = (el, ...kids) => { el.replaceChildren(); append(el, kids); return el; };

const P = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
export const ICON = {
  mic: `<svg viewBox="0 0 24 24" ${P}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>`,
  image: `<svg viewBox="0 0 24 24" ${P}><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>`,
  pen: `<svg viewBox="0 0 24 24" ${P}><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" ${P}><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>`,
  search: `<svg viewBox="0 0 24 24" ${P}><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" ${P}><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/></svg>`,
  home: `<svg viewBox="0 0 24 24" ${P}><path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>`,
  list: `<svg viewBox="0 0 24 24" ${P}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>`,
  user: `<svg viewBox="0 0 24 24" ${P}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.5c1.5-2 3.4-3 5.5-3s4 1 5.5 3"/></svg>`,
  cal: `<svg viewBox="0 0 24 24" ${P}><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`,
  close: `<svg viewBox="0 0 24 24" ${P}><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  left: `<svg viewBox="0 0 24 24" ${P}><path d="M15 6l-6 6 6 6"/></svg>`,
  right: `<svg viewBox="0 0 24 24" ${P}><path d="M9 6l6 6-6 6"/></svg>`,
  paste: `<svg viewBox="0 0 24 24" ${P}><rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9z"/></svg>`,
  form: `<svg viewBox="0 0 24 24" ${P}><path d="M5 5h14M5 12h14M5 19h9"/></svg>`,
  exam: `<svg viewBox="0 0 24 24" ${P}><path d="M7 3h10v18H7z"/><path d="M10 8h4M10 12h4M10 16h2"/></svg>`,
  spark: `<svg viewBox="0 0 24 24" ${P}><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" ${P}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  book: `<svg viewBox="0 0 24 24" ${P}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7"/></svg>`,
  theme: `<svg viewBox="0 0 24 24" ${P}><circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>`,
  save: `<svg viewBox="0 0 24 24" ${P}><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>`,
  restore: `<svg viewBox="0 0 24 24" ${P}><path d="M12 21V9M7 14l5-5 5 5M5 3h14"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" ${P}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
  info: `<svg viewBox="0 0 24 24" ${P}><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>`,
  up: `<svg viewBox="0 0 24 24" ${P}><path d="M6 15l6-6 6 6"/></svg>`,
  down: `<svg viewBox="0 0 24 24" ${P}><path d="M6 9l6 6 6-6"/></svg>`,
  doc: `<svg viewBox="0 0 24 24" ${P}><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/></svg>`,
  cap: `<svg viewBox="0 0 48 48"><path d="M3 17L24 8l21 9-21 9z" fill="#1769D2"/><path d="M11 21v9c0 3 6 7 13 7s13-4 13-7v-9l-13 6z" fill="#3E8BEA"/><path d="M41 18v10" stroke="#0F376B" stroke-width="2.4" stroke-linecap="round"/><circle cx="41" cy="30" r="2.6" fill="#0F376B"/><path d="M33 4l1.2-3M38 6l2.4-2M40 11l3-.6" stroke="#F5B82E" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  logo: `<svg viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#1769D2"/><path d="M9 20.5c1.6 1.6 3.9 2.5 6.6 2.5 3.6 0 6-1.7 6-4.3 0-5.6-11.4-3.4-11.4-8.4C10.2 8.2 12.3 7 15 7c2.1 0 3.9.7 5.2 1.9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="23.5" cy="23.5" r="2.4" fill="#16B76A"/></svg>`,
};
export const icon = name => h('span', { 'aria-hidden': 'true', style: { display: 'contents' }, html: ICON[name] });

// ---------- แจ้งผลสั้น ๆ (มีปุ่มเลิกทำได้) ----------
let toastTimer;
export function toast(msg, action) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const el = h('div.toast', { role: 'status', 'aria-live': 'polite' }, h('span', msg),
    action && h('button', { onclick: () => { el.remove(); action.run(); } }, action.label));
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  toastTimer = setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, action ? 6000 : 2800);
}

// ---------- กล่องยืนยัน ----------
export function confirmBox({ title, body, ok = 'ตกลง', cancel = 'ยกเลิก', danger = false }) {
  return new Promise(resolve => {
    const done = v => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') done(false); };
    const okBtn = h('button.btn' + (danger ? '.danger' : '.blue'), { onclick: () => done(true) }, ok);
    const wrap = h('div.dialog', { role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t', onclick: e => { if (e.target === wrap) done(false); } },
      h('div.box', h('h3', { id: 'dlg-t' }, title), body && h('p', body),
        h('div.row', h('button.btn', { onclick: () => done(false) }, cancel), okBtn)));
    document.body.append(wrap);
    document.addEventListener('keydown', onKey);
    okBtn.focus();
  });
}

/** สีพื้นหลังป้ายวิชา + ตัวย่อ 2–4 ตัวอักษร */
export function subjectBadge(subject) {
  const name = subject?.name || 'ทั่วไป';
  // ป้ายเล็กใช้ชื่อเล่นภาษาไทยตัวแรก ("คณิต" "ชีวะ") ถ้าชื่อเต็มยาวเกิน 7 ตัวอักษร
  const base = name.replace(/^(ภาษา|วิชา)/, '');
  const nick = (subject?.aliases || []).find(a => /[ก-๙]/.test(a) && a.length <= 6);
  const short = base.length <= 7 ? base : (nick || base.slice(0, 5));
  return h('span.chipsubj', { style: { background: subject?.color || '#94A3B8' }, 'aria-hidden': 'true' }, short);
}
