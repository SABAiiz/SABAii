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
  const browser = await chromium.launch();
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
  await page.waitForSelector('.bk-new');
  check('ชั้น "สมุดจด" มีปุ่มสมุดใหม่', await page.locator('.bk-new').isVisible());

  // สร้างสมุด (ตั้งตามวิชาฟิสิกส์)
  await page.locator('.bk-new').click(); await wait(400);
  await page.locator('.bk-subs button', { hasText: 'ฟิสิกส์' }).click();
  await shot('01-new-book');
  await page.locator('.mfoot .btn.primary').click();
  await page.waitForSelector('#sk.in'); await wait(500);
  check('สร้างแล้วเข้าหน้าเขียนทันที · หน้า 1 / 1', (await page.locator('.sk-name small').textContent()) === 'หน้า 1 / 1');

  const box = await page.locator('.sk-paper').boundingBox();
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
  await draw([[.2, .66], [.45, .66]]);
  await page.locator('.sk-seg button[aria-label="สี่เหลี่ยม"]').click();
  await draw([[.5, .6], [.84, .74]]);
  await page.locator('.sk-seg button[aria-label="วงกลม"]').click();
  await draw([[.14, .78], [.34, .9]]);
  await page.locator('.sk-tool[data-tool="pen"]').click(); await wait(600);
  const n1 = await strokes();
  check('ปากกา/ไฮไลต์/รูปทรงได้เส้นครบ (บันทึกเองระหว่างเขียน)', n1 === 14, String(n1));
  check('ไม่ได้เลือกอะไร = ไม่มีแถบ ลบ/ทำสำเนา', !(await page.locator('.sk-selbar').isVisible()));
  await shot('02-writing');

  // ยางลบ → เลิกทำ → ทำซ้ำ
  await page.locator('.sk-tool[data-tool="eraser"]').click();
  await draw([[.5, .5], [.5, .54]]);
  await wait(600);
  const erased = await page.evaluate(() => window.__sabaii.state.pages[0].strokes.length);
  check('ยางลบ: ลากผ่านเส้นแดง → ลบทั้งเส้น', erased === n1 - 1, String(erased));
  await page.locator('.sk-ib[aria-label="เลิกทำ"]').click(); await wait(500);
  check('เลิกทำ: เส้นกลับมา', (await strokes()) === n1);

  // บ่วงเลือก → ย้าย
  await page.locator('.sk-tool[data-tool="lasso"]').click();
  await draw([[.1, .75], [.4, .75], [.4, .95], [.1, .95], [.1, .76]]);
  check('บ่วงเลือก: มีกรอบเลือก + แถบ ลบ/ทำสำเนา', await page.locator('.sk-selbox').isVisible() && await page.locator('.sk-selbar').isVisible());
  await shot('03-lasso');
  const before = await page.evaluate(() => window.__sabaii.state.pages[0].strokes.at(-1).p[0]);
  await draw([[.24, .84], [.5, .84]]); await wait(600);
  const after = await page.evaluate(() => window.__sabaii.state.pages[0].strokes.at(-1).p[0]);
  check('ลากในกรอบ = ย้ายวงกลม', after - before > 200, `${before} → ${after}`);
  await page.locator('.sk-tool[data-tool="pen"]').click();

  // พลิกไปหน้าใหม่
  await page.locator('.sk-turn.add').click(); await wait(250);
  await shot('04-flip');
  await wait(500);
  check('ปุ่ม + = เพิ่มหน้าใหม่ แล้วพลิกไป · หน้า 2 / 2', (await page.locator('.sk-name small').textContent()) === 'หน้า 2 / 2');
  await page.locator('.sk-tool[data-tool="text"]').click();
  await page.mouse.click(...P(.16, .08)); await wait(150);
  await page.keyboard.type('แบบฝึกหัด 4.1');
  await page.locator('.sk-tool[data-tool="pen"]').click();
  await page.locator('.sk-colors button').nth(0).click();
  for (const y of [.2, .26, .32, .38]) await draw(wave(y, .16, .7 + y / 4, .008));
  await page.locator('.sk-ib[aria-label="ตั้งค่าหน้า"]').click(); await wait(250);
  await shot('05-menu');
  await page.locator('.sk-papers button', { hasText: 'ตาราง' }).click(); await wait(200);
  await page.locator('.sk-turn.add').click(); await wait(800);
  await page.locator('.sk-tool[data-tool="hl"]').click();
  await draw([[.2, .3], [.7, .3]]);
  await page.locator('.sk-ib[aria-label="หน้าก่อน"], .sk-turn[aria-label="หน้าก่อน"]').first().click(); await wait(800);
  check('ปุ่ม ‹ = หน้าก่อน', (await page.locator('.sk-name small').textContent()) === 'หน้า 2 / 3');

  // ออก → เห็นทุกหน้า
  await page.locator('.sk-close').click(); await wait(250);
  await shot('06-closing');
  await page.waitForSelector('#sk', { state: 'detached' }); await wait(300);
  check('ออกแล้วเห็นทุกหน้า (3 หน้า + ปุ่มหน้าใหม่)', (await page.locator('.bk-thumb[data-id]').count()) === 3 && await page.locator('.bk-add').isVisible() && await page.evaluate(() => location.hash.startsWith('#/book/')));
  check('หน้าล่าสุดมีกรอบเข้ม (หน้า 2)', (await page.locator('.bk-thumb.last span').textContent()) === '2');
  await shot('07-overview');

  // แตะภาพย่อ = เปิดหน้านั้น · ปุ่มย้อนกลับของเครื่อง = ออก
  await page.locator('.bk-thumb[data-id]').nth(0).click(); await page.waitForSelector('#sk.in'); await wait(500);
  check('แตะภาพย่อหน้า 1 → เปิดหน้า 1', (await page.locator('.sk-name small').textContent()) === 'หน้า 1 / 3');
  await page.goBack(); await page.waitForSelector('#sk', { state: 'detached' }); await wait(200);
  check('ปุ่มย้อนกลับของเครื่อง = ออกจากหน้าเขียน กลับไปทุกหน้า', await page.evaluate(() => location.hash.startsWith('#/book/')));

  // ชั้นสมุด + ค้นข้อความในสมุด
  await page.locator('.bk-head .iconbtn').first().click(); await page.waitForSelector('.bk-cover'); await wait(300);
  await page.locator('.bk-new').click(); await wait(300);
  await page.locator('.bk-in').fill('ศัพท์อังกฤษ'); await page.locator('.bk-colors button').nth(4).click();
  await page.locator('.mfoot .btn.primary').click(); await page.waitForSelector('#sk.in'); await wait(400);
  await page.locator('.sk-tool[data-tool="pen"]').click();
  const box2 = await page.locator('.sk-paper').boundingBox();
  await page.mouse.move(box2.x + 60, box2.y + 90); await page.mouse.down(); for (let i = 0; i < 20; i++) await page.mouse.move(box2.x + 60 + i * 10, box2.y + 90 + Math.sin(i) * 8); await page.mouse.up();
  await page.locator('.sk-close').click(); await page.waitForSelector('#sk', { state: 'detached' }); await wait(300);
  await page.locator('#nav a[data-r="notebook"]').click(); await page.waitForSelector('.bk-cover'); await wait(300);
  check('ชั้นสมุดมี 2 เล่ม', (await page.locator('.bk-cover').count()) === 2);
  await shot('08-shelf');
  await page.locator('#nb-q').fill('นิวตัน');
  check('ค้นในสมุดเจอข้อความที่พิมพ์ในหน้า', (await page.locator('.nb-hit', { hasText: 'หน้า 1' }).count()) === 1);
  await page.locator('#nb-q').fill('');  await page.locator('#nb-q').dispatchEvent('input');

  // เปิดใหม่ข้อมูลยังอยู่
  await page.reload(); await page.waitForSelector('.bk-cover'); await wait(300);
  const kept = await page.evaluate(() => ({ b: window.__sabaii.state.books.length, p: window.__sabaii.state.pages.length, t: window.__sabaii.state.pages.flatMap(p => p.texts).map(t => t.v) }));
  check('เปิดแอปใหม่: สมุด/หน้า/ข้อความยังอยู่', kept.b === 2 && kept.p === 4 && kept.t.includes('กฎของนิวตัน'), JSON.stringify(kept));

  check('ไม่มีข้อผิดพลาดในหน้า', !errors.length, errors.join(' | '));
  console.log(`\nรวม ${results.filter(Boolean).length}/${results.length} ผ่าน`);
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
