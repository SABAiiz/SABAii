// แจ้งเตือนก่อนวันส่ง (0.14) — Web Push · เด้งแม้ปิดแอป
//   เปิด: ขออนุญาต → pushManager.subscribe (กุญแจสาธารณะจาก push_public_key) → push_subscribe (เวลาเตือน + เขตเวลา)
//   เซิร์ฟเวอร์ (supabase/functions/push-reminders) เช็กทุก 15 นาที → ถึงเวลาเตือนของเครื่องไหน ส่งงาน/สอบ "พรุ่งนี้" ที่ยังไม่เสร็จ
//   เปิด/ปิด + เวลา = ของเครื่องนี้ (localStorage) · iPhone ต้องเพิ่มลงหน้าจอโฮมก่อน (iOS 16.4+)
import { h, put, toast, openModal } from '../ui/kit.js';
import { app } from './shared.js';

const ON_KEY = 'sabaii-push', TIME_KEY = 'sabaii-push-time';
export const TIMES = ['17:00', '18:00', '19:00', '20:00', '21:00'];
const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};
export const notifyTime = () => ls.get(TIME_KEY) || '19:00';

const MSG = {
  unsupported: 'เบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือน ลองเปิด SABAii ด้วย Chrome หรือ Safari รุ่นใหม่',
  denied: 'เบราว์เซอร์บล็อกการแจ้งเตือนของ SABAii ไว้ เปิดได้ที่ตั้งค่าของเบราว์เซอร์ › การแจ้งเตือน แล้วกลับมากดอีกครั้ง',
  'ios-install': 'บน iPhone ต้องเพิ่ม SABAii ลงหน้าจอโฮมก่อน จึงจะแจ้งเตือนได้',
  notReady: 'ระบบแจ้งเตือนยังไม่พร้อม ปิดแล้วเปิดแอปใหม่ แล้วลองอีกครั้ง',
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
export const notifyLabel = () => notifyOn() ? `เปิด ${notifyTime()}` : 'ปิด';

const b64 = s => { const t = s.replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(t + '='.repeat((4 - t.length % 4) % 4)), c => c.charCodeAt(0)); };
/** service worker ที่ลงทะเบียนแล้ว (ไม่มี = ไม่พร้อม · ไม่รอนานเกิน 6 วินาที) */
async function registration() {
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 6000))]);
  if (!reg) throw new Error(MSG.notReady);
  return reg;
}
async function save(sub, time) {
  const j = sub.toJSON();
  await app.cloud.rpc('push_subscribe', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth,
    p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Bangkok', p_remind_at: time });
}

export async function enable(time = notifyTime()) {
  const st = support();
  if (st !== 'ok') throw new Error(MSG[st]);
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(perm === 'denied' ? MSG.denied : 'ยังไม่ได้อนุญาตการแจ้งเตือน กดอีกครั้งแล้วเลือก "อนุญาต"');
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const key = await app.cloud.rpc('push_public_key');
    if (!key) throw new Error(MSG.notReady);
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
  }
  await save(sub, time);
  ls.set(ON_KEY, '1'); ls.set(TIME_KEY, time);
}

/** ปิดในเครื่องนี้ (ใช้ตอนออกจากระบบ/ลบบัญชีด้วย) — ล้มบางส่วนก็ไม่เป็นไร */
export async function disable() {
  ls.set(ON_KEY, null);
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
    if (sub) await save(sub, notifyTime()); else ls.set(ON_KEY, null);
  } catch {}
}

export function notifyModal() {
  const body = h('div');
  const done = () => { paint(); app.refresh?.(); };
  const paint = () => {
    const st = support(), on = notifyOn();
    const err = h('p.ferr', { role: 'alert' });
    const times = h('div.ntimes', { role: 'radiogroup', 'aria-label': 'เตือนตอน' }, TIMES.map(t => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(t === notifyTime()),
      onclick: async () => {
        if (t === notifyTime()) return;
        ls.set(TIME_KEY, t);
        if (notifyOn()) { try { await enable(t); toast(`เปลี่ยนเป็นเตือนตอน ${t} แล้ว`); } catch (e) { toast(e.message); } }
        done();
      } }, t)));
    const turnOn = h('button.btn.primary.full', { id: 'nt-on', onclick: async () => {
      turnOn.disabled = true; turnOn.textContent = 'รอสักครู่…'; err.textContent = '';
      try { await enable(); toast(`เปิดแจ้งเตือนแล้ว เตือนตอน ${notifyTime()}`); done(); }
      catch (e) { err.textContent = e.message; turnOn.disabled = false; turnOn.textContent = 'เปิดแจ้งเตือน'; }
    } }, 'เปิดแจ้งเตือน');
    const test = h('button.btn.ghost.full', { id: 'nt-test', onclick: async () => {
      test.disabled = true; err.textContent = '';
      try {
        const r = await app.cloud.fn('push-reminders', { test: true });
        if (r?.sent) toast('ส่งแล้ว ดูที่แถบแจ้งเตือนของเครื่อง');
        else err.textContent = 'ส่งไม่ถึงเครื่องนี้ ลองปิดแล้วเปิดแจ้งเตือนใหม่';
      } catch (e) { err.textContent = e.offline ? 'ต้องต่อเน็ตก่อนจึงจะทดสอบได้' : e.message; }
      setTimeout(() => { test.disabled = false; }, 4000);
    } }, 'ส่งแจ้งเตือนทดสอบ');
    const off = h('button.btn.ghost.full.nt-off', { id: 'nt-off', onclick: async () => { await disable(); toast('ปิดแจ้งเตือนแล้ว'); done(); } }, 'ปิดแจ้งเตือน');

    put(body,
      h('p', 'ตอนเย็นก่อนวันส่ง SABAii จะเตือนงานที่ต้องส่ง', h('span.nw', 'พรุ่งนี้'), ' และสอบ', h('span.nw', 'พรุ่งนี้'), ' แม้ปิดแอปอยู่'),
      h('p.muted', 'วันไหนไม่มีงานพรุ่งนี้ ก็ไม่เตือน'),
      st === 'ios-install' ? iosHelp()
        : st !== 'ok' ? h('p.nwarn', MSG[st])
        : [h('p.flabel', 'เตือนตอน'), times, err, on ? h('div.nacts', test, off) : turnOn]);
  };
  openModal({ title: 'แจ้งเตือนก่อนวันส่ง', body });
  paint();
}

function iosHelp() {
  return h('div.nios',
    h('p.nwarn', MSG['ios-install']),
    h('ol',
      h('li', 'เปิด SABAii ใน Safari แล้วแตะปุ่มแชร์ (สี่เหลี่ยมมีลูกศรชี้ขึ้น)'),
      h('li', 'เลือก "เพิ่มไปยังหน้าจอโฮม"'),
      h('li', 'เปิด SABAii จากไอคอนบนหน้าจอโฮม แล้วกลับมาเปิดแจ้งเตือนที่นี่')),
    h('p.muted', 'ต้องเป็น iOS 16.4 ขึ้นไป'));
}
