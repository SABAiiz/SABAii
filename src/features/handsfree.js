// โหมดโบกมือในชั้นโน้ต — มือเลอะ/ถือปากกาอยู่ก็เปลี่ยนโน้ตได้ไม่ต้องแตะจอ
//   ทิศเหมือนนิ้วลาก: มือไปขวา = เนื้อหาไปขวา (โน้ตก่อนหน้า) · มือไปซ้าย = โน้ตถัดไป · มือขึ้น = งานถัดไป · มือลง = งานก่อนหน้า
//   ปุ่มมือมุมขวาบน (เฉพาะตอนดูโน้ต) · ออกจากโหมดโน้ต/ปิดแอป = กล้องดับทันที · ภาพไม่ออกจากเครื่อง
import { h, ic, toast, $ } from '../ui/kit.js';
import { app } from './shared.js';

let session = null, ui = null, nav = null, seenHint = false;

/** nav = { note(d), task(d) } จากหน้าแรก */
export function initHandsfree(navigation) {
  nav = navigation;
  const btn = h('button.fab', { id: 'note-hand', 'aria-label': 'โหมดโบกมือ', 'aria-pressed': 'false', html: ic('hand'), onclick: () => (session || ui ? stopHandsfree() : startHandsfree()) });
  $('#note-ui').append(btn);
  addEventListener('pagehide', stopHandsfree);
}

export async function startHandsfree() {
  if (ui) return;
  const video = h('video', { 'aria-hidden': 'true' });
  const status = h('span.hf-st', 'กำลังเปิดกล้อง…');
  const dot = h('div.hf-dot', { 'aria-hidden': 'true' });
  const flash = h('div.hf-flash', { 'aria-hidden': 'true' });
  ui = { box: h('div.hf', { role: 'status', 'aria-live': 'polite' }, h('div.hf-cam', video), status), dot, flash, status };
  document.body.append(ui.box, dot, flash);
  $('#note-hand')?.setAttribute('aria-pressed', 'true');
  document.body.classList.add('hf-on');
  const { startHands } = await import('../gesture/hand.js');
  const mine = ui;
  const s = await startHands({
    video,
    onState: st => {
      if (ui !== mine) return;
      mine.box.dataset.state = st;
      mine.status.textContent = { loading: 'กำลังเตรียม…', ready: 'โบกมือได้เลย', denied: 'ยังไม่ได้อนุญาตกล้อง', unsupported: 'เครื่องนี้ยังใช้ไม่ได้' }[st] || '';
      if (st === 'ready' && !seenHint) { seenHint = true; toast('ซ้ายขวา = โน้ต · ขึ้นลง = งาน'); }
      if (st === 'denied' || st === 'unsupported') setTimeout(() => ui === mine && stopHandsfree(), 2600);
    },
    onPoint: p => handPoint(p),
    onSwipe: d => handSwipe(d),
  });
  if (ui !== mine) { s?.stop(); return; }
  session = s;
}

export function stopHandsfree() {
  session?.stop(); session = null;
  if (!ui) return;
  const u = ui; ui = null;
  u.box.classList.add('out'); u.dot.remove(); u.flash.remove();
  setTimeout(() => u.box.remove(), 250);
  $('#note-hand')?.setAttribute('aria-pressed', 'false');
  document.body.classList.remove('hf-on');
}

/** จุดมือบนจอ (0..1) — แสดงเป็นจุดเรืองแสง */
export function handPoint(p) {
  if (!ui) return;
  ui.dot.classList.toggle('on', !!p);
  if (p) ui.dot.style.transform = `translate3d(${(p.x * innerWidth).toFixed(0)}px,${(p.y * innerHeight).toFixed(0)}px,0)`;
}

/** ผลของการปัด (เรียกจากกล้อง หรือจากเทสต์) */
export function handSwipe(dir) {
  const act = { left: () => nav.note(1), right: () => nav.note(-1), up: () => nav.task(1), down: () => nav.task(-1) }[dir];
  if (!act || !nav) return;
  session?.rest?.(650); // พักตัวตามมือระหว่างเปลี่ยนหน้า
  act();
  if (ui) {
    ui.flash.dataset.dir = dir;
    ui.flash.classList.remove('go'); void ui.flash.offsetWidth; ui.flash.classList.add('go');
  }
  if (navigator.vibrate) navigator.vibrate(8);
}

export const handsfreeOn = () => !!ui;
app.handsfree = { start: startHandsfree, stop: stopHandsfree, swipe: handSwipe, on: handsfreeOn };
