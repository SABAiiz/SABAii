// แผ่นล่าง 3 สถานะ (ปิด · ครึ่งจอ · เต็มจอ) — ลากตามนิ้วได้ · ปิดด้วยปุ่มย้อนกลับของเครื่อง/ปัดลง/ปุ่มปิด
// ถ้าในแผ่นมีข้อความที่ยังไม่บันทึก (isDirty) จะถามก่อนปิดเสมอ — สเปกข้อ 3
import { h, ICON, confirmBox, put } from './dom.js';

let current = null;

export function openSheet({ title, body, foot, state = 'compact', isDirty = () => false, onClose, label }) {
  if (current) current.forceClose();
  const scrim = h('div.scrim');
  const sheet = h('section.sheet', { role: 'dialog', 'aria-modal': 'true', 'aria-label': label || title || 'แผ่นเครื่องมือ' });
  const grab = h('div.grab', { 'aria-hidden': 'true' }, h('i'));
  const closeBtn = h('button.iconbtn', { 'aria-label': 'ปิด', html: ICON.close });
  const titleEl = h('h2', title || '');
  const bodyEl = h('div.sbody');
  const footEl = h('div.sfoot');
  sheet.append(grab, h('div.shead', titleEl, closeBtn), bodyEl, footEl);
  document.body.append(scrim, sheet);
  const prevFocus = document.activeElement;

  let st = state;
  const setState = s => { st = s; sheet.classList.toggle('compact', s === 'compact'); sheet.classList.toggle('expanded', s === 'expanded'); };
  setState(state);
  requestAnimationFrame(() => { scrim.classList.add('show'); sheet.classList.add('open'); });

  // ปุ่มย้อนกลับของเครื่อง = ปิดแผ่น
  try { history.pushState({ sheet: true }, ''); } catch { /* บางกรอบหน้าเว็บไม่ให้ใช้ history — ปิดด้วยปุ่ม/ปัดลงได้ตามปกติ */ }
  const onPop = () => { tryClose(true); };
  window.addEventListener('popstate', onPop);
  const onKey = e => { if (e.key === 'Escape') tryClose(); };
  document.addEventListener('keydown', onKey);

  let closed = false;
  const closeHooks = [];
  function teardown() {
    if (closed) return; closed = true;
    window.removeEventListener('popstate', onPop);
    document.removeEventListener('keydown', onKey);
    scrim.classList.remove('show'); sheet.classList.remove('open');
    setTimeout(() => { scrim.remove(); sheet.remove(); }, 260);
    if (current === api) current = null;
    prevFocus?.focus?.();
    onClose?.();
    closeHooks.forEach(fn => { try { fn(); } catch {} });
  }
  async function tryClose(fromPop = false) {
    if (closed) return;
    if (isDirty()) {
      if (fromPop) { try { history.pushState({ sheet: true }, ''); } catch {} } // ยังไม่ปิด ต้องคืน state ไว้ให้กดย้อนกลับได้อีก
      const ok = await confirmBox({ title: 'ทิ้งข้อความที่พิมพ์ไว้?', body: 'ยังไม่ได้บันทึก ถ้าปิดตอนนี้ข้อความจะหาย', ok: 'ทิ้ง', cancel: 'กลับไปแก้ต่อ', danger: true });
      if (!ok) return;
      if (fromPop) { teardown(); history.back(); return; }
    }
    if (!fromPop && history.state?.sheet) { teardown(); history.back(); return; }
    teardown();
  }
  closeBtn.onclick = () => tryClose();
  scrim.onclick = () => tryClose();

  // ลากที่จับ: ลากขึ้น = ขยาย · ลากลง = ย่อ/ปิด
  let y0 = null, h0 = 0;
  grab.addEventListener('pointerdown', e => { y0 = e.clientY; h0 = sheet.getBoundingClientRect().height; grab.setPointerCapture(e.pointerId); sheet.style.transition = 'none'; });
  grab.addEventListener('pointermove', e => {
    if (y0 == null) return;
    const dy = e.clientY - y0;
    if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
    else sheet.style.height = Math.min(window.innerHeight * .92, h0 - dy) + 'px';
  });
  grab.addEventListener('pointerup', e => {
    if (y0 == null) return;
    const dy = e.clientY - y0; y0 = null;
    sheet.style.transition = ''; sheet.style.transform = ''; sheet.style.height = '';
    if (Math.abs(dy) < 6) { setState(st === 'compact' ? 'expanded' : 'compact'); return; } // แตะที่จับ = สลับขนาด
    if (dy < -40) setState('expanded');
    else if (dy > 80) { if (st === 'expanded') setState('compact'); else tryClose(); }
  });
  grab.addEventListener('pointercancel', () => { y0 = null; sheet.style.transition = ''; sheet.style.transform = ''; sheet.style.height = ''; });

  const api = {
    sheet, body: bodyEl, foot: footEl,
    setTitle: t => { titleEl.textContent = t; },
    setBody: (...nodes) => { put(bodyEl, nodes); bodyEl.scrollTop = 0; },
    setFoot: (...nodes) => { put(footEl, nodes); footEl.hidden = !footEl.childNodes.length; },
    setState, close: () => tryClose(), forceClose: () => { if (history.state?.sheet) { teardown(); history.back(); } else teardown(); },
    setDirty: fn => { isDirty = fn; },
    onClose: fn => closeHooks.push(fn),
  };
  current = api;
  if (body) api.setBody(body); else api.setBody();
  api.setFoot(...(foot ? [foot] : []));
  setTimeout(() => closeBtn.focus(), 50);
  return api;
}
