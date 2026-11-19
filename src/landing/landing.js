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
  const lerp = (a, b, t) => a + (b - a) * t;

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

  /* ---------------- Parallax ---------------- */
  const hero = $('.hero'), heroText = $('[data-hero-text]');
  const heroCards = $$('.hero .fc').map(el => ({ el, d: +el.dataset.depth || 1, dir: +el.dataset.dir || 1, x: 0, y: 0, s: 1, o: 1 }));
  const story = $('.story'), pin = $('.pin'), phone = $('.phone'), sbar = $('.sbar i');
  const chips = $$('[data-sdepth]').map(el => ({ el, d: +el.dataset.sdepth, y: 0 }));
  const belts = $$('[data-belt]').map(el => ({ el, dir: +el.dataset.belt, x: null, top: 0, h: 0, shift: 0 }));
  const fin = $('.final');
  const conv = $$('.cv').map(el => { const [fx, fy] = el.dataset.from.split(',').map(Number); return { el, fx, fy, p: 0 }; });
  const ph = { ry: -8, rx: 5 };
  let H = { top: 0, h: 1 }, S = { top: 0, h: 1 }, F = { top: 0, h: 1 }, vh = innerHeight, vw = innerWidth;
  let mx = 0, my = 0, tmx = 0, tmy = 0, hx = 0, hy = 0, ho = 1;

  const pos = el => ({ top: el.getBoundingClientRect().top + scrollY, h: el.offsetHeight || 1 });
  function measure() {
    vh = innerHeight; vw = innerWidth;
    H = pos(hero); S = pos(story); F = pos(fin);
    for (const b of belts) { const r = pos(b.el); b.top = r.top; b.h = r.h; b.shift = Math.max(160, b.el.scrollWidth - vw + 40); }
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
    const go = (cur, target, t = .12) => { const v = lerp(cur, target, t); if (Math.abs(v - target) > .05) moving = true; return Math.abs(v - target) > .05 ? v : target; };
    mx = go(mx * 100, tmx * 100, .07) / 100; my = go(my * 100, tmy * 100, .07) / 100;

    // 1 · Hero: การ์ดลอยออกด้านข้างและขึ้นด้วยความเร็วต่างกัน + จางหาย · หัวเรื่องเลื่อนช้ากว่า
    if (y < H.h * 1.2) {
      const p = clamp(y / H.h);
      for (const c of heroCards) {
        c.x = go(c.x, c.dir * p * 180 * c.d - mx * 26 * c.d);
        c.y = go(c.y, -y * .32 * c.d - my * 20 * c.d);
        c.s = go(c.s * 100, (1 - p * .07 * c.d) * 100) / 100;
        c.o = go(c.o * 100, clamp(1 - p * 1.25) * 100) / 100;
        c.el.style.transform = `translate3d(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px,0) scale(${c.s.toFixed(3)})`;
        c.el.style.opacity = c.o.toFixed(3);
      }
      hy = go(hy, y * .22); hx = go(hx, -mx * 8); ho = go(ho * 100, clamp(1 - p * 1.5) * 100) / 100;
      heroText.style.transform = `translate3d(${hx.toFixed(1)}px,${hy.toFixed(1)}px,0)`;
      heroText.style.opacity = ho.toFixed(3);
    }

    // 2 · Story: ขั้นตอนเปลี่ยนตามระยะเลื่อน · มือถือเอียงตาม · ชิปรอบ ๆ ลอยสวนกัน
    if (y + vh > S.top && y < S.top + S.h) {
      const sp = clamp((y - S.top) / (S.h - vh));
      setStep(sp);
      sbar.style.transform = `scaleX(${sp.toFixed(3)})`;
      ph.ry = go(ph.ry, (sp - .5) * -16 + mx * 10, .08); ph.rx = go(ph.rx, 6 - sp * 8 - my * 6, .08);
      phone.style.transform = `perspective(1400px) rotateY(${ph.ry.toFixed(2)}deg) rotateX(${ph.rx.toFixed(2)}deg)`;
      for (const c of chips) { c.y = go(c.y, (sp - .5) * -150 * c.d); c.el.style.transform = `translate3d(0,${c.y.toFixed(1)}px,0)`; }
    }

    // 3 · สายพานโน้ต: แถวบนไหลซ้าย แถวล่างไหลขวา ตามการเลื่อน
    for (const b of belts) {
      if (y + vh < b.top - 200 || y > b.top + b.h + 200) continue;
      const p = clamp((y + vh - b.top) / (vh + b.h));
      const target = b.dir < 0 ? -p * b.shift : -(1 - p) * b.shift;
      b.x = b.x == null ? target : go(b.x, target, .1);
      b.el.style.transform = `translate3d(${b.x.toFixed(1)}px,0,0)`;
    }

    // 5 · CTA: การ์ดจากมุมจอลอยเข้ามารวมรอบหัวเรื่อง
    if (y + vh > F.top - 100) {
      const p = clamp((y + vh - F.top) / (vh * .85));
      const dx = Math.min(300, vw * .3), dy = Math.min(200, vh * .22);
      for (const c of conv) {
        c.p = go(c.p * 100, p * 100, .1) / 100;
        c.el.style.transform = `translate3d(${((1 - c.p) * c.fx * dx).toFixed(1)}px,${((1 - c.p) * c.fy * dy).toFixed(1)}px,0) scale(${(.8 + c.p * .2).toFixed(3)})`;
        c.el.style.opacity = clamp(c.p * 1.2).toFixed(3);
      }
    }

    if (moving) requestAnimationFrame(frame); else running = false;
  }
  const kick = () => { if (!running) { running = true; requestAnimationFrame(frame); } };

  function reducedTick() { // ไม่มี parallax — แค่เปลี่ยนขั้นตอนของมือถือตามการเลื่อน
    const sp = clamp((scrollY - S.top) / (S.h - vh));
    setStep(sp); sbar.style.transform = `scaleX(${sp.toFixed(3)})`;
  }

  addEventListener('scroll', () => { solid(); reduce ? reducedTick() : kick(); }, { passive: true });
  addEventListener('resize', () => { measure(); reduce ? reducedTick() : kick(); });
  if (fine && !reduce) addEventListener('pointermove', e => { tmx = e.clientX / vw - .5; tmy = e.clientY / vh - .5; kick(); }, { passive: true });
  addEventListener('load', () => { measure(); reduce ? reducedTick() : kick(); });
  document.fonts?.ready.then(() => { measure(); kick(); });
  measure(); solid(); reduce ? reducedTick() : kick();
})();
