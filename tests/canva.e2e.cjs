// 0.14 หน้าเขียนแบบ Canva (จอใหญ่) — ทุกอย่างเป็นชิ้นที่จับได้: แตะเลือก · ลากย้าย + เส้นช่วยจัดแนว · มุมย่อขยาย · ขอบยืด · หมุน
// รูปทรงใส่ข้อความ · เส้นเชื่อมเกาะรูปทรง (ย้ายรูปแล้วเส้นตาม) · แถบเมนูลอย (สี/พื้น/ชั้น/ทำสำเนา/ลบ) · คัดลอก/วาง · แผงทุกหน้า · ซูมออก/พอดีหน้า
//   node tests/canva.e2e.cjs [โฟลเดอร์เก็บภาพ]
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const SHOTS = process.argv[2] || null;
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'ผ่าน' : 'ตก  '}  ${name}${extra ? '  — ' + extra : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = require('./fake-login.cjs').autoSignIn(await chromium.launch()); // แอปต้องเข้าสู่ระบบก่อน
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'th-TH', timezoneId: 'Asia/Bangkok', serviceWorkers: 'block' });
  await ctx.route('http://sabaii.test/**', r => {
    let f = path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname));
    if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const shot = async n => { if (!SHOTS) return; await wait(350); await page.screenshot({ path: `${SHOTS}/${n}.png` }); };
  await page.goto('http://sabaii.test/#/notebook');
  await page.waitForSelector('#ob-skip'); await page.locator('#ob-skip').click(); await wait(400);
  await page.locator('.nb-add').click(); await wait(400);
  await page.locator('.bk-in').fill('ผังความคิด');
  await page.locator('.nb-firsts button', { hasText: 'เริ่มเขียนเลย' }).click();
  await page.locator('.mfoot .btn.primary').click();
  await page.waitForSelector('#sk.in'); await wait(700);

  const cur = async () => { await wait(480); return page.evaluate(() => { const st = window.__sabaii.state, b = st.books.find(x => x.title === 'ผังความคิด'); return st.pages.filter(x => x.book_id === b.id).sort((a, c) => a.order - c.order)[0]; }); };
  // พิกัดหน้ากระดาษ (หน่วย 0–1000) → จุดบนจอ
  const view = () => page.evaluate(() => { const m = document.querySelector('.sk-layer').style.transform.match(/-?[\d.]+/g).map(Number); return { vx: m[0], vy: m[1], s: m[2] }; });
  let V = await view();
  const U = (x, y) => [V.vx + x * V.s, V.vy + y * V.s];
  async function drag(a, b, steps = 8) { await page.mouse.move(...U(...a)); await page.mouse.down(); await page.mouse.move(...U(...b), { steps }); await page.mouse.up(); await wait(80); }
  async function tap(a) { await page.mouse.click(...U(...a)); await wait(120); }

  check('จอใหญ่: แผงทุกหน้าทางซ้าย + แถบซูมมุมขวาล่าง', await page.locator('.sk-side').isVisible() && await page.locator('.sk-zbar').isVisible() && (await page.locator('.sk-sp').count()) === 1);
  check('กระดาษหลบแผงซ้าย (ไม่ทับกัน)', V.vx >= 176, String(V.vx));

  // รูปทรง: สี่เหลี่ยมมน + ดาว
  await page.locator('.sk-tool[data-tool="shape"]').click();
  await page.locator('.sk-kinds button[aria-label="สี่เหลี่ยมมน"]').click();
  await page.locator('.sk-seg button[aria-label="พื้นจาง"]').click();
  await drag([120, 200], [420, 380]);
  let p = await cur();
  check('ลากด้วยเครื่องมือรูปทรง = รูปทรงใหม่ (ชิ้นงาน มีพื้นจาง) และถูกเลือกทันที', p.shapes.length === 1 && p.shapes[0].k === 'round' && p.shapes[0].f === 'tint' && await page.locator('.sk-selbox').isVisible() && await page.locator('.sk-selbar').isVisible());
  await page.locator('.sk-kinds button[aria-label="ดาว"]').click();
  await tap([700, 600]);
  p = await cur();
  check('แตะเฉย ๆ = วางรูปทรงขนาดพอดีตรงนั้น', p.shapes.length === 2 && p.shapes[1].k === 'star' && Math.abs(p.shapes[1].x + p.shapes[1].w / 2 - 700) < 2);

  // ลูกศรจากสี่เหลี่ยมไปดาว → เกาะทั้งสองปลาย
  await page.locator('.sk-kinds button[aria-label="ลูกศร"]').click();
  await page.locator('.sk-seg button[aria-label="แบบโค้ง"]').click();
  await drag([420, 290], [600, 600], 12);
  p = await cur();
  const ln = p.lines[0];
  check('ลากลูกศรจากรูปทรงไปอีกรูป = เส้นเกาะทั้งสองปลาย (โค้ง)', ln && ln.a.to === p.shapes[0].id && ln.b.to === p.shapes[1].id && ln.st === 'curve' && ln.hd === 1, JSON.stringify(ln && { a: ln.a, b: ln.b }));
  await shot('c01-shapes-arrow');

  // เครื่องมือเลือก: แตะดาว → ลากย้าย → เส้นตามไปเอง
  await page.locator('.sk-tool[data-tool="lasso"]').click();
  const star0 = p.shapes[1];
  await drag([700, 600], [760, 700]);
  p = await cur();
  check('เครื่องมือเลือก: แตะแล้วลากชิ้นได้ทันที', Math.abs(p.shapes[1].x - star0.x - 60) < 3 && Math.abs(p.shapes[1].y - star0.y - 100) < 3, `${star0.x},${star0.y} → ${p.shapes[1].x},${p.shapes[1].y}`);
  check('ย้ายรูปทรงแล้วเส้นที่เกาะอยู่ตามไป (ยังเกาะ)', p.lines[0].b.to === p.shapes[1].id);

  // เส้นช่วยจัดแนว: ลากดาวให้กลางเกือบตรงกับกลางสี่เหลี่ยม → ดูดเข้าพอดี
  const rc = p.shapes[0].x + p.shapes[0].w / 2, sc0 = p.shapes[1].x + p.shapes[1].w / 2;
  await page.mouse.move(...U(sc0, p.shapes[1].y + p.shapes[1].h / 2)); await page.mouse.down();
  await page.mouse.move(...U(rc + 4, p.shapes[1].y + p.shapes[1].h / 2 + 40), { steps: 10 });
  await wait(50); await shot('c02-snap-guide');
  await page.mouse.up(); await wait(100);
  p = await cur();
  check('ลากใกล้แนวกลางชิ้นอื่น = ดูดเข้าแนวพอดี (เส้นช่วยจัดแนว)', Math.abs(p.shapes[1].x + p.shapes[1].w / 2 - rc) < .6, `${(p.shapes[1].x + p.shapes[1].w / 2).toFixed(1)} vs ${rc}`);

  // หมุน: จับปุ่ม ⟳ ใต้กรอบ ลากไปทางขวา
  const rot = await page.locator('.sk-rot').boundingBox();
  await page.mouse.move(rot.x + rot.width / 2, rot.y + rot.height / 2); await page.mouse.down();
  const sh = p.shapes[1], ccx = sh.x + sh.w / 2, ccy = sh.y + sh.h / 2;
  await page.mouse.move(...U(ccx - 200, ccy + 30), { steps: 10 });
  check('หมุนอยู่ = มีป้ายบอกองศา', await page.locator('.sk-badge').isVisible() && /°/.test(await page.locator('.sk-badge').textContent()));
  await page.mouse.up(); await wait(100);
  p = await cur();
  check('จับปุ่มหมุนแล้วลาก = รูปทรงหมุน', Math.abs(p.shapes[1].r) > .3, String(p.shapes[1].r));
  await shot('c03-rotate');
  await page.locator('.sk-ib[aria-label="เลิกทำ"]').click(); await wait(200);
  p = await cur();
  check('เลิกทำ = หมุนกลับ', !p.shapes[1].r);

  // ขอบยืด: แตะสี่เหลี่ยม แล้วลากขอบขวา
  await tap([200, 230]);
  const r0 = (await cur()).shapes[0];
  const eh = await page.locator('.sk-h[data-h="e"]').boundingBox();
  await page.mouse.move(eh.x + eh.width / 2, eh.y + eh.height / 2); await page.mouse.down(); await page.mouse.move(eh.x + 120, eh.y + 30, { steps: 6 }); await page.mouse.up(); await wait(100);
  let r1 = (await cur()).shapes[0];
  check('ลากขอบขวา = ยืดแนวนอนอย่างเดียว', r1.w > r0.w + 80 && r1.h === r0.h && r1.x === r0.x, `${r0.w}x${r0.h} → ${r1.w}x${r1.h}`);
  const se = await page.locator('.sk-h[data-h="se"]').boundingBox();
  await page.mouse.move(se.x + se.width / 2, se.y + se.height / 2); await page.mouse.down(); await page.mouse.move(se.x + 60, se.y + 80, { steps: 6 }); await page.mouse.up(); await wait(100);
  const r2 = (await cur()).shapes[0];
  check('ลากมุม = ย่อขยายคงสัดส่วน', Math.abs(r2.w / r2.h - r1.w / r1.h) < .02 && r2.w > r1.w, `${r1.w}x${r1.h} → ${r2.w}x${r2.h}`);

  // ข้อความในรูปทรง: แตะชิ้นที่เลือกอยู่ซ้ำ
  await tap([200, 260]);
  check('แตะรูปทรงที่เลือกอยู่ซ้ำ = พิมพ์ข้อความในรูป', await page.locator('.sk-ta.in-shape').isVisible());
  await page.keyboard.type('สังเคราะห์แสง');
  await page.keyboard.press('Escape'); await wait(500);
  p = await cur();
  check('ข้อความอยู่ในรูปทรง (ค้นเจอในสมุดด้วย)', p.shapes[0].v === 'สังเคราะห์แสง');

  // แถบเมนูลอย: สี · พื้น · ชั้น
  await tap([200, 230]);
  await page.locator('.sk-selbar .sk-swb').click(); await wait(80);
  await page.locator('.sk-selpal button').nth(3).click(); await wait(80);
  p = await cur();
  check('แถบเมนูลอย: เปลี่ยนสีชิ้นที่เลือก', p.shapes[0].c === '#16B76A', p.shapes[0].c);
  await page.locator('.sk-selbar button[aria-label^="พื้น"]').click(); await wait(80);
  p = await cur();
  check('แถบเมนูลอย: แตะพื้น = จาง → ทึบ', p.shapes[0].f === 'solid');
  await shot('c04-selbar');
  await page.locator('.sk-selbar button[aria-label="เอาไว้หน้าสุด"]').click(); await wait(80);
  p = await cur();
  check('เอาไว้หน้าสุด = ชั้นบนสุด (เหนือเส้นเชื่อม)', p.shapes[0].z > 3);

  // เส้นเชื่อม: แตะเส้น → เปลี่ยนแบบเส้น · หัวลูกศร
  await page.keyboard.press('Escape'); await wait(80);
  p = await cur();
  const A = p.shapes[0], B = p.shapes[1];
  await page.locator('.sk-tool[data-tool="lasso"]').click();
  // ใช้บ่วงวนเส้นทั้งเส้นไม่ได้ (ติดรูปทรง) → แตะที่ปลายเส้นข้างรูปดาว
  const end = await page.evaluate(() => {
    const st = window.__sabaii.state, b = st.books.find(x => x.title === 'ผังความคิด'), p = st.pages.find(x => x.book_id === b.id && x.order === 0), o = p.shapes[1], l = p.lines[0];
    const side = l.b.side, m = { n: [.5, 0], e: [1, .5], s: [.5, 1], w: [0, .5] }[side];
    return [o.x + o.w * m[0], o.y + o.h * m[1], side];
  });
  const off = { n: [0, -18], s: [0, 18], e: [18, 0], w: [-18, 0] }[end[2]];
  await tap([end[0] + off[0] * 1.6, end[1] + off[1] * 1.6]);
  check('แตะเส้นเชื่อม = เลือกเส้น (มีจุดปลายให้ลาก)', await page.locator('.sk-ends').isVisible() && !(await page.locator('.sk-selbox').isVisible()));
  await page.locator('.sk-selbar button[aria-label^="เส้นแบบโค้ง"]').click(); await wait(80);
  p = await cur();
  check('แถบเมนูของเส้น: แตะแบบเส้น = โค้ง → ตรง', p.lines[0].st === 'straight');
  await page.locator('.sk-selbar button[aria-label^="หัวลูกศรปลายเดียว"]').click(); await wait(80);
  p = await cur();
  check('แถบเมนูของเส้น: หัวลูกศร = สองปลาย', p.lines[0].hd === 2);
  await shot('c05-line');

  // คัดลอก/วาง
  await page.keyboard.press('Escape');
  const starC = () => cur().then(q => [q.shapes[1].x + q.shapes[1].w / 2, q.shapes[1].y + q.shapes[1].h / 2]);
  await tap(await starC());
  await page.keyboard.press('Control+c'); await page.keyboard.press('Control+v'); await wait(150);
  p = await cur();
  check('ctrl+C / ctrl+V = วางชิ้นใหม่ เลื่อนนิด ถูกเลือก', p.shapes.length === 3 && p.shapes[2].k === 'star' && p.shapes[2].x === p.shapes[1].x + 30);
  await page.keyboard.press('Delete'); await wait(100);
  check('Delete = ลบชิ้นที่เลือก', (await cur()).shapes.length === 2);

  // ลบรูปทรงที่มีเส้นเกาะ → เส้นยังอยู่ ปลายค้างที่เดิม
  await tap(await starC());
  await page.keyboard.press('Delete'); await wait(500);
  p = await cur();
  check('ลบรูปทรงที่มีเส้นเกาะ = เส้นยังอยู่ ปลายค้างตำแหน่งเดิม', p.lines.length === 1 && !p.lines[0].b.to && typeof p.lines[0].b.x === 'number');
  await page.locator('.sk-ib[aria-label="เลิกทำ"]').click(); await wait(200);

  // ซูมออก + พอดีหน้า
  await page.locator('.sk-zb[aria-label="ซูมออก"]').click(); await wait(350);
  const zt = await page.locator('.sk-zpct').textContent();
  check('ปุ่มซูมออก = ต่ำกว่า 100% (เห็นทั้งหน้าลอยบนโต๊ะ)', parseInt(zt) < 100, zt);
  await page.locator('.sk-zb[aria-label="พอดีหน้า"]').click(); await wait(400);
  V = await view();
  const ph = await page.evaluate(() => document.querySelector('.sk-layer').getBoundingClientRect().height);
  check('พอดีหน้า = ทั้งหน้าอยู่ในจอ', V.vy >= 0 && V.vy + ph <= 900, `${V.vy} + ${ph}`);
  await shot('c06-fit');
  await page.locator('.sk-zpct').click(); await wait(400);
  check('แตะ % = กลับ 100%', (await page.locator('.sk-zpct').textContent()) === '100%');

  // แผงทุกหน้า
  await page.locator('.sk-sp-add').click(); await wait(900);
  check('แผงซ้าย "เพิ่มหน้า" = หน้าใหม่ แผงมี 2 หน้า', (await page.locator('.sk-name b').textContent()) === '2 / 2' && (await page.locator('.sk-sp').count()) === 2);
  await page.locator('.sk-sp').first().click(); await wait(900);
  check('แตะหน้าในแผง = ไปหน้านั้น', (await page.locator('.sk-name b').textContent()) === '1 / 2');
  await page.locator('.sk-name').click(); await wait(300);
  check('แตะ "x / y" บนจอใหญ่ = ซ่อน/แสดงแผงหน้า', !(await page.locator('.sk-side').isVisible()));
  await page.locator('.sk-name').click(); await wait(300);

  // ค้างปากกา: สี่เหลี่ยมเบี้ยว ๆ → รูปทรงจริง
  await page.locator('.sk-tool[data-tool="pen"]').click();
  V = await view();
  const n0 = (await cur()).shapes.length;
  const sq = [[150, 900], [450, 905], [452, 1100], [148, 1098], [151, 905]];
  await page.mouse.move(...U(...sq[0])); await page.mouse.down();
  for (let i = 1; i < sq.length; i++) await page.mouse.move(...U(...sq[i]), { steps: 10 });
  await wait(800); await page.mouse.up(); await wait(500);
  p = await cur();
  check('ปากกาวาดสี่เหลี่ยมแล้วค้าง = รูปทรงสี่เหลี่ยมที่ปรับได้', p.shapes.length === n0 + 1 && p.shapes.at(-1).k === 'rect');
  await shot('c07-final');

  // ภาพย่อในหน้ารวมวาดรูปทรง/เส้นด้วย (ไม่พัง)
  await page.locator('.sk-close').click(); await page.waitForSelector('#sk', { state: 'detached' }); await wait(500);
  check('ออกจากหน้าเขียนได้ ภาพย่อขึ้นครบ', (await page.locator('.bk-thumb canvas').count()) >= 2);

  check('ไม่มีข้อผิดพลาดในหน้า', !errors.length, errors.join(' | '));
  console.log(`\nรวม ${results.filter(Boolean).length}/${results.length} ผ่าน`);
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
