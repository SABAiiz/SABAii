// หน้าเข้าสู่ระบบ (0.13.2) — ต้องเข้าสู่ระบบทุกครั้งก่อนเข้าแอป
//   เจ้าของเลือกแบบ D + ปุ่มกรมท่าแบบ B จาก mockups/sabaii-login-variants.jpg:
//   พื้นเทาอ่อน · โลโก้บน · กล่องขาวกลางจอ · รูปงานจริง 3 ใบโผล่เหนือกล่อง (คลี่ออกตอนเปิด) · ปุ่ม Google สีกรมท่า
//   หน้าแนะนำ → "ลองใช้เลย" → หน้านี้ → Google → แบบสอบถาม (ครั้งแรก) → แอป
//   หลุดจากระบบกลางทาง → หน้านี้ (แบบ "อีกครั้ง") ทับแอป ข้อมูลในเครื่องยังอยู่
import { h } from '../ui/kit.js';

const G_LOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const F_LOGO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/></svg>';
const PHOTOS = ['board', 'notes', 'sticky'].map(n => `assets/landing/photos/${n}.jpg`);

/** กลับมาที่หน้าเดิมของแอป (ไม่เอา ?/# ไปด้วย) — ต้องอยู่ในรายการ Redirect URLs ของ Supabase */
export const returnUrl = () => location.origin + location.pathname;

/** เปิดหน้าเข้าสู่ระบบเต็มจอ · error = ข้อความจากรอบก่อน (กดยกเลิกที่ Google ฯลฯ) · again = เคยเข้าแล้วแต่หลุด */
export function showLogin(cloud, { error = '', again = false } = {}) {
  if (document.getElementById('login')) return;
  document.documentElement.classList.add('gated');
  const err = h('p.lg-err', { role: 'alert' }, error);
  // ปุ่มเข้าสู่ระบบ 1 ปุ่ม/ผู้ให้บริการ — กดปุ่มหนึ่ง ปิดอีกปุ่มไว้จนกว่าจะกลับมา
  const providers = [
    { id: 'google', name: 'Google', logo: G_LOGO, btn: 'acc-google' },
    { id: 'facebook', name: 'Facebook', logo: F_LOGO, btn: 'acc-facebook' },
  ].map(p => {
    const label = h('span.lg-lbl', `ดำเนินการต่อด้วย ${p.name}`);
    return { ...p, label, el: h('button.lg-btn', { id: p.btn, type: 'button' }, h('span.lg-ic', { html: p.logo }), label) };
  });
  const busy = (on, cur) => providers.forEach(p => {
    p.el.disabled = on;
    p.label.textContent = on && p === cur ? `กำลังไปที่ ${p.name}…` : `ดำเนินการต่อด้วย ${p.name}`;
  });
  providers.forEach(p => {
    p.el.onclick = async () => {
      err.textContent = '';
      if (!navigator.onLine) { err.textContent = 'ยังไม่ได้ต่อเน็ต ต่อเน็ตแล้วกดอีกครั้ง'; return; }
      busy(true, p);
      try { location.assign(await cloud.oauthUrl(p.id, returnUrl())); }
      catch (e) { err.textContent = e.message; busy(false); }
    };
  });
  // กดย้อนกลับจาก Google (หน้าเก่าจากแคชของเบราว์เซอร์) → ปุ่มต้องกดได้อีก
  addEventListener('pageshow', () => busy(false));
  const inApp = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  document.body.append(h('div', { id: 'login', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lg-title' },
    h('header.lg-top', h('img', { src: 'icon-192.png', alt: '', width: 26, height: 26 }), h('span', 'SABAii')),
    h('main.lg-card',
      h('div.lg-stack', { 'aria-hidden': 'true' }, PHOTOS.map((src, i) => h('img', { src, alt: '', style: { '--i': i } }))),
      h('h1', { id: 'lg-title' }, again ? 'เข้าสู่ระบบอีกครั้ง' : 'ยินดีต้อนรับสู่ SABAii'),
      h('p.lg-sub', again ? ['งานในเครื่องนี้ยังอยู่ครบ', h('br'), 'แค่ยืนยันว่าเป็นคุณ'] : ['เข้าสู่ระบบเพื่อเก็บงานไว้ในบัญชี', h('br'), 'เปิดได้ทุกเครื่อง']),
      h('div.lg-btns', providers.map(p => p.el)), err,
      h('p.lg-foot', 'ไม่ต้องตั้งรหัสผ่าน งานของคุณเห็นได้เฉพาะคุณ · ', h('a', { href: '../privacy/' }, 'นโยบายความเป็นส่วนตัว'))),
    inApp ? h('span.lg-space') : h('a.lg-back', { href: '../' }, 'ดู SABAii ก่อน')));
}

export function hideLogin() {
  document.getElementById('login')?.remove();
  document.documentElement.classList.remove('gated');
}
