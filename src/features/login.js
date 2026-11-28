// หน้าเข้าสู่ระบบ (0.13.2) — ต้องเข้าสู่ระบบทุกครั้งก่อนเข้าแอป
//   เจ้าของเลือกแบบ D + ปุ่มกรมท่าแบบ B จาก mockups/sabaii-login-variants.jpg:
//   พื้นเทาอ่อน · โลโก้บน · กล่องขาวกลางจอ · รูปงานจริง 3 ใบโผล่เหนือกล่อง (คลี่ออกตอนเปิด) · ปุ่ม Google สีกรมท่า
//   0.14.1: เพิ่ม Facebook · Apple · อีเมล (รหัสทางอีเมล) ใต้ปุ่ม Google
//   0.15.1: รหัสอีเมลรับ 6–8 หลัก (Supabase ตั้งความยาวได้ — ค่าตอนนี้ 8) · ครบ 8 ส่งเอง · 6–7 กดยืนยัน
//   หน้าแนะนำ → "ลองใช้เลย" → หน้านี้ → Google/Facebook/Apple/อีเมล → แบบสอบถาม (ครั้งแรก) → แอป
//   หลุดจากระบบกลางทาง → หน้านี้ (แบบ "อีกครั้ง") ทับแอป ข้อมูลในเครื่องยังอยู่
import { h } from '../ui/kit.js';

const G_LOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const PHOTOS = ['board', 'notes', 'sticky'].map(n => `assets/landing/photos/${n}.jpg`);

/** กลับมาที่หน้าเดิมของแอป (ไม่เอา ?/# ไปด้วย) — ต้องอยู่ในรายการ Redirect URLs ของ Supabase */
export const returnUrl = () => location.origin + location.pathname;

const FB_LOGO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/></svg>';
const APPLE_LOGO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#000" d="M16.4 12.7c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1zM13.9 5c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z"/></svg>';
const MAIL_LOGO = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/></svg>';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** เปิดหน้าเข้าสู่ระบบเต็มจอ · error = ข้อความจากรอบก่อน (กดยกเลิก ฯลฯ) · again = เคยเข้าแล้วแต่หลุด
    4 ทาง (แบบหน้าเข้าสู่ระบบของ fastwork): Google (ปุ่มหลักสีกรมท่า) · Facebook · Apple · อีเมล (รหัสทางอีเมล ไม่ต้องตั้งรหัสผ่าน) */
