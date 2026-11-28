// จุดเริ่มแอป: เปิดที่เก็บข้อมูลในเครื่อง → หน้าแรก (ชั้นโน้ต + แผ่นล่าง) · หน้างาน · สมุด (+ สมุดจด #/book/<id>) · หน้าฉัน · หน้าวิชา
import { h, ic, toast, $ } from './ui/kit.js';
import { openBestDB } from './data/db.js';
import { createStore } from './data/store.js';
import { createCloud } from './data/cloud.js';
import { createSync } from './data/sync.js';
import { showLogin } from './features/login.js';
import { app, gcUrls } from './features/shared.js';
import { initHome, renderHomeAll, homeState, setSnap, goPage } from './features/home.js';
import { applyNoteStyle } from './features/notestyle.js';
import { needsOnboarding, openOnboarding } from './features/onboard.js';

globalThis.SABAII_VERSION = '0.14.0';
const TITLES = { home: 'หน้าหลัก', tasks: 'งาน', notebook: 'สมุด', me: 'ฉัน', subject: 'วิชา', book: 'สมุดจด' };
const PAGES = {
  tasks: [() => import('./features/tasks.js'), 'tasksView'],
  subject: [() => import('./features/tasks.js'), 'subjectView'],
  notebook: [() => import('./features/notebook.js'), 'notebookView'],
  book: [() => import('./features/sketch.js'), 'bookView'],
  me: [() => import('./features/me.js'), 'meView'],
};

/** รับทั้ง #home และ #/home (ลิงก์แบบ artifact ส่งต่อได้เฉพาะ #ชื่อ ธรรมดา) */
export function route() {
  const [name, arg] = location.hash.replace(/^#\/?/, '').split('/');
  return Object.hasOwn(TITLES, name) ? { name, arg } : { name: 'home' };
}

async function boot() {
  let store, sync;
  const cloud = createCloud();
  // กลับมาจาก Google: ?code=… (หรือ ?error=… ถ้ากดยกเลิก) → แลกเป็นการเข้าสู่ระบบ แล้วลบออกจากแถบที่อยู่ ไปหน้าฉัน
  let signedIn = false, signInErr = '';
  if (/[?&](code|error)=/.test(location.search) || /[#&]error=/.test(location.hash)) {
    try { signedIn = await cloud.finishRedirect(location.search, location.hash); } catch (e) { signInErr = e.message; }
    history.replaceState(history.state, '', location.pathname + (signedIn ? '#/home' : ''));
  }
  // ต้องเข้าสู่ระบบก่อนทุกครั้ง: ยังไม่เข้า → หน้าเข้าสู่ระบบอย่างเดียว ไม่เปิดแอป
  if (!cloud.user()) {
    showLogin(cloud, { error: signInErr });
    document.documentElement.classList.remove('booting');
    return;
  }
  // หลุดจากระบบกลางทาง (token ใช้ไม่ได้แล้ว / ลบบัญชี) → หน้าเข้าสู่ระบบทับแอป ข้อมูลในเครื่องยังอยู่
  cloud.onChange(u => { if (!u) showLogin(cloud, { again: true }); });
  try {
    const db = await openBestDB();
    sync = createSync({ db, cloud });
    store = createStore(sync.trackedDB);
    sync.attach(store);
    await store.load();
  }
  catch (e) {
    $('#pane-home').replaceChildren();
    document.documentElement.classList.remove('booting');
    document.body.append(h('div.fatal', h('b', 'เปิดข้อมูลในเครื่องไม่ได้'), h('p', String(e.message || e))));
    return;
  }
  app.store = store; app.cloud = cloud; app.sync = sync;
  document.documentElement.dataset.theme = 'light';
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
  const views = new Map(), loading = new Set();
  function renderPage() {
    const r = route(), key = r.name + '/' + (r.arg || '');
    const y = key === last ? page.scrollTop : 0;
    page.hidden = r.name === 'home';
    const entry = PAGES[r.name];
    if (views.has(r.name)) views.get(r.name)(page, r.arg);
    else if (entry && !loading.has(r.name)) {
      loading.add(r.name);
      page.replaceChildren(h('div.phead', h('h1', TITLES[r.name])), h('p.muted', { role: 'status' }, 'กำลังเปิด…'));
      entry[0]().then(module => {
        views.set(r.name, module[entry[1]]);
        if (route().name === r.name) renderPage();
      }, () => {
        if (route().name === r.name) page.replaceChildren(h('p.empty-note', 'เปิดหน้านี้ไม่ได้ ลองเปิดใหม่อีกครั้ง'));
      }).finally(() => loading.delete(r.name));
    } else if (entry && key !== last) {
      page.replaceChildren(h('div.phead', h('h1', TITLES[r.name])), h('p.muted', { role: 'status' }, 'กำลังเปิด…'));
    }
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
  sync.onStatus(() => { if (route().name === 'me') renderPage(); });
  app.refresh();
  document.documentElement.classList.remove('booting');
  // ครั้งแรก: แบบสอบถามก่อนเข้าแอป · กดมาจากหน้าแนะนำ (?from=landing) ข้ามหน้าต้อนรับไปข้อ 1 เลย
  const fromLanding = new URLSearchParams(location.search).get('from') === 'landing';
  if (location.search) history.replaceState(history.state, '', location.pathname + location.hash);
  if (needsOnboarding()) openOnboarding({ start: fromLanding || signedIn ? 1 : 0 }); // เพิ่งผ่านหน้าเข้าสู่ระบบ = ทักทายไปแล้ว

  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  addEventListener('offline', () => toast(cloud.user() ? 'ออฟไลน์อยู่ — เพิ่มและแก้งานได้ตามปกติ ต่อเน็ตแล้วจะซิงก์เอง' : 'ออฟไลน์อยู่ — เพิ่มและแก้งานได้ตามปกติ ข้อมูลอยู่ในเครื่อง'));
  // ซิงก์: ตอนเปิดแอป · ต่อเน็ตได้ · กลับมาที่แอป · ทุก 1 นาทีที่เปิดดูอยู่ (แก้งานแล้วส่งเองภายใน 2 วินาที)
  const syncIfIn = () => { if (cloud.user() && document.visibilityState === 'visible') sync.syncNow(); };
  addEventListener('online', syncIfIn);
  document.addEventListener('visibilitychange', syncIfIn);
  setInterval(syncIfIn, 60_000);
  if (signedIn) import('./features/account.js').then(({ afterSignIn }) => {
    if (cloud.user()) return afterSignIn(cloud.user());
  }).catch(() => toast('เตรียมบัญชีไม่สำเร็จ กรุณาเปิดแอปใหม่'));
  else requestAnimationFrame(() => setTimeout(syncIfIn, 0));
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

