// กระดิ่งหน้าหลัก (0.15 · เจ้าของเลือกแบบ 1+2 จาก mockups/sabaii-alerts-placement.jpg)
//   มุมขวาบนข้างรูปโปรไฟล์ · เลขแดง = เรื่องด่วนที่ยังไม่ได้เปิดดู · แตะ = แผ่นรายการ · แตะเรื่อง = เปิดงานนั้น
//   เรื่องด่วนคิดในเครื่อง (alertsOf) ใช้ได้แม้ออฟไลน์ · "เห็นแล้ว" จำในเครื่องนี้ · ท้ายแผ่น = ตั้งเวลาแจ้งเตือน
import { h, ic, openModal, closeModal } from '../ui/kit.js';
import { alertsOf } from '../domain/tasks.js';
import { app, S, today, fullTitle } from './shared.js';
import { notifyModal, notifyLabel } from './notify.js';

const SEEN_KEY = 'sabaii-bell-seen';
const seen = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); } };
const remember = keys => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(keys.slice(-200))); } catch {} };

export const alertsNow = () => alertsOf(S().tasks, today());
export const unseenCount = () => { const s = seen(); return alertsNow().filter(a => !s.has(a.key)).length; };

const at = t => t.due_time ? ` ${t.due_time.slice(0, 5)}` : '';
const LOOK = {
  overdue: a => ['เลย', '#E2453A', `เลยกำหนดมา ${-a.days} วัน`],
  exam: a => ['สอบ', a.days <= 1 ? '#E2453A' : '#F08A24', (a.days === 0 ? 'สอบวันนี้' : a.days === 1 ? 'สอบพรุ่งนี้' : `สอบอีก ${a.days} วัน`) + at(a.task)],
  today: a => ['ส่ง', '#F08A24', 'ส่งวันนี้' + at(a.task)],
  tomorrow: a => ['ส่ง', '#0A6CF1', 'ส่งพรุ่งนี้' + at(a.task)],
};

/** ปุ่มกระดิ่งในแถววันที่ของหน้าหลัก */
export function bellButton(openNotes) {
  const n = unseenCount();
  return h('button.bell', { type: 'button', 'aria-label': n ? `แจ้งเตือน มีเรื่องใหม่ ${n} เรื่อง` : 'แจ้งเตือน', onclick: () => openBell(openNotes) },
    h('span', { html: ic('bell') }), n ? h('i', n > 9 ? '9+' : String(n)) : '');
}

export function openBell(openNotes) {
  const list = alertsNow(), was = seen();
  remember([...new Set([...was, ...list.map(a => a.key)])]);
  app.refresh?.(); // เลขแดงหายเมื่อเปิดดูแล้ว
  const row = a => {
    const [tag, color, when] = LOOK[a.kind](a);
    return h('button.bl-row' + (was.has(a.key) ? '' : '.new'), { type: 'button', onclick: () => { closeModal(); openNotes(a.id); } },
      h('span.bl-tag', { style: { '--c': color } }, tag),
      h('span.bl-t', h('b', fullTitle(a.task)), h('small', { style: { color: a.kind === 'tomorrow' ? '' : color } }, when)),
      h('span.chev', { html: ic('right') }));
  };
  openModal({ title: 'แจ้งเตือน', label: 'แจ้งเตือน เรื่องด่วน', body: h('div.bl',
    list.length ? h('div.bl-list', list.map(row))
      : h('div.bl-empty', h('span', { html: ic('check') }), h('b', 'ไม่มีเรื่องด่วน'), h('small', 'ไม่มีงานเลยกำหนด ไม่มีงานส่งวันนี้หรือพรุ่งนี้ และไม่มีสอบใน 3 วัน')),
    h('button.bl-set', { type: 'button', onclick: () => { closeModal(); setTimeout(notifyModal, 320); } },
      h('span', { html: ic('clock') }), h('span.bl-t', h('b', 'ตั้งเวลาแจ้งเตือน'), h('small', 'เด้งเตือนตอนเย็นก่อนวันส่ง แม้ปิดแอป')), h('em', notifyLabel()), h('span.chev', { html: ic('right') }))) });
}