export function showLogin(cloud, { error = '', again = false } = {}) {
  if (document.getElementById('login')) return;
  document.documentElement.classList.add('gated');
  const err = h('p.lg-err', { role: 'alert' }, error);
  const say = m => { err.textContent = m; };
  const online = () => navigator.onLine || (say('ยังไม่ได้ต่อเน็ต ต่อเน็ตแล้วกดอีกครั้ง'), false);

  // ----- ปุ่มผู้ให้บริการ: ไปหน้าเลือกบัญชีของเขา แล้วเด้งกลับมาที่แอป -----
  const PROVIDERS = [
    ['google', 'Google', G_LOGO, 'lg-btn'],
    ['facebook', 'Facebook', FB_LOGO, 'lg-btn.alt'],
    ['apple', 'Apple', APPLE_LOGO, 'lg-btn.alt', true], // soon: ยังไม่ได้เชื่อม Apple — ปุ่มจาง กดไม่ได้ (เชื่อมแล้วลบ true ออก)
  ];
  const oauthBtns = PROVIDERS.map(([id, name, logo, cls, soon]) => {
    const label = h('span.lg-lbl', `ดำเนินการต่อด้วย ${name}`);
    if (soon) return h('button.' + cls + '.soon', { id: 'acc-' + id, type: 'button', disabled: true, 'aria-disabled': 'true', title: 'เร็ว ๆ นี้' },
      h('span.lg-ic', { html: logo }), label, h('span.lg-soon', 'เร็ว ๆ นี้'));
    const b = h('button.' + cls, { id: 'acc-' + id, type: 'button' }, h('span.lg-ic', { html: logo }), label);
    b.onclick = async () => {
      say('');
      if (!online()) return;
      all.forEach(x => { x.disabled = true; });
      label.textContent = `กำลังไปที่ ${name}…`;
      try { location.assign(await cloud.oauthUrl(id, returnUrl())); }
      catch (e) { say(e.message); reset(); }
    };
    b._reset = () => { label.textContent = `ดำเนินการต่อด้วย ${name}`; };
    return b;
  });
  const mailBtn = h('button.lg-btn.alt', { id: 'acc-email', type: 'button' }, h('span.lg-ic', { html: MAIL_LOGO }), h('span.lg-lbl', 'ดำเนินการต่อด้วยอีเมล'));
  const all = [...oauthBtns.filter(b => !b.classList.contains('soon')), mailBtn];
  const reset = () => all.forEach(x => { x.disabled = false; x._reset?.(); });
  // กดย้อนกลับจากหน้าผู้ให้บริการ (หน้าเก่าจากแคชของเบราว์เซอร์) → ปุ่มต้องกดได้อีก
  addEventListener('pageshow', reset);

  // ----- อีเมล: กรอกอีเมล → ส่งรหัส → กรอกรหัส (อยู่ในหน้านี้ ไม่ต้องออกจากแอป) -----
  const choose = h('div.lg-choose', [...oauthBtns, mailBtn]);
  const emailIn = h('input.lg-in', { id: 'acc-email-in', type: 'email', inputmode: 'email', autocomplete: 'email', placeholder: 'อีเมลของคุณ', 'aria-label': 'อีเมล', required: true });
  const codeIn = h('input.lg-in.code', { id: 'acc-code-in', type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 8, placeholder: 'รหัสจากอีเมล', 'aria-label': 'รหัสจากอีเมล' });
  const sendBtn = h('button.lg-btn', { id: 'acc-send', type: 'submit' }, h('span.lg-lbl', 'ส่งรหัสไปที่อีเมล'));
  const okBtn = h('button.lg-btn', { id: 'acc-verify', type: 'submit' }, h('span.lg-lbl', 'ยืนยัน'));
  const sentTo = h('p.lg-note');
  const back = h('button.lg-link', { type: 'button' }, 'ย้อนกลับ');
  const resend = h('button.lg-link', { type: 'button' }, 'ส่งรหัสอีกครั้ง');
  const stepEmail = h('form.lg-form', { novalidate: true }, emailIn, sendBtn);
  const stepCode = h('form.lg-form', { novalidate: true, hidden: true }, sentTo, codeIn, okBtn);
  const mailBox = h('div.lg-mail', { hidden: true }, stepEmail, stepCode, h('div.lg-links', back, resend));
  const busyBtn = (b, on, text) => { b.disabled = on; b.firstChild.textContent = text; };

  const show = which => {
    say('');
    choose.hidden = which !== 'choose';
    mailBox.hidden = which === 'choose';
    stepEmail.hidden = which !== 'email';
    stepCode.hidden = which !== 'code';
    resend.hidden = which !== 'code';
    (which === 'email' ? emailIn : which === 'code' ? codeIn : null)?.focus();
  };
  mailBtn.onclick = () => show('email');
  back.onclick = () => show(stepCode.hidden ? 'choose' : 'email');

  const send = async () => {
    const email = emailIn.value.trim();
    if (!EMAIL_RE.test(email)) { say('ใส่อีเมลให้ถูกก่อน เช่น name@gmail.com'); emailIn.focus(); return false; }
    if (!online()) return false;
    try { await cloud.sendEmailCode(email); }
    catch (e) { say(e.message); return false; }
    sentTo.replaceChildren('ส่งรหัสไปที่ ', h('b', email), ' แล้ว', h('br'), 'เปิดอีเมลแล้วกรอกรหัสที่ได้ (ดูในจดหมายขยะด้วย)');
    return true;
  };
  stepEmail.onsubmit = async e => {
    e.preventDefault(); say('');
    busyBtn(sendBtn, true, 'กำลังส่งรหัส…');
    const ok = await send();
    busyBtn(sendBtn, false, 'ส่งรหัสไปที่อีเมล');
    if (ok) { codeIn.value = ''; show('code'); }
  };
  resend.onclick = async () => {
    say(''); resend.disabled = true;
    if (await send()) say('ส่งรหัสใหม่แล้ว');
    setTimeout(() => { resend.disabled = false; }, 30_000); // กันกดรัว (Supabase จำกัดจำนวนอีเมลต่อชั่วโมง)
  };
  codeIn.oninput = () => { codeIn.value = codeIn.value.replace(/\D/g, '').slice(0, 8); if (codeIn.value.length === 8) stepCode.requestSubmit(); };
  stepCode.onsubmit = async e => {
    e.preventDefault(); say('');
    if (codeIn.value.length < 6) { say('ใส่รหัสที่ได้จากอีเมลให้ครบ'); codeIn.focus(); return; }
    if (!online()) return;
    busyBtn(okBtn, true, 'กำลังตรวจรหัส…');
    try {
      await cloud.verifyEmailCode(emailIn.value, codeIn.value);
      // เปิดแอปใหม่เหมือนเพิ่งกลับจาก Google (แบบสอบถามครั้งแรก · ซิงก์ · งานในเครื่องขึ้นบัญชี)
      try { sessionStorage.setItem('sabaii-just-in', '1'); } catch {}
      history.replaceState(null, '', returnUrl() + '#/home');
      location.reload();
    } catch (e2) { say(e2.message); busyBtn(okBtn, false, 'ยืนยัน'); codeIn.select(); }
  };

  const inApp = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  document.body.append(h('div', { id: 'login', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lg-title' },
    h('header.lg-top', h('img', { src: 'icon-192.png', alt: '', width: 26, height: 26 }), h('span', 'SABAii')),
    h('main.lg-card',
      h('div.lg-stack', { 'aria-hidden': 'true' }, PHOTOS.map((src, i) => h('img', { src, alt: '', style: { '--i': i } }))),
      h('h1', { id: 'lg-title' }, again ? 'เข้าสู่ระบบอีกครั้ง' : 'ยินดีต้อนรับสู่ SABAii'),
      h('p.lg-sub', again ? ['งานในเครื่องนี้ยังอยู่ครบ', h('br'), 'แค่ยืนยันว่าเป็นคุณ'] : ['เข้าสู่ระบบเพื่อเก็บงานไว้ในบัญชี', h('br'), 'เปิดได้ทุกเครื่อง']),
      choose, mailBox, err,
      h('p.lg-foot', 'ไม่ต้องตั้งรหัสผ่าน งานของคุณเห็นได้เฉพาะคุณ · ', h('a', { href: '../privacy/' }, 'นโยบายความเป็นส่วนตัว'))),
    inApp ? h('span.lg-space') : h('a.lg-back', { href: '../' }, 'ดู SABAii ก่อน')));
}

export function hideLogin() {
  document.getElementById('login')?.remove();
  document.documentElement.classList.remove('gated');
}
