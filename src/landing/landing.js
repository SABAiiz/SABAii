// SABAii หน้าแนะนำ — เครื่องยนต์การเคลื่อนไหว (ไม่ใช้ไลบรารี)
//   • Parallax: แต่ละชั้นขยับตามการเลื่อนด้วยความเร็วต่างกัน (data-depth) + ตามเมาส์เล็กน้อยบนคอม
//   • ค่าทุกตัววิ่งเข้าหาเป้าแบบนุ่ม (lerp) ใน requestAnimationFrame เดียว — หยุดเองเมื่อนิ่ง ไม่กินแบตตอนไม่ได้เลื่อน
//   • ไม่ยึด/ไม่หน่วงการเลื่อนของผู้ใช้ · ใช้แค่ transform / opacity (ลื่นบนมือถือ)
//   • ผู้ใช้ตั้ง "ลดการเคลื่อนไหว" ไว้ → ไม่มี parallax ไม่มีลอย แต่เนื้อหายังเปลี่ยนตามขั้นตอนครบ
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  if (!reduce && 'IntersectionObserver' in window) root.classList.add('anim');
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

  /* คำที่หมุนในหัวเรื่อง */
  const rot = $('.rot'), rw = $('.rot-w');
  const WORDS = [['การบ้าน', '#0A6CF1'], ['สอบย่อย', '#E2453A'], ['รายงาน', '#119A5A'], ['ใบงาน', '#D9741A']];
  const meas = document.createElement('span');
  meas.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;left:-9999px';
  rot.parentNode.append(meas);
  const widthOf = w => { meas.textContent = w; return meas.getBoundingClientRect().width; };
  let wi = 0;
  const sizeRot = () => { const pad = parseFloat(getComputedStyle(rot).paddingLeft) * 2; rot.style.width = widthOf(WORDS[wi][0]) + pad + 'px'; };
  rot.style.setProperty('--rc', WORDS[0][1]);
  document.fonts?.ready.then(sizeRot); sizeRot();
  if (!reduce) setInterval(() => {
    if (document.hidden) return;
    rot.classList.add('out');
    setTimeout(() => {
      wi = (wi + 1) % WORDS.length;
      rw.textContent = WORDS[wi][0]; rot.style.setProperty('--rc', WORDS[wi][1]); sizeRot();
      rot.classList.remove('out'); rot.classList.add('pre');
      requestAnimationFrame(() => requestAnimationFrame(() => rot.classList.remove('pre')));
    }, 320);
  }, 2600);

  /* นาฬิกาจับเวลาบนการ์ด */
  for (const el of $$('[data-clock]')) {
    let s = +el.dataset.clock;
    setInterval(() => { s++; el.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }, 1000);
  }

  /* พิมพ์ภาษาครู → ชิปวิชา/วัน (เริ่มเมื่อกล่องโผล่) */
  const typer = $('.typer');
  if (typer) {
    const out = $('.ttext', typer), text = [...out.dataset.type];
    const run = () => {
      typer.classList.remove('done'); out.textContent = '';
      if (reduce) { out.textContent = text.join(''); typer.classList.add('done'); return; }
      let i = 0;
      const t = setInterval(() => {
        out.textContent += text[i++];
        if (i >= text.length) { clearInterval(t); setTimeout(() => typer.classList.add('done'), 250); setTimeout(run, 4600); }
      }, 70);
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
    return { el, d, z0: (d - 1) * 150, z: 0, y: 0, o: 1 };
  });
  const story = $('.story'), pin = $('.pin'), phone = $('.phone'), sbar = $('.sbar i');
  const chips = $$('[data-sdepth]').map(el => ({ el, d: +el.dataset.sdepth, y: 0 }));
  const notesSec = $('.notes');
  const belts = $$('[data-belt]').map(el => ({ el, dir: +el.dataset.belt, x: null, rx: 0, top: 0, h: 0, shift: 0 }));
  const fin = $('.final');
  const conv = $$('.cv').map(el => { const [fx, fy] = el.dataset.from.split(',').map(Number); return { el, fx, fy, p: 0 }; });
  const ph = { ry: -8, rx: 5, q: 0 };
  const cam = { rx: 0, ry: 0, s: 1, ty: 0, o: 1 };
  let H = { top: 0, h: 1 }, S = { top: 0, h: 1 }, F = { top: 0, h: 1 }, N = { top: 0, h: 1 }, vh = innerHeight, vw = innerWidth;
  let mx = 0, my = 0, tmx = 0, tmy = 0;

  const pos = el => ({ top: el.getBoundingClientRect().top + scrollY, h: el.offsetHeight || 1 });
  function measure() {
    vh = innerHeight; vw = innerWidth;
    H = pos(hero); S = pos(story); F = pos(fin); N = pos(notesSec);
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
        c.o = go(c.o, clamp(1 - (p - .3) * 2.4), .2, .003);
        c.el.style.transform = `translate3d(0,${c.y.toFixed(1)}px,${c.z.toFixed(1)}px)`;
        c.el.style.opacity = c.o.toFixed(3);
      }
      cam.s = go(cam.s, 1 - p * .16, .14, .0005); cam.ty = go(cam.ty, p * 70, .14, .1); cam.o = go(cam.o, clamp(1 - p * 1.6), .18, .003);
      heroText.style.transform = `translate3d(0,${cam.ty.toFixed(1)}px,0) scale(${cam.s.toFixed(4)})`;
      heroText.style.opacity = cam.o.toFixed(3);
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

    // 5 · การ์ดบินเข้ามาจากด้านหน้าผู้ดู แล้วไปเกาะรอบหัวเรื่อง
    if (y + vh > F.top - 100) {
      const p = clamp((y + vh - F.top) / (vh * .85));
      const dx = Math.min(300, vw * .3), dy = Math.min(200, vh * .22);
      for (const c of conv) {
        c.p = go(c.p, p, .1, .001);
        const e = 1 - c.p;
        c.el.style.transform = `translate3d(${(e * c.fx * dx).toFixed(1)}px,${(e * c.fy * dy).toFixed(1)}px,0) scale(${(1 + e * .5).toFixed(3)})`;
        c.el.style.opacity = clamp(c.p * 1.3).toFixed(3);
      }
    }

    if (moving) requestAnimationFrame(frame); else running = false;
  }
  const kick = () => { if (!running) { running = true; requestAnimationFrame(frame); } };

  function reducedTick() { // ไม่มีการเคลื่อนไหว — แค่เปลี่ยนขั้นตอนของมือถือตามการเลื่อน
    const sp = clamp((scrollY - S.top) / (S.h - vh));
    setStep(sp); sbar.style.transform = `scaleX(${sp.toFixed(3)})`;
  }

  addEventListener('scroll', () => { solid(); reduce ? reducedTick() : kick(); }, { passive: true });
  addEventListener('resize', () => { measure(); reduce ? reducedTick() : kick(); });
  if (!reduce) {
    if (fine) addEventListener('pointermove', e => { tmx = e.clientX / vw - .5; tmy = e.clientY / vh - .5; kick(); }, { passive: true });
    // เอียงเครื่อง (Android · iOS ต้องขออนุญาตก่อน เลยไม่ใช้) — มุมแรกที่ถือ = จุดกลาง
    else if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') {
      let b0 = null;
      addEventListener('deviceorientation', e => {
        if (e.gamma == null) return;
        if (b0 == null) b0 = e.beta;
        tmx = clamp(e.gamma / 50, -.5, .5); tmy = clamp((e.beta - b0) / 50, -.5, .5); kick();
      }, { passive: true });
    }
  }

  /* สปอตไลต์ตามเคอร์เซอร์บนกล่องจุดเด่น (คอม) */
  if (fine && !reduce) for (const bx of $$('.bx')) bx.addEventListener('pointermove', e => {
    const r = bx.getBoundingClientRect();
    bx.style.setProperty('--sx', (e.clientX - r.left).toFixed(0) + 'px'); bx.style.setProperty('--sy', (e.clientY - r.top).toFixed(0) + 'px');
  }, { passive: true });

  /* เข้าแอป: วงขาวขยายจากปุ่มจนเต็มจอ แล้วแบบสอบถามค่อย ๆ โผล่ (แท็บเดิม) */
  for (const a of $$('.app-link')) a.addEventListener('click', e => {
    if (reduce || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    e.preventDefault();
    const r = a.getBoundingClientRect();
    const portal = document.createElement('div');
    portal.className = 'portal';
    portal.style.setProperty('--cx', (r.left + r.width / 2).toFixed(0) + 'px'); portal.style.setProperty('--cy', (r.top + r.height / 2).toFixed(0) + 'px');
    document.body.append(portal);
    root.classList.add('leaving');
    requestAnimationFrame(() => requestAnimationFrame(() => portal.classList.add('go')));
    setTimeout(() => { location.href = a.href; }, 640);
  });
  addEventListener('pageshow', e => { if (e.persisted) { root.classList.remove('leaving'); $$('.portal').forEach(p => p.remove()); } });

  addEventListener('load', () => { measure(); reduce ? reducedTick() : kick(); });
  document.fonts?.ready.then(() => { measure(); kick(); });
  measure(); solid(); reduce ? reducedTick() : kick();
})();
