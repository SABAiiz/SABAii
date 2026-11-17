// จุดเริ่มแอป: เปิดที่เก็บข้อมูลในเครื่อง → หน้าแรก (ชั้นโน้ต + แผ่นล่าง) · หน้างาน · หน้าฉัน · หน้าวิชา
import { h, ic, toast, $ } from './ui/kit.js';
import { openBestDB } from './data/db.js';
import { createStore } from './data/store.js';
import { app, gcUrls } from './features/shared.js';
import { initHome, renderHomeAll, homeState, setSnap, goPage } from './features/home.js';
import { tasksView, subjectView } from './features/tasks.js';
import { meView, applyTheme } from './features/me.js';

globalThis.SABAII_VERSION = '0.4.0-local';
const TITLES = { home: 'หน้าหลัก', tasks: 'งาน', me: 'ฉัน', subject: 'วิชา' };

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
  applyTheme(store.state.prefs.theme || 'system');
  if (store.state.dbKind !== 'indexeddb') document.body.append(h('div.storage-warn', 'เบราว์เซอร์นี้เก็บข้อมูลถาวรไม่ได้ (โหมดส่วนตัว?) — งานจะหายเมื่อปิดหน้า'));

  const page = $('#page'), nav = $('#nav');
  const NAV = { home: ['home', 'หน้าหลัก'], tasks: ['tasks', 'งาน'], me: ['me', 'ฉัน'] };
  nav.querySelectorAll('a').forEach(a => { const [i, l] = NAV[a.dataset.r]; a.innerHTML = ic(i) + `<span>${l}</span>`; });

  // เมนูล่างลอย: หลบเองตอนดูโน้ต และตอนเลื่อนรายการลง · โผล่กลับตอนเลื่อนขึ้น
  let navAway = false;
  app.updateNav = () => {
    const r = route(), here = r.name === 'subject' ? 'tasks' : r.name;
    nav.classList.toggle('away', navAway || (r.name === 'home' && document.body.classList.contains('note-mode')));
    nav.querySelectorAll('a').forEach(a => { if (a.dataset.r === here) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  };
  const autoHide = el => { let last = 0; el.addEventListener('scroll', () => { const y = el.scrollTop, dy = y - last; last = y; if (Math.abs(dy) < 4) return; const away = dy > 0 && y > 40; if (away !== navAway) { navAway = away; app.updateNav(); } }, { passive: true }); };
  autoHide(page); autoHide($('#pane-home'));

  let last = null;
  function renderPage() {
    const r = route(), key = r.name + '/' + (r.arg || '');
    const y = key === last ? page.scrollTop : 0;
    page.hidden = r.name === 'home';
    if (r.name === 'tasks') tasksView(page);
    else if (r.name === 'me') meView(page);
    else if (r.name === 'subject') subjectView(page, r.arg);
    if (key !== last) { navAway = false; document.title = `${TITLES[r.name]} · SABAii.com`; }
    page.scrollTop = y;
    last = key;
    app.updateNav();
  }
  app.refresh = () => { renderHomeAll(); renderPage(); };
  initHome();
  store.subscribe(() => { gcUrls(); app.refresh(); });
  addEventListener('hashchange', renderPage);
  app.refresh();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  addEventListener('offline', () => toast('ออฟไลน์อยู่ — เพิ่มและแก้งานได้ตามปกติ ข้อมูลอยู่ในเครื่อง'));
  globalThis.__sabaii = store; // ใช้ตอนทดสอบเท่านั้น
  globalThis.__ui = { homeState, setSnap, goPage, openNotes: id => app.openNotes(id) };
}
boot();
