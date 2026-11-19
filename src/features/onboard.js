// แบบสอบถามก่อนเข้าแอปครั้งแรก — ถามเฉพาะข้อมูลที่แอปใช้จริง ทุกคำตอบเก็บในเครื่องนี้เท่านั้น
//   1 ชื่อเล่น             → prefs.display_name   (หน้าฉัน)
//   2 วิชาที่เรียนเทอมนี้     → subjects[].hidden     (ชิปวิชาตอนเพิ่มงาน · การ์ดวิชา · เดาวิชาจากคำพูด) + เพิ่มวิชาเอง
//   3 ครูสั่งงานแบบไหน      → prefs.listen_mode    (ปุ่มพูดเริ่มที่ "ฟังครู" หรือ "ฉันพูดเอง")
//   4 หน้าตาหน้าโน้ตงาน     → prefs.note_style     (6 แบบ ดู features/notestyle.js)
//   5 งานตัวอย่าง           → store.addSamples()   (ติดป้าย "ตัวอย่าง" ลบได้ทีเดียว)
// ข้ามได้ทุกเมื่อ (ค่าเดิมไม่เปลี่ยน) · ทำใหม่ได้จากหน้าฉัน
import { h, ic, toast } from '../ui/kit.js';
import { app, S } from './shared.js';
import { MODES } from './listen.js';
import { NOTE_STYLES, noteStyle, styleName, stylePreview } from './notestyle.js';

export const needsOnboarding = () => !S().prefs.onboarded;
const QUESTIONS = 5;
const STEPS = ['welcome', 'name', 'subjects', 'listen', 'style', 'samples', 'done'];

let root = null;

/** หน้าต้อนรับ: โลโก้กลาง + การ์ด UI ของแอปลอยรอบ ๆ (เข้าฉากทีละใบ · ลอยเบา ๆ · ขยับตามเมาส์บนคอม) */
function welcomeHero() {
  const card = (cls, depth, i, ...kids) => h('div.obf.' + cls, { style: { '--i': i }, 'data-depth': depth }, h('div.obf-fl', h('div.obf-c', ...kids)));
  const bdg = (t, c) => h('span.obf-b', { style: { '--c': c } }, t);
  const hero = h('div.ob-hero', { 'aria-hidden': 'true' },
    card('o-photo', 1.2, 0, h('img', { src: 'assets/landing/note-photo.jpg', alt: '' }), h('span.obf-tag', 'วิทย์ · 08:54')),
    card('o-task', .8, 1, bdg('ฟิส', '#8B5CF6'), h('span.obf-tt', h('b', 'แบบฝึกหัด 4.3'), h('small', 'ส่งศุกร์ 08:00')), h('span.obf-go', 'ทำเลย')),
    card('o-sticky', 1.5, 2, 'ทำแค่ข้อคี่', h('br'), 'ส่งในห้องนะ'),
    card('o-listen', 1, 3, h('span.obf-mic', { html: ic('mic') }), h('span.obf-wave', Array.from({ length: 9 }, () => h('i')))),
    card('o-timer', 1.8, 4, h('i.obf-dot'), 'กำลังทำ ', h('b', '12:40')),
    card('o-exam', .9, 5, h('small', 'สอบย่อย'), h('b', '3'), h('small', 'วัน')),
    h('img.ob-logo', { src: 'icon.svg', alt: '', width: 84, height: 84 }));
  if (matchMedia('(pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const items = [...hero.querySelectorAll('.obf')];
    let raf = 0, tx = 0, ty = 0, x = 0, y = 0;
    const tick = () => { x += (tx - x) * .08; y += (ty - y) * .08;
      for (const el of items) { const d = +el.dataset.depth; el.style.transform = `translate3d(${(x * d * -18).toFixed(1)}px,${(y * d * -14).toFixed(1)}px,0)`; }
      raf = Math.abs(tx - x) + Math.abs(ty - y) > .002 ? requestAnimationFrame(tick) : 0; };
    hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width - .5; ty = (e.clientY - r.top) / r.height - .5; if (!raf) raf = requestAnimationFrame(tick); });
  }
  return hero;
}

