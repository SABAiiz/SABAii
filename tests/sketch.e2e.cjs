// 0.10 สมุดจด ในเบราว์เซอร์จริง — สร้างสมุด · เขียน/ไฮไลต์/รูปทรง/ข้อความ · ยางลบ · เลิกทำ · บ่วงย้าย · พลิกหน้า · ออกแล้วเห็นทุกหน้า · เปิดใหม่ข้อมูลยังอยู่
//   node tests/sketch.e2e.cjs [โฟลเดอร์เก็บภาพ]
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'th-TH', timezoneId: 'Asia/Bangkok', serviceWorkers: 'block', hasTouch: false });
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
  const shot = async n => { if (!SHOTS) return; await wait(450); await page.screenshot({ path: `${SHOTS}/${n}.png` }); };
  await page.goto('http://sabaii.test/#/notebook');
  await page.waitForSelector('#ob-skip'); await page.locator('#ob-skip').click(); await wait(400);
  await page.waitForSelector('.nb-add');
  check('0.11 หน้าสมุด: การ์ดวิชา + ปุ่ม "เพิ่ม วิชา/โปรเจกต์" + ชวนเริ่มโปรเจกต์แรก', await page.locator('.nb-add').isVisible() && (await page.locator('.nb-card').count()) >= 8 && await page.locator('.nb-proj.empty').isVisible());
  check('0.11 วิชาที่ยังไม่มีสมุด = "แตะเพื่อเริ่มจด"', (await page.locator('.nb-card', { hasText: 'ฟิสิกส์' }).textContent()).includes('แตะเพื่อเริ่มจด'));

  // สมุดของวิชาฟิสิกส์ (แบบเริ่มเขียนเลย ไม่มีหน้าปก)
  await page.locator('.nb-add').click(); await wait(400);
  await page.locator('.nb-seg button', { hasText: 'วิชาใหม่' }).click();
  await page.locator('.bk-in').fill('ฟิสิกส์');
  await page.locator('.nb-firsts button', { hasText: 'เริ่มเขียนเลย' }).click();
  await shot('01-new-book');
  await page.locator('.mfoot .btn.primary').click();
  await page.waitForSelector('#sk.in'); await wait(500);
  check('0.11 "วิชาใหม่" ชื่อซ้ำวิชาเดิม = ใช้วิชาเดิม (ไม่มีวิชาซ้ำ) · ปิดแล้วกลับหน้าวิชา', await page.evaluate(() => window.__sabaii.state.subjects.filter(s => s.name === 'ฟิสิกส์').length === 1 && location.hash.startsWith('#/subject/')));
  check('สร้างแล้วเข้าหน้าเขียนทันที · หน้า 1 / 1', (await page.locator('.sk-name b').textContent()) === '1 / 1');
  const full = await page.evaluate(() => { const r = document.querySelector('.sk-stage').getBoundingClientRect(); return [r.width, r.height, innerWidth, innerHeight]; });
  check('กระดาษเต็มจอ ขอบชนขอบ', full[0] === full[2] && full[1] === full[3], full.join(','));

  const box = await page.locator('.sk-stage').boundingBox();
  const P = (x, y) => [box.x + box.width * x, box.y + box.height * y];
  async function draw(pts) {
    await page.mouse.move(...P(...pts[0])); await page.mouse.down();
    for (const p of pts.slice(1)) await page.mouse.move(...P(...p), { steps: 4 });
    await page.mouse.up(); await wait(60);
  }
  const strokes = () => page.evaluate(() => window.__sabaii.state.pages[0]?.strokes.length);
  // ข้อความหัวเรื่อง
  await page.locator('.sk-tool[data-tool="text"]').click();
  await page.locator('.sk-sizes button').nth(2).click();
  await page.mouse.click(...P(.16, .08)); await wait(150);
  await page.keyboard.type('กฎของนิวตัน');
  await page.locator('.sk-tool[data-tool="pen"]').click(); await wait(100);
  // ลายมือ: สูตร F = ma (เขียนเป็นเส้น)
  const wave = (y0, x0, x1, amp = .012) => Array.from({ length: 24 }, (_, i) => [x0 + (x1 - x0) * i / 23, y0 + Math.sin(i * 1.3) * amp]);
  await draw([[.18, .2], [.18, .27]]); await draw([[.18, .2], [.25, .2]]); await draw([[.18, .235], [.23, .235]]); // F
  await draw([[.3, .23], [.36, .23]]); await draw([[.3, .245], [.36, .245]]); // =
  await draw(wave(.24, .42, .62, .018)); // ma (ลายมือหยัก ๆ)
  await page.locator('.sk-colors button').nth(2).click(); // ฟ้า
  for (const y of [.34, .4, .46]) await draw(wave(y, .16, .84, .006));
  await page.locator('.sk-colors button').nth(3).click(); // แดง
  await draw(wave(.52, .16, .6, .006));
  // ไฮไลต์
  await page.locator('.sk-tool[data-tool="hl"]').click();
  await draw([[.4, .24], [.64, .24]]);
  // รูปทรง: ลูกศร + กรอบ
  await page.locator('.sk-tool[data-tool="shape"]').click();
  await page.locator('.sk-seg button[aria-label="ลูกศร"]').click();
  await draw([[.2, .58], [.45, .58]]);
  await page.locator('.sk-seg button[aria-label="สี่เหลี่ยม"]').click();
  await draw([[.5, .54], [.84, .64]]);
  await page.locator('.sk-seg button[aria-label="วงกลม"]').click();
  await draw([[.14, .68], [.34, .78]]);
  await page.locator('.sk-tool[data-tool="pen"]').click(); await wait(600);
  const n1 = await strokes();
  check('ปากกา/ไฮไลต์/รูปทรงได้เส้นครบ (บันทึกเองระหว่างเขียน)', n1 === 14, String(n1));
  check('ไม่ได้เลือกอะไร = ไม่มีแถบ ลบ/ทำสำเนา', !(await page.locator('.sk-selbar').isVisible()));
  await shot('02-writing');

  // ยางลบ → เลิกทำ → ทำซ้ำ
  await page.locator('.sk-tool[data-tool="eraser"]').click();
  await draw([[.3, .5], [.3, .54]]);
  await wait(600);
  const erased = await page.evaluate(() => window.__sabaii.state.pages[0].strokes.length);
  check('ยางลบ: ลากผ่านเส้นแดง → ลบทั้งเส้น', erased === n1 - 1, String(erased));
  await page.locator('.sk-ib[aria-label="เลิกทำ"]').click(); await wait(500);
  check('เลิกทำ: เส้นกลับมา', (await strokes()) === n1);

  // บ่วงเลือก → ย้าย
  await page.locator('.sk-tool[data-tool="lasso"]').click();
  await draw([[.08, .66], [.42, .66], [.42, .8], [.08, .8], [.08, .67]]);
  check('บ่วงเลือก: มีกรอบเลือก + แถบ ลบ/ทำสำเนา', await page.locator('.sk-selbox').isVisible() && await page.locator('.sk-selbar').isVisible());
  await shot('03-lasso');
  const before = await page.evaluate(() => window.__sabaii.state.pages[0].strokes.at(-1).p[0]);
  await draw([[.24, .73], [.5, .73]]); await wait(600);
  const after = await page.evaluate(() => window.__sabaii.state.pages[0].strokes.at(-1).p[0]);
  check('ลากในกรอบ = ย้ายวงกลม', after - before > 200, `${before} → ${after}`);
  await page.locator('.sk-tool[data-tool="pen"]').click();

  // เลื่อนลง (ล้อเมาส์) · เขียนใกล้ท้ายหน้า → หน้ายาวขึ้นเอง
  const vyOf = () => page.evaluate(() => Number(document.querySelector('.sk-layer').style.transform.match(/-?[\d.]+/g)[1]));
  await page.mouse.move(...P(.5, .5)); await page.mouse.wheel(0, 3000); await wait(300);
  const vyEnd = await vyOf();
  check('ล้อเมาส์ = เลื่อนหน้าลง', vyEnd < -50, String(vyEnd));
  const h0 = await page.evaluate(() => window.__sabaii.state.pages[0].h || 1414);
  await page.locator('.sk-tool[data-tool="pen"]').click();
  await draw(wave(.7, .16, .7, .006)); await wait(600);
  const h1 = await page.evaluate(() => window.__sabaii.state.pages[0].h || 0);
  check('เขียนใกล้ท้ายหน้า → หน้ายาวขึ้นเอง เลื่อนต่อได้', h1 > h0 + 500, `${h0} → ${h1}`);
  await page.mouse.wheel(0, 3000); await wait(300);
  check('หน้ายาวขึ้นแล้วเลื่อนลงได้อีก', (await vyOf()) < vyEnd - 100);
  await shot('03b-long-page');
  await page.mouse.wheel(0, -20000); await wait(300);
  check('เลื่อนกลับบนสุดได้', (await vyOf()) === 0);

  // พลิกไปหน้าใหม่
  await page.locator('.sk-pg.add').click(); await wait(250);
  await shot('04-flip');
  await wait(500);
  check('ปุ่ม + = เพิ่มหน้าใหม่ แล้วพลิกไป · หน้า 2 / 2', (await page.locator('.sk-name b').textContent()) === '2 / 2');
  await page.locator('.sk-tool[data-tool="text"]').click();
  await page.mouse.click(...P(.16, .08)); await wait(150);
  await page.keyboard.type('แบบฝึกหัด 4.1');
  await page.locator('.sk-tool[data-tool="pen"]').click();
  await page.locator('.sk-colors button').nth(0).click();
  for (const y of [.2, .26, .32, .38]) await draw(wave(y, .16, .7 + y / 4, .008));
  await page.locator('.sk-ib[aria-label="ตั้งค่าหน้า"]').click(); await wait(250);
  await shot('05-menu');
  await page.locator('.sk-papers button', { hasText: 'ตาราง' }).click(); await wait(200);
  await page.locator('.sk-pg.add').click(); await wait(800);
  await page.locator('.sk-tool[data-tool="hl"]').click();
  await draw([[.2, .3], [.7, .3]]);
  await page.locator('.sk-ib[aria-label="หน้าก่อน"], .sk-pg[aria-label="หน้าก่อน"]').first().click(); await wait(800);
  check('ปุ่ม ‹ = หน้าก่อน', (await page.locator('.sk-name b').textContent()) === '2 / 3');

  // ออก → เห็นทุกหน้า
  await page.locator('.sk-close').click(); await wait(250);
  await shot('06-closing');
  await page.waitForSelector('#sk', { state: 'detached' }); await wait(300);
  check('ออกแล้วเห็นทุกหน้าในหน้าวิชา แท็บโน้ต (3 หน้า + ปุ่มหน้าใหม่)', (await page.locator('.bk-thumb[data-id]').count()) === 3 && await page.locator('.bk-add').isVisible() && await page.evaluate(() => location.hash.startsWith('#/subject/')) && (await page.locator('.sv-tabs [aria-selected="true"]').textContent()).startsWith('โน้ต'));
  check('หน้าล่าสุดมีกรอบเข้ม (หน้า 2) · ใต้ภาพย่อมีหัวข้อหน้า', (await page.locator('.bk-thumb.last span b').textContent()) === '2' && (await page.locator('.bk-thumb[data-id] small').first().textContent()) === 'กฎของนิวตัน');
  await shot('07-overview');

  // แตะภาพย่อ = เปิดหน้านั้น · ปุ่มย้อนกลับของเครื่อง = ออก
  await page.locator('.bk-thumb[data-id]').nth(0).click(); await page.waitForSelector('#sk.in'); await wait(500);
  check('แตะภาพย่อหน้า 1 → เปิดหน้า 1', (await page.locator('.sk-name b').textContent()) === '1 / 3');
  await page.goBack(); await page.waitForSelector('#sk', { state: 'detached' }); await wait(200);
  check('ปุ่มย้อนกลับของเครื่อง = ออกจากหน้าเขียน กลับไปหน้าวิชา', await page.evaluate(() => location.hash.startsWith('#/subject/')));
  await page.locator('.sv-tabs button', { hasText: 'งาน' }).click(); await wait(200);
  check('0.11 หน้าวิชา: แท็บงาน = งานของวิชา (ของเดิม)', await page.locator('#page .board').isVisible());
  await page.locator('.sv-tabs button', { hasText: 'โน้ต' }).click(); await wait(200);

  // โปรเจกต์ใหม่ (หน้าปก + สารบัญ) → เปิดมาที่หน้าปก
  await page.locator('#page .phead .iconbtn').first().click(); await page.waitForSelector('.nb-add'); await wait(300);
  await page.locator('.nb-add').click(); await wait(300);
  await page.locator('.bk-in').fill('ศัพท์อังกฤษ'); await page.locator('.bk-colors button').nth(4).click();
  await page.locator('.mfoot .btn.primary').click(); await page.waitForSelector('#sk.in'); await wait(600);
  check('0.11 โปรเจกต์ใหม่เปิดมาที่หน้าปก (1 / 2) · สารบัญมี 1 แถว', (await page.locator('.sk-name b').textContent()) === '1 / 2' && (await page.locator('.sk-toc a').count()) === 1);
  await shot('08a-cover');
  await page.locator('.sk-toc a').first().click(); await wait(800);
  check('0.11 แตะแถวสารบัญ = พลิกไปหน้านั้น', (await page.locator('.sk-name b').textContent()) === '2 / 2');
  await page.locator('.sk-tool[data-tool="text"]').click();
  const box2 = await page.locator('.sk-stage').boundingBox();
  await page.mouse.click(box2.x + 70, box2.y + 110); await wait(150); await page.keyboard.type('Unit 5 คำศัพท์');
  await page.locator('.sk-tool[data-tool="pen"]').click();
  await page.mouse.move(box2.x + 60, box2.y + 200); await page.mouse.down(); for (let i = 0; i < 20; i++) await page.mouse.move(box2.x + 60 + i * 10, box2.y + 200 + Math.sin(i) * 8); await page.mouse.up();
  await page.locator('.sk-pg[aria-label="หน้าก่อน"]').click(); await wait(800);
  check('0.11 สารบัญอัปเดตเอง: หัวข้อที่พิมพ์ขึ้นในหน้าปก', /Unit 5/.test(await page.locator('.sk-toc a').first().getAttribute('aria-label')));
  await shot('08b-cover-toc');
  await page.locator('.sk-close').click(); await page.waitForSelector('#sk', { state: 'detached' }); await wait(300);
  check('0.11 ปิดโปรเจกต์ → หน้าโปรเจกต์ (ทุกหน้า)', await page.evaluate(() => location.hash.startsWith('#/book/')) && (await page.locator('.bk-thumb[data-id]').count()) === 2);
  await page.locator('#nav a[data-r="notebook"]').click(); await page.waitForSelector('.nb-proj'); await wait(300);
  check('0.11 หน้าสมุด: โปรเจกต์ 1 เล่ม · การ์ดฟิสิกส์มีหน้าโน้ตจริงซ้อนโผล่', (await page.locator('.nb-proj:not(.empty)').count()) === 1 && (await page.locator('.nb-card', { hasText: 'ฟิสิกส์' }).locator('.nb-peek canvas').count()) === 2);
  await shot('08-shelf');
  await page.locator('#nb-q').fill('นิวตัน');
  check('ค้นในสมุดเจอข้อความที่พิมพ์ในหน้า', (await page.locator('.nb-hit', { hasText: 'หน้า 1' }).count()) === 1);
  await page.locator('#nb-q').fill('');  await page.locator('#nb-q').dispatchEvent('input');

  // เปิดใหม่ข้อมูลยังอยู่
  await page.reload(); await page.waitForSelector('.nb-proj'); await wait(300);
  const kept = await page.evaluate(() => ({ b: window.__sabaii.state.books.length, p: window.__sabaii.state.pages.length, t: window.__sabaii.state.pages.flatMap(p => p.texts).map(t => t.v) }));
  check('เปิดแอปใหม่: สมุด/หน้า/ข้อความยังอยู่', kept.b === 2 && kept.p === 5 && kept.t.includes('กฎของนิวตัน'), JSON.stringify(kept));

  // ---------- 0.10.1 ยกระดับ ----------
  await page.locator('.nb-card', { hasText: 'ฟิสิกส์' }).click(); await page.waitForSelector('.bk-go'); await wait(300);
  await shot('09-subject');
  await page.locator('.bk-go').click(); await page.waitForSelector('#sk.in'); await wait(800);
  check('แตะการ์ดวิชา → หน้าวิชา → "เขียนต่อ" เปิดหน้าล่าสุด', await page.locator('#sk').isVisible() && (await page.locator('.sk-name b').textContent()) === '1 / 3');
  const cur = () => page.evaluate(() => { const b = window.__sabaii.state.books.find(x => x.title === 'ฟิสิกส์'); return window.__sabaii.state.pages.find(p => p.id === b.last_page); });
  const bx = await page.locator('.sk-stage').boundingBox();
  const Q = (x, y) => [bx.x + bx.width * x, bx.y + bx.height * y];
  await page.locator('.sk-name').click(); await wait(300);
  check('แตะ "หน้า x / y" = แถบภาพย่อทุกหน้า', await page.locator('.sk-strip').isVisible() && (await page.locator('.sk-film canvas').count()) === 3);
  await page.locator('.sk-film').nth(2).click(); await wait(800);
  check('แตะภาพย่อในแถบ = ไปหน้านั้น', (await page.locator('.sk-name b').textContent()) === '3 / 3' && !(await page.locator('.sk-strip').isVisible()));
  // ค้างไว้ = รูปทรงเป๊ะ
  await page.locator('.sk-tool[data-tool="pen"]').click();
  await page.mouse.move(...Q(.5 + .25, .5)); await page.mouse.down();
  for (let i = 1; i <= 40; i++) { const a = i / 40 * Math.PI * 2; await page.mouse.move(...Q(.5 + .25 * Math.cos(a) + Math.sin(i * 1.7) * .006, .5 + .16 * Math.sin(a) + Math.cos(i * 2.1) * .004)); }
  await wait(800); await page.mouse.up(); await wait(600);
  const snapped = (await cur()).strokes.at(-1);
  check('วาดวงกลมเบี้ยว ๆ แล้วค้างไว้ → วงกลมเป๊ะ', snapped?.sh === 1 && snapped.p.length === 147, snapped ? `sh=${snapped.sh} n=${snapped.p.length / 3}` : 'ไม่มีเส้น');
  await page.mouse.move(...Q(.2, .2)); await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(...Q(.2 + i * .02, .2 + Math.sin(i) * .01));
  await page.mouse.up(); await wait(600);
  const free = (await cur()).strokes.at(-1);
  check('เขียนปกติ (ไม่ค้าง) = ลายมือเดิม มีหนา-บางตามความเร็ว', !free.sh && new Set(free.p.filter((v, i) => i % 3 === 2)).size > 2);
  // ซูม (ctrl + ล้อเมาส์ = ถ่างนิ้วบนทัชแพด)
  await page.mouse.move(...Q(.4, .3));
  await page.keyboard.down('Control'); await page.mouse.wheel(0, -120); await page.keyboard.up('Control'); await wait(400);
  const zl = await page.locator('.sk-zoom').textContent().catch(() => '');
  check('ซูมเข้าได้ · มีปุ่มบอก % และกลับขนาดเดิม', await page.locator('.sk-zoom').isVisible() && /\d+%/.test(zl) && parseInt(zl) > 150, zl);
  await page.locator('.sk-tool[data-tool="pen"]').click();
  const zx = await page.locator('.sk-stage').boundingBox();
  const n0 = (await cur()).strokes.length;
  const [vx, vy, vs] = await page.evaluate(() => document.querySelector('.sk-layer').style.transform.match(/-?[\d.]+/g).map(Number));
  await page.mouse.move(zx.x + 200, zx.y + 400); await page.mouse.down(); await page.mouse.move(zx.x + 260, zx.y + 420, { steps: 6 }); await page.mouse.up(); await wait(600);
  const zs = (await cur()).strokes.at(-1);
  check('ตอนซูม เขียนตรงตำแหน่งนิ้ว', (await cur()).strokes.length === n0 + 1 && Math.abs(zs.p[0] - (200 - vx) / vs) < 3 && Math.abs(zs.p[1] - (400 - vy) / vs) < 3, `${zs.p[0]},${zs.p[1]} · ${vx},${vy},${vs}`);
  await shot('10-zoom');
  await page.locator('.sk-zoom').click(); await wait(400);
  check('แตะปุ่ม % = กลับ 100%', !(await page.locator('.sk-zoom').isVisible()));
  // ทำสำเนาหน้า · กระดานดำใช้สีชอล์ก
  await page.locator('.sk-ib[aria-label="ตั้งค่าหน้า"]').click(); await wait(200);
  await page.locator('.sk-mi', { hasText: 'ทำสำเนาหน้านี้' }).click(); await wait(900);
  check('ทำสำเนาหน้า → หน้า 4 / 4 มีเส้นครบเท่าหน้าเดิม', (await page.locator('.sk-name b').textContent()) === '4 / 4' && (await cur()).strokes.length >= n0 + 1);
  await page.locator('.sk-ib[aria-label="ตั้งค่าหน้า"]').click(); await wait(200);
  await page.locator('.sk-menu .sk-papers button', { hasText: 'กระดานดำ' }).click(); await wait(300);
  await page.locator('.sk-tool[data-tool="pen"]').click();
  check('กระดานดำ: จานสีเป็นชอล์ก (ขาวเป็นสีแรก)', await page.locator('.sk.dark-paper').count() === 1 && (await page.locator('.sk-colors button').first().getAttribute('aria-label')) === 'สี #FFFFFF');
  await page.locator('.sk-colors button').nth(1).click();
  await page.mouse.move(...Q(.18, .12)); await page.mouse.down();
  for (let i = 1; i <= 24; i++) await page.mouse.move(...Q(.18 + i * .025, .12 + Math.sin(i * .9) * .015)); await page.mouse.up(); await wait(600);
  check('เขียนบนกระดานดำได้ด้วยชอล์กเหลือง', (await cur()).strokes.at(-1).c === '#FFE066');
  await shot('11-board');
  await page.locator('.sk-ib[aria-label="ตั้งค่าหน้า"]').click(); await wait(250);
  await shot('12-papers');
  await page.keyboard.press('Escape'); await wait(100);
  await page.locator('.sk-close').click(); await page.waitForSelector('#sk', { state: 'detached' }); await wait(400);
  await shot('13-overview2');

  // วิชาที่ยังไม่มีสมุด → "เริ่มจด" ได้หน้าปก
  await page.locator('#nav a[data-r="notebook"]').click(); await page.waitForSelector('.nb-card'); await wait(200);
  await page.locator('.nb-card', { hasText: 'เคมี' }).click(); await page.waitForSelector('.sv-empty'); await wait(200);
  await shot('14-empty-subject');
  await page.locator('.sv-empty .btn').click(); await page.waitForSelector('#sk.in'); await wait(700);
  check('0.11 วิชาว่าง → "เริ่มจด" = สมุดวิชาพร้อมหน้าปก เปิดที่หน้าปก', (await page.locator('.sk-name b').textContent()) === '1 / 2' && await page.evaluate(() => window.__sabaii.state.pages.some(p => p.cover && window.__sabaii.state.books.find(b => b.id === p.book_id)?.title === 'เคมี')));
  await page.locator('.sk-close').click(); await page.waitForSelector('#sk', { state: 'detached' }); await wait(300);

  // 0.11.1 หน้าในสมุด → โน้ตของงาน (หน้าหลัก ดึงลง)
  await page.evaluate(() => window.__sabaii.addSamples()); await wait(300);
  await page.evaluate(() => { location.hash = '#/home'; }); await wait(400);
  const [t1, t2] = await page.evaluate(() => window.__ui.homeState().pages.slice(0, 2));
  const t1title = await page.evaluate(id => window.__sabaii.state.tasks.find(t => t.id === id).title, t1);
  await page.evaluate(id => window.__ui.openNotes(id), t1); await wait(800);
  check('0.11.1 โน้ตหน้างานมีปุ่ม "สมุด" (4 ปุ่มแถวเดียว)', (await page.locator('#pane-note .pill').count()) === 4 && await page.locator('#pane-note .pill', { hasText: 'สมุด' }).isVisible());
  await page.locator('#pane-note .pill', { hasText: 'สมุด' }).click(); await wait(400);
  await page.locator('.modal .pill', { hasText: 'เขียนหน้าใหม่' }).click(); await page.waitForSelector('#sk.in'); await wait(700);
  const newPg = await page.evaluate(() => window.__sabaii.state.attachments.find(a => a.kind === 'page'));
  check('0.11.1 "เขียนหน้าใหม่" = หน้าใหม่ในสมุดวิชา หัวข้อ = ชื่องาน · ผูกกับงานแล้ว', !!newPg && newPg.task_id === t1 && await page.evaluate(([pid, tt]) => window.__sabaii.state.pages.find(p => p.id === pid).texts[0].v === tt, [newPg.page_id, t1title]));
  const sb = await page.locator('.sk-stage').boundingBox();
  await page.locator('.sk-tool[data-tool="pen"]').click();
  await page.mouse.move(sb.x + 60, sb.y + 300); await page.mouse.down(); for (let i = 0; i < 20; i++) await page.mouse.move(sb.x + 60 + i * 12, sb.y + 300 + Math.sin(i) * 8); await page.mouse.up();
  await page.locator('.sk-close').click(); await page.waitForSelector('#sk', { state: 'detached' }); await wait(600);
  check('0.11.1 ปิดแล้วอยู่ที่โน้ตหน้างานเดิม · มีการ์ดหน้าสมุด', await page.evaluate(() => location.hash === '#/home' && window.__ui.homeState().noteMode) && (await page.locator('#stage .npage').first().locator('.nitem.page').count()) === 1);
  await shot('15-task-page');
  await page.evaluate(() => window.__ui.goPage(1)); await wait(700);
  await page.locator('#pane-note .pill', { hasText: 'สมุด' }).click(); await wait(400);
  await page.locator('.modal .pill', { hasText: 'เลือกหน้าที่มีอยู่' }).click(); await page.waitForSelector('.pk-page'); await wait(300);
  await page.locator('.pk-page:not(.on)').first().click(); await wait(600);
  check('0.11.1 "เลือกหน้าที่มีอยู่" = ผูกหน้าเดิมกับงานที่ 2', await page.evaluate(id => window.__sabaii.state.attachments.some(a => a.task_id === id && a.kind === 'page'), t2));
  await page.locator('#stage .npage').first().locator('.nitem.page .zoom').click(); await page.waitForSelector('#sk.in'); await wait(600);
  check('0.11.1 แตะการ์ดหน้าสมุด = เปิดเขียนต่อหน้านั้น', await page.locator('#sk').isVisible());
  await page.locator('.sk-ib[aria-label="ตั้งค่าหน้า"]').click(); await wait(200);
  await page.locator('.sk-mi', { hasText: 'ส่งไปโน้ตของงาน' }).click(); await wait(200);
  await shot('16-send-to-task');
  const nTask = await page.locator('.sk-task').count();
  await page.locator('.sk-task:not(:has(em))').first().click(); await wait(500);
  check('0.11.1 เมนู ⋯ "ส่งไปโน้ตของงาน" = ผูกหน้านี้กับงานอื่น', nTask >= 2 && await page.evaluate(pid => window.__sabaii.state.attachments.filter(a => a.kind === 'page' && a.page_id === pid).length >= 2, newPg.page_id));
  await page.locator('.sk-close').click(); await page.waitForSelector('#sk', { state: 'detached' }); await wait(300);
  await page.locator('#note-back').click(); await wait(300);

  // ---------- นิ้วจริง (CDP): นิ้วเดียวเขียน · ถ่างสองนิ้ว = ซูม · ปัดสองนิ้ว = พลิกหน้า ----------
  const tctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  await tctx.route('http://sabaii.test/**', r => {
    let f = path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname)); if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  const tp = await tctx.newPage();
  tp.on('pageerror', e => errors.push('นิ้ว: ' + e.message));
  await tp.goto('http://sabaii.test/#/notebook'); await tp.locator('#ob-skip').tap(); await wait(400);
  await tp.locator('.nb-add').tap(); await wait(400); await tp.locator('.bk-in').fill('นิ้ว'); await tp.locator('.nb-firsts button', { hasText: 'เริ่มเขียนเลย' }).tap(); await tp.locator('.mfoot .btn.primary').tap();
  await tp.waitForSelector('#sk.in'); await wait(600);
  const cdp = await tctx.newCDPSession(tp);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  const tb = await tp.locator('.sk-stage').boundingBox(), cx = tb.x + tb.width / 2, cy = tb.y + tb.height / 2;
  await touch('touchStart', [[cx - 80, cy]]); for (let i = 1; i <= 12; i++) await touch('touchMove', [[cx - 80 + i * 12, cy + Math.sin(i) * 10]]); await touch('touchEnd', []); await wait(600);
  const tStrokes = () => tp.evaluate(() => window.__sabaii.state.pages[0].strokes.length);
  check('นิ้ว: นิ้วเดียว = เขียน', (await tStrokes()) === 1);
  await touch('touchStart', [[cx - 30, cy], [cx + 30, cy]]);
  for (let i = 1; i <= 10; i++) await touch('touchMove', [[cx - 30 - i * 9, cy - i * 3], [cx + 30 + i * 9, cy + i * 3]]);
  await touch('touchEnd', []); await wait(400);
  const tz = await tp.locator('.sk-zoom').textContent().catch(() => '');
  check('นิ้ว: ถ่างสองนิ้ว = ซูม (ไม่เกิดเส้นเพิ่ม)', await tp.locator('.sk-zoom').isVisible() && parseInt(tz) > 200 && (await tStrokes()) === 1, tz);
  await tp.locator('.sk-zoom').tap(); await wait(400);
  await touch('touchStart', [[cx + 60, cy - 20], [cx + 60, cy + 20]]);
  for (let i = 1; i <= 10; i++) await touch('touchMove', [[cx + 60 - i * 14, cy - 20], [cx + 60 - i * 14, cy + 20]]);
  await touch('touchEnd', []); await wait(900);
  check('นิ้ว: ปัดสองนิ้วไปซ้ายที่หน้าสุดท้าย = หน้าใหม่ พลิกไป', (await tp.locator('.sk-name b').textContent()) === '2 / 2' && (await tStrokes()) === 1);
  await tctx.close();

  check('ไม่มีข้อผิดพลาดในหน้า', !errors.length, errors.join(' | '));
  console.log(`\nรวม ${results.filter(Boolean).length}/${results.length} ผ่าน`);
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
