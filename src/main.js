// จุดเริ่มแอป: เปิดที่เก็บข้อมูลในเครื่อง → หน้าแรก (ชั้นโน้ต + แผ่นล่าง) · หน้างาน · สมุด (+ สมุดจด #/book/<id>) · หน้าฉัน · หน้าวิชา
import { h, ic, toast, $ } from './ui/kit.js';
import { openBestDB } from './data/db.js';
import { createStore } from './data/store.js';
import { app, gcUrls } from './features/shared.js';
import { initHome, renderHomeAll, homeState, setSnap, goPage } from './features/home.js';
import { tasksView, subjectView } from './features/tasks.js';
import { notebookView } from './features/notebook.js';
import { bookView } from './features/sketch.js';
import { meView, applyTheme } from './features/me.js';
import { applyNoteStyle } from './features/notestyle.js';
import { needsOnboarding, openOnboarding } from './features/onboard.js';

globalThis.SABAII_VERSION = '0.11.1';
const TITLES = { home: 'หน้าหลัก', tasks: 'งาน', notebook: 'สมุด', me: 'ฉัน', subject: 'วิชา', book: 'สมุดจด' };

/** รับทั้ง #home และ #/home (ลิงก์แบบ artifact ส่งต่อได้เฉพาะ #ชื่อ ธรรมดา) */
export function route() {
  const [name, arg] = location.hash.replace(/^#\/?/, '').split('/');
  return name in TITLES ? { name, arg } : { name: 'home' };
}

async function boot() {
  let store;
  try { store = createStore(await openBestDB()); await store.load(); }
  catch (e) { document.body.append(h('div.fatal', h('b', 'เปิดข้อมูลในเครื่องไม่ได้'), h('p', String(e.message || e)))); return; }
  app.store = store;
  applyTheme();
  if (store.state.dbKind !== 'indexeddb') document.body.append(h('div.storage-warn', 'เบราว์เซอร์นี้เก็บข้อมูลถาวรไม่ได้ (โหมดส่วนตัว?) — งานจะหายเมื่อปิดหน้า'));

  const page = $('#page'), nav = $('#nav');
  const NAV = { home: ['home', 'หน้าหลัก'], tasks: ['tasks', 'งาน'], notebook: ['notebook', 'สมุด'], me: ['me', 'ฉัน'] };
  nav.querySelectorAll('a').forEach(a => { const [i, l] = NAV[a.dataset.r]; a.innerHTML = ic(i) + `<span>${l}</span>`; });

  // เมนูล่างลอย: หลบเองตอนดูโน้ต และตอนเลื่อนรายการลง · โผล่กลับตอนเลื่อนขึ้น
  let navAway = false;
  app.updateNav = () => {
    const r = route(), here = r.name === 'subject' || r.name === 'book' ? 'notebook' : r.name;
    nav.classList.toggle('away', navAway || (r.name === 'home' && document.body.classList.contains('note-mode')));
    nav.querySelectorAll('a').forEach(a => { if (a.dataset.r === here) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  };
  const autoHide = el => { let last = 0; el.addEventListener('scroll', () => { const y = el.scrollTop, dy = y - last; last = y; if (Math.abs(dy) < 4) return; const away = dy > 0 && y > 40; if (away !== navAway) { navAway = away; app.updateNav(); } }, { passive: true }); };
  autoHide(page); autoHide($('#pane-home'));
  navDrag(nav);

  let last = null;
  function renderPage() {
    const r = route(), key = r.name + '/' + (r.arg || '');
    const y = key === last ? page.scrollTop : 0;
    page.hidden = r.name === 'home';
    if (r.name === 'tasks') tasksView(page);
    else if (r.name === 'notebook') notebookView(page);
    else if (r.name === 'me') meView(page);
    else if (r.name === 'subject') subjectView(page, r.arg);
    else if (r.name === 'book') bookView(page, r.arg);
    if (key !== last) { navAway = false; document.title = `${TITLES[r.name]} · SABAii.com`; }
    page.scrollTop = y;
    last = key;
    app.updateNav();
  }
  app.refresh = () => { applyNoteStyle(); renderHomeAll(); renderPage(); };
  applyNoteStyle();
  initHome();
  store.subscribe(() => { gcUrls(); app.refresh(); });
  addEventListener('hashchange', renderPage);
  app.refresh();
  // ครั้งแรก: แบบสอบถามก่อนเข้าแอป · กดมาจากหน้าแนะนำ (?from=landing) ข้ามหน้าต้อนรับไปข้อ 1 เลย
  const fromLanding = new URLSearchParams(location.search).get('from') === 'landing';
  if (location.search) history.replaceState(history.state, '', location.pathname + location.hash);
  if (needsOnboarding()) openOnboarding({ start: fromLanding ? 1 : 0 });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  addEventListener('offline', () => toast('ออฟไลน์อยู่ — เพิ่มและแก้งานได้ตามปกติ ข้อมูลอยู่ในเครื่อง'));
  globalThis.__sabaii = store; // ใช้ตอนทดสอบเท่านั้น
  globalThis.__ui = { homeState, setSnap, goPage, openNotes: id => app.openNotes(id), handSwipe: d => app.handsfree?.swipe(d) };
}
boot();

/** เมนูล่าง: วางนิ้วแล้วลากซ้ายขวา เม็ดกรมท่าเลื่อนตามนิ้ว ปล่อยตรงไหนไปหน้านั้น (แตะเฉย ๆ ยังใช้ได้เหมือนเดิม)
    ข้ามช่องแล้วสั่นเบา ๆ (Android) · ลากเกิน 6px ถึงนับว่าลาก ไม่ให้แตะพลาด */
function navDrag(nav) {
  const links = [...nav.querySelectorAll('a')];
  let d = null, suppress = false;
  const slot = () => (nav.clientWidth - 12) / links.length;
  const idxAt = x => Math.max(0, Math.min(links.length - 1, Math.round(x / slot())));
  nav.addEventListener('pointerdown', e => {
    if (e.button) return;
    const cur = Math.max(0, links.findIndex(a => a.hasAttribute('aria-current')));
    d = { x0: e.clientX, start: cur * slot(), moved: false, at: cur, id: e.pointerId };
  });
  nav.addEventListener('pointermove', e => {
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x0;
    if (!d.moved) { if (Math.abs(dx) < 6) return; d.moved = true; nav.classList.add('drag'); nav.setPointerCapture?.(e.pointerId); }
    const x = Math.max(0, Math.min(slot() * (links.length - 1), d.start + dx));
    nav.style.setProperty('--nx', x.toFixed(1) + 'px');
    const i = idxAt(x);
    if (i !== d.at) { d.at = i; navigator.vibrate?.(6); }
    links.forEach((a, k) => a.classList.toggle('over', k === i));
  });
  const end = e => {
    if (!d || (e && e.pointerId !== d.id)) return;
    const done = d; d = null;
    links.forEach(a => a.classList.remove('over'));
    if (!done.moved) return;
    suppress = true; setTimeout(() => { suppress = false; }, 0);
    nav.classList.remove('drag');
    location.hash = links[done.at].getAttribute('href');
    app.updateNav?.();
  };
  nav.addEventListener('pointerup', end); nav.addEventListener('pointercancel', end);
  nav.addEventListener('click', e => { if (suppress) { e.preventDefault(); e.stopPropagation(); } }, true);
}