export function openOnboarding({ redo = false } = {}) {
  if (root) return;
  const s = S(), hasSamples = s.tasks.some(t => t.source === 'sample');
  const ans = {
    name: s.prefs.display_name || '',
    subj: new Set(s.subjects.filter(x => !x.hidden).map(x => x.id)),
    listen: redo ? (s.prefs.listen_mode === 'teacher' ? 'teacher' : 'self') : null,
    style: noteStyle(),
    samples: redo ? hasSamples : null,
  };
  let step = 0, back = 1;

  const prog = h('div.ob-prog', { 'aria-hidden': 'true' }, Array.from({ length: QUESTIONS }, () => h('i')));
  const backBtn = h('button.ob-back', { 'aria-label': 'ย้อนกลับ', html: ic('back'), onclick: () => go(step - 1) });
  const skipBtn = h('button.ob-skip', { id: 'ob-skip', onclick: skip }, 'ข้าม');
  const body = h('div.ob-body');
  const next = h('button.cta.ob-next', { id: 'ob-next', onclick: () => onNext() });
  root = h('div.ob', { id: 'onboard', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'ตั้งค่าก่อนเริ่มใช้ SABAii' },
    h('div.ob-top', backBtn, prog, skipBtn), body, h('div.ob-foot', next));
  document.body.append(root);
  document.body.classList.add('ob-open');
  let onNext = () => go(step + 1);

  function go(i) {
    back = i < step ? -1 : 1;
    step = Math.max(0, Math.min(STEPS.length - 1, i));
    render();
  }
  function close() {
    root.classList.add('out');
    const r = root; root = null;
    document.body.classList.remove('ob-open');
    setTimeout(() => r.remove(), 260);
  }
  async function skip() {
    if (!redo) await app.store.setPref('onboarded', true);
    close();
    if (!redo) toast('ตั้งค่าทีหลังได้ที่หน้า "ฉัน"');
  }
  async function finish() {
    next.disabled = true;
    const st = app.store;
    await st.setPref('display_name', ans.name.trim().slice(0, 40), false);
    for (const sj of S().subjects) { const hidden = !ans.subj.has(sj.id); if (!!sj.hidden !== hidden) await st.updateSubject(sj.id, { hidden }); }
    await st.setPref('listen_mode', ans.listen || 'self', false);
    await st.setPref('note_style', ans.style, false);
    const has = S().tasks.some(t => t.source === 'sample');
    if (ans.samples && !has) await st.addSamples(); else if (!ans.samples && has) await st.removeSamples();
    await st.setPref('onboarded_at', new Date().toISOString(), false);
    await st.setPref('onboarded', true);
    close();
    location.hash = '#/home';
    toast(ans.name.trim() ? `ยินดีต้อนรับ ${ans.name.trim()}` : 'พร้อมแล้ว เพิ่มงานแรกได้เลย');
  }

  const head = (k, q, sub) => [
    k ? h('div.ob-k', `ข้อ ${k} จาก ${QUESTIONS}`) : '',
    h('h1.ob-q', { tabindex: '-1' }, q), sub ? h('p.ob-sub', sub) : ''];
  const why = text => h('p.ob-why', h('span', { html: ic('info') }), text);
  const option = (on, icon, title, desc, pick) => h('button.ob-opt', { 'aria-pressed': String(on), onclick: pick },
    h('span.ob-oi', { html: ic(icon) }), h('span.ob-ot', h('b', title), h('small', desc)), h('span.ob-ck', { html: ic('check') }));

  function render() {
    const name = STEPS[step];
    root.dataset.step = name;
    backBtn.hidden = step === 0 || name === 'done';
    skipBtn.hidden = name === 'done';
    prog.hidden = step === 0 || name === 'done';
    [...prog.children].forEach((el, i) => el.classList.toggle('on', i < step));
    next.disabled = false;
    onNext = () => go(step + 1);
    const view = h('div.ob-view' + (back < 0 ? '.rev' : ''));

    if (name === 'welcome') {
      view.append(
        welcomeHero(),
        ...head(0, redo ? 'ตั้งค่า SABAii ใหม่' : ['จดงานครบ', h('br'), 'ไม่พลาดกำหนดส่ง'],
          `ตอบ ${QUESTIONS} ข้อสั้น ๆ ให้แอปตั้งค่าตามที่คุณใช้จริง ใช้เวลาไม่ถึง 1 นาที`),
        why('ทุกคำตอบเก็บในเครื่องนี้เท่านั้น ไม่ส่งไปที่ไหน แก้ได้ทุกเมื่อที่หน้า "ฉัน"'));
      next.textContent = 'เริ่มเลย';
    }

    if (name === 'name') {
      const inp = h('input.field.ob-input', { id: 'ob-name', value: ans.name, maxlength: 40, placeholder: 'ชื่อเล่น', autocomplete: 'nickname', 'aria-label': 'ชื่อเล่น',
        oninput: e => { ans.name = e.target.value; label(); }, onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); onNext(); } } });
      const label = () => { next.textContent = ans.name.trim() ? 'ต่อไป' : 'ข้ามข้อนี้'; };
      view.append(...head(1, 'ให้เราเรียกคุณว่าอะไรดี?', 'ชื่อเล่นก็พอ ไม่ต้องใส่ชื่อจริงหรือชื่อโรงเรียน'), inp, why('ใช้ทักทายและแสดงที่หน้า "ฉัน"'));
      label();
      setTimeout(() => inp.focus({ preventScroll: true }), 320);
    }

    if (name === 'subjects') {
      const grid = h('div.ob-chips'), count = h('span.ob-count');
      const paint = () => {
        const list = [...S().subjects].sort((a, b) => a.order - b.order);
        grid.replaceChildren(...list.map(sj => h('button.ob-chip', { 'aria-pressed': String(ans.subj.has(sj.id)), style: { '--c': sj.color },
          onclick: () => { ans.subj.has(sj.id) ? ans.subj.delete(sj.id) : ans.subj.add(sj.id); paint(); } }, h('i'), sj.name)));
        count.textContent = `เลือกแล้ว ${ans.subj.size} วิชา`;
        next.disabled = ans.subj.size === 0;
      };
      const add = h('input.field', { id: 'ob-newsubj', placeholder: 'วิชาอื่น เช่น ประวัติศาสตร์', maxlength: 40, 'aria-label': 'เพิ่มวิชาอื่น',
        onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); addSubj(); } } });
      const addSubj = async () => { const v = add.value.trim(); if (!v) return; const sj = await app.store.ensureSubject(v); ans.subj.add(sj.id); add.value = ''; paint(); };
      view.append(...head(2, 'เทอมนี้เรียนวิชาอะไรบ้าง?', 'แตะเลือกให้ครบ แตะซ้ำเพื่อเอาออก'), grid,
        h('div.ob-addrow', add, h('button.btn.ghost.auto', { onclick: addSubj }, 'เพิ่ม')), count,
        why('ใช้เป็นชิปวิชาตอนเพิ่มงาน การ์ดวิชาในหน้างาน และเดาวิชาจากคำที่พิมพ์หรือพูด · วิชาที่ไม่เลือกแค่ซ่อนไว้ ไม่หาย'));
      next.textContent = 'ต่อไป';
      paint();
    }

    if (name === 'listen') {
      const box = h('div.ob-opts');
      const paint = () => {
        box.replaceChildren(
          option(ans.listen === 'teacher', 'users', 'ครูพูดสั่งปากเปล่าในห้อง', 'กดพูดแล้วแอปฟังครูยาว ๆ จนกดหยุด แยกเป็นหลายงานให้เอง', () => { ans.listen = 'teacher'; paint(); }),
          option(ans.listen === 'self', 'text', 'ครูเขียนบนกระดาน หรือโพสต์ในกลุ่ม', 'กดพูดแล้วคุณพูดเองสั้น ๆ ทีละงาน หรือถ่ายรูปกระดานเก็บไว้', () => { ans.listen = 'self'; paint(); }));
        next.disabled = !ans.listen;
      };
      view.append(...head(3, 'ส่วนใหญ่ครูสั่งงานแบบไหน?', 'เลือกแบบที่เจอบ่อยที่สุด'), box,
        why(`ปุ่มพูดจะเริ่มที่โหมด "${MODES.teacher}" หรือ "${MODES.self}" ตามคำตอบ · สลับได้ทุกครั้งที่กดพูด · ไม่เก็บไฟล์เสียง`));
      next.textContent = 'ต่อไป';
      paint();
    }

    if (name === 'style') {
      const strip = h('div.ob-styles', { role: 'radiogroup', 'aria-label': 'หน้าตาหน้าโน้ตงาน' });
      const cards = NOTE_STYLES.map(st => h('button.ob-style', { role: 'radio', 'data-id': st.id, onclick: () => pick(st.id, true) },
        h('span.ob-shot', h('img', { src: stylePreview(st.id), alt: `ตัวอย่างแบบ ${st.name}`, loading: 'lazy' }), h('span.ob-ck', { html: ic('check') })),
        h('b', `${st.id} · ${st.name}`), h('small', st.desc)));
      strip.append(...cards);
      const dots = h('div.ob-dots', { 'aria-hidden': 'true' }, NOTE_STYLES.map(() => h('i')));
      const pick = (id, scroll) => {
        ans.style = id;
        cards.forEach(c => c.setAttribute('aria-checked', String(+c.dataset.id === id)));
        [...dots.children].forEach((d, i) => d.classList.toggle('on', i + 1 === id));
        next.textContent = `ใช้แบบ "${styleName(id)}"`;
        if (scroll) cards[id - 1].scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', inline: 'center', block: 'nearest' });
      };
      let t; strip.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => {
        const mid = strip.scrollLeft + strip.clientWidth / 2;
        let best = cards[0]; for (const c of cards) if (Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) < Math.abs(best.offsetLeft + best.offsetWidth / 2 - mid)) best = c;
        if (+best.dataset.id !== ans.style) pick(+best.dataset.id, false);
      }, 90); }, { passive: true });
      view.append(...head(4, 'ชอบหน้าโน้ตงานแบบไหน?', 'ปัดดูทั้ง 6 แบบ แล้วเลือกแบบที่ชอบ ทุกแบบใช้งานเหมือนกัน'), strip, dots,
        why('หน้านี้คือรูปและโน้ตของงาน (ดึงหน้าแรกลงเพื่อดู) · เปลี่ยนแบบได้ที่หน้า "ฉัน"'));
      pick(ans.style, false);
      requestAnimationFrame(() => { const c = cards[ans.style - 1]; strip.scrollLeft = c.offsetLeft + c.offsetWidth / 2 - strip.clientWidth / 2; });
    }

    if (name === 'samples') {
      const had = S().tasks.some(t => t.source === 'sample'), box = h('div.ob-opts');
      const paint = () => {
        box.replaceChildren(
          option(ans.samples === true, 'spark', had ? 'เก็บงานตัวอย่างไว้' : 'ใส่งานตัวอย่าง 6 งาน', 'ลองเลื่อน ลองปัด ลองกดทำเลยได้เลย ทุกงานติดป้าย "ตัวอย่าง"', () => { ans.samples = true; paint(); }),
          option(ans.samples === false, 'plus', had ? 'ลบงานตัวอย่างออก' : 'ไม่ต้อง เริ่มจากว่าง', 'เพิ่มงานแรกเองจากหน้าแรก', () => { ans.samples = false; paint(); }));
        next.disabled = ans.samples == null;
      };
      view.append(...head(5, 'อยากลองกับงานตัวอย่างก่อนไหม?', 'เหมาะถ้ายังไม่มีงานจะจดตอนนี้'), box,
        why('งานตัวอย่างลบออกได้ทีเดียวที่หน้า "ฉัน" งานของคุณเองไม่หาย'));
      next.textContent = 'ต่อไป';
      paint();
    }

    if (name === 'done') {
      const names = [...S().subjects].filter(x => ans.subj.has(x.id)).sort((a, b) => a.order - b.order).map(x => x.name.replace(/^ภาษา/, ''));
      const row = (k, v, extra) => h('div.ob-sum', h('span', k), h('b', v), extra || '');
      view.append(
        h('div.ob-done', { html: ic('check') }),
        ...head(0, ans.name.trim() ? `พร้อมแล้ว ${ans.name.trim()}!` : 'พร้อมแล้ว!', 'ตั้งค่าตามนี้ แก้ได้ทุกอย่างที่หน้า "ฉัน"'),
        h('div.ob-sums',
          row('ชื่อ', ans.name.trim() || 'ไม่ได้ตั้ง'),
          row('วิชา', `${names.length} วิชา`, h('small', names.slice(0, 6).join(' · ') + (names.length > 6 ? ' …' : ''))),
          row('ปุ่มพูดเริ่มที่', MODES[ans.listen || 'self']),
          row('หน้าโน้ต', styleName(ans.style), h('img', { src: stylePreview(ans.style), alt: '' })),
          row('งานตัวอย่าง', ans.samples ? 'ใส่ 6 งาน' : 'ไม่ใส่')));
      next.textContent = 'เข้าแอป';
      onNext = finish;
    }

    body.replaceChildren(view);
    body.scrollTop = 0;
    if (name !== 'name') requestAnimationFrame(() => view.querySelector('.ob-q')?.focus({ preventScroll: true }));
  }
  render();
}
