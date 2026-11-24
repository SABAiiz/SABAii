// หน้าเข้าสู่ระบบตอนเปิดแอป (ก่อนแบบสอบถาม) — อีเมล → รหัส 6 หลัก
// เข้าสู่ระบบแล้ว: ดึงงานจากบัญชี (เครื่องใหม่ได้งานเดิมคืน · ตอบแบบสอบถามไว้แล้วไม่ต้องตอบซ้ำ)
// "ใช้ต่อโดยไม่เข้าสู่ระบบ" = ใช้แบบเดิม ข้อมูลอยู่ในเครื่อง (จำไว้ ไม่ถามอีกจนกว่าจะออกจากระบบ) · เข้าสู่ระบบทีหลังได้ที่หน้าฉัน
import { h } from '../ui/kit.js';
import { welcomeHero } from './onboard.js';
import { signInSteps, afterSignIn, skipLogin } from './account.js';

let root = null;

/** onDone(signedIn) เรียกหลังปิดหน้านี้ */
export function openLogin({ onDone = () => {} } = {}) {
  if (root) return;
  const view = h('div.ob-view');
  const skip = h('button.ob-skip.login-skip', { id: 'login-skip', onclick: () => { skipLogin(); close(false); } }, 'ใช้ต่อโดยไม่เข้าสู่ระบบ');
  root = h('div.ob.login', { id: 'login', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'เข้าสู่ระบบ SABAii' },
    h('div.ob-top', h('span.login-brand', h('img', { src: 'icon.svg', alt: '' }), 'SABAii')),
    h('div.ob-body', view),
    h('div.ob-foot', skip));
  document.body.append(root);
  document.body.classList.add('ob-open');

  /** signedIn = null → ปิดเฉย ๆ (เรียก onDone เองทีหลัง) */
  function close(signedIn) {
    if (!root) return;
    const r = root; root = null;
    r.classList.add('out');
    document.body.classList.remove('ob-open');
    setTimeout(() => r.remove(), 260);
    if (signedIn !== null) onDone(signedIn);
  }

  signInSteps(view, {
    inputCls: '.field.ob-input',
    btnCls: '.cta.ob-next',
    intro: (step, email) => {
      root.dataset.step = step;
      return step === 'email'
        ? [welcomeHero(), h('h1.ob-q', 'เข้าสู่ระบบ'), h('p.ob-sub', 'งานไม่หายเมื่อเปลี่ยนเครื่อง · ไม่ต้องตั้งรหัสผ่าน')]
        : [h('h1.ob-q', 'ใส่รหัสจากอีเมล'), h('p.ob-sub', 'ส่งรหัส 6 หลักไปที่ ', h('b', email), ' แล้ว · ดูในจดหมายขยะด้วย หรือกดลิงก์ในอีเมลแทนก็ได้')];
    },
    onSignedIn: async u => { close(null); await afterSignIn(u); onDone(true); }, // รอซิงก์เสร็จก่อน จะได้รู้ว่าบัญชีนี้ตอบแบบสอบถามแล้วหรือยัง
  });
}
