// แจ้งเตือนรายวิชา (0.16) — Web Push · เด้งแม้ปิดแอป · เจ้าของขอ "ง่ายที่สุด บอกเวลาแล้วเตือนตามนั้น แยกแต่ละวิชา"
//   หน้าฉัน › การแจ้งเตือน: วิชาละบรรทัด = เวลา (แตะเพื่อเปลี่ยน) + สวิตช์เปิด/ปิด · ค่าเริ่มต้น 19:00
//   เวลาเก็บในข้อมูลของบัญชี (ซิงก์ไปทุกเครื่อง): วิชา.remind_at · งานไม่มีวิชา = prefs.remind_none · 'off' = ไม่เตือน
//   เปิด/ปิด = ของเครื่องนี้: ขออนุญาต → pushManager.subscribe (กุญแจจาก push_public_key) → push_subscribe (เขตเวลา)
//   เซิร์ฟเวอร์ (supabase/functions/push-reminders) เช็กทุก 5 นาที → ถึงเวลาของวิชาไหน เตือนงานที่ยังไม่เสร็จของวิชานั้น
//   iPhone ต้องเพิ่มลงหน้าจอโฮมก่อน (iOS 16.4+)
import { h, put, toast, openModal } from '../ui/kit.js';
import { app, S } from './shared.js';

const ON_KEY = 'sabaii-push';
export const DEFAULT_TIME = '19:00';
export const NONE = '_none';
const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};
const valid = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || '');
/** เวลาเตือนของวิชา (หรือ NONE = งานไม่มีวิชา): 'HH:MM' | 'off' */
export function remindOf(slot, s = S()) {
  const v = slot === NONE ? s.prefs.remind_none : s.subjects.find(x => x.id === slot)?.remind_at;
  return v === 'off' || valid(v) ? v : DEFAULT_TIME;
}
async function setRemind(slot, v) {
  if (slot === NONE) await app.store.setPref('remind_none', v);
  else await app.store.updateSubject(slot, { remind_at: v });
}
const shownSubjects = (s = S()) => [...s.subjects].filter(x => !x.hidden).sort((a, b) => a.order - b.order);

const MSG = {
  unsupported: 'เบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือน ลองเปิด SABAii ด้วย Chrome หรือ Safari รุ่นใหม่',
  denied: 'เบราว์เซอร์บล็อกการแจ้งเตือนของ SABAii ไว้ เปิดได้ที่ตั้งค่าของเบราว์เซอร์ › การแจ้งเตือน แล้วกลับมากดอีกครั้ง',
  'ios-install': 'บน iPhone ต้องเพิ่ม SABAii ลงหน้าจอโฮมก่อน จึงจะแจ้งเตือนได้',
  notReady: 'ระบบแจ้งเตือนยังไม่พร้อม ปิดแล้วเปิดแอปใหม่ แล้วลองอีกครั้ง',
  signedOut: 'ต้องเข้าสู่ระบบก่อน จึงจะเปิดการแจ้งเตือนได้',
};
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/** 'ok' | 'ios-install' | 'unsupported' | 'denied' */
export function support() {
  if (isIOS() && !standalone()) return 'ios-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in globalThis) || !('Notification' in globalThis)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'ok';
}
export const notifyOn = () => ls.get(ON_KEY) === '1' && support() === 'ok' && Notification.permission === 'granted';
/** ค่าที่แสดงในแถวของหน้าฉัน */
export function notifyLabel(s = S()) {
  if (!notifyOn()) return 'ปิด';
  const n = shownSubjects(s).filter(x => remindOf(x.id, s) !== 'off').length;
  return n ? `เปิด · ${n} วิชา` : 'เปิด';
}

const b64 = s => { const t = s.replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(t + '='.repeat((4 - t.length % 4) % 4)), c => c.charCodeAt(0)); };
/** service worker ที่ลงทะเบียนแล้ว (ไม่มี = ไม่พร้อม · ไม่รอนานเกิน 6 วินาที) */
async function registration() {
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 6000))]);
  if (!reg) throw new Error(MSG.notReady);
  return reg;
}
async function save(sub) {
  const j = sub.toJSON();
  await app.cloud.rpc('push_subscribe', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth,
    p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Bangkok' });
}

export async function enable() {
  const st = support();
  if (st !== 'ok') throw new Error(MSG[st]);
  if (!app.cloud?.user()) throw new Error(MSG.signedOut);
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(perm === 'denied' ? MSG.denied : 'ยังไม่ได้อนุญาตการแจ้งเตือน กดอีกครั้งแล้วเลือก "อนุญาต"');
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const key = await app.cloud.rpc('push_public_key');
    if (!key) throw new Error(MSG.notReady);
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
  }
  await save(sub);
  ls.set(ON_KEY, '1');
  app.sync?.syncNow?.(); // เวลาของแต่ละวิชาต้องขึ้นบัญชีก่อน เซิร์ฟเวอร์จึงรู้
}

/** ปิดในเครื่องนี้ (ใช้ตอนออกจากระบบ/ลบบัญชีด้วย) — ล้มบางส่วนก็ไม่เป็นไร */
export async function disable() {
  const was = ls.get(ON_KEY) === '1';
  ls.set(ON_KEY, null);
  if (!was || !('serviceWorker' in navigator)) return;
  try {
    const reg = await registration();
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    try { await app.cloud.rpc('push_unsubscribe', { p_endpoint: sub.endpoint }); } catch {}
    await sub.unsubscribe();
  } catch {}
}

