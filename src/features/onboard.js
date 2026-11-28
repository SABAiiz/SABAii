// แบบสอบถามก่อนเข้าแอปครั้งแรก — ถามเฉพาะข้อมูลที่แอปใช้จริง ทุกคำตอบเก็บในเครื่องนี้เท่านั้น
//   1 ชื่อเล่น             → prefs.display_name   (หน้าฉัน)
//   2 วิชาที่เรียนเทอมนี้     → subjects[].hidden     (ชิปวิชาตอนเพิ่มงาน · การ์ดวิชา · เดาวิชาจากคำพูด) + เพิ่มวิชาเอง
//   3 ครูสั่งงานแบบไหน      → prefs.listen_mode    (ปุ่มพูดเริ่มที่ "ฟังครู" หรือ "ฉันพูดเอง")
//   4 หน้าตาหน้าโน้ตงาน     → prefs.note_style     (6 แบบ ดู features/notestyle.js)
//   5 งานตัวอย่าง           → store.addSamples()   (ติดป้าย "ตัวอย่าง" ลบได้ทีเดียว)
// ข้ามได้ทุกเมื่อ (ค่าเดิมไม่เปลี่ยน) · ทำใหม่ได้จากหน้าฉัน
import { h, ic, toast } from '../ui/kit.js';
import { app, S } from './shared.js';
import { NOTE_STYLES, noteStyle, styleName, stylePreview } from './notestyle.js';

export const needsOnboarding = () => !S().prefs.onboarded;
const QUESTIONS = 5;
const STEPS = ['welcome', 'name', 'subjects', 'listen', 'style', 'samples', 'done'];

let root = null;

/** หน้าต้อนรับ (แนวเดียวกับหน้าแนะนำ 0.8): การ์ดรูปถ่ายจริงวางกองรอบ ๆ เข้าฉากทีละใบ · ลอยเบา ๆ · ขยับตามเมาส์บนคอม */
function welcomeHero() {
  const P = 'assets/landing/photos/';
  const card = (cls, depth, i, src, bdg, c, title, meta, red) => h('div.obf.' + cls, { style: { '--i': i }, 'data-depth': depth },
    h('div.obf-fl', h('figure.obf-c', h('img', { src, alt: '' }),
      h('figcaption', h('span.obf-b', { style: { '--c': c } }, bdg), h('span.obf-tt', h('b', title), h('small' + (red ? '.red' : ''), meta))))));
  const hero = h('div.ob-hero', { 'aria-hidden': 'true' },
    card('o1', 1.1, 0, P + 'board.jpg', 'ฟิส', '#7C4DFF', 'แบบฝึกหัด 4.3', 'ส่งศุกร์'),
    card('o2', .8, 1, 'assets/landing/note-photo.jpg', 'วิทย์', '#F08A24', 'Mind mapping', 'ส่งวันนี้', true),
    card('o3', 1.4, 2, P + 'chalk.jpg', 'คณิต', '#1769D2', 'สอบย่อยบทที่ 4', 'อีก 3 วัน', true),
    card('o4', .9, 3, P + 'notes.jpg', 'ชีวะ', '#14A06A', 'สรุปบทที่ 2', 'ส่งพรุ่งนี้'),
    card('o5', 1.25, 4, P + 'sticky.jpg', 'อังกฤษ', '#E0457B', 'ท่องศัพท์ Unit 5', '20 คำ'));
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

/** คำที่เปลี่ยนในหัวเรื่อง (เหมือนหน้าแนะนำ): คำเดิมเบลอหดเป็นจุดสามจุด → จุดขยายเป็นคำใหม่ · หยุดเองเมื่อออกจากหน้านี้ */
function morphWord() {
  const W = [['การบ้าน', '#0A6CF1', '#7C4DFF'], ['สอบย่อย', '#E2453A', '#FF8A3D'], ['รายงาน', '#0E9F6E', '#0A6CF1'], ['ใบงาน', '#D9741A', '#E0457B']];
  const mw = h('span.mw', W[0][0]), meas = h('span.mmeas', { 'aria-hidden': 'true' });
  const el = h('span.morph', mw, h('span.mdots', { 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), meas);
  let i = 0;
  const paint = () => { el.style.setProperty('--c1', W[i][1]); el.style.setProperty('--c2', W[i][2]); };
  const size = () => { meas.textContent = W[i][0]; if (meas.offsetWidth) el.style.width = meas.offsetWidth + 'px'; };
  paint(); requestAnimationFrame(size); document.fonts?.ready.then(size);
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const t = setInterval(() => {
      if (!el.isConnected) { clearInterval(t); return; }
      if (document.hidden) return;
      el.classList.add('melt');
      setTimeout(() => { i = (i + 1) % W.length; size(); }, 260);
      setTimeout(() => { el.classList.add('form'); mw.textContent = W[i][0]; paint();
        setTimeout(() => { el.classList.remove('melt'); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('form'))); }, 380); }, 520);
    }, 3000);
  }
  return el;
}

