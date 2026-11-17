// จุดเริ่มแอป: เปิดที่เก็บข้อมูล → วาดหน้า → แถบล่าง 3 เมนู (#/home · #/tasks · #/me)
import { h, ICON, toast } from './ui/dom.js';
import { openBestDB } from './data/db.js';
import { createStore } from './data/store.js';
import { initAdd } from './features/add.js';
import { initDetail } from './features/detail.js';
import { initViews, homeView, tasksView, meView, applyTheme } from './features/views.js';

globalThis.SABAII_VERSION = '0.3.0-local';
const ROUTES = { home: ['หน้าหลัก', 'home', homeView], tasks: ['งาน', 'list', tasksView], me: ['ฉัน', 'user', meView] };

async function boot() {
  const root = document.getElementById('app');
  const db = await openBestDB();
  const store = createStore(db);
  try { await store.load(); }
  catch (e) { root.replaceChildren(h('div.empty', { style: { marginTop: '40px' } }, h('b', 'เปิดข้อมูลในเครื่องไม่ได้'), String(e.message || e))); return; }
  initAdd(store); initDetail(store); initViews(store);
  applyTheme(store.state.prefs.theme || 'system');

  const nav = h('nav.nav', { 'aria-label': 'เมนูหลัก' }, Object.entries(ROUTES).map(([k, [label, ic]]) =>
    h('a', { href: '#' + k, 'data-route': k }, h('span', { html: ICON[ic] }), label)));
  document.body.append(nav);

  // รับทั้ง #home และ #/home — หน้าแบบ artifact ส่งต่อได้เฉพาะ #ชื่อ ธรรมดา
  const route = () => { const k = location.hash.replace(/^#\/?/, ''); return k in ROUTES ? k : 'home'; };
  let last = null;
  function render() {
    const r = route();
    // รักษาตำแหน่งเลื่อนและช่องที่กำลังพิมพ์ไว้ ถ้าวาดซ้ำหน้าเดิม
    const y = r === last ? window.scrollY : 0;
    const focusedSearch = document.activeElement?.type === 'search';
    root.className = r === 'home' ? '' : 'pad';
    ROUTES[r][2](root);
    nav.querySelectorAll('a').forEach(a => { if (a.dataset.route === r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (r !== last) document.title = `${ROUTES[r][0]} · SABAii.com`;
    window.scrollTo(0, y);
    if (focusedSearch) { const s = root.querySelector('input[type=search]'); s?.focus(); s?.setSelectionRange?.(s.value.length, s.value.length); }
    last = r;
  }
  window.addEventListener('hashchange', render);
  store.subscribe(render);
  render();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  window.addEventListener('offline', () => toast('ออฟไลน์อยู่ — เพิ่มและแก้งานได้ตามปกติ ข้อมูลอยู่ในเครื่อง'));
  globalThis.__sabaii = store; // ใช้ตอนทดสอบเท่านั้น
}
boot();
