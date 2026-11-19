// SABAii หน้าแนะนำ 0.8 — เครื่องยนต์การเคลื่อนไหว (ไม่ใช้ไลบรารี)
//   แนว fastwork.com/selling: คำในหัวเรื่องสลายเป็นจุด · หัวเรื่องเบลอตอนออก · โพสต์อิทหล่นทีละใบ · แผ่นขาวทับส่วนมืด · การ์ดจุดเด่นลอยขึ้น
//   ของเดิม 0.6 อยู่ครบ: กล้องพุ่งทะลุการ์ด · เมาส์/เอียงเครื่องหมุนฉาก · มือถือลอยขึ้น · สายพานเอียง · วงขาวเข้าแอป · โบกมือ
//   • Parallax: แต่ละชั้นขยับตามการเลื่อนด้วยความเร็วต่างกัน (data-depth) + ตามเมาส์เล็กน้อยบนคอม
//   • ค่าทุกตัววิ่งเข้าหาเป้าแบบนุ่ม (lerp) ใน requestAnimationFrame เดียว — หยุดเองเมื่อนิ่ง ไม่กินแบตตอนไม่ได้เลื่อน
//   • ไม่ยึด/ไม่หน่วงการเลื่อนของผู้ใช้ · ใช้แค่ transform / opacity (ลื่นบนมือถือ)
//   • ผู้ใช้ตั้ง "ลดการเคลื่อนไหว" ไว้ → ไม่มี parallax ไม่มีลอย แต่เนื้อหายังเปลี่ยนตามขั้นตอนครบ
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  if (!reduce && 'IntersectionObserver' in window) root.classList.add('anim'); else root.classList.add('no-anim');
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  /* ลิงก์เข้าแอป (รุ่นลิงก์ทดลองชี้ไปหน้าแอปอีกหน้า) */
  const APP = document.querySelector('meta[name="sabaii-app"]')?.content;
  if (APP) for (const a of $$('.app-link')) { a.href = APP; if (/^https?:/.test(APP)) { a.target = '_blank'; a.rel = 'noopener'; } }

  /* หัวเว็บทึบเมื่อเลื่อนพ้น */
  const top = $('#top');
  const solid = () => top.classList.toggle('solid', scrollY > 20);

  /* เผยทีละชิ้น (stagger ด้วย --i ในแต่ละกลุ่ม) */
  if (root.classList.contains('anim')) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: .12 });
    $$('.rv').forEach(el => io.observe(el));
  } else $$('.rv').forEach(el => el.classList.add('in'));

  /* คำที่เปลี่ยนในหัวเรื่อง: คำเดิมเบลอแล้วหดเป็นจุดสามจุด → จุดขยายกลับเป็นคำใหม่ (สีไล่ของแต่ละคำ) */
  const morph = $('.morph'), mw = $('.mw');
  const WORDS = [['การบ้าน', '#0A6CF1', '#7C4DFF'], ['สอบย่อย', '#E2453A', '#FF8A3D'], ['รายงาน', '#0E9F6E', '#0A6CF1'], ['ใบงาน', '#D9741A', '#E0457B'], ['งานกลุ่ม', '#7C4DFF', '#E0457B']];
  let wi = 0, busy = false;
  const paint = () => { morph.style.setProperty('--c1', WORDS[wi][1]); morph.style.setProperty('--c2', WORDS[wi][2]); };
  const meas = document.createElement('span'); meas.className = 'mmeas'; meas.setAttribute('aria-hidden', 'true'); morph.append(meas);
  const sizeRot = () => { meas.textContent = WORDS[wi][0]; morph.style.width = meas.offsetWidth + 'px'; };
  paint(); document.fonts?.ready.then(sizeRot); sizeRot();
  const word = (d = 1) => {
    if (busy) return; busy = true;
    morph.classList.add('melt');
    setTimeout(() => { wi = (wi + d + WORDS.length) % WORDS.length; sizeRot(); }, 260);   // ช่องว่างเปลี่ยนขนาดระหว่างเป็นจุด
    setTimeout(() => {
      morph.classList.add('form'); mw.textContent = WORDS[wi][0]; paint();
      setTimeout(() => {
        morph.classList.remove('melt');
        requestAnimationFrame(() => requestAnimationFrame(() => { morph.classList.remove('form'); busy = false; }));
      }, 380);
    }, 520);
  };
  let wordTimer = 0;
  const autoWord = () => { clearInterval(wordTimer); if (!reduce) wordTimer = setInterval(() => { if (!document.hidden) word(1); }, 3000); };
  autoWord();

  /* นาฬิกาจับเวลาบนการ์ด */
  for (const el of $$('[data-clock]')) {
    let s = +el.dataset.clock;
    setInterval(() => { s++; el.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }, 1000);
  }

  /* พิมพ์ภาษาครู → ชิปวิชา/วัน · ครูพูด → ได้ 2 งาน (เริ่มเมื่อกล่องโผล่ · วนใหม่เรื่อย ๆ) */
  for (const [typer, out, text] of [[$('.typer'), $('.typer .ttext'), [...($('.typer .ttext')?.dataset.type || '')]], [$('.talk'), $('.talk .said'), [...($('.talk .said')?.dataset.say || '')]]]) {
    if (!typer || !out) continue;
    const run = () => {
      typer.classList.remove('done'); out.textContent = '';
      if (reduce) { out.textContent = text.join(''); out.classList.add('done'); typer.classList.add('done'); return; }
      let i = 0; out.classList.remove('done');
      const t = setInterval(() => {
        out.textContent += text[i++];
        if (i >= text.length) { clearInterval(t); out.classList.add('done'); setTimeout(() => typer.classList.add('done'), 250); setTimeout(run, 5200); }
      }, 55);
    };
    if ('IntersectionObserver' in window) { const o = new IntersectionObserver(es => { if (es[0].isIntersecting) { o.disconnect(); run(); } }, { threshold: .4 }); o.observe(typer); } else run();
  }

  /* ---------------- เครื่องยนต์ความลึก ----------------
     ฉากแรกเป็นพื้นที่ 3 มิติจริง: การ์ดแต่ละใบอยู่ห่างจากผู้ดูไม่เท่ากัน (data-depth → translateZ)
     เลื่อนลง = กล้องพุ่งทะลุฝูงการ์ด (การ์ดเข้าหาผู้ดูแล้วกระจายออกเองตามมุมมอง) · หัวเรื่องถอยลึก
     เมาส์/เอียงเครื่อง (Android) = หมุนฉากทั้งฉาก การ์ดใกล้ขยับมากกว่าการ์ดไกล + แสงสะท้อนจากทิศเดียวกัน */
  const hero = $('.hero'), heroText = $('[data-hero-text]'), scene = $('.hero .cards');
  const heroCards = $$('.hero .fc').map(el => {
    const d = +el.dataset.depth || 1;
    el.style.setProperty('--d', d.toFixed(2));
    return { el, d, z0: (d - 1) * 150, z: 0, x: 0, y: 0, o: 1, side: 1 };
  });
  const story = $('.story'), pin = $('.pin'), phone = $('.phone'), sbar = $('.sbar i');
  const chips = $$('[data-sdepth]').map(el => ({ el, d: +el.dataset.sdepth, y: 0 }));
  const notesSec = $('.notes');
  const belts = $$('[data-belt]').map(el => ({ el, dir: +el.dataset.belt, x: null, rx: 0, top: 0, h: 0, shift: 0 }));
  const fin = $('.final');
  const painSec = $('.pain'), painPin = $('.pain-pin'), relief = $('.relief');
  const notes = $$('.pn').map((el, i) => { const cs = getComputedStyle(el); return { el, i, x: cs.getPropertyValue('--x').trim(), y: cs.getPropertyValue('--y').trim(), r: parseFloat(cs.getPropertyValue('--r')) || 0, p: 0 }; });
  const pp = { s: 1, o: 1 };
  const featSec = $('.feat');
  const fxs = $$('[data-fx]').map(el => ({ el, top: 0, p: 0 }));
  const dock = $('.dock');
  const ph = { ry: -8, rx: 5, q: 0 };
  const cam = { rx: 0, ry: 0, s: 1, ty: 0, o: 1 };
  let H = { top: 0, h: 1 }, S = { top: 0, h: 1 }, F = { top: 0, h: 1 }, N = { top: 0, h: 1 }, P = { top: 0, h: 1 }, R = { top: 0, h: 1 }, X = { top: 0, h: 1 }, vh = innerHeight, vw = innerWidth;
  let mx = 0, my = 0, tmx = 0, tmy = 0, handOn = false;

  const pos = el => ({ top: el.getBoundingClientRect().top + scrollY, h: el.offsetHeight || 1 });
  function measure() {
    vh = innerHeight; vw = innerWidth;
    H = pos(hero); S = pos(story); F = pos(fin); N = pos(notesSec); P = pos(painSec); R = pos(relief); X = pos(featSec);
    for (const c of heroCards) { const r = c.el.getBoundingClientRect(); c.side = (r.left + r.width / 2) < vw / 2 ? -1 : 1; }
    for (const f of fxs) { const t = f.el.style.transform; f.el.style.transform = 'none'; f.top = pos(f.el).top; f.el.style.transform = t; }
    for (const b of belts) { const t = b.el.style.transform; b.el.style.transform = 'none'; const r = pos(b.el); b.el.style.transform = t; b.top = r.top; b.h = r.h; b.shift = Math.max(160, b.el.scrollWidth - vw + 40); }
    sizeRot();
  }

  let step = -1;
  function setStep(sp) {
    const s = Math.min(2, Math.floor(sp * 3));
    if (s !== step) { step = s; pin.dataset.step = String(s); }
  }

  let running = false;
  function frame() {
    const y = scrollY;
    let moving = false;
    // ค่าเข้าหาเป้าแบบนุ่ม · k = ความไว (ยิ่งน้อยยิ่งหนืด) · eps = ถือว่าถึงแล้ว
    const go = (cur, target, k = .14, eps = .02) => { const v = cur + (target - cur) * k; if (Math.abs(v - target) > eps) { moving = true; return v; } return target; };
    mx = go(mx, tmx, .07, .0005); my = go(my, tmy, .07, .0005);

    // 1 · ฉากแรก: กล้องพุ่งทะลุการ์ด
    if (y < H.h * 1.15) {
      const p = clamp(y / (H.h * .85));
      cam.rx = go(cam.rx, my * -7, .1, .005); cam.ry = go(cam.ry, mx * 9, .1, .005);
      scene.style.transform = `rotateX(${cam.rx.toFixed(3)}deg) rotateY(${cam.ry.toFixed(3)}deg)`;
      scene.style.setProperty('--lx', (50 + cam.ry * 5).toFixed(1) + '%');
      scene.style.setProperty('--ly', (8 - cam.rx * 5).toFixed(1) + '%');
      for (const c of heroCards) {
        c.z = go(c.z, c.z0 + Math.min(620, p * 760 * c.d), .16, .1);
        c.y = go(c.y, -y * .12 * c.d, .16, .1);
        c.x = go(c.x, c.side * p * 240 * c.d, .16, .1);
        c.o = go(c.o, clamp(1 - (p - .3) * 2.4), .2, .003);
        c.el.style.transform = `translate3d(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px,${c.z.toFixed(1)}px)`;
        c.el.style.opacity = c.o.toFixed(3);
      }
      cam.s = go(cam.s, 1 - p * .16, .14, .0005); cam.ty = go(cam.ty, p * 70, .14, .1); cam.o = go(cam.o, clamp(1 - p * 1.6), .18, .003);
      heroText.style.transform = `translate3d(0,${cam.ty.toFixed(1)}px,0) scale(${cam.s.toFixed(4)})`;
      heroText.style.opacity = cam.o.toFixed(3);
      heroText.style.filter = p > .01 ? `blur(${(p * 14).toFixed(2)}px)` : 'none';
    }

    // 2 · มือถือโผล่ขึ้นมาจากฉาก แล้วเอียงตามการเลื่อน · ขั้นตอนเปลี่ยนตามระยะ
    if (y + vh > S.top && y < S.top + S.h) {
      const sp = clamp((y - S.top) / (S.h - vh));
      const q = clamp((y + vh - S.top) / vh);
      setStep(sp);
      sbar.style.transform = `scaleX(${sp.toFixed(3)})`;
      ph.q = go(ph.q, q, .12, .001);
      ph.ry = go(ph.ry, (sp - .5) * -16 + mx * 10, .08, .01); ph.rx = go(ph.rx, 6 - sp * 8 - my * 6, .08, .01);
      const e = 1 - ph.q;
      phone.style.transform = `perspective(1400px) translate3d(0,${(e * 200).toFixed(1)}px,0) rotateX(${(ph.rx + e * 26).toFixed(2)}deg) rotateY(${ph.ry.toFixed(2)}deg) scale(${(.84 + ph.q * .16).toFixed(4)})`;
      for (const c of chips) { c.y = go(c.y, (sp - .5) * -150 * c.d, .14, .1); c.el.style.transform = `translate3d(0,${c.y.toFixed(1)}px,0)`; }
    }

    // 3 · สายพานโน้ตวางบนระนาบเอียง → ราบลงเมื่อถึงกลางจอ · สองแถวไหลสวนกัน
    if (y + vh > N.top - 100 && y < N.top + N.h + 100) {
      for (const b of belts) {
        const p = clamp((y + vh - b.top) / (vh + b.h));
        const rel = clamp((b.top + b.h / 2 - y - vh / 2) / vh, -1, 1);
        const target = b.dir < 0 ? -p * b.shift : -(1 - p) * b.shift;
        b.x = b.x == null ? target : go(b.x, target, .1, .1);
        b.rx = go(b.rx, rel * 16, .12, .01);
        b.el.style.transformOrigin = `${(vw / 2 - b.x).toFixed(0)}px 50%`;
        b.el.style.transform = `perspective(1100px) rotateX(${b.rx.toFixed(2)}deg) translate3d(${b.x.toFixed(1)}px,0,0)`;
      }
    }

    // 3 · ส่วนมืด: โพสต์อิทหล่นจากด้านบนทีละใบ · แผ่นขาวเลื่อนขึ้นมาทับ ฉากด้านหลังยุบลงและมืดลง (การ์ดซ้อน)
    if (y + vh > P.top && y < R.top + vh) {
      const p = clamp((y - P.top + vh * .55) / (vh * 1.35));
      for (const n of notes) {
        n.p = go(n.p, clamp((p - n.i * .15) / .22), .16, .001);
        const k = 1 - n.p;
        n.el.style.transform = `translate(${n.x}, calc(${n.y} - ${(k * 95).toFixed(2)}vh)) rotate(${(n.r - k * 24 * (n.i % 2 ? 1 : -1)).toFixed(2)}deg) scale(${(1 + k * .25).toFixed(3)})`;
        n.el.style.opacity = clamp(n.p * 3).toFixed(3);
      }
      const cover = clamp((y + vh - R.top) / vh);
      pp.s = go(pp.s, 1 - cover * .08, .16, .0005); pp.o = go(pp.o, 1 - cover * .6, .16, .002);
      painPin.style.transform = `scale(${pp.s.toFixed(4)})`; painPin.style.opacity = pp.o.toFixed(3);
    }

    // 4 · จุดเด่น: การ์ดลอยขึ้นจากความลึก เอียงแล้วราบลง
    if (y + vh > X.top && y < X.top + X.h) {
      for (const f of fxs) {
        f.p = go(f.p, clamp((y + vh - f.top) / (vh * .75)), .14, .001);
        const k = 1 - f.p;
        f.el.style.transform = `perspective(1200px) translate3d(0,${(k * 140).toFixed(1)}px,${(-k * 120).toFixed(1)}px) rotateX(${(k * 16).toFixed(2)}deg)`;
        f.el.style.opacity = clamp(f.p * 1.6).toFixed(3);
      }
    }

    if (moving) requestAnimationFrame(frame); else running = false;
  }
  const kick = () => { if (!running) { running = true; requestAnimationFrame(frame); } };

  function reducedTick() { // ไม่มีการเคลื่อนไหว — แค่เปลี่ยนขั้นตอนของมือถือตามการเลื่อน
    const sp = clamp((scrollY - S.top) / (S.h - vh));
    setStep(sp); sbar.style.transform = `scaleX(${sp.toFixed(3)})`;
  }

  /* หัวเว็บเปลี่ยนเป็นมืดเมื่ออยู่บนส่วนมืด · ปุ่มลอยล่างจอโผล่หลังพ้นฉากแรก หลบตอนถึงกรอบสุดท้าย */
  function chrome() {
    const y = scrollY, at = y + 36;
    const dark = (at > P.top && at < R.top) || (at > X.top && at < X.top + X.h) || at > F.top;
    top.classList.toggle('on-dark', dark);
    dock?.classList.toggle('show', y > H.h * .75 && y + vh < F.top + vh * .35);
  }

  addEventListener('scroll', () => { solid(); chrome(); reduce ? reducedTick() : kick(); }, { passive: true });
  addEventListener('resize', () => { measure(); chrome(); reduce ? reducedTick() : kick(); });
  if (!reduce) {
    if (fine) addEventListener('pointermove', e => { if (handOn) return; tmx = e.clientX / vw - .5; tmy = e.clientY / vh - .5; kick(); }, { passive: true });
    // เอียงเครื่อง (Android · iOS ต้องขออนุญาตก่อน เลยไม่ใช้) — มุมแรกที่ถือ = จุดกลาง
    else if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') {
      let b0 = null;
      addEventListener('deviceorientation', e => {
        if (e.gamma == null || handOn) return;
        if (b0 == null) b0 = e.beta;
        tmx = clamp(e.gamma / 50, -.5, .5); tmy = clamp((e.beta - b0) / 50, -.5, .5); kick();
      }, { passive: true });
    }
  }


  /* โหมดโบกมือ: กล้องหน้า → ฉากหมุนตามมือ · ปัดขึ้น/ลง = เลื่อนไปส่วนถัดไป/ก่อนหน้า · ปัดซ้าย/ขวา = เปลี่ยนคำในหัวเรื่อง
     ภาพไม่ออกจากเครื่อง · โหลดตัวตามมือเฉพาะตอนกด */
  const handBtn = $('.handbtn');
  let hand = null;
  async function handStart() {
    const video = document.createElement('video');
    const st = document.createElement('span'); st.className = 'hb-st'; st.textContent = 'กำลังเปิดกล้อง…';
    const cam = document.createElement('div'); cam.className = 'hb-cam'; cam.append(video);
    const box = document.createElement('div'); box.className = 'hb'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); box.append(cam, st);
    const dot = document.createElement('div'); dot.className = 'hb-dot';
    document.body.append(box, dot);
    const me = hand = { box, dot, s: null };
    handBtn.setAttribute('aria-pressed', 'true');
    const say = { loading: 'กำลังเตรียม…', ready: 'โบกมือได้เลย', denied: 'ยังไม่ได้อนุญาตกล้อง', unsupported: 'เครื่องนี้ยังใช้ไม่ได้' };
    let mod;
    // ที่อยู่ของตัวตามมืออิงหน้าเว็บ (import ในสคริปต์ธรรมดาจะอิงที่อยู่ของไฟล์สคริปต์)
    try { mod = await import(new URL($('meta[name="sabaii-hand"]').content, location.href).href); } catch { st.textContent = say.unsupported; setTimeout(handStop, 2600); return; }
    const s = await mod.startHands({
      video,
      onState: k => { if (hand !== me) return; box.dataset.state = k; st.textContent = say[k] || ''; if (k === 'ready') { handOn = true; clearInterval(wordTimer); } if (k === 'denied' || k === 'unsupported') setTimeout(() => hand === me && handStop(), 2600); },
      onPoint: p => {
        if (hand !== me) return;
        dot.classList.toggle('on', !!p);
        if (!p) return;
        dot.style.transform = `translate3d(${(p.x * vw).toFixed(0)}px,${(p.y * vh).toFixed(0)}px,0)`;
        tmx = (p.x - .5) * 1.2; tmy = (p.y - .5) * 1.2; kick();
      },
      onSwipe: d => {
        if (hand !== me) return;
        if (d === 'up') scrollBy({ top: vh * .85, behavior: 'smooth' });
        else if (d === 'down') scrollBy({ top: -vh * .85, behavior: 'smooth' });
        else word(d === 'left' ? 1 : -1);
        dot.classList.remove('hit'); void dot.offsetWidth; dot.classList.add('hit');
        if (navigator.vibrate) navigator.vibrate(8);
      },
    });
    if (hand !== me) { s?.stop(); return; }
    me.s = s;
  }
  function handStop() {
    if (!hand) return;
    const h = hand; hand = null; handOn = false;
    h.s?.stop(); h.dot.remove(); h.box.classList.add('out'); setTimeout(() => h.box.remove(), 250);
    handBtn.setAttribute('aria-pressed', 'false');
    tmx = tmy = 0; kick(); autoWord();
  }
  if (handBtn) {
    if (!navigator.mediaDevices?.getUserMedia) handBtn.hidden = true;
    handBtn.addEventListener('click', () => (hand ? handStop() : handStart()));
    addEventListener('pagehide', handStop);
  }

  /* เข้าแอป: วงขาวขยายจากปุ่มจนเต็มจอ แล้วแบบสอบถามค่อย ๆ โผล่ (แท็บเดิม) */
  for (const a of $$('.app-link')) a.addEventListener('click', e => {
    if (reduce || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    e.preventDefault();
    const r = a.getBoundingClientRect();
    const portal = document.createElement('div');
    portal.className = 'portal';
    portal.style.setProperty('--cx', (r.left + r.width / 2).toFixed(0) + 'px'); portal.style.setProperty('--cy', (r.top + r.height / 2).toFixed(0) + 'px');
    document.body.append(portal);
    root.classList.add('leaving'); handStop();
    requestAnimationFrame(() => requestAnimationFrame(() => portal.classList.add('open')));
    setTimeout(() => { location.href = a.href; }, 640);
  });
  addEventListener('pageshow', e => { if (e.persisted) { root.classList.remove('leaving'); $$('.portal').forEach(p => p.remove()); } });

  addEventListener('load', () => { measure(); chrome(); reduce ? reducedTick() : kick(); });
  document.fonts?.ready.then(() => { measure(); kick(); });
  measure(); solid(); chrome(); reduce ? reducedTick() : kick();
})();