export function openOnboarding({ redo = false, start = 0 } = {}) {
  if (root) return;
  const s = S(), hasSamples = s.tasks.some(t => t.source === 'sample');
  const ans = {
    name: s.prefs.display_name || '',
    subj: new Set(s.subjects.filter(x => !x.hidden).map(x => x.id)),
    listen: redo ? (s.prefs.listen_mode === 'teacher' ? 'teacher' : 'self') : null,
    style: noteStyle(),
    samples: redo ? hasSamples : null,
  };
  let step = start, back = 1; // มาจากหน้าแนะนำ = เห็นภาพรวมแล้ว เริ่มที่ข้อ 1 เลย

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

  // หัวข้อ: คำถามสั้นบรรทัดเดียว คำโผล่ทีละคำ (เบลอ → ชัด) · ไม่มีคำอธิบายรอง
  const head = q => {
    const el = h('h1.ob-q', { tabindex: '-1' });
    let n = 0;
    for (const part of [].concat(q)) {
      if (typeof part !== 'string') { el.append(part); continue; }
      part.split(/(\s+)/).forEach(w => { if (!w) return; el.append(/^\s+$/.test(w) ? w : h('span.ob-w', { style: { '--k': n++ } }, w)); });
    }
    return el;
  };
  const tick = () => h('span.ob-ck', { html: ic('check') });
  const grapheme = t => { try { return [...new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(t.trim())][0]?.segment || ''; } catch { return t.trim()[0] || ''; } };

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
    const stage = h('div.ob-stage');

    if (name === 'welcome') {
      view.append(welcomeHero(),
        head(redo ? 'ตั้งค่า SABAii ใหม่' : ['จดงานครบ', h('br'), h('span.ob-ln', 'ไม่ให้', morphWord(), 'หลุด')]));
      next.textContent = redo ? 'เริ่ม' : 'เริ่มเลย';
    }

    // 1 · ชื่อ: พิมพ์ลงในประโยคทักทายตัวใหญ่ วงกลมตัวอักษรแรกเปลี่ยนตาม
    if (name === 'name') {
      const av = h('span.ob-av');
      const inp = h('input.ob-input', { id: 'ob-name', value: ans.name, maxlength: 40, placeholder: 'ชื่อเล่น', autocomplete: 'nickname', 'aria-label': 'ชื่อเล่น', enterkeyhint: 'next',
        oninput: e => { ans.name = e.target.value; paint(); }, onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); onNext(); } } });
      const paint = () => { const g = grapheme(ans.name); av.textContent = g; av.classList.toggle('on', !!g); next.textContent = ans.name.trim() ? 'ต่อไป' : 'ข้ามข้อนี้'; };
      stage.append(h('div.ob-hello', av, h('span.ob-hi', 'สวัสดี'), h('label.ob-namebox', inp)));
      view.append(head('เรียกคุณว่าอะไรดี?'), stage);
      paint();
      setTimeout(() => inp.focus({ preventScroll: true }), 420);
    }

    // 2 · วิชา: ไทล์สีของแต่ละวิชา แตะเลือก/เอาออก · ไทล์สุดท้ายเพิ่มวิชาเอง
    if (name === 'subjects') {
      const grid = h('div.ob-tiles');
      const add = h('input.ob-addin', { id: 'ob-newsubj', placeholder: 'ชื่อวิชา', maxlength: 40, 'aria-label': 'เพิ่มวิชาอื่น', enterkeyhint: 'done',
        onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); addSubj(); } }, onblur: () => { if (!add.value.trim()) addTile.classList.remove('typing'); } });
      const addTile = h('div.ob-tile.add', h('button.ob-addbtn', { type: 'button', 'aria-label': 'เพิ่มวิชาอื่น', html: ic('plus') + '<span>วิชาอื่น</span>',
        onclick: () => { addTile.classList.add('typing'); add.focus(); } }), add);
      const addSubj = async () => { const v = add.value.trim(); if (!v) return; const sj = await app.store.ensureSubject(v); ans.subj.add(sj.id); add.value = ''; paint(); };
      const paint = () => {
        const list = [...S().subjects].sort((a, b) => a.order - b.order);
        grid.replaceChildren(...list.map((sj, k) => h('button.ob-chip.ob-tile', { 'aria-pressed': String(ans.subj.has(sj.id)), style: { '--c': sj.color, '--k': k },
          onclick: () => { ans.subj.has(sj.id) ? ans.subj.delete(sj.id) : ans.subj.add(sj.id); paint(); } }, h('i', { html: ic('check') }), h('span', sj.name))), addTile);
        next.disabled = ans.subj.size === 0;
        next.textContent = ans.subj.size ? `ต่อไป · ${ans.subj.size} วิชา` : 'เลือกอย่างน้อย 1 วิชา';
      };
      stage.append(grid);
      view.append(head('เรียนวิชาอะไรบ้าง?'), stage);
      paint();
    }

    // 3 · ครูสั่งงานแบบไหน: การ์ดภาพใหญ่ 2 ใบ
    if (name === 'listen') {
      const box = h('div.ob-pair');
      const paint = () => box.replaceChildren(
        h('button.ob-opt.ob-big.dark', { 'aria-pressed': String(ans.listen === 'teacher'), onclick: () => { ans.listen = 'teacher'; paint(); next.disabled = false; } },
          h('span.ob-art.talk', h('span.ob-mic', { html: ic('mic') }), h('span.ob-bars', Array.from({ length: 14 }, (_, k) => h('i', { style: { '--k': k } })))),
          h('span.ob-ot', h('b', 'ครูพูดในห้อง')), tick()),
        h('button.ob-opt.ob-big', { 'aria-pressed': String(ans.listen === 'self'), onclick: () => { ans.listen = 'self'; paint(); next.disabled = false; } },
          h('span.ob-art.board', h('span', 'การบ้าน'), h('span', 'แบบฝึกหัด หน้า 20'), h('span.r', 'ส่ง ศ.!')),
          h('span.ob-ot', h('b', 'เขียนกระดาน / โพสต์กลุ่ม')), tick()));
      paint();
      next.disabled = !ans.listen;
      stage.append(box);
      view.append(head('ครูสั่งงานยังไง?'), stage);
      next.textContent = 'ต่อไป';
    }

    // 4 · หน้าโน้ต: ปัดดูภาพจอ 6 แบบ ภาพใหญ่ ชื่ออยู่ใต้ภาพ
    if (name === 'style') {
      const strip = h('div.ob-styles', { role: 'radiogroup', 'aria-label': 'หน้าตาหน้าโน้ตงาน' });
      const cards = NOTE_STYLES.map(st => h('button.ob-style', { role: 'radio', 'data-id': st.id, onclick: () => pick(st.id, true) },
        h('span.ob-shot', h('img', { src: stylePreview(st.id), alt: `ตัวอย่างแบบ ${st.name}`, width: 440, height: 951, decoding: 'async', loading: st.id === ans.style ? 'eager' : 'lazy' }), tick()), h('b', st.name)));
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
      stage.append(strip, dots);
      view.append(head('ชอบหน้าโน้ตแบบไหน?'), stage);
      pick(ans.style, false);
      requestAnimationFrame(() => { const c = cards[ans.style - 1]; strip.scrollLeft = c.offsetLeft + c.offsetWidth / 2 - strip.clientWidth / 2; });
    }

    // 5 · งานตัวอย่าง: การ์ดภาพ 2 ใบ (กองงาน / หน้าว่าง)
    if (name === 'samples') {
      const had = S().tasks.some(t => t.source === 'sample'), box = h('div.ob-pair.side');
      const row = (c, w) => h('i', { style: { '--c': c, '--w': w } });
      const paint = () => box.replaceChildren(
        h('button.ob-opt.ob-big', { 'aria-pressed': String(ans.samples === true), onclick: () => { ans.samples = true; paint(); next.disabled = false; } },
          h('span.ob-art.stack', row('#7C4DFF', '70%'), row('#F08A24', '52%'), row('#1769D2', '62%')),
          h('span.ob-ot', h('b', had ? 'เก็บงานตัวอย่างไว้' : 'ใส่งานตัวอย่าง')), tick()),
        h('button.ob-opt.ob-big', { 'aria-pressed': String(ans.samples === false), onclick: () => { ans.samples = false; paint(); next.disabled = false; } },
          h('span.ob-art.empty', { html: ic('plus') }),
          h('span.ob-ot', h('b', had ? 'ลบงานตัวอย่าง' : 'เริ่มจากว่าง')), tick()));
      paint();
      next.disabled = ans.samples == null;
      stage.append(box);
      view.append(head('ลองกับงานตัวอย่างก่อนไหม?'), stage);
      next.textContent = 'ต่อไป';
    }

    // เสร็จ: ภาพจอหน้าโน้ตที่เลือก + ชิปวิชาลอยรอบ ๆ
    if (name === 'done') {
      const subs = [...S().subjects].filter(x => ans.subj.has(x.id)).sort((a, b) => a.order - b.order);
      const pos = [[8, 'l'], [4, 'r'], [40, 'l'], [36, 'r'], [72, 'l'], [68, 'r']];
      stage.append(h('div.ob-final',
      h('span.ob-phone', h('img', { src: stylePreview(ans.style), alt: `หน้าโน้ตแบบ ${styleName(ans.style)}`, width: 440, height: 951, decoding: 'async' })),
        ...subs.slice(0, 6).map((sj, k) => h('span.ob-fchip.' + pos[k][1], { style: { '--c': sj.color, '--y': pos[k][0] + '%', '--k': k } }, h('i'), sj.name.replace(/^ภาษา/, '')))));
      view.append(head(ans.name.trim() ? `พร้อมแล้ว ${ans.name.trim()}!` : 'พร้อมแล้ว!'), stage);
      next.textContent = 'เข้าแอป';
      onNext = finish;
    }

    body.replaceChildren(view);
    body.scrollTop = 0;
    if (name !== 'name') requestAnimationFrame(() => view.querySelector('.ob-q')?.focus({ preventScroll: true }));
  }
  render();
}
