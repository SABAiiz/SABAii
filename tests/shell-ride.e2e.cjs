// ทดสอบโครงแอปแบบเรียกรถ (shell/ride/) ในเบราว์เซอร์จริง — ไม่ต้องเปิดเซิร์ฟเวอร์
//   node tests/shell-ride.e2e.cjs [โฟลเดอร์เก็บภาพ]
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const BASE = (process.env.SABAII_URL || 'http://sabaii.test/') + 'shell/ride/';
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const SHOTS = process.argv[2] || null;
let fail = 0;
const check = (name, ok, extra = '') => { if (!ok) fail++; console.log(`${ok ? 'ผ่าน' : 'ตก  '}  ${name}${extra ? '  — ' + extra : ''}`); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
  // ไม่ต้องเปิดเซิร์ฟเวอร์: ส่งไฟล์จากโฟลเดอร์ให้เบราว์เซอร์ตรง ๆ (ถ้าตั้ง SABAII_URL จะใช้เซิร์ฟเวอร์จริงแทน)
  if (!process.env.SABAII_URL) await ctx.route('http://sabaii.test/**', r => {
    let f = path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname));
    if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });
  await page.goto(BASE);
  await page.waitForSelector('.search');
  await page.waitForTimeout(600);
  const shot = async n => SHOTS && page.screenshot({ path: `${SHOTS}/ride-${n}.png` });
  const vis = () => page.evaluate(() => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sheet-vis')));

  check('หน้าแรกมีแถบ "ไปไหนดี?" + บริการ 4 ช่อง', await page.getByText('ไปไหนดี?').isVisible() && (await page.locator('.svc').count()) === 4);
  await shot('01-home');

  // ลากที่จับขึ้น → เต็มจอ · ลากลง → ต่ำสุด
  const g = await page.locator('.grab').boundingBox();
  const v0 = await vis();
  await page.mouse.move(g.x + g.width / 2, g.y + 5); await page.mouse.down();
  await page.mouse.move(g.x + g.width / 2, 40, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(400);
  check('ลากแผ่นขึ้น → เต็มจอ', await page.locator('#sheet.full').count() === 1, `${v0} → ${await vis()}`);
  const g2 = await page.locator('.grab').boundingBox();
  await page.mouse.move(g2.x + g2.width / 2, g2.y + 5); await page.mouse.down();
  await page.mouse.move(g2.x + g2.width / 2, 830, { steps: 10 }); await page.mouse.up();
  await page.waitForTimeout(400);
  check('ลากแผ่นลง → ระดับต่ำสุด', (await vis()) === 212, String(await vis()));
  await shot('02-home-low');

  // ค้นหา → กรอง → เลือก
  await page.getByRole('button', { name: 'ค้นหาปลายทาง' }).click();
  await page.waitForTimeout(400);
  await page.fill('#dest', 'สถานี');
  check('ค้นหา "สถานี" เหลือ 1 ที่', (await page.locator('.places .place b').allTextContents()).filter(t => t !== 'เลือกบนแผนที่').length === 1);
  await shot('03-search');
  await page.getByRole('button', { name: /สถานีรถไฟฟ้า/ }).click();
  await page.waitForTimeout(700);
  check('หน้าเลือกรถมี 4 แบบ + เส้นทางบนแผนที่', (await page.locator('.opt').count()) === 4 && (await page.locator('.m-route').count()) === 1);
  await page.locator('.opt').nth(1).click();
  check('เลือก "ประหยัด" → ปุ่มเปลี่ยนตาม', (await page.locator('.sfoot .btn.primary').textContent()) === 'เรียก ประหยัด');
  await shot('04-options');

  // ย้อนกลับ → หน้าแรก
  await page.getByRole('button', { name: 'ย้อนกลับ' }).click();
  await page.waitForTimeout(400);
  check('ปุ่มย้อนกลับจากเลือกรถ → หน้าแรก', await page.getByText('ไปไหนดี?').isVisible() && (await page.locator('.m-route').count()) === 0);

  // เลือกบนแผนที่
  await page.getByRole('button', { name: 'ค้นหาปลายทาง' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /เลือกบนแผนที่/ }).click();
  await page.waitForTimeout(600);
  const before = await page.locator('.sbody b').textContent();
  await page.mouse.move(200, 200); await page.mouse.down(); await page.mouse.move(60, 380, { steps: 6 }); await page.mouse.up();
  const after = await page.locator('.sbody b').textContent();
  check('เลื่อนแผนที่ → ชื่อจุดเปลี่ยน', before !== after && /^ใกล้แยก/.test(after), after);
  await shot('05-pick');
  await page.getByRole('button', { name: 'ยืนยันจุดนี้' }).click();
  await page.waitForTimeout(500);
  check('ยืนยันจุด → ไปหน้าเลือกรถ', (await page.locator('.opt').count()) === 4);

  // เรียกรถ → หาคนขับ → คนขับมา → ขึ้นรถ → ถึง → ให้คะแนน
  await page.locator('.sfoot .btn.primary').click();
  check('หาคนขับ', await page.getByText('กำลังหาคนขับใกล้คุณ').isVisible());
  await shot('06-finding');
  await page.waitForSelector('.driver', { timeout: 6000 });
  await page.waitForTimeout(1500);
  await shot('07-driver');
  await page.getByRole('button', { name: 'ขึ้นรถแล้ว (จำลอง)' }).waitFor({ timeout: 12000 });
  check('คนขับมาถึง → มีปุ่มขึ้นรถ', true);
  await page.getByRole('button', { name: 'ขึ้นรถแล้ว (จำลอง)' }).click();
  await page.waitForTimeout(1500);
  await shot('08-trip');
  await page.getByText('ถึงแล้ว!').waitFor({ timeout: 16000 });
  await page.getByRole('button', { name: '4 ดาว' }).click();
  await shot('09-rate');
  await page.getByRole('button', { name: 'เสร็จสิ้น' }).click();
  await page.waitForTimeout(500);
  check('จบเที่ยว → กลับหน้าแรก', await page.getByText('ไปไหนดี?').isVisible() && (await page.evaluate(() => window.__shell.stack.length)) === 1);

  // เมนู + ธีมมืด
  await page.getByRole('button', { name: 'เมนู' }).click();
  await page.waitForTimeout(350);
  check('เปิดลิ้นชักเมนู', await page.locator('#drawer.open').count() === 1);
  await page.getByRole('button', { name: /สลับธีม/ }).click();
  await page.waitForTimeout(200);
  await shot('10-drawer-dark');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  await shot('11-home-dark');

  check('ไม่มี error ใน console', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(fail ? `ตก ${fail} ข้อ` : 'ผ่านทั้งหมด');
  process.exit(fail ? 1 : 0);
})();