/** เปิดแอป: ส่งข้อมูลเครื่องซ้ำ (endpoint อาจเปลี่ยน · เข้าบัญชีใหม่ในเครื่องเดิม) — เงียบ ๆ */
export async function refreshPush() {
  if (!notifyOn() || !app.cloud?.user()) return;
  try {
    const sub = await (await registration()).pushManager.getSubscription();
    if (sub) await save(sub); else ls.set(ON_KEY, null);
  } catch {}
}

export function notifyModal() {
  const body = h('div');
  const done = () => { paint(); app.refresh?.(); };

  // แถวของ 1 วิชา: จุดสี · ชื่อ · เวลา (แตะ = ตัวเลือกเวลาของเครื่อง) · สวิตช์
  const line = (slot, name, color) => {
    const v = remindOf(slot), off = v === 'off';
    const apply = async t => {
      if (t === remindOf(slot)) return;
      await setRemind(slot, t); done();
      toast(t === 'off' ? `ไม่เตือน${name}แล้ว` : `${name} เตือน ${t} ทุกวัน`);
    };
    const native = h('input', { type: 'time', value: off ? DEFAULT_TIME : v, 'aria-label': `เวลาเตือน ${name}`,
      onchange: e => { if (valid(e.target.value)) apply(e.target.value); } });
    return h('div.rm-row' + (off ? '.off' : ''), { 'data-slot': slot },
      h('i.rm-dot', { style: { '--c': color || '#94A0B8' } }),
      h('span.rm-name', name),
      h('label.rm-time', { onclick: () => { try { native.showPicker?.(); } catch {} } }, h('b', off ? 'ปิด' : v), native),
      h('button.rm-sw', { type: 'button', role: 'switch', 'aria-checked': String(!off), 'aria-label': `เตือน ${name}`,
        onclick: () => apply(off ? DEFAULT_TIME : 'off') }));
  };

  const paint = () => {
    const st = support(), on = notifyOn(), signed = !!app.cloud?.user();
    const err = h('p.ferr', { role: 'alert' });
    const turnOn = h('button.btn.primary.full', { id: 'nt-on', onclick: async () => {
      turnOn.disabled = true; turnOn.textContent = 'รอสักครู่…'; err.textContent = '';
      try { await enable(); toast('เปิดการแจ้งเตือนแล้ว'); done(); }
      catch (e) { err.textContent = e.offline ? 'ต้องต่อเน็ตก่อนจึงจะเปิดได้' : e.message; turnOn.disabled = false; turnOn.textContent = 'เปิดการแจ้งเตือน'; }
    } }, 'เปิดการแจ้งเตือน');
    const test = h('button.btn.ghost', { id: 'nt-test', onclick: async () => {
      test.disabled = true; err.textContent = '';
      try {
        const r = await app.cloud.fn('push-reminders', { test: true });
        if (r?.sent) toast('ส่งแล้ว ดูที่แถบแจ้งเตือนของเครื่อง');
        else err.textContent = 'ส่งไม่ถึงเครื่องนี้ ลองปิดแล้วเปิดการแจ้งเตือนใหม่';
      } catch (e) { err.textContent = e.offline ? 'ต้องต่อเน็ตก่อนจึงจะทดสอบได้' : e.message; }
      setTimeout(() => { test.disabled = false; }, 4000);
    } }, 'ลองส่ง');
    const off = h('button.btn.ghost.nt-off', { id: 'nt-off', onclick: async () => { await disable(); toast('ปิดการแจ้งเตือนในเครื่องนี้แล้ว'); done(); } }, 'ปิดในเครื่องนี้');

    put(body,
      h('p', 'ตั้งเวลาให้แต่ละวิชา ถึงเวลาแล้ว SABAii จะเตือนงานที่ยังไม่เสร็จของวิชานั้น แม้ปิดแอปอยู่'),
      st === 'ios-install' ? iosHelp()
        : st !== 'ok' ? h('p.nwarn', MSG[st])
        : !signed ? h('p.nwarn', MSG.signedOut)
        : on ? '' : [turnOn, err],
      h('p.flabel', 'เตือนกี่โมง · แตะเวลาเพื่อเปลี่ยน'),
      h('div.rm-list', shownSubjects().map(sj => line(sj.id, sj.name, sj.color)), line(NONE, 'งานไม่มีวิชา')),
      h('p.muted.rm-note', 'เตือนงานที่เลยกำหนด ส่งวันนี้หรือพรุ่งนี้ และสอบภายใน 3 วัน · วันไหนวิชานั้นไม่มีงาน ก็ไม่เตือน'),
      on ? [err, h('div.nacts', test, off)] : '');
  };
  openModal({ title: 'การแจ้งเตือน', body });
  paint();
}

function iosHelp() {
  return h('div.nios',
    h('p.nwarn', MSG['ios-install']),
    h('ol',
      h('li', 'เปิด SABAii ใน Safari แล้วแตะปุ่มแชร์ (สี่เหลี่ยมมีลูกศรชี้ขึ้น)'),
      h('li', 'เลือก "เพิ่มไปยังหน้าจอโฮม"'),
      h('li', 'เปิด SABAii จากไอคอนบนหน้าจอโฮม แล้วกลับมาเปิดการแจ้งเตือนที่นี่')),
    h('p.muted', 'ต้องเป็น iOS 16.4 ขึ้นไป'));
}
